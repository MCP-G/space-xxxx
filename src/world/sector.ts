import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';
import { PALETTE, type ColliderBox, type World } from './station';
import { DecaySystem } from '../lib/world/Decay';
import { WindowSystem } from '../lib/world/Windows';

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
  kind: 'asteroids' | 'derelict' | 'beacon' | 'wreck' | 'nebula' | 'monolith' | 'planet';
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
  /** Decorative objects that drift and tumble gently (never walkable geometry). */
  floaters: Floater[];
}

export interface Floater {
  obj: THREE.Object3D;
  base: THREE.Vector3;     // resting position
  amp: number;             // bob amplitude (m)
  speed: number;           // bob speed
  phase: number;
  spin: number;            // rad/s around a lazy axis
}

export const DERELICT_LOGS = [
  'LOG 4411: CAPTAIN SAYS THE NOISE IS NOTHING. THE NOISE DISAGREES.',
  'LOG 4412: RAN OUT OF TEA. MORALE STRUCTURALLY COMPROMISED.',
  'LOG 4413: THE CARGO IS HUMMING IN B FLAT. REQUESTING HAZARD PAY.',
  'LOG 4414: CREW VOTE HELD. UNANIMOUS DECISION: "WE QUIT." EVEN THE NOISE VOTED.',
  'LOG 4415 (AUTOMATED): LIFE SUPPORT IDLE. PLANTS DOING FINE WITHOUT YOU, FRANKLY.',
  'LOG 4416 (AUTOMATED): A SHIP DOCKED. SOMEONE READ THE LOGS. HELLO, SOMEONE.',
  'LOG 4417 (AUTOMATED): THE NOISE WOULD LIKE ITS LOG ENTRIES BACK.',
  'LOG 4418 (AUTOMATED): VISIBLE PLANET COUNT UNCHANGED. PLANETS REMAIN ALOOF.',
];

function rockMat() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a4060, roughness: 0.95, metalness: 0.02 });
  applyVertexSnap(mat);
  return mat;
}

