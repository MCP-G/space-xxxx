import './style.css';
import * as THREE from 'three';
import { PixelPipeline } from './render/PixelPipeline';
import { buildStation, TERMINAL_LINES } from './world/station';
import { buildSector, type Poi } from './world/sector';
import { WalkController } from './player/WalkController';
import { FlightController } from './player/FlightController';
import { Ship } from './ship/Ship';
import { AudioDirector } from './audio/AudioDirector';
import { Hud } from './ui/hud';
import { InteractionRegistry } from './core/Interactable';
import { Ministry } from './chain/ministry';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const boot = document.querySelector<HTMLDivElement>('#boot')!;
const legacyHud = document.querySelector<HTMLDivElement>('#hud')!;
legacyHud.textContent =
  'WASD move · SHIFT sprint/boost · E interact\n' +
  'FLIGHT: mouse steer · W/S thrust · A/D strafe · R/F lift · SPACE brake\n' +
  'PORT IMPROBABLE — Deck 7 (allegedly)';

const pipeline = new PixelPipeline(canvas);
const world = buildStation();
const ministry = new Ministry();
let sector = buildSector(world, ministry.improviseSeed());
const audio = new AudioDirector();
const hud = new Hud();
const interactions = new InteractionRegistry();

// --- ship, parked in the hangar, nose at the field
const ship = new Ship();
world.scene.add(ship.group);
const HANGAR_PARK = { x: 0, y: 0, z: -10, yaw: 0 };
ship.park(HANGAR_PARK.x, HANGAR_PARK.y, HANGAR_PARK.z, HANGAR_PARK.yaw);

// --- controllers + mode machine
type Mode = 'walk' | 'fly';
let mode: Mode = 'walk';
const walk = new WalkController(pipeline.aspect, canvas);
const flight = new FlightController(ship, canvas);
walk.onFootstep = () => audio.footstep();
walk.setPosition(0, 0, -4, Math.PI);

// active landing pad (its colliders + floor join the walkable set)
let activePoi: Poi | null = null;

function enterFlight() {
  mode = 'fly';
  walk.active = false;
  flight.active = true;
  flight.syncToShip();
  audio.setMode('flight');
  hud.hideGuide();
  hud.say('THE HEART OF MILD INCONVENIENCE reluctantly agrees to fly.');
  pipeline.triggerGlitch(0.5);
  audio.glitchBurst();
}

function enterWalk(x: number, y: number, z: number) {
  mode = 'walk';
  flight.active = false;
  walk.active = true;
  walk.setPosition(x, y, z);
  audio.setMode('station');
  audio.setThrust(0);
}

// --- interactables
const seatPos = new THREE.Vector3();
const seatInteract = interactions.add({
  position: seatPos,
  radius: 1.6,
  label: 'E — TAKE THE SEAT',
  enabled: true,
  onUse: () => { if (mode === 'walk') enterFlight(); },
});

let terminalIdx = 0;
interactions.add({
  position: new THREE.Vector3(-3.5, 0.9, 17.5),
  radius: 2.2,
  label: 'E — CONSULT TERMINAL',
  enabled: true,
  onUse: () => {
    hud.say(TERMINAL_LINES[terminalIdx % TERMINAL_LINES.length], 5);
    terminalIdx++;
    pipeline.triggerGlitch(0.3);
    audio.glitchBurst();
  },
});

// Ministry filing window: the screen beside the terminal monolith
let filing = false;
interactions.add({
  position: new THREE.Vector3(-3.5, 1.4, 17.3),
  radius: 1.8,
  label: 'E — FILE FORM 88-B (CLAIM A SECTOR)',
  enabled: true,
  onUse: () => {
    if (filing) return;
    filing = true;
    hud.say('MINISTRY OF IMMUTABLE AFFAIRS: PROCESSING…', 3);
    ministry.claimSector((u) => {
      hud.say(u.text, u.stage === 'granted' ? 8 : 5);
      pipeline.triggerGlitch(u.stage === 'rejected' ? 0.9 : 0.5);
      audio.glitchBurst();
      if (u.stage === 'granted') setSector(u.seed);
      if (u.stage === 'granted' || u.stage === 'rejected') filing = false;
    });
  },
});

