import * as THREE from 'three';
import type { Sector } from '../world/sector';
import { PALETTE } from '../world/station';
import { registry } from '../lib/registry/AssetRegistry';
import '../lib/registry/prefabs';

// Security drones haunt the derelict: leftover loss-prevention units still
// enforcing a returns policy nobody remembers. They drop scrap when argued
// with sufficiently. The player argues with one of several WEAPONS.
const DRONE_COUNT = 3;
const DRONE_HP = 2;
const DRONE_RANGE = 90;
const BOLT_SPEED = 24;      // dodgeable on foot if you keep moving
const BOLT_LIFE = 4;
const BOLT_DAMAGE = 8;
const FIRE_INTERVAL = 3.4;
const DRONE_RING = 26;      // preferred standoff distance from target
const DRONE_SPEED = 7;
const DODGE_SPEED = 16;

// THE OVERSEER: a surprise boss that only wakes when the monolith does. It is
// a drone the size of a small grievance, with a returns policy of its own.
const BOSS_HP = 26;
const BOSS_RANGE = 180;
const BOSS_RING = 44;
const BOSS_SPEED = 11;
const BOSS_FIRE_INTERVAL = 2.0;
const BOSS_BOLT_SPEED = 30;
const BOSS_BOLT_DAMAGE = 16;
const BOSS_SCALE = 4.2;

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
  // --- SECRET WEAPONS: not for sale. Earned, or stumbled into. ---
  // The Overseer's own armament, prised loose from its smoking wreckage.
  {
    id: 'lance', name: 'IMPROBABILITY LANCE', kind: 'hitscan',
    damage: 6, cooldown: 0.4, range: 320, color: 0xffd23e,
  },
  // Issued to those who reach the highest, most pointless clearance.
  {
    id: 'mortar', name: 'SINGULARITY MORTAR', kind: 'projectile',
    damage: 5, cooldown: 1.4, range: 260, speed: 64, color: 0xaa44ff,
  },
];

// The arms the shops and the Ministry will never simply let you buy.
export const SECRET_WEAPONS = ['lance', 'mortar'];

interface Drone {
  mesh: THREE.Group;          // full model; position drives everything
  core: THREE.Mesh;
  ring: THREE.Mesh;
  eye: THREE.Mesh;
  hp: number;
  fireTimer: number;
  orbit: number;
  home: THREE.Vector3;
  vel: THREE.Vector3;
  dodgeTimer: number;
  strafeDir: 1 | -1;
  boss?: boolean;             // the Overseer is bigger, meaner, and named
  maxHp?: number;
}

interface Bolt {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  boss?: boolean;   // Overseer ordnance hits harder
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
  /** The Overseer has been disassembled. Drop the loot at `position`. */
  onBossDown?: (position: THREE.Vector3) => void;
}

export class CombatSystem {
  drones: Drone[] = [];
  boss: Drone | null = null;
  private bolts: Bolt[] = [];
  private playerShots: PlayerShot[] = [];
  private effects: Effect[] = [];
  private root = new THREE.Group();
  private cooldown = 0;
  private droneMat: THREE.MeshBasicMaterial;
  private droneHitMat: THREE.MeshBasicMaterial;
  private bossMat: THREE.MeshBasicMaterial;
  private boltGeo = new THREE.SphereGeometry(0.25, 6, 6);
  private boltMat: THREE.MeshBasicMaterial;
  private bossBoltMat: THREE.MeshBasicMaterial;
  private events: CombatEvents;

