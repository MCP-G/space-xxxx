import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';
import { PALETTE, type ColliderBox, type World } from './station';

// Deterministic PRNG (sfc32). A sector seed fully determines the sector —
// this is the function that will eventually live behind a SectorDeed token.
export function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

export interface Asteroid {
  position: THREE.Vector3;
  radius: number;
}

export interface Poi {
  name: string;
  kind: 'asteroids' | 'derelict' | 'beacon';
  position: THREE.Vector3;
  /** Dockable pad: ship parks here, player can walk the pad. */
  dock?: {
    shipPos: THREE.Vector3;   // where the ship parks (floor-flush)
    standPos: THREE.Vector3;  // where the player stands after landing
    floorY: number;           // walkable plane height
    colliders: ColliderBox[];
  };
  guideTitle: string;
  guideText: string;
}

export interface Sector {
  seed: number;
  root: THREE.Group;
  pois: Poi[];
  asteroids: Asteroid[];
}

function rockMat() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x4a4060 });
  applyVertexSnap(mat);
  return mat;
}

function padBox(
  parent: THREE.Object3D, colliders: ColliderBox[],
  w: number, h: number, d: number, x: number, y: number, z: number,
  color: number, emissive = false
) {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (emissive) mat.emissive = new THREE.Color(color);
  applyVertexSnap(mat);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  colliders.push({
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
  });
  return mesh;
}

