import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';

// Humanoids, second draft: jointed limbs, faces, boots, props. Still
// low-poly, but now recognizably people with jobs they regret.
export interface NpcConfig {
  skin: number;
  shirt: number;
  trousers: number;
  hair?: number;          // hair cap color; omit for bald
  hat?: number;           // flat cap; wins over hair
  prop?: 'wrench' | 'mug' | 'datapad';
  guideTitle: string;
  guideText: string;
}

export function buildNpc(cfg: NpcConfig): THREE.Group {
  const g = new THREE.Group();

  const mat = (color: number, emissiveScale = 0) => {
    const m = new THREE.MeshLambertMaterial({ color });
    if (emissiveScale > 0) m.emissive = new THREE.Color(color).multiplyScalar(emissiveScale);
    applyVertexSnap(m);
    return m;
  };
  const skin = mat(cfg.skin, 0.08);
  const shirt = mat(cfg.shirt, 0.05);
  const trousers = mat(cfg.trousers);
  const dark = mat(0x14141f);

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  // boots
  add(new THREE.BoxGeometry(0.16, 0.1, 0.26), dark, -0.13, 0.05, 0.03);
  add(new THREE.BoxGeometry(0.16, 0.1, 0.26), dark, 0.13, 0.05, 0.03);
  // legs: shin + thigh with a knee hint
  add(new THREE.CylinderGeometry(0.075, 0.09, 0.36, 10), trousers, -0.13, 0.28, 0);
  add(new THREE.CylinderGeometry(0.075, 0.09, 0.36, 10), trousers, 0.13, 0.28, 0);
  add(new THREE.SphereGeometry(0.08, 8, 6), trousers, -0.13, 0.47, 0.01);
  add(new THREE.SphereGeometry(0.08, 8, 6), trousers, 0.13, 0.47, 0.01);
  add(new THREE.CylinderGeometry(0.095, 0.085, 0.34, 10), trousers, -0.13, 0.64, 0);
  add(new THREE.CylinderGeometry(0.095, 0.085, 0.34, 10), trousers, 0.13, 0.64, 0);
  // belt
  add(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 12), dark, 0, 0.84, 0);
  const buckle = mat(0xffd23e, 0.3);
  add(new THREE.BoxGeometry(0.08, 0.06, 0.03), buckle, 0, 0.84, 0.22);
  // torso: tapered, with chest panel
  add(new THREE.CylinderGeometry(0.21, 0.245, 0.5, 12), shirt, 0, 1.13, 0);
  add(new THREE.BoxGeometry(0.26, 0.3, 0.06), mat(cfg.shirt, 0.12), 0, 1.2, 0.18);
  // shoulders
  add(new THREE.SphereGeometry(0.095, 10, 8), shirt, -0.27, 1.36, 0);
  add(new THREE.SphereGeometry(0.095, 10, 8), shirt, 0.27, 1.36, 0);

  // arms: upper + forearm, bent at the elbow, holding-something pose on the
  // prop side, hanging on the other
  const buildArm = (side: -1 | 1, holding: boolean) => {
    const upper = add(new THREE.CylinderGeometry(0.06, 0.055, 0.32, 10), shirt, side * 0.31, 1.2, 0);
    upper.rotation.z = side * 0.18;
    if (holding) {
      const fore = add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), skin, side * 0.34, 0.98, 0.16);
      fore.rotation.x = -1.1; // forearm raised forward
      add(new THREE.SphereGeometry(0.065, 8, 6), skin, side * 0.35, 0.97, 0.32);
    } else {
      const fore = add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), skin, side * 0.36, 0.86, 0.02);
      fore.rotation.z = side * 0.08;
      add(new THREE.SphereGeometry(0.065, 8, 6), skin, side * 0.37, 0.7, 0.02);
    }
  };
  buildArm(-1, false);
  buildArm(1, !!cfg.prop);

  // neck + head
  add(new THREE.CylinderGeometry(0.06, 0.075, 0.1, 10), skin, 0, 1.48, 0);
  add(new THREE.SphereGeometry(0.155, 14, 12), skin, 0, 1.66, 0);
  // ears
  add(new THREE.SphereGeometry(0.035, 6, 5), skin, -0.15, 1.66, 0);
  add(new THREE.SphereGeometry(0.035, 6, 5), skin, 0.15, 1.66, 0);
  // eyes: dark, judging
  add(new THREE.BoxGeometry(0.035, 0.04, 0.02), dark, -0.055, 1.69, 0.145);
  add(new THREE.BoxGeometry(0.035, 0.04, 0.02), dark, 0.055, 1.69, 0.145);
  // nose
  add(new THREE.ConeGeometry(0.03, 0.07, 6), skin, 0, 1.65, 0.16).rotation.x = Math.PI / 2;
  // mouth: a thin line of professional neutrality
  add(new THREE.BoxGeometry(0.07, 0.015, 0.02), dark, 0, 1.59, 0.14);

  if (cfg.hat !== undefined) {
    const hatMat = mat(cfg.hat, 0.05);
    add(new THREE.CylinderGeometry(0.16, 0.165, 0.09, 12), hatMat, 0, 1.79, 0);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 12), hatMat, 0, 1.755, 0.04);
  } else if (cfg.hair !== undefined) {
    const hairMat = mat(cfg.hair);
    const cap = add(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.1), hairMat, 0, 1.68, -0.015);
    cap.rotation.x = -0.15;
  }

  // props
  if (cfg.prop === 'wrench') {
    const metal = mat(0xb0b0c8, 0.1);
    const handle = add(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), metal, 0.35, 0.99, 0.42);
    handle.rotation.x = 0.5;
    add(new THREE.TorusGeometry(0.045, 0.02, 6, 10, Math.PI * 1.4), metal, 0.35, 1.1, 0.52);
  } else if (cfg.prop === 'mug') {
    const mug = add(new THREE.CylinderGeometry(0.05, 0.045, 0.09, 10), mat(0x7fffd4, 0.2), 0.35, 1.0, 0.34);
    mug.rotation.x = 0.1;
  } else if (cfg.prop === 'datapad') {
    const pad = add(new THREE.BoxGeometry(0.16, 0.22, 0.02), mat(0x14141f), 0.35, 1.02, 0.36);
    pad.rotation.x = -0.6;
    const screen = add(new THREE.BoxGeometry(0.12, 0.16, 0.01), mat(0x7fffd4, 0.6), 0.35, 1.03, 0.375);
    screen.rotation.x = -0.6;
  }

  g.userData.guideTitle = cfg.guideTitle;
  g.userData.guideText = cfg.guideText;
  g.userData.npc = true;
  return g;
}
