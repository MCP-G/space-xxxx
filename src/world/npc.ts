import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';

// Low-poly humanoids: enough polygons to read as a person, few enough to
// read as a person who has given up. Idle bob driven from the frame loop
// via userData.baseY + name 'npc'.
export interface NpcConfig {
  skin: number;
  shirt: number;
  trousers: number;
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

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };

  // legs
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 8), trousers, -0.13, 0.39, 0);
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 8), trousers, 0.13, 0.39, 0);
  // hips + torso (slightly tapered)
  add(new THREE.CylinderGeometry(0.24, 0.2, 0.22, 10), trousers, 0, 0.86, 0);
  add(new THREE.CylinderGeometry(0.21, 0.25, 0.52, 10), shirt, 0, 1.22, 0);
  // shoulders
  add(new THREE.SphereGeometry(0.09, 8, 6), shirt, -0.27, 1.42, 0);
  add(new THREE.SphereGeometry(0.09, 8, 6), shirt, 0.27, 1.42, 0);
  // arms (hang with a slight bend out)
  const armL = add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8), shirt, -0.31, 1.1, 0);
  armL.rotation.z = 0.12;
  const armR = add(new THREE.CylinderGeometry(0.06, 0.05, 0.62, 8), shirt, 0.31, 1.1, 0);
  armR.rotation.z = -0.12;
  // hands
  add(new THREE.SphereGeometry(0.06, 8, 6), skin, -0.35, 0.78, 0);
  add(new THREE.SphereGeometry(0.06, 8, 6), skin, 0.35, 0.78, 0);
  // neck + head
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skin, 0, 1.53, 0);
  add(new THREE.SphereGeometry(0.16, 12, 10), skin, 0, 1.71, 0);
  // a flat-ish nose so heads have a facing
  add(new THREE.ConeGeometry(0.035, 0.08, 6), skin, 0, 1.69, 0.16).rotation.x = Math.PI / 2;

  g.userData.guideTitle = cfg.guideTitle;
  g.userData.guideText = cfg.guideText;
  g.userData.npc = true;
  return g;
}
