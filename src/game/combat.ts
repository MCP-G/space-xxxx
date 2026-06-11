import * as THREE from 'three';
import type { Sector } from '../world/sector';
import { PALETTE } from '../world/station';

// Security drones haunt the derelict: leftover loss-prevention units still
// enforcing a returns policy nobody remembers. They drop scrap when argued
// with sufficiently.
const DRONE_COUNT = 3;
const DRONE_HP = 2;
const DRONE_RANGE = 90;
const BOLT_SPEED = 38;
const BOLT_LIFE = 3.5;
const FIRE_INTERVAL = 2.4;
const BLASTER_COOLDOWN = 0.25;
const BLASTER_RANGE = 60;

interface Drone {
  mesh: THREE.Mesh;
  hp: number;
  fireTimer: number;
  orbit: number;
  home: THREE.Vector3;
}

interface Bolt {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
}

export interface CombatEvents {
  onPlayerHit: (damage: number) => void;
  onDroneDown: (position: THREE.Vector3) => void;
  onShot: () => void;
}

export class CombatSystem {
  drones: Drone[] = [];
  private bolts: Bolt[] = [];
  private root = new THREE.Group();
  private cooldown = 0;
  private droneMat: THREE.MeshBasicMaterial;
  private boltGeo = new THREE.SphereGeometry(0.25, 6, 6);
  private boltMat: THREE.MeshBasicMaterial;

  private events: CombatEvents;

  constructor(scene: THREE.Scene, events: CombatEvents) {
    this.events = events;
    scene.add(this.root);
    this.droneMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentA });
    this.boltMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentB });
  }

  /** (Re)spawn drones around the sector's derelict. */
  populate(sector: Sector) {
    for (const d of this.drones) this.root.remove(d.mesh);
    for (const b of this.bolts) this.root.remove(b.mesh);
    this.drones = [];
    this.bolts = [];
    const derelict = sector.pois.find((p) => p.kind === 'derelict');
    if (!derelict) return;
    for (let i = 0; i < DRONE_COUNT; i++) {
      const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), this.droneMat);
      mesh.userData.guideTitle = 'LOSS-PREVENTION DRONE';
      mesh.userData.guideText = 'Still guarding inventory that no longer exists. Commendable. Hostile.';
      const home = derelict.position.clone().add(new THREE.Vector3((i - 1) * 14, 6 + i * 3, 10));
      mesh.position.copy(home);
      this.root.add(mesh);
      this.drones.push({ mesh, hp: DRONE_HP, fireTimer: 1 + i, orbit: i * 2.1, home });
    }
  }

  /** True if any living drone has the target in range (drives danger music). */
  inDanger(target: THREE.Vector3): boolean {
    return this.drones.some((d) => d.hp > 0 && d.mesh.position.distanceTo(target) < DRONE_RANGE);
  }

  /** Fire the blaster from a camera/nose ray. Returns true if it fired. */
  shoot(origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = BLASTER_COOLDOWN;
    this.events.onShot();
    const ray = new THREE.Ray(origin, direction.clone().normalize());
    let hit: Drone | null = null;
    let hitD = BLASTER_RANGE;
    for (const d of this.drones) {
      if (d.hp <= 0) continue;
      const dist = ray.distanceToPoint(d.mesh.position);
      const along = d.mesh.position.clone().sub(origin).dot(ray.direction);
      if (dist < 1.6 && along > 0 && along < hitD) {
        hitD = along;
        hit = d;
      }
    }
    if (hit) {
      hit.hp--;
      hit.mesh.scale.setScalar(0.7); // flinch
      if (hit.hp <= 0) {
        hit.mesh.visible = false;
        this.events.onDroneDown(hit.mesh.position.clone());
      }
    }
    return true;
  }

  /** shielded: target is under cover (indoors) — bolts can't reach them. */
  update(dt: number, t: number, target: THREE.Vector3, targetRadius: number, shielded = false) {
    this.cooldown = Math.max(0, this.cooldown - dt);

    for (const d of this.drones) {
      if (d.hp <= 0) continue;
      d.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 6);
      d.orbit += dt * 0.5;
      d.mesh.position.x = d.home.x + Math.cos(d.orbit) * 8;
      d.mesh.position.z = d.home.z + Math.sin(d.orbit) * 8;
      d.mesh.position.y = d.home.y + Math.sin(t * 1.3 + d.orbit) * 2;
      d.mesh.rotation.y = t * 2;

      const distToTarget = d.mesh.position.distanceTo(target);
      if (distToTarget < DRONE_RANGE && !shielded) {
        d.fireTimer -= dt;
        if (d.fireTimer <= 0) {
          d.fireTimer = FIRE_INTERVAL;
          const dir = target.clone().sub(d.mesh.position).normalize();
          const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
          mesh.position.copy(d.mesh.position);
          this.root.add(mesh);
          this.bolts.push({ mesh, velocity: dir.multiplyScalar(BOLT_SPEED), life: BOLT_LIFE });
        }
      }
    }

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      if (!shielded && b.mesh.position.distanceTo(target) < targetRadius) {
        this.events.onPlayerHit(12);
        b.life = 0;
      }
      if (b.life <= 0) {
        this.root.remove(b.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  get aliveCount() {
    return this.drones.filter((d) => d.hp > 0).length;
  }
}
