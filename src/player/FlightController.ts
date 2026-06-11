import * as THREE from 'three';
import type { Ship } from '../ship/Ship';

// Arcade-newtonian: thrust adds velocity, heavy damping keeps it flyable,
// mouse steers the nose directly. Fast, twitchy, slightly rude.
const THRUST = 26;
const BOOST = 60;
const STRAFE = 18;
const DAMPING = 0.6;   // velocity retained per second (exponential)
const BRAKE = 0.05;
const MAX_SPEED = 90;

export class FlightController {
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;

  private ship: Ship;

  constructor(ship: Ship, canvas: HTMLCanvasElement) {
    this.ship = ship;
    document.addEventListener('keydown', (e) => this.keys.add(e.code));
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (!this.active || document.pointerLockElement !== canvas) return;
      this.yaw -= e.movementX * 0.0018;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0018, -1.45, 1.45);
    });
  }

  active = false;

  /** Sync steering to the ship's current attitude (call when taking the seat). */
  syncToShip() {
    const e = new THREE.Euler().setFromQuaternion(this.ship.quaternion, 'YXZ');
    this.yaw = e.y;
    this.pitch = e.x;
  }

  get speed() { return this.ship.velocity.length(); }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    if (!this.active) return;
    const ship = this.ship;

    ship.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(ship.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(ship.quaternion);

    const boost = this.keys.has('ShiftLeft');
    const a = new THREE.Vector3();
    if (this.keys.has('KeyW')) a.addScaledVector(forward, boost ? BOOST : THRUST);
    if (this.keys.has('KeyS')) a.addScaledVector(forward, -THRUST * 0.6);
    if (this.keys.has('KeyA')) a.addScaledVector(right, -STRAFE);
    if (this.keys.has('KeyD')) a.addScaledVector(right, STRAFE);
    if (this.keys.has('KeyR')) a.addScaledVector(up, STRAFE);
    if (this.keys.has('KeyF')) a.addScaledVector(up, -STRAFE);

    ship.velocity.addScaledVector(a, dt);
    const damp = this.keys.has('Space') ? BRAKE : DAMPING;
    ship.velocity.multiplyScalar(Math.pow(damp, dt));
    if (ship.velocity.length() > MAX_SPEED) ship.velocity.setLength(MAX_SPEED);

    ship.position.addScaledVector(ship.velocity, dt);

    // camera: cockpit view from the seat, slight speed shake
    const seat = ship.seatWorld();
    camera.position.copy(seat);
    camera.quaternion.copy(ship.quaternion);
    const shake = Math.min(this.speed / MAX_SPEED, 1) * 0.015;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }

  get thrusting() {
    return this.active && ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyR', 'KeyF'].some((k) => this.keys.has(k));
  }
}
