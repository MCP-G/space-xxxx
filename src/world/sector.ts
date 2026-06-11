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
  /** Collectable scrap/ore: glowing meshes the player can E-harvest. */
  salvage: { mesh: THREE.Mesh; position: THREE.Vector3 }[];
  /** Ship's log terminal aboard the derelict. */
  logPos?: THREE.Vector3;
}

export const DERELICT_LOGS = [
  'LOG 4411: CAPTAIN SAYS THE NOISE IS NOTHING. THE NOISE DISAGREES.',
  'LOG 4412: RAN OUT OF TEA. MORALE STRUCTURALLY COMPROMISED.',
  'LOG 4413: THE CARGO IS HUMMING IN B FLAT. REQUESTING HAZARD PAY.',
  'LOG 4414: CREW VOTE HELD. UNANIMOUS DECISION: "WE QUIT." EVEN THE NOISE VOTED.',
  'LOG 4415 (AUTOMATED): LIFE SUPPORT IDLE. PLANTS DOING FINE WITHOUT YOU, FRANKLY.',
];

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
  const sector: Sector = { seed, root: scene, pois: [], asteroids: [], salvage: [] };

  const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.trim });
  const oreMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentB });
  const addSalvage = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    sector.salvage.push({ mesh, position: pos.clone() });
    return mesh;
  };

  // --- starfield: two layers, tinted, plentiful
  const starTints = [0xc0c0e8, 0xffffff, 0x9fd8ff, 0xffd8b0, 0xffb0d8];
  for (let layer = 0; layer < 2; layer++) {
    const starGeo = new THREE.BufferGeometry();
    const starCount = layer === 0 ? 3200 : 1400;
    const pos = new Float32Array(starCount * 3);
    const col = new Float32Array(starCount * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5)
        .normalize().multiplyScalar(900 + rnd() * 600);
      pos.set([v.x, v.y, v.z], i * 3);
      tint.setHex(starTints[Math.floor(rnd() * starTints.length)]);
      const bright = 0.7 + rnd() * 0.3;
      col.set([tint.r * bright, tint.g * bright, tint.b * bright], i * 3);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      vertexColors: true, size: layer === 0 ? 2 : 3.5, sizeAttenuation: false,
    }));
    scene.add(stars);
  }

  // sun-ish directional light so exteriors read in space
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(0.4, 0.7, -0.6);
  scene.add(sun);
  // and a cool fill from the opposite side so shadow faces aren't pitch black
  const fill = new THREE.DirectionalLight(0x6080ff, 0.9);
  fill.position.set(-0.5, -0.3, 0.6);
  scene.add(fill);

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
  // mining outpost: a pad bolted to the cluster's largest rock, with ore
  // nodes you can chip loose and a hut that has seen things
  const minePadY = clusterCenter.y - 20;
  const minePadC = new THREE.Vector3(clusterCenter.x, minePadY, clusterCenter.z + 60);
  const mPad: ColliderBox[] = [];
  padBox(scene, mPad, 12, 0.6, 12, minePadC.x, minePadY - 0.3, minePadC.z, PALETTE.floor);
  padBox(scene, mPad, 12, 1, 0.3, minePadC.x, minePadY + 0.5, minePadC.z - 6, PALETTE.accentB, true);
  padBox(scene, mPad, 12, 1, 0.3, minePadC.x, minePadY + 0.5, minePadC.z + 6, PALETTE.accentB, true);
  padBox(scene, mPad, 0.3, 1, 12, minePadC.x - 6, minePadY + 0.5, minePadC.z, PALETTE.accentB, true);
  padBox(scene, mPad, 0.3, 1, 12, minePadC.x + 6, minePadY + 0.5, minePadC.z, PALETTE.accentB, true);
  // prospector hut: tin shed, lived-in, recently fled
  padBox(scene, mPad, 3, 2.4, 3, minePadC.x + 3.8, minePadY + 1.2, minePadC.z - 3.8, PALETTE.wall);
  padBox(scene, mPad, 1, 1, 1, minePadC.x + 2, minePadY + 0.5, minePadC.z - 3.6, PALETTE.dark);
  const hutLight = new THREE.PointLight(PALETTE.accentB, 12, 14, 1.6);
  hutLight.position.copy(minePadC).add(new THREE.Vector3(2, 3, -2));
  scene.add(hutLight);
  // the host rock looms over the pad
  const hostRock = new THREE.Mesh(new THREE.IcosahedronGeometry(16, 1), mat);
  hostRock.position.copy(minePadC).add(new THREE.Vector3(-6, -19, -4));
  scene.add(hostRock);
  // ore nodes: glowing crystals on pedestals around the pad
  for (let i = 0; i < 4; i++) {
    const px = minePadC.x + Math.cos(i * 1.9) * 4.2;
    const pz = minePadC.z + Math.sin(i * 1.9) * 4.2;
    padBox(scene, mPad, 0.7, 0.5 + (i % 2) * 0.2, 0.7, px, minePadY + 0.25, pz, 0x4a4060);
    const ore = addSalvage(new THREE.OctahedronGeometry(0.3), oreMat, new THREE.Vector3(px, minePadY + 0.85, pz));
    ore.rotation.set(i, i * 2, 0);
    ore.userData.guideTitle = 'ORE NODE';
    ore.userData.guideText = 'Technically the property of a mining concern that dissolved mid-sentence.';
  }
  // floodlight pole
  padBox(scene, mPad, 0.2, 5, 0.2, minePadC.x - 4, minePadY + 2.5, minePadC.z + 4, PALETTE.dark);
  const flood = new THREE.PointLight(0xc0d8ff, 20, 22, 1.6);
  flood.position.copy(minePadC).add(new THREE.Vector3(-4, 5.2, 4));
  scene.add(flood);

  sector.pois.push({
    name: 'ROCK COLLECTION',
    kind: 'asteroids',
    position: clusterCenter,
    dock: {
      shipPos: new THREE.Vector3(minePadC.x - 2.5, minePadY, minePadC.z + 2),
      standPos: new THREE.Vector3(minePadC.x + 1.5, minePadY, minePadC.z - 1),
      floorY: minePadY,
      colliders: mPad,
    },
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
  // rails (the one thing aboard that still works) — gap at north for the airlock
  padBox(scene, dPadColliders, 3.5, 1, 0.3, derelictPos.x - 3.25, dPadY + 0.5, derelictPos.z + 14 - 5, PALETTE.trim, true);
  padBox(scene, dPadColliders, 3.5, 1, 0.3, derelictPos.x + 3.25, dPadY + 0.5, derelictPos.z + 14 - 5, PALETTE.trim, true);
  padBox(scene, dPadColliders, 10, 1, 0.3, derelictPos.x, dPadY + 0.5, derelictPos.z + 14 + 5, PALETTE.trim, true);
  padBox(scene, dPadColliders, 0.3, 1, 10, derelictPos.x - 5, dPadY + 0.5, derelictPos.z + 14, PALETTE.trim, true);
  padBox(scene, dPadColliders, 0.3, 1, 10, derelictPos.x + 5, dPadY + 0.5, derelictPos.z + 14, PALETTE.trim, true);

  // --- derelict lower deck: an airlock off the pad into two rooms of
  // exactly the kind of dark you were warned about
  const dx = derelictPos.x;
  const dz = derelictPos.z + 14; // pad center
  // airlock corridor: pad north edge (z-5) into the hull
  padBox(scene, dPadColliders, 3, 0.6, 6, dx, dPadY - 0.3, dz - 8, PALETTE.floor);
  padBox(scene, dPadColliders, 0.4, 3, 6, dx - 1.7, dPadY + 1.5, dz - 8, 0x3a3148);
  padBox(scene, dPadColliders, 0.4, 3, 6, dx + 1.7, dPadY + 1.5, dz - 8, 0x3a3148);
  padBox(scene, dPadColliders, 3, 0.5, 6, dx, dPadY + 3.2, dz - 8, 0x2a2438);
  // (gap in the pad's north rail so you can actually walk in)
  // room A: cargo bay 9x3x8 at z-15
  padBox(scene, dPadColliders, 9, 0.6, 8, dx, dPadY - 0.3, dz - 15, PALETTE.floor);
  padBox(scene, dPadColliders, 9, 0.5, 8, dx, dPadY + 3.2, dz - 15, 0x2a2438);
  padBox(scene, dPadColliders, 0.4, 3, 8, dx - 4.5, dPadY + 1.5, dz - 15, 0x3a3148);
  padBox(scene, dPadColliders, 0.4, 3, 8, dx + 4.5, dPadY + 1.5, dz - 15, 0x3a3148);
  padBox(scene, dPadColliders, 3.2, 3, 0.4, dx - 3, dPadY + 1.5, dz - 19, 0x3a3148);
  padBox(scene, dPadColliders, 3.2, 3, 0.4, dx + 3, dPadY + 1.5, dz - 19, 0x3a3148); // door gap to room B
  padBox(scene, dPadColliders, 2.8, 3, 0.4, dx - 3.2, dPadY + 1.5, dz - 11, 0x3a3148);
  padBox(scene, dPadColliders, 2.8, 3, 0.4, dx + 3.2, dPadY + 1.5, dz - 11, 0x3a3148);
  // toppled containers + loot
  padBox(scene, dPadColliders, 1.6, 1.6, 1.6, dx - 2.6, dPadY + 0.8, dz - 16, 0x4a4060);
  padBox(scene, dPadColliders, 1.2, 1.2, 1.2, dx + 2.8, dPadY + 0.6, dz - 13.5, 0x4a4060);
  const lootA = addSalvage(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowMat, new THREE.Vector3(dx - 2.6, dPadY + 1.85, dz - 16));
  lootA.userData.guideTitle = 'INTACT CARGO';
  lootA.userData.guideText = 'Still humming faintly in B flat.';
  addSalvage(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowMat, new THREE.Vector3(dx + 1.2, dPadY + 0.25, dz - 17.5));
  addSalvage(new THREE.BoxGeometry(0.4, 0.4, 0.4), glowMat, new THREE.Vector3(dx - 3.6, dPadY + 0.2, dz - 12.3));
  // flickering ceiling light (animated from the frame loop)
  const flicker = new THREE.PointLight(0xfff0d8, 9, 16, 1.6);
  flicker.position.set(dx, dPadY + 2.8, dz - 15);
  flicker.name = 'derelict-flicker';
  scene.add(flicker);
  // room B: the bridge-ish nook with the ship's log
  padBox(scene, dPadColliders, 6, 0.6, 6, dx, dPadY - 0.3, dz - 22.5, PALETTE.floor);
  padBox(scene, dPadColliders, 6, 0.5, 6, dx, dPadY + 3.2, dz - 22.5, 0x2a2438);
  padBox(scene, dPadColliders, 0.4, 3, 6, dx - 3, dPadY + 1.5, dz - 22.5, 0x3a3148);
  padBox(scene, dPadColliders, 0.4, 3, 6, dx + 3, dPadY + 1.5, dz - 22.5, 0x3a3148);
  padBox(scene, dPadColliders, 6, 3, 0.4, dx, dPadY + 1.5, dz - 25.5, 0x3a3148);
  // log terminal: dead console, one stubborn screen
  padBox(scene, dPadColliders, 1.2, 1.4, 0.5, dx, dPadY + 0.7, dz - 24.8, PALETTE.dark);
  const logScreen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.06), new THREE.MeshBasicMaterial({ color: 0x2a4438 }));
  logScreen.position.set(dx, dPadY + 1.6, dz - 24.7);
  logScreen.rotation.x = -0.15;
  logScreen.userData.guideTitle = "SHIP'S LOG";
  logScreen.userData.guideText = 'Final entries preserved. Reading them is salvage etiquette.';
  scene.add(logScreen);
  const logLight = new THREE.PointLight(0x4aff9a, 5, 8, 1.6);
  logLight.position.set(dx, dPadY + 2, dz - 23.5);
  scene.add(logLight);
  sector.logPos = new THREE.Vector3(dx, dPadY + 1.2, dz - 24.7);

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

  // --- dock beacons: tall glowing pillars so pads can be FOUND
  for (const poi of sector.pois) {
    if (!poi.dock) continue;
    const pillarMat = new THREE.MeshBasicMaterial({
      color: PALETTE.trim, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 120, 8, 1, true), pillarMat);
    pillar.position.copy(poi.dock.shipPos).add(new THREE.Vector3(0, 60, 0));
    pillar.name = 'dock-pillar';
    scene.add(pillar);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.25, 6, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.accentA })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(poi.dock.shipPos).add(new THREE.Vector3(0, 6, 0));
    ring.name = 'dock-ring';
    scene.add(ring);
  }

  return sector;
}
