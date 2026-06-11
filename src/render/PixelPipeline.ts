import * as THREE from 'three';

// Renders the scene into a low-res target, then upscales through a post
// shader that quantizes to a palette with ordered dithering, plus scanline
// and glitch passes. The internal resolution is the look — don't raise it.
// Default 1080; override with ?res=540 etc. for weaker GPUs / testing.
const INTERNAL_HEIGHT = (() => {
  if (typeof location === 'undefined') return 1080; // node (tests)
  const q = new URLSearchParams(location.search).get('res');
  const n = q ? parseInt(q, 10) : NaN;
  return Number.isFinite(n) && n >= 120 ? n : 1080;
})();

const POST_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tScene;
  uniform vec2 uResolution;   // internal (low) resolution
  uniform float uTime;
  uniform float uGlitch;      // 0..1 transient glitch intensity

  // 4x4 Bayer matrix, normalized
  float bayer(vec2 p) {
    int x = int(mod(p.x, 4.0));
    int y = int(mod(p.y, 4.0));
    int i = y * 4 + x;
    float m[16];
    m[0]=0.0;  m[1]=8.0;  m[2]=2.0;  m[3]=10.0;
    m[4]=12.0; m[5]=4.0;  m[6]=14.0; m[7]=6.0;
    m[8]=3.0;  m[9]=11.0; m[10]=1.0; m[11]=9.0;
    m[12]=15.0;m[13]=7.0; m[14]=13.0;m[15]=5.0;
    for (int k = 0; k < 16; k++) { if (k == i) return m[k] / 16.0 - 0.5; }
    return 0.0;
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;

    // glitch: horizontal band displacement + channel split
    if (uGlitch > 0.001) {
      float band = floor(uv.y * uResolution.y / 8.0);
      float jump = hash(vec2(band, floor(uTime * 24.0)));
      if (jump > 1.0 - uGlitch * 0.6) {
        uv.x = fract(uv.x + (jump - 0.5) * 0.2 * uGlitch);
      }
    }

    vec3 col = texture2D(tScene, uv).rgb;
    if (uGlitch > 0.001) {
      float off = uGlitch * 2.0 / uResolution.x;
      col.r = texture2D(tScene, uv + vec2(off, 0.0)).r;
      col.b = texture2D(tScene, uv - vec2(off, 0.0)).b;
    }

    // the scene target holds linear values; lift exposure, encode to sRGB
    col = pow(col * 1.25, vec3(1.0 / 2.2));

    // ordered dither, then quantize each channel to limited levels
    vec2 pix = floor(uv * uResolution);
    float d = bayer(pix);
    float levels = 14.0;
    col = floor((col + d / levels) * levels + 0.5) / levels;

    // whisper of scanlines on internal rows
    float scan = 0.97 + 0.03 * step(0.5, fract(pix.y * 0.5));
    col *= scan;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class PixelPipeline {
  readonly renderer: THREE.WebGLRenderer;
  private target: THREE.WebGLRenderTarget;
  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private postMaterial: THREE.ShaderMaterial;
  private glitch = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });

    this.target = new THREE.WebGLRenderTarget(16, 16, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tScene: { value: this.target.texture },
        uResolution: { value: new THREE.Vector2(16, 16) },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial));

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    // canvas buffer at device pixels; internal target never exceeds it
    // (downscaling the dithered frame produces moiré)
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const ih = Math.min(INTERNAL_HEIGHT, Math.round(h * dpr));
    const iw = Math.round((w / h) * ih);
    this.target.setSize(iw, ih);
    (this.postMaterial.uniforms.uResolution.value as THREE.Vector2).set(iw, ih);
  }

  get aspect() {
    const v = this.postMaterial.uniforms.uResolution.value as THREE.Vector2;
    return v.x / v.y;
  }

  /** Fire a transient glitch burst (damage, chain events, doors with opinions). */
  triggerGlitch(intensity = 1) {
    this.glitch = Math.max(this.glitch, intensity);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, dt: number, time: number) {
    this.glitch = Math.max(0, this.glitch - dt * 2.5);
    this.postMaterial.uniforms.uTime.value = time;
    this.postMaterial.uniforms.uGlitch.value = this.glitch;

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}

/**
 * PS1-style vertex snapping: patch a material so vertices snap to a coarse
 * grid in clip space, giving the characteristic wobble.
 */
export function applyVertexSnap(material: THREE.Material, snapRes = 320) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnapRes = { value: snapRes };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uSnapRes;'
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        gl_Position.xyz = floor(gl_Position.xyz / gl_Position.w * uSnapRes + 0.5) / uSnapRes * gl_Position.w;`
      );
  };
  material.needsUpdate = true;
}
