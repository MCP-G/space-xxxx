import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';

export interface ColliderBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface World {
  scene: THREE.Scene;
  colliders: ColliderBox[];
}

const PALETTE = {
  floor: 0x2a2a3e,
  wall: 0x3d3d5c,
  trim: 0x7fffd4,
  accentA: 0xff2e88,
  accentB: 0xffd23e,
  dark: 0x14141f,
};

function box(
  world: World,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  color: number,
  collide = true
) {
  const mat = new THREE.MeshLambertMaterial({ color });
  applyVertexSnap(mat);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  world.scene.add(mesh);
  if (collide) {
    world.colliders.push({
      min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
      max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
    });
  }
  return mesh;
}

/**
 * Greybox slice of Port Improbable: a hangar-ish room connected by a
 * corridor to a smaller room (the future bar). Enough to walk and vibe.
 */
export function buildGreybox(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.dark);
  scene.fog = new THREE.Fog(PALETTE.dark, 8, 40);
  const world: World = { scene, colliders: [] };

  // lighting: dim ambient + colored points, very nightclub-in-a-shipyard
  scene.add(new THREE.AmbientLight(0x9090c0, 1.0));
  scene.add(new THREE.HemisphereLight(0x6060a0, 0x202030, 0.8));
  const pink = new THREE.PointLight(PALETTE.accentA, 40, 20, 1.6);
  pink.position.set(-4, 4, -10);
  scene.add(pink);
  const mint = new THREE.PointLight(PALETTE.trim, 35, 18, 1.6);
  mint.position.set(4, 4, -14);
  scene.add(mint);
  const amber = new THREE.PointLight(PALETTE.accentB, 12, 12, 1.8);
  amber.position.set(0, 2.8, 5);
  scene.add(amber);
  const barLight = new THREE.PointLight(PALETTE.accentA, 25, 16, 1.6);
  barLight.position.set(0, 3.5, 14);
  scene.add(barLight);

  // hangar room: 16w x 6h x 16d centered at z=-8
  box(world, 16, 0.5, 16, 0, -0.25, -8, PALETTE.floor);       // floor
  box(world, 16, 0.5, 16, 0, 6.25, -8, PALETTE.dark);         // ceiling
  box(world, 0.5, 6, 16, -8.25, 3, -8, PALETTE.wall);         // west wall
  box(world, 0.5, 6, 16, 8.25, 3, -8, PALETTE.wall);          // east wall
  box(world, 16, 6, 0.5, 0, 3, -16.25, PALETTE.wall);         // north wall
  // south wall with corridor gap (corridor is 3 wide at x=0)
  box(world, 6.5, 6, 0.5, -4.75, 3, 0.25, PALETTE.wall);
  box(world, 6.5, 6, 0.5, 4.75, 3, 0.25, PALETTE.wall);

  // corridor: 3w x 3h x 10d from z=0 to z=10
  box(world, 3, 0.5, 10, 0, -0.25, 5, PALETTE.floor);
  box(world, 3, 0.5, 10, 0, 3.25, 5, PALETTE.dark);
  box(world, 0.5, 3, 10, -1.75, 1.5, 5, PALETTE.wall);
  box(world, 0.5, 3, 10, 1.75, 1.5, 5, PALETTE.wall);
  // corridor trim strips (glowy, non-colliding)
  for (let z = 1; z < 10; z += 2) {
    const strip = box(world, 0.1, 0.1, 1.2, -1.68, 1.5, z, PALETTE.trim, false);
    (strip.material as THREE.MeshLambertMaterial).emissive = new THREE.Color(PALETTE.trim);
    const strip2 = box(world, 0.1, 0.1, 1.2, 1.68, 1.5, z, PALETTE.accentA, false);
    (strip2.material as THREE.MeshLambertMaterial).emissive = new THREE.Color(PALETTE.accentA);
  }

  // bar room: 10w x 4h x 8d centered at z=14.5
  box(world, 10, 0.5, 8, 0, -0.25, 14, PALETTE.floor);
  box(world, 10, 0.5, 8, 0, 4.25, 14, PALETTE.dark);
  box(world, 0.5, 4, 8, -5.25, 2, 14, PALETTE.wall);
  box(world, 0.5, 4, 8, 5.25, 2, 14, PALETTE.wall);
  box(world, 10, 4, 0.5, 0, 2, 18.25, PALETTE.wall);
  box(world, 3.25, 4, 0.5, -3.4, 2, 10.25, PALETTE.wall);
  box(world, 3.25, 4, 0.5, 3.4, 2, 10.25, PALETTE.wall);

  // the bar itself + clutter crates
  box(world, 4, 1.1, 1, 0, 0.55, 16.5, PALETTE.accentB);
  box(world, 1.2, 1.2, 1.2, -5.5, 0.6, -12, PALETTE.accentA);
  box(world, 1, 1, 1, -4.2, 0.5, -12.5, PALETTE.wall);
  box(world, 1.4, 1.4, 1.4, 6, 0.7, -4, PALETTE.trim);
  box(world, 0.9, 0.9, 0.9, 6.2, 1.85, -4.1, PALETTE.wall);

  // a placeholder "ship": chunky wedge in the hangar (boarding comes in M1)
  const shipMat = new THREE.MeshLambertMaterial({ color: 0x5c5c8a });
  applyVertexSnap(shipMat);
  const ship = new THREE.Mesh(new THREE.ConeGeometry(2, 5, 4), shipMat);
  ship.rotation.z = Math.PI / 2;
  ship.rotation.y = Math.PI / 4;
  ship.position.set(-2, 1.6, -11);
  scene.add(ship);
  world.colliders.push({
    min: new THREE.Vector3(-5, 0, -13),
    max: new THREE.Vector3(1, 3.2, -9),
  });

  return world;
}
