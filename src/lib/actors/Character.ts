import * as THREE from 'three';
import { instantiate } from '../models/ModelCache';

// An animated person: the Universal Animation Library mannequin (CC0,
// Quaternius/J-Ponzo) tinted per role, driven by a tiny state machine —
// play a default clip, optionally patrol waypoints (walking clip while
// moving), and turn to face the player when approached. Life, not AI.
const MANNEQUIN_URL = '/models/AnimLib.gltf';
const WALK_SPEED = 1.1;
const TURN_SPEED = 4;
const GREET_RADIUS = 2.8;

export interface Waypoint { x: number; z: number; wait: number; }

export interface CharacterOpts {
  /** Body tint for the mannequin's main material. */
  tint: number;
  /** Default clip name (e.g. 'Idle_Loop', 'Fixing_Kneeling', 'Dance_Loop'). */
  clip: string;
  position: THREE.Vector3;
  yaw?: number;
  /** Patrol route (floor-level). Walks Walk_Loop between points. */
  waypoints?: Waypoint[];
  /** Turn to face the player when they come close (default true). */
  greets?: boolean;
  guideTitle: string;
  guideText: string;
}

export class Character {
  readonly root: THREE.Group;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current = '';
  private opts: CharacterOpts;
  private wpIndex = 0;
  private waitTimer = 0;
  private baseYaw: number;
  private targetYaw: number;

  private constructor(root: THREE.Group, mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[], opts: CharacterOpts) {
    this.root = root;
    this.mixer = mixer;
    this.opts = opts;
    for (const clip of clips) {
      this.actions.set(clip.name, mixer.clipAction(clip));
    }
    this.baseYaw = opts.yaw ?? 0;
    this.targetYaw = this.baseYaw;
    root.position.copy(opts.position);
    root.rotation.y = this.baseYaw;
    root.userData.guideTitle = opts.guideTitle;
    root.userData.guideText = opts.guideText;
    root.userData.npc = false; // no procedural bob — the rig breathes already
    this.play(opts.clip);
  }

  static async spawn(opts: CharacterOpts): Promise<Character> {
    const { root, inner, animations } = await instantiate(MANNEQUIN_URL, { height: 1.75 });
    // tint the body material per role (clone so castmates don't share paint)
    inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const tintOne = (m: THREE.Material) => {
        const c = m.clone();
        if (/main/i.test(m.name)) (c as THREE.MeshStandardMaterial).color = new THREE.Color(opts.tint);
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(tintOne)
        : tintOne(mesh.material);
    });
    const mixer = new THREE.AnimationMixer(inner);
    return new Character(root, mixer, animations, opts);
  }

  play(name: string, fade = 0.3) {
    if (name === this.current) return;
    const next = this.actions.get(name);
    if (!next) return;
    const prev = this.actions.get(this.current);
    next.reset().fadeIn(fade).play();
    prev?.fadeOut(fade);
    this.current = name;
  }

  update(dt: number, playerPos: THREE.Vector3) {
    this.mixer.update(dt);

    const toPlayer = playerPos.clone().sub(this.root.position);
    toPlayer.y = 0;
    const playerDist = toPlayer.length();

    if (this.opts.waypoints?.length) {
      this.patrol(dt);
    } else {
      // stationary: face the player when greeted, drift back after
      if ((this.opts.greets ?? true) && playerDist < GREET_RADIUS && playerDist > 0.4) {
        this.targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
      } else {
        this.targetYaw = this.baseYaw;
      }
      const delta = THREE.MathUtils.euclideanModulo(this.targetYaw - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
      this.root.rotation.y += THREE.MathUtils.clamp(delta, -TURN_SPEED * dt, TURN_SPEED * dt);
    }
  }

  private patrol(dt: number) {
    const wps = this.opts.waypoints!;
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      this.play(this.opts.clip);
      return;
    }
    const wp = wps[this.wpIndex % wps.length];
    const target = new THREE.Vector3(wp.x, this.root.position.y, wp.z);
    const to = target.clone().sub(this.root.position);
    const dist = to.length();
    if (dist < 0.15) {
      this.waitTimer = wp.wait;
      this.wpIndex++;
      return;
    }
    this.play('Walk_Loop');
    const yaw = Math.atan2(to.x, to.z);
    const delta = THREE.MathUtils.euclideanModulo(yaw - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.root.rotation.y += THREE.MathUtils.clamp(delta, -TURN_SPEED * dt, TURN_SPEED * dt);
    this.root.position.addScaledVector(to.normalize(), Math.min(WALK_SPEED * dt, dist));
  }
}
