import * as THREE from 'three';
import { sfc32 } from '../../world/sector';
import type { ColliderBox } from '../../world/station';

// WINDOWS — the companion to Decay. Feed it collider walls; it bolts on
// framed viewports with a star-field "view" behind tinted glass. Whether
// any given window faces actual space is between the station and its
// conscience: the Guide is honest about this.
const STAR_TINTS = ['#c0c0e8', '#ffffff', '#9fd8ff', '#ffd8b0'];

function makeSpaceViewTexture(rnd: () => number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#04040c';
  ctx.fillRect(0, 0, 256, 160);
  // a wash of nebula, for morale
  const grad = ctx.createRadialGradient(60 + rnd() * 140, 40 + rnd() * 80, 5, 128, 80, 160);
  const hue = Math.floor(rnd() * 3);
  grad.addColorStop(0, ['rgba(255,46,136,0.16)', 'rgba(127,255,212,0.13)', 'rgba(106,74,138,0.2)'][hue]);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 160);
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)];
    ctx.globalAlpha = 0.4 + rnd() * 0.6;
    const s = rnd() > 0.92 ? 2 : 1;
    ctx.fillRect(rnd() * 256, rnd() * 160, s, s);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface WindowOpts {
  /** windows per eligible wall face, on average. */
  density?: number;
}

export class WindowSystem {
  private rnd: () => number;
  private viewPool: THREE.CanvasTexture[] = [];
  private frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.5, metalness: 0.6 });
  private glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfffec, metalness: 0.9, roughness: 0.08,
    transparent: true, opacity: 0.16, depthWrite: false,
  });
  readonly root = new THREE.Group();

  constructor(parent: THREE.Object3D, seed: number) {
    this.rnd = sfc32(0x717d05, 0x243f6a88, seed, 0x10ca1);
    this.root.name = 'windows';
    parent.add(this.root);
  }

  apply(colliders: ColliderBox[], opts: WindowOpts = {}) {
    const density = opts.density ?? 0.6;
    for (const c of colliders) {
      const sx = c.max.x - c.min.x;
      const sy = c.max.y - c.min.y;
      const sz = c.max.z - c.min.z;
      if (sy > 2.2 && sx < 0.8 && sz > 2.4) this.fit(c, 'x', density);
      else if (sy > 2.2 && sz < 0.8 && sx > 2.4) this.fit(c, 'z', density);
    }
  }

  private fit(c: ColliderBox, normalAxis: 'x' | 'z', density: number) {
    const sy = c.max.y - c.min.y;
    const along = normalAxis === 'x' ? c.max.z - c.min.z : c.max.x - c.min.x;
    for (const side of [1, -1]) {
      let n = 0;
      const expected = density * Math.min(2.5, along / 5);
      while (this.rnd() < expected - n) n++;
      for (let i = 0; i < n; i++) {
        const w = 1.5 + this.rnd() * 1.2;
        const h = 0.8 + this.rnd() * 0.5;
        const u = 0.18 + this.rnd() * 0.64;
        const y = c.min.y + sy * (0.45 + this.rnd() * 0.2);
        const win = this.window(w, h);
        const eps = 0.04 * side;
        if (normalAxis === 'x') {
          win.position.set(side > 0 ? c.max.x + eps : c.min.x + eps, y, c.min.z + along * u);
          win.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          win.position.set(c.min.x + along * u, y, side > 0 ? c.max.z + eps : c.min.z + eps);
          win.rotation.y = side > 0 ? 0 : Math.PI;
        }
        this.root.add(win);
      }
    }
  }

  private window(w: number, h: number): THREE.Group {
    const g = new THREE.Group();
    if (this.viewPool.length < 8) this.viewPool.push(makeSpaceViewTexture(this.rnd));
    const view = this.viewPool[Math.floor(this.rnd() * this.viewPool.length)];

    const space = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: view })
    );
    g.add(space);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.glassMat);
    glass.position.z = 0.015;
    g.add(glass);
    // frame: four bars
    const t = 0.07;
    for (const [bw, bh, x, y] of [
      [w + t * 2, t, 0, h / 2 + t / 2],
      [w + t * 2, t, 0, -h / 2 - t / 2],
      [t, h, -w / 2 - t / 2, 0],
      [t, h, w / 2 + t / 2, 0],
    ] as const) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), this.frameMat);
      bar.position.set(x, y, 0.01);
      g.add(bar);
    }
    g.userData.guideTitle = 'WINDOW';
    g.userData.guideText = 'View simulated for morale purposes. The void appreciates your interest.';
    return g;
  }
}