  constructor(scene: THREE.Scene, events: CombatEvents) {
    this.events = events;
    scene.add(this.root);
    this.droneMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentA });
    this.droneHitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.boltMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentB });
    this.bossMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    this.bossBoltMat = new THREE.MeshBasicMaterial({ color: 0xff6622 });
  }

  /** (Re)spawn drones around the sector's derelict. */
  populate(sector: Sector) {
    for (const d of this.drones) this.root.remove(d.mesh);
    for (const b of this.bolts) this.root.remove(b.mesh);
    for (const s of this.playerShots) this.root.remove(s.mesh);
    for (const e of this.effects) this.root.remove(e.mesh);
    if (this.boss) this.root.remove(this.boss.mesh);
    this.boss = null;
    this.drones = [];
    this.bolts = [];
    this.playerShots = [];
    this.effects = [];
    const derelict = sector.pois.find((p) => p.kind === 'derelict');
    if (!derelict) return;
    for (let i = 0; i < DRONE_COUNT; i++) {
      // the drone lives in the prefab catalogue now — spawn, don't build
      const { root: group, parts } = registry.spawn('drone-loss-prevention');
      const home = derelict.position.clone().add(new THREE.Vector3((i - 1) * 14, 6 + i * 3, 10));
      group.position.copy(home);
      this.root.add(group);
      this.drones.push({
        mesh: group as THREE.Group,
        core: parts!.core as THREE.Mesh,
        ring: parts!.ring as THREE.Mesh,
        eye: parts!.eye as THREE.Mesh,
        hp: DRONE_HP, fireTimer: 1 + i, orbit: i * 2.1, home,
        vel: new THREE.Vector3(), dodgeTimer: 0, strafeDir: i % 2 === 0 ? 1 : -1,
      });
    }
  }

  /** Wake the Overseer at `position`. The surprise is rather the point. */
  spawnBoss(position: THREE.Vector3) {
    if (this.boss) return;
    const { root: group, parts } = registry.spawn('drone-loss-prevention');
    group.position.copy(position);
    group.scale.setScalar(BOSS_SCALE);
    // recolour the whole rig gold so nobody mistakes it for the small fry
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = this.bossMat;
    });
    this.root.add(group);
    this.boss = {
      mesh: group as THREE.Group,
      core: parts!.core as THREE.Mesh,
      ring: parts!.ring as THREE.Mesh,
      eye: parts!.eye as THREE.Mesh,
      hp: BOSS_HP, maxHp: BOSS_HP, boss: true,
      fireTimer: 2, orbit: 0, home: position.clone(),
      vel: new THREE.Vector3(), dodgeTimer: 0, strafeDir: 1,
    };
    // a thunderous arrival
    this.addExplosion(position.clone());
  }

  get bossAlive(): boolean { return !!this.boss && this.boss.hp > 0; }
  /** 0..1 health remaining, for the HUD bar. */
  get bossHpFrac(): number {
    return this.boss && this.boss.maxHp ? Math.max(0, this.boss.hp / this.boss.maxHp) : 0;
  }

  inDanger(target: THREE.Vector3): boolean {
    if (this.boss && this.boss.hp > 0 && this.boss.mesh.position.distanceTo(target) < BOSS_RANGE) return true;
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
    const base = drone.boss ? BOSS_SCALE : 1;
    drone.mesh.scale.setScalar(base * 0.78);   // recoil squash, relative to size
    const restore = drone.boss ? this.bossMat : this.droneMat;
    drone.core.material = this.droneHitMat;
    setTimeout(() => { drone.core.material = restore; }, 90);
    // getting shot teaches them to juke
    drone.dodgeTimer = 0.9;
    drone.strafeDir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
    this.addSpark(drone.mesh.position.clone(), 0xffffff, drone.boss ? 1.0 : 0.4);
    if (drone.hp <= 0) {
      drone.mesh.visible = false;
      if (drone.boss) {
        // a death befitting management: several explosions, then loot
        for (let i = 0; i < 5; i++) {
          this.addExplosion(drone.mesh.position.clone().add(
            new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6)));
        }
        const where = drone.mesh.position.clone();
        this.boss = null;
        this.events.onBossDown?.(where);
      } else {
        this.addExplosion(drone.mesh.position.clone());
        this.events.onDroneDown(drone.mesh.position.clone());
      }
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
      const targets = this.boss ? [...this.drones, this.boss] : this.drones;
      for (const d of targets) {
        if (d.hp <= 0) continue;
        const dist = ray.distanceToPoint(d.mesh.position);
        const along = d.mesh.position.clone().sub(origin).dot(ray.direction);
        const radius = d.boss ? 5.0 : 2.0;   // the Overseer is hard to miss
        if (dist < radius && along > 0 && along < hitD) {
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
      d.orbit += dt * 0.45;
      d.dodgeTimer = Math.max(0, d.dodgeTimer - dt);

      const distToTarget = d.mesh.position.distanceTo(target);
      const engaged = distToTarget < DRONE_RANGE && !shielded;

      // steering: hold a slowly-rotating point on a standoff ring around the
      // target while engaged; drift home when bored; juke sideways when shot
      const desired = new THREE.Vector3();
      if (engaged) {
        desired.set(
          target.x + Math.cos(d.orbit) * DRONE_RING,
          target.y + 6 + Math.sin(t * 0.7 + d.orbit) * 3,
          target.z + Math.sin(d.orbit) * DRONE_RING
        );
      } else {
        desired.copy(d.home);
      }
      const steer = desired.sub(d.mesh.position).clampLength(0, DRONE_SPEED);
      d.vel.lerp(steer, dt * 1.6);
      if (d.dodgeTimer > 0) {
        const toT = target.clone().sub(d.mesh.position).normalize();
        const side = new THREE.Vector3(-toT.z, 0, toT.x).multiplyScalar(DODGE_SPEED * d.strafeDir);
        d.vel.lerp(side, dt * 4);
      }
      d.mesh.position.addScaledVector(d.vel, dt);

      // face the target, spin the gyro ring, hover-bob
      if (engaged) d.mesh.lookAt(target);
      d.ring.rotation.z = t * 3;
      d.mesh.position.y += Math.sin(t * 2 + d.orbit) * 0.01;

      if (engaged) {
        d.fireTimer -= dt;
        if (d.fireTimer <= 0) {
          d.fireTimer = FIRE_INTERVAL;
          // slightly imperfect aim: a moving player can genuinely dodge
          const dir = target.clone().sub(d.mesh.position).normalize();
          dir.x += (Math.random() - 0.5) * 0.08;
          dir.y += (Math.random() - 0.5) * 0.08;
          dir.normalize();
          const mesh = new THREE.Mesh(this.boltGeo, this.boltMat);
          mesh.position.copy(d.mesh.position);
          this.root.add(mesh);
          this.bolts.push({ mesh, velocity: dir.multiplyScalar(BOLT_SPEED), life: BOLT_LIFE });
        }
      }
    }

    // THE OVERSEER: bigger ring, three-bolt spreads, no sense of proportion
    const boss = this.boss;
    if (boss && boss.hp > 0) {
      boss.mesh.scale.lerp(new THREE.Vector3(BOSS_SCALE, BOSS_SCALE, BOSS_SCALE), dt * 6);
      boss.orbit += dt * 0.3;
      boss.dodgeTimer = Math.max(0, boss.dodgeTimer - dt);
      const engaged = !shielded; // the Overseer does not lose interest
      const desired = new THREE.Vector3(
        target.x + Math.cos(boss.orbit) * BOSS_RING,
        target.y + 10 + Math.sin(t * 0.5 + boss.orbit) * 5,
        target.z + Math.sin(boss.orbit) * BOSS_RING
      );
      const steer = desired.sub(boss.mesh.position).clampLength(0, BOSS_SPEED);
      boss.vel.lerp(steer, dt * 1.4);
      if (boss.dodgeTimer > 0) {
        const toT = target.clone().sub(boss.mesh.position).normalize();
        const side = new THREE.Vector3(-toT.z, 0, toT.x).multiplyScalar(DODGE_SPEED * boss.strafeDir);
        boss.vel.lerp(side, dt * 3);
      }
      boss.mesh.position.addScaledVector(boss.vel, dt);
      boss.mesh.lookAt(target);
      boss.ring.rotation.z = t * 2;
      if (engaged) {
        boss.fireTimer -= dt;
        if (boss.fireTimer <= 0) {
          boss.fireTimer = BOSS_FIRE_INTERVAL;
          const base = target.clone().sub(boss.mesh.position).normalize();
          // a fan of three: aim slightly left, centre, right
          for (const spread of [-0.12, 0, 0.12]) {
            const dir = base.clone();
            const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
            dir.addScaledVector(side, spread).normalize();
            const mesh = new THREE.Mesh(this.boltGeo, this.bossBoltMat);
            mesh.scale.setScalar(2.2);
            mesh.position.copy(boss.mesh.position);
            this.root.add(mesh);
            this.bolts.push({ mesh, velocity: dir.multiplyScalar(BOSS_BOLT_SPEED), life: BOLT_LIFE + 1, boss: true });
          }
        }
      }
    }

    // hostile bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      if (!shielded && b.mesh.position.distanceTo(target) < targetRadius) {
        this.events.onPlayerHit(b.boss ? BOSS_BOLT_DAMAGE : BOLT_DAMAGE);
        this.addSpark(b.mesh.position.clone(), b.boss ? 0xff6622 : PALETTE.accentB, b.boss ? 0.9 : 0.5);
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
        const targets = this.boss ? [...this.drones, this.boss] : this.drones;
        for (const d of targets) {
          if (d.hp <= 0) continue;
          const reach = d.boss ? 5.5 : 2.2;
          if (s.mesh.position.distanceTo(d.mesh.position) < reach) {
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
