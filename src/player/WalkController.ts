import * as THREE from 'three';
import type { ColliderBox } from '../world/greybox';

// Simple capsule-vs-AABB first-person controller. Rapier replaces this in M1
// when ships need real physics; for greybox walking this is plenty.
const EYE_HEIGHT = 1.6;
const RADIUS = 0.35;
const SPEED = 4.5;
const SPRINT = 7.5;

export class WalkController {
  readonly camera: THREE.PerspectiveCamera;
  readonly position = new THREE.Vector3(0, 0, -4);
  private yaw = Math.PI; // face the corridor
  private pitch = 0;
  private keys = new Set<string>();
  private moved = 0; // distance accumulator for footsteps
  onFootstep?: () => void;

  constructor(aspect: number, canvas: HTMLCanvasElement) {
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 200);

    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('click', () => {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0025, -1.4, 1.4);
    });
  }

  update(dt: number, colliders: ColliderBox[]) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(forward);
    if (this.keys.has('KeyS')) move.sub(forward);
    if (this.keys.has('KeyD')) move.add(right);
    if (this.keys.has('KeyA')) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar((this.keys.has('ShiftLeft') ? SPRINT : SPEED) * dt);
      // resolve each axis separately so we slide along walls
      this.tryMove(move.x, 0, colliders);
      this.tryMove(0, move.z, colliders);
      this.moved += move.length();
      if (this.moved > 2.2) {
        this.moved = 0;
        this.onFootstep?.();
      }
    }

    this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
  }

  private tryMove(dx: number, dz: number, colliders: ColliderBox[]) {
    const nx = this.position.x + dx;
    const nz = this.position.z + dz;
    for (const c of colliders) {
      // only collide with boxes that overlap the player's torso height band
      if (c.max.y < 0.3 || c.min.y > EYE_HEIGHT) continue;
      if (
        nx + RADIUS > c.min.x && nx - RADIUS < c.max.x &&
        nz + RADIUS > c.min.z && nz - RADIUS < c.max.z
      ) {
        return; // blocked
      }
    }
    this.position.x = nx;
    this.position.z = nz;
  }

  get isMoving() {
    return ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some((k) => this.keys.has(k));
  }
}
