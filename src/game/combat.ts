import * as THREE from 'three';
import type { Sector } from '../world/sector';
import { PALETTE } from '../world/station';

// Security drones haunt the derelict: leftover loss-prevention units still
// enforcing a returns policy nobody remembers. They drop scrap when argued
// with sufficiently. The player argues with one of several WEAPONS.
const DRONE_COUNT = 3;
const DRONE_HP = 2;
const DRONE_RANGE = 90;
const BOLT_SPEED = 38;
const BOLT_LIFE = 3.5;
const FIRE_INTERVAL = 2.4;

export interface Weapon {
  id: string;
  name: string;
  kind: 'hitscan' | 'projectile';
  damage: number;
  cooldown: number;
  range: number;       // hitscan reach / projectile lifetime-distance
  speed?: number;      // projectile m/s
  color: number;
}

export const WEAPONS: Weapon[] = [
  {
    id: 'blaster', name: 'BLASTER MK.1', kind: 'hitscan',
    damage: 1, cooldown: 0.22, range: 160, color: PALETTE.accentB,
  },
  {
    id: 'pulse', name: 'PULSE CANNON', kind: 'projectile',
    damage: 2, cooldown: 0.9, range: 220, speed: 90, color: PALETTE.accentA,
  },
];

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

interface PlayerShot {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  damage: number;
}

interface Effect {
  mesh: THREE.Mesh | THREE.Line;
  life: number;
  maxLife: number;
  grow?: number; // scale growth per second
}

export interface CombatEvents {
  onPlayerHit: (damage: number) => void;
  onDroneDown: (position: THREE.Vector3) => void;
  onShot: (weapon: Weapon) => void;
}

export class CombatSystem {
  drones: Drone[] = [];
  private bolts: Bolt[] = [];
  private playerShots: PlayerShot[] = [];
  private effects: Effect[] = [];
  private root = new THREE.Group();
  private cooldown = 0;
  private droneMat: THREE.MeshBasicMaterial;
  private droneHitMat: THREE.MeshBasicMaterial;
  private boltGeo = new THREE.SphereGeometry(0.25, 6, 6);
  private boltMat: THREE.MeshBasicMaterial;
  private events: CombatEvents;

