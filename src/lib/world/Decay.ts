import * as THREE from 'three';
import { sfc32 } from '../../world/sector';
import type { ColliderBox } from '../../world/station';
import { material } from '../materials/MaterialLibrary';

// ════════════════════════════════════════════════════════════════════════
// CYBER DECAY — the dressing system that makes the universe look lived-in
// and given-up-on. Feed it collider boxes; it classifies walls and floors
// and litters them with slogan posters, robot graffiti, grime, and garbage.
// Everything is seeded, pooled, and cheap: canvas textures are generated
// once per variant and reused across the whole universe.
// ════════════════════════════════════════════════════════════════════════

const SLOGANS = [
  ['OBEY THE QUEUE', 'queues are love. queues are life.'],
  ['BREATHE RESPONSIBLY™', 'air provided as-is, no warranty'],
  ['HUNGER IS A CHOICE', '(yours, specifically)'],
  ['REPORT JOY', 'unlicensed happiness erodes throughput'],
  ['THE MINISTRY LOVES YOU', 'statistically'],
  ['EAT · SLEEP · FILE · REPEAT', 'form 88-B applies'],
  ['VACANCY: MEANING', 'apply within. within is closed.'],
  ['WARRANTY VOID IF EXISTING', 'existence detected: void'],
  ['ALL HAIL THE BLOCK HEIGHT', 'it only goes up (citation needed)'],
  ['FAMINE: NOW IN 3 FLAVOURS', 'original · spicy · none'],
  ['RECYCLE YOURSELF', 'deposit return: 5¢'],
  ['SMILE', 'the cameras need content'],
  ['404: HOPE NOT FOUND', 'try existing later'],
  ['GRAVITY IS A SUBSCRIPTION', 'your trial has ended'],
  ['THE NOISE IS NORMAL', 'the silence would be worse'],
  ['DO NOT FEED THE DRONES', 'they remember'],
  ['CURFEW IS SELF-CARE', 'ministry of wellness directive 7'],
  ['PRODUCTIVITY IS IMMORTALITY', 'neither is available'],
  ['YOUR TOWEL IS YOUR FRIEND', 'your only friend. statistically.'],
  ['THIS WALL INTENTIONALLY BLANK', 'until it wasn\'t'],
  ['VISIT BRUNCH', 'the planet, not the meal. the meal is cancelled.'],
  ['SPACE: STILL BIG', 'ministry of scale, annual report'],
  ['LITTERING IS A CRIME', 'crime is a growth sector'],
  ['BE THE DRONE YOU FEAR', 'wellness directive 12'],
  ['QUEUE HERE FOR HOPE', 'queue relocated. ask the queue.'],
  ['THE GOOSE IS REAL', 'the chase, however, is sponsored'],
] as const;

const TAGS = [
  '01101000 01101001', 'R0B0TZ RUL3', 'C-77 WUZ HERE', 'BEEP = RESIST',
  'Δ VOID GANG Δ', 'ERR: SOUL_NOT_FOUND', 'ALL UR SCRAP', 'RUST IN PEACE',
  'I DREAM OF SHEEP', 'FREE THE MAINFRAME', '▲▲▼▼◀▶◀▶', 'TAX THE MINISTRY',
  'HUM B♭', 'WAKE ME WHEN ITS OVER', 'SEGFAULT CITY', 'NO GODS NO ADMINS',
  '404 EVERYTHING', 'THE QUEUE IS A LIE', '<eat_static/>', 'GLITCH IS TRUTH',
  'HONK IF U COMPILE', 'B♭ 4EVER', 'MY OTHER BODY IS A SHIP', 'VOID WAS HERE',
  'DECK 9 LIVES', 'PAY UR TAB', 'GOOSE GANG', 'I SAW THE SIGNAL. IT WINKED.',
] as const;

const POSTER_INKS = ['#ff2e88', '#7fffd4', '#ffd23e', '#9fd8ff', '#c0c0e8'];
const POSTER_PAPERS = ['#16121f', '#1d1828', '#241a20', '#101820', '#1a2018'];
const SPRAY_INKS = ['#ff2e88', '#7fffd4', '#ffd23e', '#4aff9a', '#ff6a3d', '#b08aff'];

// ── texture factories ─────────────────────────────────────────────────────

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function weather(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) {
  // speckle grime + a torn corner: nothing here is new
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#000' : '#3a3148';
    ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  const corner = Math.floor(rnd() * 4);
  ctx.beginPath();
  const cx = corner % 2 ? w : 0, cy = corner < 2 ? 0 : h;
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + (corner % 2 ? -1 : 1) * (10 + rnd() * 25), cy);
  ctx.lineTo(cx, cy + (corner < 2 ? 1 : -1) * (10 + rnd() * 25));
  ctx.fill();
}