// --- docking (flight mode): station berth + POI pads
interface DockSpot {
  name: string;
  shipPos: THREE.Vector3;
  shipYaw: number;
  standPos: THREE.Vector3;
  poi: Poi | null;
}
function buildDockSpots(): DockSpot[] {
  return [
    {
      name: 'PORT IMPROBABLE',
      shipPos: new THREE.Vector3(HANGAR_PARK.x, HANGAR_PARK.y, HANGAR_PARK.z),
      shipYaw: HANGAR_PARK.yaw,
      standPos: new THREE.Vector3(0, 0, -5.4),
      poi: null,
    },
    ...sector.pois.filter((p) => p.dock).map((p) => ({
      name: p.name,
      shipPos: p.dock!.shipPos.clone(),
      shipYaw: 0,
      standPos: p.dock!.standPos.clone(),
      poi: p,
    })),
  ];
}
let dockSpots = buildDockSpots();

/** Tear down the current sector and generate a new one from `seed`. */
function setSector(seed: number) {
  world.scene.remove(sector.root);
  sector.root.traverse((o: any) => {
    o.geometry?.dispose?.();
    o.material?.dispose?.();
  });
  sector = buildSector(world, seed);
  dockSpots = buildDockSpots();
  activePoi = null;
  // anyone not at the station gets repossessed to the hangar, for safety
  ship.park(HANGAR_PARK.x, HANGAR_PARK.y, HANGAR_PARK.z, HANGAR_PARK.yaw);
  if (mode === 'fly') enterWalk(0, 0, -5.4);
  else walk.setPosition(0, 0, -5.4);
  pipeline.triggerGlitch(1);
  audio.glitchBurst();
}

function nearestDock(): DockSpot | null {
  for (const d of dockSpots) {
    if (ship.position.distanceTo(d.shipPos) < 14) return d;
  }
  return null;
}

function dockAt(spot: DockSpot) {
  ship.park(spot.shipPos.x, spot.shipPos.y, spot.shipPos.z, spot.shipYaw);
  activePoi = spot.poi;
  enterWalk(spot.standPos.x, spot.shipPos.y, spot.standPos.z);
  hud.setFlight(null);
  hud.say(`DOCKED: ${spot.name}. Parking validated. Validation meaningless.`);
  pipeline.triggerGlitch(0.6);
  audio.glitchBurst();
}

// --- E key
document.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE') return;
  if (mode === 'walk') {
    const it = interactions.nearest(walk.camera.position);
    it?.onUse();
  } else {
    const spot = nearestDock();
    if (spot && flight.speed < 20) dockAt(spot);
  }
});

// --- guide raycaster: dwell on a tagged object to get an entry
const raycaster = new THREE.Raycaster();
raycaster.far = 8;
let guideTimer = 0;
let lastGuideKey = '';
function updateGuide(dt: number, camera: THREE.PerspectiveCamera) {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(world.scene.children, true);
  let found: { title: string; text: string } | null = null;
  for (const h of hits) {
    let o: THREE.Object3D | null = h.object;
    while (o) {
      if (o.userData.guideTitle) {
        found = { title: o.userData.guideTitle, text: o.userData.guideText };
        break;
      }
      o = o.parent;
    }
    if (found) break;
  }
  if (found) {
    const key = found.title;
    guideTimer = key === lastGuideKey ? guideTimer + dt : 0;
    lastGuideKey = key;
    if (guideTimer > 0.5) hud.showGuide(found.title, found.text);
  } else {
    guideTimer = 0;
    lastGuideKey = '';
    hud.hideGuide();
  }
}