/** Generate the sector around Port Improbable into the world's scene. */
export function buildSector(world: World, seed: number): Sector {
  const rnd = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, seed);
  const scene = new THREE.Group(); // detachable root: scene-like for adds below
  world.scene.add(scene);
  const sector: Sector = { seed, root: scene, pois: [], asteroids: [] };

  // --- starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1500;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(900 + rnd() * 600);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc0c0e8, size: 2, sizeAttenuation: false }));
  scene.add(stars);

  // sun-ish directional light so exteriors read in space
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6);
  sun.position.set(0.4, 0.7, -0.6);
  scene.add(sun);

  // --- asteroid cluster
  const clusterCenter = new THREE.Vector3(
    (rnd() - 0.5) * 300, (rnd() - 0.5) * 80, -250 - rnd() * 150
  );
  const mat = rockMat();
  for (let i = 0; i < 24; i++) {
    const r = 3 + rnd() * 12;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
    const p = clusterCenter.clone().add(
      new THREE.Vector3((rnd() - 0.5) * 120, (rnd() - 0.5) * 60, (rnd() - 0.5) * 120)
    );
    rock.position.copy(p);
    rock.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    scene.add(rock);
    sector.asteroids.push({ position: p, radius: r });
  }
  sector.pois.push({
    name: 'ROCK COLLECTION',
    kind: 'asteroids',
    position: clusterCenter,
    guideTitle: 'ASTEROID CLUSTER 7-GAMMA',
    guideText: 'Officially a "mineral opportunity zone". The minerals disagree.',
  });

  // --- derelict: kitbashed dead freighter, with a landing pad
  const derelictPos = new THREE.Vector3(
    150 + rnd() * 120, (rnd() - 0.5) * 60, -120 - rnd() * 120
  );
  const dMat = new THREE.MeshLambertMaterial({ color: 0x3a3148 });
  applyVertexSnap(dMat);
  const derelict = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(8 + rnd() * 10, 4 + rnd() * 5, 6 + rnd() * 8), dMat
    );
    seg.position.set((i - 3) * 7 + (rnd() - 0.5) * 3, (rnd() - 0.5) * 4, (rnd() - 0.5) * 5);
    seg.rotation.z = (rnd() - 0.5) * 0.3;
    derelict.add(seg);
  }
  derelict.position.copy(derelictPos);
  scene.add(derelict);

  const dPadColliders: ColliderBox[] = [];
  const dPadY = derelictPos.y - 8;
  padBox(scene, dPadColliders, 10, 0.6, 10, derelictPos.x, dPadY - 0.3, derelictPos.z + 14, PALETTE.floor);
  // rails (the one thing aboard that still works)
  padBox(scene, dPadColliders, 10, 1, 0.3, derelictPos.x, dPadY + 0.5, derelictPos.z + 14 - 5, PALETTE.trim, true);
  padBox(scene, dPadColliders, 10, 1, 0.3, derelictPos.x, dPadY + 0.5, derelictPos.z + 14 + 5, PALETTE.trim, true);
  padBox(scene, dPadColliders, 0.3, 1, 10, derelictPos.x - 5, dPadY + 0.5, derelictPos.z + 14, PALETTE.trim, true);
  padBox(scene, dPadColliders, 0.3, 1, 10, derelictPos.x + 5, dPadY + 0.5, derelictPos.z + 14, PALETTE.trim, true);

  sector.pois.push({
    name: 'DERELICT',
    kind: 'derelict',
    position: derelictPos,
    dock: {
      shipPos: new THREE.Vector3(derelictPos.x, dPadY, derelictPos.z + 14),
      standPos: new THREE.Vector3(derelictPos.x, dPadY, derelictPos.z + 14 + 3),
      floorY: dPadY,
      colliders: dPadColliders,
    },
    guideTitle: 'UNREGISTERED DERELICT',
    guideText: 'Crew manifest: "we quit." Salvage rights: contested by no one, claimed by everyone.',
  });

  // --- beacon: navigation buoy with a kiosk pad
  const beaconPos = new THREE.Vector3(
    -(120 + rnd() * 120), (rnd() - 0.5) * 50, -180 - rnd() * 100
  );
  const bMat = new THREE.MeshLambertMaterial({ color: PALETTE.accentB });
  bMat.emissive = new THREE.Color(0x403300);
  applyVertexSnap(bMat);
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.4, 18, 6), bMat);
  pylon.position.copy(beaconPos);
  scene.add(pylon);
  const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(2), new THREE.MeshBasicMaterial({ color: PALETTE.accentB }));
  lamp.position.copy(beaconPos).add(new THREE.Vector3(0, 11, 0));
  lamp.name = 'beacon-lamp';
  scene.add(lamp);

  const bPadColliders: ColliderBox[] = [];
  const bPadY = beaconPos.y - 9;
  padBox(scene, bPadColliders, 8, 0.6, 8, beaconPos.x, bPadY - 0.3, beaconPos.z, PALETTE.floor);
  padBox(scene, bPadColliders, 8, 1, 0.3, beaconPos.x, bPadY + 0.5, beaconPos.z - 4, PALETTE.accentA, true);
  padBox(scene, bPadColliders, 8, 1, 0.3, beaconPos.x, bPadY + 0.5, beaconPos.z + 4, PALETTE.accentA, true);
  padBox(scene, bPadColliders, 0.3, 1, 8, beaconPos.x - 4, bPadY + 0.5, beaconPos.z, PALETTE.accentA, true);
  padBox(scene, bPadColliders, 0.3, 1, 8, beaconPos.x + 4, bPadY + 0.5, beaconPos.z, PALETTE.accentA, true);
  // kiosk
  padBox(scene, bPadColliders, 1, 1.6, 0.6, beaconPos.x + 2, bPadY + 0.8, beaconPos.z - 2, PALETTE.dark);

  sector.pois.push({
    name: 'NAV BEACON',
    kind: 'beacon',
    position: beaconPos,
    dock: {
      shipPos: new THREE.Vector3(beaconPos.x - 1, bPadY, beaconPos.z + 1),
      standPos: new THREE.Vector3(beaconPos.x + 1.5, bPadY, beaconPos.z),
      floorY: bPadY,
      colliders: bPadColliders,
    },
    guideTitle: 'NAVIGATION BEACON XK-9',
    guideText: 'Broadcasts "YOU ARE HERE" to a radius of 40 light-minutes. Unhelpfully, it is correct.',
  });

  return sector;
}
