import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';
import { buildNpc } from './npc';

export interface ColliderBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface World {
  scene: THREE.Scene;
  colliders: ColliderBox[];
  guideMeshes: THREE.Mesh[];
}

export const PALETTE = {
  floor: 0x2a2a3e,
  wall: 0x3d3d5c,
  trim: 0x7fffd4,
  accentA: 0xff2e88,
  accentB: 0xffd23e,
  dark: 0x14141f,
  hull: 0x5c5c8a,
};

export function box(
  world: World,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  color: number,
  opts: { collide?: boolean; emissive?: boolean; guide?: [string, string] } = {}
) {
  const { collide = true, emissive = false, guide } = opts;
  const mat = new THREE.MeshLambertMaterial({ color });
  if (emissive) mat.emissive = new THREE.Color(color);
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
  if (guide) {
    mesh.userData.guideTitle = guide[0];
    mesh.userData.guideText = guide[1];
    world.guideMeshes.push(mesh);
  }
  return mesh;
}

/**
 * Port Improbable, Deck 7: hangar (open to space at the north end, courtesy
 * of an atmosphere retention field of questionable warranty status), a
 * corridor, and the bar. The terminal lives in the bar and has opinions.
 */
export function buildStation(): World {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05050c);
  scene.fog = new THREE.Fog(0x05050c, 14, 400);
  const world: World = { scene, colliders: [], guideMeshes: [] };

  // --- lighting
  scene.add(new THREE.AmbientLight(0x9090c0, 1.0));
  scene.add(new THREE.HemisphereLight(0x6060a0, 0x202030, 0.8));
  const lights: [number, number, number, number, number, number][] = [
    [PALETTE.accentA, 40, -5, 4.5, -10, 20],
    [PALETTE.trim, 35, 5, 4.5, -13, 18],
    [PALETTE.accentB, 12, 0, 2.8, 5, 12],
    [PALETTE.accentA, 25, 0, 3.5, 14, 16],
  ];
  for (const [color, intensity, x, y, z, dist] of lights) {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
  }

  // --- hangar: 16w x 6h x 16d centered at z=-8, OPEN at north (z=-16)
  box(world, 16, 0.5, 16, 0, -0.25, -8, PALETTE.floor, {
    guide: ['HANGAR DECK', 'Rated for 3 ships or 1 ship parked diagonally.'],
  });
  box(world, 16, 0.5, 16, 0, 6.25, -8, PALETTE.dark);
  box(world, 0.5, 6, 16, -8.25, 3, -8, PALETTE.wall);
  box(world, 0.5, 6, 16, 8.25, 3, -8, PALETTE.wall);
  // north wall: only side pillars — the middle 10 units are the field
  box(world, 3, 6, 0.5, -6.5, 3, -16.25, PALETTE.wall);
  box(world, 3, 6, 0.5, 6.5, 3, -16.25, PALETTE.wall);
  box(world, 10, 0.8, 0.5, 0, 5.6, -16.25, PALETTE.wall); // header
  // atmosphere retention field: glowy translucent plane, no collision
  const fieldMat = new THREE.MeshBasicMaterial({
    color: PALETTE.trim,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });
  const field = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.2), fieldMat);
  field.position.set(0, 2.6, -16.25);
  field.userData.guideTitle = 'ATMOSPHERE RETENTION FIELD';
  field.userData.guideText =
    'Keeps the air in and the vacuum out. Warranty expired 47 years ago. It knows.';
  scene.add(field);
  world.guideMeshes.push(field as THREE.Mesh);
  // south wall with corridor gap
  box(world, 6.5, 6, 0.5, -4.75, 3, 0.25, PALETTE.wall);
  box(world, 6.5, 6, 0.5, 4.75, 3, 0.25, PALETTE.wall);

  // --- corridor: 3w x 3h, z=0..10
  box(world, 3, 0.5, 10, 0, -0.25, 5, PALETTE.floor);
  box(world, 3, 0.5, 10, 0, 3.25, 5, PALETTE.dark);
  box(world, 0.5, 3, 10, -1.75, 1.5, 5, PALETTE.wall);
  box(world, 0.5, 3, 10, 1.75, 1.5, 5, PALETTE.wall);
  for (let z = 1; z < 10; z += 2) {
    box(world, 0.1, 0.1, 1.2, -1.68, 1.5, z, PALETTE.trim, { collide: false, emissive: true });
    box(world, 0.1, 0.1, 1.2, 1.68, 1.5, z, PALETTE.accentA, { collide: false, emissive: true });
  }

  // --- bar room: 10w x 4h x 8d centered z=14
  box(world, 10, 0.5, 8, 0, -0.25, 14, PALETTE.floor);
  box(world, 10, 0.5, 8, 0, 4.25, 14, PALETTE.dark);
  box(world, 0.5, 4, 8, -5.25, 2, 14, PALETTE.wall);
  box(world, 0.5, 4, 8, 5.25, 2, 14, PALETTE.wall);
  box(world, 10, 4, 0.5, 0, 2, 18.25, PALETTE.wall);
  box(world, 3.25, 4, 0.5, -3.4, 2, 10.25, PALETTE.wall);
  box(world, 3.25, 4, 0.5, 3.4, 2, 10.25, PALETTE.wall);
  box(world, 4, 1.1, 1, 0, 0.55, 16.5, PALETTE.accentB, {
    guide: ['THE RESTAURANT AT THE END OF THE CORRIDOR', 'Serves one drink. It is green. Do not ask.'],
  });

  // the terminal: a monolith with a screen, next to the bar
  box(world, 0.8, 1.8, 0.4, -3.5, 0.9, 17.5, PALETTE.dark, {
    guide: ['MUNICIPAL TERMINAL', 'Property of the Ministry of Immutable Affairs. Filing backlog: 14,000 years.'],
  });
  box(world, 0.6, 0.5, 0.05, -3.5, 1.4, 17.28, PALETTE.trim, { collide: false, emissive: true });

  // --- the locals
  const engineer = buildNpc({
    skin: 0xd9a066, shirt: 0xff8c2e, trousers: 0x2a2a3e,
    guideTitle: 'THE ENGINEER',
    guideText: 'Fixes engines for scrap. Fixes everything else for reasons she declines to file.',
  });
  engineer.position.set(6.4, 0, -3.2);
  engineer.rotation.y = -Math.PI / 2.6; // leaning toward her crates
  scene.add(engineer);
  world.guideMeshes.push(engineer as unknown as THREE.Mesh);

  const bartender = buildNpc({
    skin: 0x8fd98f, shirt: 0x3d3d5c, trousers: 0x14141f,
    guideTitle: 'THE BARTENDER',
    guideText: 'Three hearts, one drink recipe. Pours with the enthusiasm of a tide table.',
  });
  bartender.position.set(0.8, 0, 17.4);
  bartender.rotation.y = Math.PI; // facing the bar, and therefore you
  scene.add(bartender);
  world.guideMeshes.push(bartender as unknown as THREE.Mesh);

  const lounger = buildNpc({
    skin: 0xc88fd9, shirt: 0x7fffd4, trousers: 0x3a3148,
    guideTitle: 'UNCLAIMED PASSENGER',
    guideText: 'Has been waiting for a connecting flight since the timetable was abolished.',
  });
  lounger.position.set(-4.2, 0, 13);
  lounger.rotation.y = Math.PI / 3;
  scene.add(lounger);
  world.guideMeshes.push(lounger as unknown as THREE.Mesh);

  // clutter crates
  box(world, 1.2, 1.2, 1.2, -5.5, 0.6, -12, PALETTE.accentA, {
    guide: ['CRATE (PINK)', 'Contents: 4,000 commemorative towels. Unclaimed.'],
  });
  box(world, 1, 1, 1, -4.2, 0.5, -12.5, PALETTE.wall);
  box(world, 1.4, 1.4, 1.4, 6, 0.7, -4, PALETTE.trim);
  box(world, 0.9, 0.9, 0.9, 6.2, 1.85, -4.1, PALETTE.wall);

  // --- station exterior shell (seen when flying): big greebled slab around the deck
  const shellMat = new THREE.MeshLambertMaterial({ color: 0x23233a });
  applyVertexSnap(shellMat);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(40, 18, 50), shellMat);
  shell.position.set(0, 3, 8.75); // front face flush with the hangar mouth plane
  // carve illusion: shell sits behind the hangar mouth; not collidable for walking
  scene.add(shell);
  // greebles
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(2 + (i % 4), 1 + (i % 3), 2 + ((i * 7) % 5)),
      shellMat
    );
    const angle = (i / 14) * Math.PI * 2;
    g.position.set(Math.cos(angle) * 22, 3 + Math.sin(i * 3.7) * 7, 8 + Math.sin(angle) * 27);
    scene.add(g);
  }
  // blinking beacon light on the shell
  const beaconMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentA });
  const blinker = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), beaconMat);
  blinker.position.set(0, 13, 8);
  blinker.name = 'shell-blinker';
  scene.add(blinker);

  return world;
}

/** Lines the municipal terminal will say, in order, forever. */
export const TERMINAL_LINES = [
  'WELCOME TO PORT IMPROBABLE. POPULATION: FLUCTUATING.',
  'YOUR COMPLAINT HAS BEEN FILED ON-CHAIN. IT IS NOW PERMANENT AND UNREAD.',
  'TODAY\'S AIR IS PROVIDED BY: SPONSORSHIP REVOKED.',
  'DOCKING FEES ARE WAIVED FOR VESSELS THAT CAN PROVE THEY DO NOT EXIST.',
  'THE MINISTRY OF IMMUTABLE AFFAIRS THANKS YOU FOR YOUR IMMUTABILITY.',
  'LOST PROPERTY: ONE (1) SENSE OF PURPOSE. APPLY DECK 9. DECK 9 IS MISSING.',
];