// --- flight collision: hangar channel clamp, shell AABB, asteroid bounce
const SHELL = {
  min: new THREE.Vector3(-20, -6, -16.25),
  max: new THREE.Vector3(20, 12, 33.75),
};
function flightCollisions() {
  const p = ship.position;
  const inHangar = p.z > -16.5 && p.z < 0 && Math.abs(p.x) < 8 && p.y < 6;
  if (inHangar) {
    p.x = THREE.MathUtils.clamp(p.x, -6, 6);
    p.y = THREE.MathUtils.clamp(p.y, 0, 4);
    if (p.z > -2) { p.z = -2; ship.velocity.z = Math.min(0, ship.velocity.z); }
    return;
  }
  // station shell: push out along the shallowest axis
  if (
    p.x > SHELL.min.x && p.x < SHELL.max.x &&
    p.y > SHELL.min.y && p.y < SHELL.max.y &&
    p.z > SHELL.min.z && p.z < SHELL.max.z
  ) {
    // allow the hangar mouth channel
    if (!(Math.abs(p.x) < 5 && p.y > 0 && p.y < 5.2 && p.z < -14)) {
      const dists = [
        { d: p.x - SHELL.min.x, fix: () => { p.x = SHELL.min.x; ship.velocity.x = 0; } },
        { d: SHELL.max.x - p.x, fix: () => { p.x = SHELL.max.x; ship.velocity.x = 0; } },
        { d: p.y - SHELL.min.y, fix: () => { p.y = SHELL.min.y; ship.velocity.y = 0; } },
        { d: SHELL.max.y - p.y, fix: () => { p.y = SHELL.max.y; ship.velocity.y = 0; } },
        { d: p.z - SHELL.min.z, fix: () => { p.z = SHELL.min.z; ship.velocity.z = 0; } },
        { d: SHELL.max.z - p.z, fix: () => { p.z = SHELL.max.z; ship.velocity.z = 0; } },
      ];
      dists.sort((a, b) => a.d - b.d)[0].fix();
      pipeline.triggerGlitch(0.7);
      audio.glitchBurst();
    }
  }
  // asteroids: sphere bounce
  for (const a of sector.asteroids) {
    const d = p.distanceTo(a.position);
    const minD = a.radius + 3;
    if (d < minD) {
      const n = p.clone().sub(a.position).normalize();
      p.copy(a.position).addScaledVector(n, minD);
      const vn = ship.velocity.dot(n);
      if (vn < 0) ship.velocity.addScaledVector(n, -1.6 * vn); // bouncy
      pipeline.triggerGlitch(0.8);
      audio.glitchBurst();
      hud.say('HULL: "ow." (filed as feedback)', 2);
    }
  }
}

// --- ambient pulses
setInterval(() => {
  if (Math.random() < 0.2) {
    pipeline.triggerGlitch(0.3 + Math.random() * 0.5);
    audio.glitchBurst();
  }
}, 5000);

boot.addEventListener('click', async () => {
  boot.style.display = 'none';
  await audio.start();
  canvas.requestPointerLock();
});

window.addEventListener('resize', () => {
  walk.camera.aspect = pipeline.aspect;
  walk.camera.updateProjectionMatrix();
});

// debug/test hook (drives scripted verification; harmless in production)
Object.assign(window as any, {
  __game: {
    walk, flight, ship, dockAt, enterFlight, setSector,
    sector: () => sector,
    dockSpots: () => dockSpots,
    mode: () => mode,
  },
});

// --- frame loop
let last = performance.now();
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const t = now / 1000;

  // blink the decorative lights
  const blinker = world.scene.getObjectByName('shell-blinker');
  if (blinker) blinker.visible = Math.sin(t * 4) > 0;
  const lamp = world.scene.getObjectByName('beacon-lamp');
  if (lamp) { lamp.rotation.y = t; lamp.visible = Math.sin(t * 2.5) > -0.6; }

  if (mode === 'walk') {
    ship.seatWorld(seatPos);
    seatInteract.enabled = true;
    const colliders = [
      ...world.colliders,
      ...ship.colliders(),
      ...(activePoi?.dock?.colliders ?? []),
    ];
    walk.update(dt, colliders);
    updateGuide(dt, walk.camera);

    const it = interactions.nearest(walk.camera.position);
    hud.setPrompt(it ? it.label : null);
    hud.setFlight(null);
  } else {
    flight.update(dt, walk.camera);
    flightCollisions();
    updateGuide(dt, walk.camera);

    // nearest POI readout + dock prompt
    let nearestName = '';
    let nearestD = Infinity;
    for (const p of sector.pois) {
      const d = ship.position.distanceTo(p.position);
      if (d < nearestD) { nearestD = d; nearestName = `${p.name} ${d.toFixed(0)}m`; }
    }
    const dHome = ship.position.distanceTo(new THREE.Vector3(0, 0, -10));
    if (dHome < nearestD) nearestName = `PORT IMPROBABLE ${dHome.toFixed(0)}m`;
    hud.setFlight(flight.speed, nearestName);

    const spot = nearestDock();
    hud.setPrompt(
      spot
        ? flight.speed < 20
          ? `E — DOCK AT ${spot.name}`
          : 'TOO FAST TO DOCK (the pad has feelings)'
        : null
    );

    audio.setThrust(flight.thrusting ? 0.4 + (flight.speed / 90) * 0.6 : (flight.speed / 90) * 0.3);
  }

  pipeline.render(world.scene, walk.camera, dt, t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
