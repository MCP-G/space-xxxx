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

  // --- lighting (vibrant neon scheme — blue floods in hangar, teal corridor strips, pink/amber bar)
  scene.add(new THREE.AmbientLight(0x8090c8, 0.9));
  scene.add(new THREE.HemisphereLight(0x5070b0, 0x201828, 0.7));
  // hangar: cool blue floods + warm amber from the ship pad
  const hangarFloodA = new THREE.PointLight(0x4488ff, 55, 24, 1.6);
  hangarFloodA.position.set(-5, 5.5, -8);
  scene.add(hangarFloodA);
  const hangarFloodB = new THREE.PointLight(0x2266dd, 45, 20, 1.6);
  hangarFloodB.position.set(5, 5.5, -10);
  scene.add(hangarFloodB);
  const padAmber = new THREE.PointLight(0xff9944, 30, 16, 1.6);
  padAmber.position.set(0, 2.5, -5);
  scene.add(padAmber);
  // corridor: teal strip accents
  const corrTeal = new THREE.PointLight(0x00cccc, 22, 14, 1.5);
  corrTeal.position.set(0, 2.5, 4);
  scene.add(corrTeal);
  const corrTeal2 = new THREE.PointLight(0x00aaee, 18, 12, 1.5);
  corrTeal2.position.set(0, 2.5, 8);
  scene.add(corrTeal2);
  // bar: amber back-bar + pink neon above sign + purple wash
  const barAmber = new THREE.PointLight(0xff9944, 28, 14, 1.5);
  barAmber.position.set(0, 3, 17);
  scene.add(barAmber);
  const barPink = new THREE.PointLight(0xff44aa, 35, 12, 1.5);
  barPink.position.set(0, 3.8, 10.5);
  scene.add(barPink);
  const barPurple = new THREE.PointLight(0x9933ff, 20, 10, 1.5);
  barPurple.position.set(-4, 2, 15);
  scene.add(barPurple);

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
  field.name = 'atmo-field';
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
    box(world, 0.1, 0.1, 1.2, -1.68, 1.5, z, 0x00cccc, { collide: false, emissive: true });
    box(world, 0.1, 0.1, 1.2, 1.68, 1.5, z, 0xaa44ff, { collide: false, emissive: true });
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

  // --- bar comedy props: the difference between a location and a place
  // ping-pong table in the corner
  box(world, 2.4, 0.08, 1.4, 4, 0.82, 12.5, 0x1155aa, { collide: false });
  box(world, 0.04, 0.2, 1.4, 4, 0.96, 12.5, 0xffffff, { collide: false }); // net
  // arcade machines against the east wall
  box(world, 0.7, 1.8, 0.5, 4.7, 0.9, 13.5, 0x1a0a2a, {
    guide: ['ARCADE: "MINISTRY SIMULATOR"', 'You file forms. The forms file back. 25¢.'],
  });
  box(world, 0.55, 0.6, 0.05, 4.7, 1.55, 13.26, 0x00ff88, { collide: false, emissive: true }); // screen
  box(world, 0.7, 1.8, 0.5, 4.7, 0.9, 15.0, 0x0a1a2a, {
    guide: ['ARCADE: "GOOSE HUNT"', 'Four hops minimum. Prize: disappointment.'],
  });
  box(world, 0.55, 0.6, 0.05, 4.7, 1.55, 14.76, 0xff2e88, { collide: false, emissive: true }); // screen
  // alien plants flanking the bar entrance
  for (const pz of [10.4, 10.6]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 6),
      new THREE.MeshLambertMaterial({ color: 0x1a3a1a }));
    stem.position.set(pz < 10.5 ? -3.5 : 3.5, 0.45, pz);
    scene.add(stem);
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshLambertMaterial({ color: pz < 10.5 ? 0x44cc66 : 0xaa44ff }));
    blob.position.set(pz < 10.5 ? -3.5 : 3.5, 1.1, pz);
    blob.userData.guideTitle = 'ALIEN PLANT';
    blob.userData.guideText = 'Sentient, allegedly. Its opinions are expressed via pollen.';
    scene.add(blob);
    world.guideMeshes.push(blob);
  }
  // hover serving tray near the bartender
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x8a8ac0 }));
  tray.name = 'hover-tray';
  tray.position.set(2.5, 1.3, 16.8);
  scene.add(tray);
  for (let i = 0; i < 3; i++) {
    const drink = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6),
      new THREE.MeshLambertMaterial({ color: [0x4aff9a, 0xff2e88, 0xffd23e][i] }));
    drink.position.set(2.2 + i * 0.3, 1.38, 16.8);
    scene.add(drink);
  }

  // NPCs are downloaded GLB characters, loaded async by main (see NPC_SPAWNS)

  // neon sign over the bar entrance: subtle as a flare gun
  {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.font = 'bold 40px monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 22;
    ctx.fillStyle = '#ff7ab8';
    ctx.fillText('THE RESTAURANT', 256, 42);
    ctx.font = 'bold 26px monospace';
    ctx.shadowColor = '#7fffd4';
    ctx.fillStyle = '#a8ffe8';
    ctx.fillText('AT THE END OF THE CORRIDOR', 256, 78);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 0.64),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    sign.name = 'bar-neon';
    sign.position.set(0, 3.55, 10.04);
    sign.rotation.y = Math.PI; // faces the corridor approach
    scene.add(sign);
  }

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