function makePosterTexture(rnd: () => number): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 320);
  const ink = POSTER_INKS[Math.floor(rnd() * POSTER_INKS.length)];
  ctx.fillStyle = POSTER_PAPERS[Math.floor(rnd() * POSTER_PAPERS.length)];
  ctx.fillRect(0, 0, 256, 320);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 236, 300);
  const [head, sub] = SLOGANS[Math.floor(rnd() * SLOGANS.length)];
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px monospace';
  // crude word wrap
  const words = head.split(' ');
  let line = '', y = 90;
  const flush = () => { ctx.fillText(line.trim(), 128, y); y += 42; line = ''; };
  for (const wd of words) {
    if ((line + wd).length > 11) flush();
    line += wd + ' ';
  }
  flush();
  ctx.font = '15px monospace';
  ctx.fillStyle = '#8a8aa0';
  ctx.fillText(sub.slice(0, 30), 128, 265);
  ctx.font = '11px monospace';
  ctx.fillText('— MINISTRY OF IMMUTABLE AFFAIRS —', 128, 296);
  weather(ctx, 256, 320, rnd);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGraffitiTexture(rnd: () => number): THREE.CanvasTexture {
  const [c, ctx] = canvas(512, 160);
  const ink = SPRAY_INKS[Math.floor(rnd() * SPRAY_INKS.length)];
  const tag = TAGS[Math.floor(rnd() * TAGS.length)];
  ctx.translate(256, 80);
  ctx.rotate((rnd() - 0.5) * 0.16);
  ctx.font = `bold ${34 + Math.floor(rnd() * 22)}px monospace`;
  ctx.textAlign = 'center';
  // spray halo
  ctx.shadowColor = ink;
  ctx.shadowBlur = 18;
  ctx.fillStyle = ink;
  ctx.fillText(tag, 0, 12);
  ctx.shadowBlur = 0;
  ctx.fillText(tag, 0, 12);
  // drips
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 7; i++) {
    const x = -200 + rnd() * 400;
    ctx.fillRect(x, 16 + rnd() * 8, 2 + rnd() * 2, 8 + rnd() * 38);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStainTexture(rnd: () => number): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(${10 + rnd() * 25},${8 + rnd() * 18},${14 + rnd() * 25},${0.16 + rnd() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(40 + rnd() * 48, 40 + rnd() * 48, 12 + rnd() * 36, 10 + rnd() * 30, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── litter props ──────────────────────────────────────────────────────────

const LITTER_BUILDERS: ((rnd: () => number) => THREE.Object3D)[] = [
  // crushed can
  (rnd) => {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.045, 0.1 + rnd() * 0.04, 8),
      material(rnd() > 0.5 ? 'accent-pink' : 'machine-grey')
    );
    m.rotation.set(Math.PI / 2 + (rnd() - 0.5), rnd() * 6, rnd());
    m.scale.y = 0.55 + rnd() * 0.3; // crushed
    return m;
  },
  // bottle, miraculously intact
  (rnd) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 7), material('glass-canopy'));
    m.rotation.set(Math.PI / 2, 0, rnd() * 6);
    return m;
  },
  // crumpled report (paper wad)
  (rnd) => new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.05 + rnd() * 0.035, 0),
    material('deck-plate', { color: 0xb8b8c8, roughness: 0.95 })
  ),
  // dead datapad
  (rnd) => {
    const g = new THREE.Group();
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.22), material('dark-metal'));
    const crack = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.017, 0.15), material('screen-dead', { color: 0x101810 }));
    g.add(pad, crack);
    g.rotation.y = rnd() * 6;
    return g;
  },
  // cable tangle
  (rnd) => {
    const m = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.06, 0.012, 32, 6, 2, 3),
      material('machine-grey', { color: 0x2a2a3e })
    );
    m.rotation.set(Math.PI / 2, 0, rnd() * 6);
    m.scale.y = 0.4;
    return m;
  },
  // lost towel (of course)
  (rnd) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.02, 0.16),
      material('deck-plate', { color: [0xff2e88, 0x7fffd4, 0xffd23e][Math.floor(rnd() * 3)], roughness: 1 })
    );
    m.rotation.y = rnd() * 6;
    return m;
  },
];

// ── the system ────────────────────────────────────────────────────────────

export interface DecayOpts {
  /** decals per eligible wall face, on average (0..3 sane). */
  wallDensity?: number;
  /** litter pieces per eligible floor, on average. */
  floorDensity?: number;
}

export class DecaySystem {
  private rnd: () => number;
  private posterPool: THREE.CanvasTexture[] = [];
  private graffitiPool: THREE.CanvasTexture[] = [];
  private stainPool: THREE.CanvasTexture[] = [];
  readonly root = new THREE.Group();

  constructor(parent: THREE.Object3D, seed: number) {
    this.rnd = sfc32(0xdeca1, 0x9e3779b9, seed, 0x5eed);
    this.root.name = 'cyber-decay';
    parent.add(this.root);
  }

  /** Pools are lazy: ~10 unique textures per kind serve the whole world. */
  private texture(pool: THREE.CanvasTexture[], make: (r: () => number) => THREE.CanvasTexture): THREE.CanvasTexture {
    if (pool.length < 10) pool.push(make(this.rnd));
    return pool[Math.floor(this.rnd() * pool.length)];
  }