function padBox(
  parent: THREE.Object3D, colliders: ColliderBox[],
  w: number, h: number, d: number, x: number, y: number, z: number,
  color: number, emissive = false
) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
  if (emissive) mat.emissive = new THREE.Color(color);
  applyVertexSnap(mat);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = mesh.receiveShadow = true;
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
  const sector: Sector = { seed, root: scene, pois: [], asteroids: [], salvage: [], floaters: [] };
  const float = (obj: THREE.Object3D, amp = 0.6, spin = 0.02) => {
    sector.floaters.push({
      obj, base: obj.position.clone(),
      amp, speed: 0.2 + rnd() * 0.3, phase: rnd() * Math.PI * 2, spin,
    });
  };

  const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.trim });
  const oreMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentB });
  const addSalvage = (geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    sector.salvage.push({ mesh, position: pos.clone() });
    return mesh;
  };

  // --- starfield: three layers — tiny dust, mids, brights
  const starTints = [0xc0c0e8, 0xffffff, 0x9fd8ff, 0xffd8b0, 0xffb0d8];
  for (let layer = 0; layer < 3; layer++) {
    const starGeo = new THREE.BufferGeometry();
    const starCount = layer === 0 ? 4500 : layer === 1 ? 3200 : 1400;
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
      vertexColors: true,
      // pinpricks, not confetti: sub-2px even on the bright layer
      size: layer === 0 ? 0.5 : layer === 1 ? 0.9 : 1.6,
      sizeAttenuation: false,
      opacity: layer === 0 ? 0.45 : layer === 1 ? 0.8 : 1,
      transparent: layer < 2,
      fog: false, // stars sit beyond the fog's far plane — never fog them out
    }));
    scene.add(stars);
  }

  // sun-ish directional light so exteriors read in space
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(40, 70, -60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 300;
  const sc = sun.shadow.camera;
  sc.left = -80; sc.right = 80; sc.top = 80; sc.bottom = -80;
  scene.add(sun);
  scene.add(sun.target);
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
    float(rock, 0.8, 0.04 + rnd() * 0.05);
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
  // east rail split: gap in the middle opens onto the catwalk
  padBox(scene, mPad, 0.3, 1, 4.8, minePadC.x + 6, minePadY + 0.5, minePadC.z - 3.6, PALETTE.accentB, true);
  padBox(scene, mPad, 0.3, 1, 4.8, minePadC.x + 6, minePadY + 0.5, minePadC.z + 3.6, PALETTE.accentB, true);
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
  // catwalk east to the crystal platform (rail gap in the pad's east side)
  padBox(scene, mPad, 10, 0.5, 2.4, minePadC.x + 11, minePadY - 0.25, minePadC.z, PALETTE.floor);
  padBox(scene, mPad, 10, 0.8, 0.2, minePadC.x + 11, minePadY + 0.4, minePadC.z - 1.2, PALETTE.accentB, true);
  padBox(scene, mPad, 10, 0.8, 0.2, minePadC.x + 11, minePadY + 0.4, minePadC.z + 1.2, PALETTE.accentB, true);
  // crystal platform: where the rock keeps its savings
  padBox(scene, mPad, 10, 0.6, 10, minePadC.x + 20, minePadY - 0.3, minePadC.z, PALETTE.floor);
  padBox(scene, mPad, 10, 1, 0.3, minePadC.x + 20, minePadY + 0.5, minePadC.z - 5, PALETTE.trim, true);
  padBox(scene, mPad, 10, 1, 0.3, minePadC.x + 20, minePadY + 0.5, minePadC.z + 5, PALETTE.trim, true);
  padBox(scene, mPad, 0.3, 1, 10, minePadC.x + 25, minePadY + 0.5, minePadC.z, PALETTE.trim, true);
  // monumental crystals (decorative; the small ones are the mineable ones)
  for (let i = 0; i < 3; i++) {
    const big = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6 + i * 0.7),
      new THREE.MeshLambertMaterial({ color: PALETTE.accentB, emissive: new THREE.Color(0x6a5200) })
    );
    big.position.set(minePadC.x + 17 + i * 3, minePadY + 1.6 + i * 0.7, minePadC.z - 2 + i * 2.2);
    big.rotation.set(i, i * 2.2, 0.3);
    big.userData.guideTitle = 'CRYSTAL FORMATION';
    big.userData.guideText = 'Grew here over nine million years. The mining concern gave it a barcode.';
    scene.add(big);
  }
  const crystalGlow = new THREE.PointLight(PALETTE.accentB, 24, 20, 1.6);
  crystalGlow.position.set(minePadC.x + 20, minePadY + 4, minePadC.z);
  scene.add(crystalGlow);
  // two more ore nodes out on the platform
  for (let i = 0; i < 2; i++) {
    const px = minePadC.x + 19 + i * 3.4;
    const pz = minePadC.z + 3 - i * 5.5;
    padBox(scene, mPad, 0.7, 0.55, 0.7, px, minePadY + 0.27, pz, 0x4a4060);
    const ore = addSalvage(new THREE.OctahedronGeometry(0.3), oreMat, new THREE.Vector3(px, minePadY + 0.9, pz));
    ore.rotation.set(i * 2, i, 1);
    ore.userData.guideTitle = 'ORE NODE';
    ore.userData.guideText = 'Glows encouragingly. Geologists call this "a trap". Miners call it "Tuesday".';
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
  float(derelict, 0.35, 0); // hull breathes; the walkable deck stays put

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
  // far wall split: a door through to the engine room
  padBox(scene, dPadColliders, 2.2, 3, 0.4, dx - 1.9, dPadY + 1.5, dz - 25.5, 0x3a3148);
  padBox(scene, dPadColliders, 2.2, 3, 0.4, dx + 1.9, dPadY + 1.5, dz - 25.5, 0x3a3148);

  // engine room: the reactor idles at 4%, which the manual calls "sulking"
  padBox(scene, dPadColliders, 10, 0.6, 9, dx, dPadY - 0.3, dz - 30.5, PALETTE.floor);
  padBox(scene, dPadColliders, 10, 0.5, 9, dx, dPadY + 3.7, dz - 30.5, 0x2a2438);
  padBox(scene, dPadColliders, 0.4, 4, 9, dx - 5, dPadY + 2, dz - 30.5, 0x3a3148);
  padBox(scene, dPadColliders, 0.4, 4, 9, dx + 5, dPadY + 2, dz - 30.5, 0x3a3148);
  padBox(scene, dPadColliders, 10, 4, 0.4, dx, dPadY + 2, dz - 35, 0x3a3148);
  // the reactor core: a humming column nobody should lick
  padBox(scene, dPadColliders, 2.2, 0.4, 2.2, dx, dPadY + 0.2, dz - 31.5, 0x4a4060);
  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.7, 2.8, 10),
    new THREE.MeshLambertMaterial({ color: 0x4aff9a, emissive: new THREE.Color(0x0a4426) })
  );
  core.position.set(dx, dPadY + 1.8, dz - 31.5);
  core.name = 'derelict-core';
  core.userData.guideTitle = 'REACTOR CORE';
  core.userData.guideText = 'Hums in B flat. The cargo learned it from somewhere.';
  scene.add(core);
  const coreLight = new THREE.PointLight(0x4aff9a, 16, 18, 1.6);
  coreLight.position.set(dx, dPadY + 2.4, dz - 31.5);
  scene.add(coreLight);
  // pipes along the walls + two more pieces of salvage
  for (const sx of [-4.6, 4.6]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8.4, 8), new THREE.MeshLambertMaterial({ color: 0x4a4060 }));
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(dx + sx, dPadY + 2.6, dz - 30.5);
    scene.add(pipe);
  }
  addSalvage(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowMat, new THREE.Vector3(dx - 3.6, dPadY + 0.25, dz - 33));
  addSalvage(new THREE.BoxGeometry(0.4, 0.4, 0.4), glowMat, new THREE.Vector3(dx + 3.8, dPadY + 0.2, dz - 28.5));
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
  float(pylon, 0.3, 0);
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
  // kiosk shelter: walls, a counter, a bench for existential pauses
  padBox(scene, bPadColliders, 5, 0.5, 5, beaconPos.x + 1.5, bPadY + 2.75, beaconPos.z - 1.5, 0x2a2438);
  padBox(scene, bPadColliders, 5, 3, 0.4, beaconPos.x + 1.5, bPadY + 1.5, beaconPos.z - 3.8, PALETTE.wall);
  padBox(scene, bPadColliders, 0.4, 3, 2.2, beaconPos.x + 3.8, bPadY + 1.5, beaconPos.z - 2.8, PALETTE.wall);
  padBox(scene, bPadColliders, 0.4, 3, 2.2, beaconPos.x - 0.8, bPadY + 1.5, beaconPos.z - 2.8, PALETTE.wall);
  padBox(scene, bPadColliders, 1, 1.6, 0.6, beaconPos.x + 2, bPadY + 0.8, beaconPos.z - 2, PALETTE.dark);
  padBox(scene, bPadColliders, 2, 0.5, 0.8, beaconPos.x + 0.2, bPadY + 0.25, beaconPos.z - 3.2, PALETTE.accentA);
  const kioskLight = new THREE.PointLight(PALETTE.trim, 8, 10, 1.6);
  kioskLight.position.set(beaconPos.x + 1.5, bPadY + 2.4, beaconPos.z - 2);
  scene.add(kioskLight);

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

  // --- wreck field: six dead hulls, one dockable gantry, finders-keepers
  const wreckPos = new THREE.Vector3(
    (rnd() - 0.5) * 200, 30 + rnd() * 40, -380 - rnd() * 120
  );
  const wMat = new THREE.MeshLambertMaterial({ color: 0x35304a });
  applyVertexSnap(wMat);
  for (let i = 0; i < 6; i++) {
    const hulk = new THREE.Group();
    const segs = 2 + Math.floor(rnd() * 3);
    for (let s = 0; s < segs; s++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(3 + rnd() * 5, 2 + rnd() * 3, 4 + rnd() * 6), wMat);
      seg.position.set(s * 4, (rnd() - 0.5) * 2, (rnd() - 0.5) * 3);
      seg.rotation.set(rnd(), rnd(), rnd() * 0.5);
      hulk.add(seg);
    }
    hulk.position.copy(wreckPos).add(new THREE.Vector3((rnd() - 0.5) * 80, (rnd() - 0.5) * 40, (rnd() - 0.5) * 80));
    hulk.rotation.y = rnd() * Math.PI * 2;
    scene.add(hulk);
    float(hulk, 1.4, 0.06 + rnd() * 0.06);
  }
  const wPadColliders: ColliderBox[] = [];
  const wPadY = wreckPos.y - 12;
  padBox(scene, wPadColliders, 9, 0.6, 9, wreckPos.x, wPadY - 0.3, wreckPos.z, PALETTE.floor);
  padBox(scene, wPadColliders, 9, 1, 0.3, wreckPos.x, wPadY + 0.5, wreckPos.z - 4.5, PALETTE.accentA, true);
  padBox(scene, wPadColliders, 9, 1, 0.3, wreckPos.x, wPadY + 0.5, wreckPos.z + 4.5, PALETTE.accentA, true);
  padBox(scene, wPadColliders, 0.3, 1, 9, wreckPos.x - 4.5, wPadY + 0.5, wreckPos.z, PALETTE.accentA, true);
  padBox(scene, wPadColliders, 0.3, 1, 9, wreckPos.x + 4.5, wPadY + 0.5, wreckPos.z, PALETTE.accentA, true);
  // a crane gantry and crates that outlived their ships
  padBox(scene, wPadColliders, 0.3, 6, 0.3, wreckPos.x - 3, wPadY + 3, wreckPos.z - 3, PALETTE.dark);
  padBox(scene, wPadColliders, 5, 0.3, 0.3, wreckPos.x - 0.7, wPadY + 5.8, wreckPos.z - 3, PALETTE.dark);
  padBox(scene, wPadColliders, 1.3, 1.3, 1.3, wreckPos.x + 2.5, wPadY + 0.65, wreckPos.z + 2.5, 0x4a4060);
  addSalvage(new THREE.BoxGeometry(0.5, 0.5, 0.5), glowMat, new THREE.Vector3(wreckPos.x + 2.5, wPadY + 1.55, wreckPos.z + 2.5));
  addSalvage(new THREE.BoxGeometry(0.45, 0.45, 0.45), glowMat, new THREE.Vector3(wreckPos.x - 2.8, wPadY + 0.22, wreckPos.z + 1));
  addSalvage(new THREE.BoxGeometry(0.4, 0.4, 0.4), glowMat, new THREE.Vector3(wreckPos.x + 0.5, wPadY + 0.2, wreckPos.z - 3.2));
  sector.pois.push({
    name: 'WRECK FIELD',
    kind: 'wreck',
    position: wreckPos,
    dock: {
      shipPos: new THREE.Vector3(wreckPos.x - 1, wPadY, wreckPos.z + 1),
      standPos: new THREE.Vector3(wreckPos.x + 2, wPadY, wreckPos.z - 1),
      floorY: wPadY,
      colliders: wPadColliders,
    },
    guideTitle: 'WRECK FIELD KESSLER-MINOR',
    guideText: 'Six ships entered a dispute over right of way. The dispute won.',
  });

  // --- nebulette: a small, privately disappointing nebula
  const nebPos = new THREE.Vector3(-(200 + rnd() * 150), 60 + rnd() * 50, -320 - rnd() * 100);
  const nebTints = [0xff2e88, 0x7fffd4, 0x6a4a8a];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(18 + rnd() * 22, 10, 8),
      new THREE.MeshBasicMaterial({
        color: nebTints[i % nebTints.length], transparent: true, opacity: 0.05 + rnd() * 0.05,
        depthWrite: false,
      })
    );
    puff.position.copy(nebPos).add(new THREE.Vector3((rnd() - 0.5) * 70, (rnd() - 0.5) * 40, (rnd() - 0.5) * 70));
    scene.add(puff);
    float(puff, 3, 0.008);
  }
  const nebLight = new THREE.PointLight(0xff2e88, 40, 160, 1.4);
  nebLight.position.copy(nebPos);
  scene.add(nebLight);
  sector.pois.push({
    name: 'NEBULETTE',
    kind: 'nebula',
    position: nebPos,
    guideTitle: 'THE NEBULETTE',
    guideText: 'A nebula of modest ambition. Locals describe it as "load-bearing fog".',
  });

  // --- the monolith: tall, black, smug
  const monoPos = new THREE.Vector3((rnd() - 0.5) * 300, -(60 + rnd() * 60), -300 - rnd() * 200);
  const mono = new THREE.Mesh(
    new THREE.BoxGeometry(4, 36, 9),
    new THREE.MeshLambertMaterial({ color: 0x0a0a12 })
  );
  mono.position.copy(monoPos);
  mono.rotation.y = rnd() * Math.PI;
  mono.userData.guideTitle = 'THE MONOLITH';
  mono.userData.guideText = 'Ratio 1:4:9. It is not transmitting. It is, however, judging.';
  scene.add(mono);
  float(mono, 0.9, 0.02);
  const monoRim = new THREE.PointLight(0x9fd8ff, 30, 90, 1.5);
  monoRim.position.copy(monoPos).add(new THREE.Vector3(8, 10, 8));
  scene.add(monoRim);
  sector.pois.push({
    name: 'MONOLITH',
    kind: 'monolith',
    position: monoPos,
    guideTitle: 'THE MONOLITH',
    guideText: 'Ratio 1:4:9. It is not transmitting. It is, however, judging.',
  });

  // --- planets: enormous, indifferent, mostly harmless
  const PLANET_NAMES: [string, string][] = [
    ['BRUNCH', 'Tidally locked. One hemisphere is always 11am.'],
    ['NEW SLOUGH', 'Twinned with Old Slough, which is also here, administratively.'],
    ['PRAXIBETEL B', 'Population: disputed. The dispute has its own population.'],
    ['TAXHAVEN IX', 'Gravity declared as a business expense.'],
    ['DENTRASSI PRIME', 'Excellent catering. Do not ask what it is.'],
    ['MOSTLY HARMLESS', 'Revised entry. The revision is also mostly harmless.'],
    ['B-AND-B WORLD', 'Continental breakfast served at continental scale.'],
    ['THE LONG QUEUE', 'A gas giant. The queue is for the surface. There is no surface.'],
  ];
  const planetTexture = (style: number): THREE.Texture | null => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d')!;
    const palettes = [
      ['#3a2148', '#6a3a78', '#ff2e88', '#2a1838'],   // hot pink giant
      ['#16323a', '#2a5a4a', '#7fffd4', '#0e2028'],   // mint storm
      ['#3a3148', '#5a4a38', '#ffd23e', '#241a20'],   // amber dust
      ['#1a2030', '#2a3a5a', '#9fd8ff', '#101420'],   // ice
    ];
    const pal = palettes[style % palettes.length];
    ctx.fillStyle = pal[3];
    ctx.fillRect(0, 0, 512, 256);
    // latitudinal bands with wobble
    for (let y = 0; y < 256; y += 4) {
      const band = pal[Math.floor((Math.sin(y * 0.07 + style) + 1) * 1.49) % 3];
      ctx.fillStyle = band;
      ctx.globalAlpha = 0.5 + Math.sin(y * 0.21) * 0.3;
      const wob = Math.sin(y * 0.12 + style * 2) * 14;
      ctx.fillRect(0, y + wob * 0.1, 512, 3.2);
      void wob;
    }
    // storms
    ctx.globalAlpha = 0.55;
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = pal[i % 3];
      ctx.beginPath();
      ctx.ellipse(rnd() * 512, 40 + rnd() * 176, 14 + rnd() * 40, 6 + rnd() * 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const planetCount = 2 + Math.floor(rnd() * 2);
  const nameOffset = Math.floor(rnd() * PLANET_NAMES.length);
  for (let i = 0; i < planetCount; i++) {
    const [pname, pguide] = PLANET_NAMES[(nameOffset + i * 3) % PLANET_NAMES.length];
    const radius = 70 + rnd() * 90;
    const dir = (i / planetCount) * Math.PI * 2 + rnd() * 1.2;
    const dist = 650 + rnd() * 400;
    const pos = new THREE.Vector3(
      Math.cos(dir) * dist,
      (rnd() - 0.5) * 300,
      -200 + Math.sin(dir) * dist
    );
    const tex = planetTexture(i + Math.floor(rnd() * 4));
    const mat = tex
      ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 })
      : new THREE.MeshStandardMaterial({ color: 0x6a3a78, roughness: 0.9 });
    mat.fog = false; // planets live beyond the fog, like the stars
    const planet = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
    planet.position.copy(pos);
    planet.rotation.z = (rnd() - 0.5) * 0.5;
    planet.userData.guideTitle = pname;
    planet.userData.guideText = pguide;
    scene.add(planet);
    float(planet, 0, 0.004 + rnd() * 0.004);
    // ring system for the lucky ones
    if (rnd() > 0.55) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.35, radius * 1.9, 64),
        new THREE.MeshBasicMaterial({
          color: [0xff2e88, 0x7fffd4, 0xffd23e][i % 3],
          transparent: true, opacity: 0.18, side: THREE.DoubleSide, fog: false,
        })
      );
      ring.position.copy(pos);
      ring.rotation.x = Math.PI / 2 + (rnd() - 0.5) * 0.6;
      scene.add(ring);
    }
    // a soft rim light so it reads against the void
    const rim = new THREE.PointLight(0xfff0d8, radius * 2, radius * 6, 1.8);
    rim.position.copy(pos).add(new THREE.Vector3(radius * 1.6, radius, -radius));
    scene.add(rim);
    sector.pois.push({
      name: pname,
      kind: 'planet',
      position: pos,
      guideTitle: pname,
      guideText: pguide,
    });
  }

  // --- cyber decay: every outpost has been tagged, littered, abandoned
  // (guarded: canvas textures need a DOM; node tests build sectors too)
  if (typeof document !== 'undefined') {
    const decay = new DecaySystem(scene, seed ^ 0xdeca1);
    const windows = new WindowSystem(scene, seed ^ 0x717d05);
    for (const poi of sector.pois) {
      if (!poi.dock) continue;
      decay.apply(poi.dock.colliders, {
        wallDensity: poi.kind === 'derelict' ? 1.8 : 0.9,
        floorDensity: poi.kind === 'derelict' ? 3.5 : 2,
      });
      windows.apply(poi.dock.colliders, { density: 0.5 });
    }
  }

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