  constructor(scene: THREE.Scene, events: CombatEvents) {
    this.events = events;
    scene.add(this.root);
    this.droneMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentA });
    this.droneHitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.boltMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentB });
  }

  /** (Re)spawn drones around the sector's derelict. */
  populate(sector: Sector) {
    for (const d of this.drones) this.root.remove(d.mesh);
    for (const b of this.bolts) this.root.remove(b.mesh);
    for (const s of this.playerShots) this.root.remove(s.mesh);
    for (const e of this.effects) this.root.remove(e.mesh);
    this.drones = [];
    this.bolts = [];
    this.playerShots = [];
    this.effects = [];
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

  inDanger(target: THREE.Vector3): boolean {
    return this.drones.some((d) => d.hp > 0 && d.mesh.position.distanceTo(target) < DRONE_RANGE);
  }

  // --- effects -----------------------------------------------------------

  private addTracer(from: THREE.Vector3, to: THREE.Vector3, color: number) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.root.add(line);
    this.effects.push({ mesh: line, life: 0.12, maxLife: 0.12 });
  }

  private addSpark(at: THREE.Vector3, color: number, size = 0.4) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(size), mat);
    spark.position.copy(at);
    this.root.add(spark);
    this.effects.push({ mesh: spark, life: 0.28, maxLife: 0.28, grow: 6 });
  }

  private addExplosion(at: THREE.Vector3) {
    this.addSpark(at, 0xffffff, 0.8);
    this.addSpark(at, PALETTE.accentA, 0.5);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: PALETTE.accentB, transparent: true, opacity: 1 });
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), mat);
      shard.position.copy(at);
      this.root.add(shard);
      const v = new THREE.Vector3(Math.cos(i * 1.05), Math.sin(i * 1.7), Math.sin(i * 1.05)).multiplyScalar(8);
      this.playerShots.push({ mesh: shard, velocity: v, life: 0.6, damage: 0 }); // damage 0 = debris
    }
  }

  // --- shooting ----------------------------------------------------------

  private applyHit(drone: Drone, damage: number) {
    drone.hp -= damage;
    drone.mesh.scale.setScalar(0.7);
    drone.mesh.material = this.droneHitMat;
    setTimeout(() => { drone.mesh.material = this.droneMat; }, 90);
    this.addSpark(drone.mesh.position.clone(), 0xffffff);
    if (drone.hp <= 0) {
      drone.mesh.visible = false;
      this.addExplosion(drone.mesh.position.clone());
      this.events.onDroneDown(drone.mesh.position.clone());
    }
  }

  /**
   * Fire `weapon` along the camera's sightline. Origin should be the
   * camera position so shots land where the crosshair points.
   */
  shoot(weapon: Weapon, origin: THREE.Vector3, direction: THREE.Vector3): boolean {
    if (this.cooldown > 0) return false;
    this.cooldown = weapon.cooldown;
    this.events.onShot(weapon);
    const dir = direction.clone().normalize();
    // muzzle offset so tracers don't start inside your face
    const muzzle = origin.clone().addScaledVector(dir, 1.2).add(new THREE.Vector3(0, -0.25, 0));

    if (weapon.kind === 'hitscan') {
      const ray = new THREE.Ray(origin, dir);
      let hit: Drone | null = null;
      let hitD = weapon.range;
      for (const d of this.drones) {
        if (d.hp <= 0) continue;
        const dist = ray.distanceToPoint(d.mesh.position);
        const along = d.mesh.position.clone().sub(origin).dot(ray.direction);
        if (dist < 2.0 && along > 0 && along < hitD) {
          hitD = along;
          hit = d;
        }
      }
      const end = origin.clone().addScaledVector(dir, hit ? hitD : weapon.range);
      this.addTracer(muzzle, end, weapon.color);
      if (hit) this.applyHit(hit, weapon.damage);
      else this.addSpark(end, weapon.color, 0.15);
    } else {
      // projectile: a fat glowing slug that travels and detonates
      const mat = new THREE.MeshBasicMaterial({ color: weapon.color });
      const slug = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), mat);
      slug.position.copy(muzzle);
      this.root.add(slug);
      this.playerShots.push({
        mesh: slug,
        velocity: dir.clone().multiplyScalar(weapon.speed ?? 80),
        life: weapon.range / (weapon.speed ?? 80),
        damage: weapon.damage,
      });
    }
    return true;
  }

  // --- per-frame ---------------------------------------------------------

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

    // hostile bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      if (!shielded && b.mesh.position.distanceTo(target) < targetRadius) {
        this.events.onPlayerHit(12);
        this.addSpark(b.mesh.position.clone(), PALETTE.accentB, 0.5);
        b.life = 0;
      }
      if (b.life <= 0) {
        this.root.remove(b.mesh);
        this.bolts.splice(i, 1);
      }
    }

    // player projectiles (and explosion debris, which has damage 0)
    for (let i = this.playerShots.length - 1; i >= 0; i--) {
      const s = this.playerShots[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.velocity, dt);
      if (s.damage > 0) {
        for (const d of this.drones) {
          if (d.hp <= 0) continue;
          if (s.mesh.position.distanceTo(d.mesh.position) < 2.2) {
            this.applyHit(d, s.damage);
            this.addSpark(s.mesh.position.clone(), PALETTE.accentA, 0.6);
            s.life = 0;
            break;
          }
        }
      }
      if (s.life <= 0) {
        this.root.remove(s.mesh);
        this.playerShots.splice(i, 1);
      }
    }

    // transient effects: fade, optionally grow
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const mat = (e.mesh as THREE.Mesh).material as THREE.Material & { opacity: number };
      mat.opacity = Math.max(0, e.life / e.maxLife);
      mat.transparent = true;
      if (e.grow && e.mesh instanceof THREE.Mesh) {
        e.mesh.scale.addScalar(e.grow * dt);
      }
      if (e.life <= 0) {
        this.root.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }
  }

  get aliveCount() {
    return this.drones.filter((d) => d.hp > 0).length;
  }
}