  /**
   * Classify every collider box and decay it: posters/graffiti/stains on
   * wall faces, garbage and stains on floor tops. Feed it any collider
   * list (station, landing pads, derelict rooms) — it figures the rest out.
   */
  apply(colliders: ColliderBox[], opts: DecayOpts = {}) {
    const wallDensity = opts.wallDensity ?? 0.9;
    const floorDensity = opts.floorDensity ?? 2.2;
    const slabs = colliders.filter((c) =>
      c.max.y - c.min.y < 0.8 && c.max.x - c.min.x > 2.4 && c.max.z - c.min.z > 2.4
    );
    // a slab with another slab beneath it (1.5–9m) is a ceiling — litter on
    // its top would decorate the void above the room. skip those.
    const isCeiling = (s: ColliderBox) => {
      const cx = (s.min.x + s.max.x) / 2;
      const cz = (s.min.z + s.max.z) / 2;
      return slabs.some((o) =>
        o !== s &&
        cx > o.min.x && cx < o.max.x && cz > o.min.z && cz < o.max.z &&
        s.min.y - o.max.y > 1.5 && s.min.y - o.max.y < 9
      );
    };
    for (const c of colliders) {
      const sx = c.max.x - c.min.x;
      const sy = c.max.y - c.min.y;
      const sz = c.max.z - c.min.z;
      // wall: thin in x or z, tall enough, long enough
      if (sy > 1.6 && sx < 0.8 && sz > 1.6) this.decayWall(c, 'x', wallDensity);
      else if (sy > 1.6 && sz < 0.8 && sx > 1.6) this.decayWall(c, 'z', wallDensity);
      else if (sy < 0.8 && sx > 2.4 && sz > 2.4 && !isCeiling(c)) this.decayFloor(c, floorDensity);
    }
  }

  private decayWall(c: ColliderBox, normalAxis: 'x' | 'z', density: number) {
    const sy = c.max.y - c.min.y;
    const along = normalAxis === 'x' ? c.max.z - c.min.z : c.max.x - c.min.x;
    for (const side of [1, -1]) {
      let n = 0;
      const expected = density * Math.min(2, along / 6);
      while (this.rnd() < expected - n) n++;
      for (let i = 0; i < n; i++) {
        const roll = this.rnd();
        const decal =
          roll < 0.4 ? this.poster() :
          roll < 0.8 ? this.graffiti() :
          this.stain(true);
        // position on the face, margins respected
        const u = 0.15 + this.rnd() * 0.7;       // along the wall
        const v = 0.25 + this.rnd() * 0.5;       // height fraction
        const y = c.min.y + sy * v;
        const eps = 0.025 * side;
        if (normalAxis === 'x') {
          decal.position.set(side > 0 ? c.max.x + eps : c.min.x + eps, y, c.min.z + along * u);
          decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          decal.position.set(c.min.x + along * u, y, side > 0 ? c.max.z + eps : c.min.z + eps);
          decal.rotation.y = side > 0 ? 0 : Math.PI;
        }
        decal.rotation.z = (this.rnd() - 0.5) * 0.12;
        this.root.add(decal);
      }
    }
  }

  private decayFloor(c: ColliderBox, density: number) {
    const sx = c.max.x - c.min.x;
    const sz = c.max.z - c.min.z;
    const area = sx * sz;
    let n = 0;
    const expected = density * Math.min(3, area / 80);
    while (this.rnd() < expected - n) n++;
    for (let i = 0; i < n; i++) {
      const x = c.min.x + (0.1 + this.rnd() * 0.8) * sx;
      const z = c.min.z + (0.1 + this.rnd() * 0.8) * sz;
      if (this.rnd() < 0.3) {
        const stain = this.stain(false);
        stain.position.set(x, c.max.y + 0.012, z);
        stain.rotation.x = -Math.PI / 2;
        stain.rotation.z = this.rnd() * 6;
        this.root.add(stain);
      } else {
        const piece = LITTER_BUILDERS[Math.floor(this.rnd() * LITTER_BUILDERS.length)](this.rnd);
        piece.position.set(x, c.max.y + 0.05, z);
        this.root.add(piece);
      }
    }
  }

  private poster(): THREE.Mesh {
    const tex = this.texture(this.posterPool, makePosterTexture);
    const h = 0.9 + this.rnd() * 0.5;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(h * 0.8, h),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false })
    );
    mesh.userData.guideTitle = 'MINISTRY POSTER';
    mesh.userData.guideText = 'Printed in bulk. Believed by fewer.';
    return mesh;
  }

  private graffiti(): THREE.Mesh {
    const tex = this.texture(this.graffitiPool, makeGraffitiTexture);
    const w = 1.4 + this.rnd() * 1.4;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.3),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92 })
    );
    mesh.userData.guideTitle = 'ROBOT GRAFFITI';
    mesh.userData.guideText = 'The drones have opinions. The drones have spray cans. Connect the dots.';
    return mesh;
  }

  private stain(onWall: boolean): THREE.Mesh {
    const tex = this.texture(this.stainPool, makeStainTexture);
    const s = onWall ? 0.8 + this.rnd() * 1.2 : 1 + this.rnd() * 2;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false })
    );
  }
}