/** The cast: animated mannequins (UAL clips), tinted per role. */
export const NPC_SPAWNS = [
  {
    tint: 0xffd044, clip: 'Fixing_Kneeling', x: 5.2, y: 0, z: -2.9, yaw: -0.66,
    scale: [1.0, 1.0, 1.0] as [number, number, number],
    guideTitle: 'THE ENGINEER',
    guideText: 'Fixes engines for scrap. Fixes everything else for reasons she declines to file.',
  },
  {
    tint: 0x44cc66, clip: 'Idle_Loop', x: 0.8, y: 0, z: 17.4, yaw: Math.PI,
    scale: [1.2, 0.82, 1.2] as [number, number, number],
    headShape: 'squat' as const,
    guideTitle: 'THE BARTENDER',
    guideText: 'Three hearts, one drink recipe. Pours with the enthusiasm of a tide table.',
  },
  {
    tint: 0x9f7fd4, clip: 'Idle_Talking_Loop', x: -4.2, y: 0, z: 13, yaw: Math.PI / 3,
    scale: [0.85, 1.22, 0.85] as [number, number, number],
    headShape: 'elongated' as const,
    guideTitle: 'UNCLAIMED PASSENGER',
    guideText: 'Talking to the departures board. It has been a long layover. It will be longer.',
  },
  {
    tint: 0xffd044, clip: 'Idle_Loop', x: -6.5, y: 0, z: -10.5, yaw: Math.PI / 2,
    scale: [1.0, 1.0, 1.0] as [number, number, number],
    waypoints: [
      { x: -6.5, z: -10.5, wait: 4 },
      { x: -6.5, z: -2.5, wait: 2 },
      { x: -3.4, z: -1.8, wait: 5 },
      { x: -3.4, z: -9.5, wait: 3 },
    ],
    guideTitle: 'SUIT GUY',
    guideText: 'Patrols the hangar in a full suit. "You never know," he says. He is statistically correct.',
  },
  {
    tint: 0xb0b8c8, clip: 'Sitting_Idle_Loop', x: 1.2, y: 0.42, z: 15.4, yaw: Math.PI,
    scale: [1.3, 1.3, 1.3] as [number, number, number],
    headShape: 'crystal' as const,
    guideTitle: 'REGULAR PATRON',
    guideText: 'Has a tab. The tab has its own gravitational field.',
  },
  {
    tint: 0xff2e88, clip: 'Dance_Loop', x: -3.6, y: 0, z: 16, yaw: Math.PI / 1.3, greets: false,
    scale: [0.88, 1.18, 0.88] as [number, number, number],
    headShape: 'elongated' as const,
    guideTitle: 'THE RAVER',
    guideText: 'Heard the music. Responded proportionally. Has been here for six shifts.',
  },
  {
    tint: 0xffd044, clip: 'Idle_Talking_Loop', x: 3, y: 0, z: -14.5, yaw: -Math.PI / 4,
    scale: [1.0, 1.0, 1.0] as [number, number, number],
    guideTitle: 'DOCKING CONTROLLER',
    guideText: 'Coordinates all arrivals using a combination of hand signals and wishful thinking.',
  },
  {
    tint: 0xffd044, clip: 'Fixing_Kneeling', x: 1.5, y: 0, z: 7, yaw: Math.PI / 2,
    scale: [1.05, 0.95, 1.05] as [number, number, number],
    guideTitle: 'MAINTENANCE WORKER',
    guideText: 'Fixing the same panel for the third time. The panel is winning.',
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
  'GRAVITY WILL BE INTERMITTENT BETWEEN 0300 AND 0300. PLAN ACCORDINGLY.',
  'A REMINDER: THE AIRLOCKS ARE NOT A SHORTCUT. THEY ARE A LONGCUT.',
  'TODAY\'S LOTTERY NUMBERS ARE THE SAME AS YESTERDAY\'S. NOBODY HAS WON SINCE THE INCIDENT.',
  'PLEASE DO NOT GRAFFITI THE GRAFFITI. IT IS HERITAGE NOW.',
  'THE PLANETS VISIBLE FROM DECK 7 ARE NOT ACCEPTING VISITORS. OR APOLOGIES.',
  'YOUR CALL IS IMPORTANT TO US. YOUR ARRIVAL WAS A SURPRISE.',
  'ENGINEERING REPORT: THE LOUD NOISE IS EXPECTED. THE QUIET NOISE IS NOT.',
  'REMINDER: SECTOR DEEDS ARE NON-TRANSFERABLE. SO IS THE SMELL.',
  'FORM 12-C REQUIRED TO FILE FORM 12-C. FORMS AVAILABLE FROM FORM 12-D.',
  'TODAY\'S SPECIAL: WHATEVER IS IN THE GREEN CONTAINER. IT IS WARM. DO NOT INVESTIGATE.',
  'THE BARTENDER IS NOT LICENSED. THE LICENSE IS ON ORDER. THE ORDER IS LOST.',
  'IMMIGRATION STATUS: PROBABLE. EMIGRATION STATUS: ASPIRATIONAL.',
  'MAINTENANCE NOTE: THE FLICKERING IN BAY 4 IS ART NOW.',
  'THIS TERMINAL PROCESSES 14,000 FORMS PER SECOND AND ANSWERS ZERO OF THEM.',
  'ALL WEAPONS MUST BE DECLARED. ALL DECLARATIONS WILL BE MISFILED.',
  'THE SNACK MACHINE APOLOGISES FOR THE INCIDENT. IT CANNOT SAY WHICH ONE.',
  'TRADE ROUTE STATUS: OPTIMISTIC.',
  'HAVE YOU TRIED TURNING THE PROBLEM OFF AND BACK ON AGAIN? THE MINISTRY HAS. IT HELPED BRIEFLY.',
  'EMERGENCY EXITS ARE MARKED WITH THE SIGN THAT WAS THERE BEFORE THE EXIT.',
];
