import * as THREE from 'three';
import { sfc32 } from '../../world/sector';
import type { ColliderBox } from '../../world/station';

// WINDOWS — the companion to Decay. Feed it collider walls; it bolts on
// framed viewports with a star-field "view". Whether any given window
// faces actual space is between the station and its conscience: the Guide
// is honest about this. Frame, glass sheen, and stars are all baked into
// one texture → one mesh, one draw call per window.
const STAR_TINTS = ['#c0c0e8', '#ffffff', '#9fd8ff', '#ffd8b0'];

function makeWindowTexture(rnd: () => number): THREE.CanvasTexture {
  const W = 256, H = 160, F = 12; // frame thickness in px
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  // the void
  ctx.fillStyle = '#04040c';
  ctx.fillRect(0, 0, W, H);
  // a wash of nebula, for morale
  const grad = ctx.createRadialGradient(60 + rnd() * 140, 40 + rnd() * 80, 5, W / 2, H / 2, 160);
  const hue = Math.floor(rnd() * 3);
  grad.addColorStop(0, ['rgba(255,46,136,0.16)', 'rgba(127,255,212,0.13)', 'rgba(106,74,138,0.2)'][hue]);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)];
    ctx.globalAlpha = 0.4 + rnd() * 0.6;
    const s = rnd() > 0.92 ? 2 : 1;
    ctx.fillRect(F + rnd() * (W - F * 2), F + rnd() * (H - F * 2), s, s);
  }
  ctx.globalAlpha = 1;
  // glass sheen: one confident diagonal
  const sheen = ctx.createLinearGradient(0, H, W, 0);
  sheen.addColorStop(0.35, 'rgba(191,255,236,0)');
  sheen.addColorStop(0.5, 'rgba(191,255,236,0.10)');
  sheen.addColorStop(0.65, 'rgba(191,255,236,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
  // frame
  ctx.strokeStyle = '#1a1a28';
  ctx.lineWidth = F;
  ctx.strokeRect(F / 2, F / 2, W - F, H - F);
  ctx.strokeStyle = '#34344a';
  ctx.lineWidth = 2;
  ctx.strokeRect(F + 1, F + 1, W - F * 2 - 2, H - F * 2 - 2);
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
  private viewPool: THREE.MeshBasicMaterial[] = [];
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
        const eps = 0.06 * side;
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

  private window(w: number, h: number): THREE.Mesh {
    if (this.viewPool.length < 8) {
      this.viewPool.push(new THREE.MeshBasicMaterial({
        map: makeWindowTexture(this.rnd),
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      }));
    }
    const mat = this.viewPool[Math.floor(this.rnd() * this.viewPool.length)];
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.userData.guideTitle = 'WINDOW';
    mesh.userData.guideText = 'View simulated for morale purposes. The void appreciates your interest.';
    return mesh;
  }
}
