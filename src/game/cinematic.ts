import * as THREE from 'three';

// The docking director: a letterboxed exterior orbit shot. The camera
// sweeps around the ship while an onProgress callback animates whatever
// the scene needs (the ship gliding onto the pad, or lifting off it).
// Control is returned exactly when the music says so.
export interface CinematicShot {
  duration: number;                 // seconds
  radius: number;                   // orbit distance from focus
  yawStart: number;
  yawEnd: number;
  heightStart: number;
  heightEnd: number;
  onProgress?: (k: number) => void; // eased 0..1
  onDone: () => void;
}

const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export class Cinematic {
  active = false;
  private t = 0;
  private shot: CinematicShot | null = null;
  private focus: () => THREE.Vector3 = () => new THREE.Vector3();

  start(focus: () => THREE.Vector3, shot: CinematicShot) {
    this.focus = focus;
    this.shot = shot;
    this.t = 0;
    this.active = true;
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    if (!this.active || !this.shot) return;
    const s = this.shot;
    this.t += dt;
    const k = easeInOut(Math.min(1, this.t / s.duration));
    s.onProgress?.(k);

    const f = this.focus();
    const yaw = THREE.MathUtils.lerp(s.yawStart, s.yawEnd, k);
    const h = THREE.MathUtils.lerp(s.heightStart, s.heightEnd, k);
    camera.position.set(
      f.x + Math.cos(yaw) * s.radius,
      f.y + h,
      f.z + Math.sin(yaw) * s.radius
    );
    camera.lookAt(f.x, f.y + 1.2, f.z);

    if (this.t >= s.duration) {
      this.active = false;
      const done = s.onDone;
      this.shot = null;
      done();
    }
  }
}
