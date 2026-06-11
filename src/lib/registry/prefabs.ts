import * as THREE from 'three';
import { registry } from './AssetRegistry';
import { material } from '../materials/MaterialLibrary';

// The catalogue. Complex objects get defined here once and spawned by id.
// See manifest.json for sources, licenses, and budgets.

// --- model prefabs (CC0 Quaternius, public/models) -----------------------

registry.register({
  id: 'ship-imperial', kind: 'model', tags: ['ship'],
  url: '/models/Imperial.gltf', normalize: { length: 19 },
});
registry.register({
  id: 'ship-challenger', kind: 'model', tags: ['ship'],
  url: '/models/Challenger.gltf', normalize: { length: 7 },
  guide: ["SOMEONE ELSE'S SHIP", 'Parked diagonally. The hangar is rated for exactly this crime.'],
});
for (const [id, file] of [
  ['npc-worker', 'Worker.glb'],
  ['npc-casual-man', 'Casual.glb'],
  ['npc-casual-woman', 'CasualWoman.glb'],
  ['npc-scifi-woman', 'SciFiWoman.glb'],
  ['npc-spacesuit', 'Spacesuit.glb'],
] as const) {
  registry.register({
    id, kind: 'model', tags: ['character'],
    url: `/models/${file}`, normalize: { height: 1.75 },
  });
}

// --- procedural prefabs ---------------------------------------------------

export interface DroneOverrides {
  tint?: number; // core color
}

registry.register({
  id: 'drone-loss-prevention',
  kind: 'procedural',
  tags: ['enemy'],
  guide: ['LOSS-PREVENTION DRONE', 'Still guarding inventory that no longer exists. Commendable. Hostile.'],
  build: ({ overrides }: { overrides: DroneOverrides }) => {
    const group = new THREE.Group();
    const dark = material('derelict-roof');
    const coreMat = overrides.tint
      ? material('glow-pink', { color: overrides.tint })
      : material('glow-pink');

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 1), coreMat);
    group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.12, 8, 24), dark);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), material('glow-white'));
    eye.position.set(0, 0, 0.7);
    group.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), material('ceiling-dark'));
    pupil.position.set(0, 0, 0.95);
    group.add(pupil);
    for (const sx of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4), dark);
      ant.position.set(sx * 0.45, 0.95, 0);
      ant.rotation.z = sx * -0.25;
      group.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), material('glow-pink', { color: 0xff3030 }));
      tip.position.set(sx * 0.56, 1.38, 0);
      group.add(tip);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), dark);
      arm.position.set(sx * 1.0, -0.7, 0.2);
      arm.rotation.x = 0.5;
      group.add(arm);
    }
    const emitter = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 8), material('glow-amber'));
    emitter.position.set(0, -0.85, 0);
    emitter.rotation.x = Math.PI;
    group.add(emitter);

    return { root: group, parts: { core, ring, eye } };
  },
});

registry.register({
  id: 'salvage-crate',
  kind: 'procedural',
  tags: ['pickup'],
  guide: ['INTACT CARGO', 'Legally salvage after 30 years. It has been 31. Suspiciously precise.'],
  build: ({ overrides }: { overrides: { size?: number } }) => {
    const s = overrides.size ?? 0.5;
    const root = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), material('glow-mint'));
    return { root };
  },
});

registry.register({
  id: 'ore-node',
  kind: 'procedural',
  tags: ['pickup'],
  guide: ['ORE NODE', 'Technically the property of a mining concern that dissolved mid-sentence.'],
  build: () => {
    const root = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), material('glow-amber'));
    return { root };
  },
});
