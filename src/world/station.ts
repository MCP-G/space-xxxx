import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';

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
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.08 });
  if (emissive) mat.emissive = new THREE.Color(color);
  applyVertexSnap(mat);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = mesh.receiveShadow = true;
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

  // NPCs are downloaded GLB characters, loaded async by main (see NPC_SPAWNS)

  // --- detail furniture: the difference between a level and a place
  // corridor pipes
  for (const side of [-1.6, 1.6]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x4a4060 })
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side, 2.6, 5);
    scene.add(pipe);
  }
  // ceiling light fixtures down the corridor + rooms
  const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xfff0d8 });
  for (const [fx, fy, fz] of [[0, 2.95, 2], [0, 2.95, 8], [0, 5.95, -8], [0, 3.95, 14]] as const) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.3), fixtureMat);
    fixture.position.set(fx, fy, fz);
    scene.add(fixture);
  }
  // bar stools
  for (let i = 0; i < 3; i++) {
    box(world, 0.5, 0.7, 0.5, -1.2 + i * 1.2, 0.35, 15.4, PALETTE.wall);
  }
  // bottles behind the bar: the inventory is one drink in many costumes
  for (let i = 0; i < 6; i++) {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.34, 6),
      new THREE.MeshLambertMaterial({
        color: [0x4aff9a, 0xff2e88, 0xffd23e, 0x9fd8ff][i % 4],
        emissive: new THREE.Color(0x102010),
      })
    );
    bottle.position.set(-1.4 + i * 0.55, 1.35, 17.9);
    scene.add(bottle);
  }
  box(world, 4, 0.08, 0.5, 0, 1.16, 17.9, PALETTE.wall, { collide: false }); // shelf
  // wall posters (departures that will not be departing)
  const posterA = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), new THREE.MeshBasicMaterial({ color: 0x2a4438 }));
  posterA.position.set(-5.18, 2, 13);
  posterA.rotation.y = Math.PI / 2;
  posterA.userData.guideTitle = 'DEPARTURES BOARD';
  posterA.userData.guideText = 'ALL SERVICES: DELAYED. REASON: TIME IS A SUGGESTION.';
  scene.add(posterA);
  world.guideMeshes.push(posterA as THREE.Mesh);
  const posterB = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), new THREE.MeshBasicMaterial({ color: 0x55092b }));
  posterB.position.set(5.18, 2, 15);
  posterB.rotation.y = -Math.PI / 2;
  posterB.userData.guideTitle = 'MOTIVATIONAL POSTER';
  posterB.userData.guideText = '"THE VOID IS NOT REQUIRED TO CARE. BE THE VOID." — Ministry HR';
  scene.add(posterB);
  world.guideMeshes.push(posterB as THREE.Mesh);
  // vending machine, hangar corner
  box(world, 1, 2, 0.8, -7.4, 1, -1.5, PALETTE.dark, {
    guide: ['VENDING MACHINE', 'Stock: peanuts (emergency), peanuts (recreational), one (1) towel.'],
  });
  box(world, 0.7, 0.9, 0.05, -7.4, 1.3, -1.08, PALETTE.trim, { collide: false, emissive: true });

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

/** Where the locals stand, who they are, and which CC0 model embodies them. */
export const NPC_SPAWNS = [
  {
    model: '/models/Worker.glb', x: 6.4, y: 0, z: -3.2, yaw: -Math.PI / 2.6,
    guideTitle: 'THE ENGINEER',
    guideText: 'Fixes engines for scrap. Fixes everything else for reasons she declines to file.',
  },
  {
    model: '/models/CasualWoman.glb', x: 0.8, y: 0, z: 17.4, yaw: Math.PI,
    guideTitle: 'THE BARTENDER',
    guideText: 'Three hearts, one drink recipe. Pours with the enthusiasm of a tide table.',
  },
  {
    model: '/models/SciFiWoman.glb', x: -4.2, y: 0, z: 13, yaw: Math.PI / 3,
    guideTitle: 'UNCLAIMED PASSENGER',
    guideText: 'Has been waiting for a connecting flight since the timetable was abolished.',
  },
  {
    model: '/models/Spacesuit.glb', x: -6.5, y: 0, z: -10.5, yaw: Math.PI / 2,
    guideTitle: 'SUIT GUY',
    guideText: 'Wears the suit indoors. "You never know," he says. He is statistically correct.',
  },
  {
    model: '/models/Casual.glb', x: 4.4, y: 0, z: 13.4, yaw: -Math.PI / 1.5,
    guideTitle: 'REGULAR PATRON',
    guideText: 'Has a tab. The tab has its own gravitational field.',
  },
] as const;

/** Lines the municipal terminal will say, in order, forever. */
export const TERMINAL_LINES = [
  'WELCOME TO PORT IMPROBABLE. POPULATION: FLUCTUATING.',
  'YOUR COMPLAINT HAS BEEN FILED ON-CHAIN. IT IS NOW PERMANENT AND UNREAD.',
  'TODAY\'S AIR IS PROVIDED BY: SPONSORSHIP REVOKED.',
  'DOCKING FEES ARE WAIVED FOR VESSELS THAT CAN PROVE THEY DO NOT EXIST.',
  'THE MINISTRY OF IMMUTABLE AFFAIRS THANKS YOU FOR YOUR IMMUTABILITY.',
  'LOST PROPERTY: ONE (1) SENSE OF PURPOSE. APPLY DECK 9. DECK 9 IS MISSING.',
];
