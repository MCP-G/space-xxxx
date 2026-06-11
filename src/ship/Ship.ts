import * as THREE from 'three';
import { applyVertexSnap } from '../render/PixelPipeline';
import { PALETTE, type ColliderBox } from '../world/station';

interface LocalBox {
  w: number; h: number; d: number;
  x: number; y: number; z: number;
}

/**
 * The Heart of Mild Inconvenience: a chunky wedge freighter with a walkable
 * hold (open ramp at the stern) and a cockpit seat. While parked or docked
 * the ship is axis-aligned (yaw snapped), so its interior colliders are
 * world-space AABBs recomputed from its position.
 *
 * Local frame: nose points -Z, ramp opening at +Z. Floor top at local y=0.
 */
export class Ship {
  readonly group = new THREE.Group();
  readonly velocity = new THREE.Vector3();
  /** Seat position in local space — camera goes here when piloting. */
  readonly seatLocal = new THREE.Vector3(0, 1.35, -2.6);
  /** Where a disembarking player should stand (local, just off the ramp). */
  readonly rampExitLocal = new THREE.Vector3(0, 0, 4.6);

  private localColliders: LocalBox[] = [];

  constructor() {
    // standard materials pick up scene.environment → starlight reflections
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x8a8ac0, metalness: 0.7, roughness: 0.38, envMapIntensity: 0.7,
    });
    applyVertexSnap(hullMat);
    const darkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.dark, metalness: 0.5, roughness: 0.5, envMapIntensity: 0.8,
    });
    applyVertexSnap(darkMat);
    const trimMat = new THREE.MeshStandardMaterial({
      color: PALETTE.accentB, metalness: 0.4, roughness: 0.4,
      emissive: new THREE.Color(0x553f00),
    });
    applyVertexSnap(trimMat);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x60ffe8, metalness: 1.0, roughness: 0.05, envMapIntensity: 2.2,
      emissive: new THREE.Color(0x062a26),
    });
    applyVertexSnap(canopyMat);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: PALETTE.accentA, metalness: 0.6, roughness: 0.3,
      emissive: new THREE.Color(0x55092b),
    });
    applyVertexSnap(stripeMat);

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };

    // hold shell: 4w x 2.4h x 6d, floor top at y=0, open at +Z
    add(new THREE.BoxGeometry(4.4, 0.3, 6.4), hullMat, 0, -0.15, 0);      // floor
    add(new THREE.BoxGeometry(4.4, 0.3, 6.4), hullMat, 0, 2.55, 0);       // roof
    add(new THREE.BoxGeometry(0.3, 2.4, 6.4), hullMat, -2.2, 1.2, 0);     // port wall
    add(new THREE.BoxGeometry(0.3, 2.4, 6.4), hullMat, 2.2, 1.2, 0);      // starboard wall
    this.localColliders.push(
      { w: 0.3, h: 2.4, d: 6.4, x: -2.2, y: 1.2, z: 0 },
      { w: 0.3, h: 2.4, d: 6.4, x: 2.2, y: 1.2, z: 0 },
    );

    // cockpit nose: faceted, swept — stacked tapering sections + canopy
    const noseA = add(new THREE.BoxGeometry(3.6, 2.2, 1.8), hullMat, 0, 1.15, -4.0);
    noseA.rotation.x = 0.04;
    const noseB = add(new THREE.BoxGeometry(2.7, 1.7, 1.6), hullMat, 0, 1.0, -5.5);
    noseB.rotation.x = 0.1;
    const noseC = add(new THREE.BoxGeometry(1.7, 1.0, 1.6), hullMat, 0, 0.85, -6.9);
    noseC.rotation.x = 0.16;
    add(new THREE.BoxGeometry(0.9, 0.5, 1.2), stripeMat, 0, 0.72, -7.9).rotation.x = 0.2;
    // canopy: angled mirror-glass slab over the cockpit
    const canopy = add(new THREE.BoxGeometry(1.7, 0.7, 2.0), canopyMat, 0, 2.05, -4.4);
    canopy.rotation.x = -0.32;
    // hull racing stripes (every disreputable freighter has them)
    add(new THREE.BoxGeometry(0.5, 0.06, 6.4), stripeMat, -1.2, 2.73, 0);
    add(new THREE.BoxGeometry(0.5, 0.06, 6.4), stripeMat, 1.2, 2.73, 0);

    // swept wings + tail fin
    const wingL = add(new THREE.BoxGeometry(3.4, 0.18, 2.6), hullMat, -3.6, 0.6, 1.2);
    wingL.rotation.z = 0.1; wingL.rotation.y = -0.35;
    const wingR = add(new THREE.BoxGeometry(3.4, 0.18, 2.6), hullMat, 3.6, 0.6, 1.2);
    wingR.rotation.z = -0.1; wingR.rotation.y = 0.35;
    add(new THREE.BoxGeometry(0.5, 0.1, 1.4), stripeMat, -4.9, 0.78, 1.7).rotation.y = -0.35;
    add(new THREE.BoxGeometry(0.5, 0.1, 1.4), stripeMat, 4.9, 0.78, 1.7).rotation.y = 0.35;
    const fin = add(new THREE.BoxGeometry(0.16, 1.8, 1.6), hullMat, 0, 3.4, 2.4);
    fin.rotation.x = 0.25;

    // cockpit bulkhead with door gap, between hold and nose
    this.localColliders.push(
      { w: 1.5, h: 2.4, d: 0.3, x: -1.45, y: 1.2, z: -3.2 },
      { w: 1.5, h: 2.4, d: 0.3, x: 1.45, y: 1.2, z: -3.2 },
    );
    add(new THREE.BoxGeometry(1.5, 2.4, 0.3), darkMat, -1.45, 1.2, -3.2);
    add(new THREE.BoxGeometry(1.5, 2.4, 0.3), darkMat, 1.45, 1.2, -3.2);

    // pilot seat + console
    const seat = add(new THREE.BoxGeometry(0.8, 0.6, 0.8), trimMat, 0, 0.3, -2.6);
    seat.userData.guideTitle = 'PILOT SEAT';
    seat.userData.guideText = 'Certified for one (1) humanoid of average regret.';
    add(new THREE.BoxGeometry(1.6, 0.7, 0.4), darkMat, 0, 0.9, -3.6);

    // cargo crates in the hold
    add(new THREE.BoxGeometry(1, 1, 1), darkMat, -1.4, 0.5, 1.5);
    add(new THREE.BoxGeometry(0.8, 0.8, 0.8), trimMat, 1.4, 0.4, 0.8);
    this.localColliders.push(
      { w: 1, h: 1, d: 1, x: -1.4, y: 0.5, z: 1.5 },
      { w: 0.8, h: 0.8, d: 0.8, x: 1.4, y: 0.4, z: 0.8 },
    );

    // engine pods, port and starboard
    add(new THREE.CylinderGeometry(0.6, 0.8, 2.4), hullMat, -2.6, 1.2, 2.4).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.6, 0.8, 2.4), hullMat, 2.6, 1.2, 2.4).rotation.x = Math.PI / 2;
    // engine glow
    const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.trim });
    add(new THREE.BoxGeometry(0.7, 0.7, 0.1), glowMat, -2.6, 1.2, 3.62);
    add(new THREE.BoxGeometry(0.7, 0.7, 0.1), glowMat, 2.6, 1.2, 3.62);

    // interior light so the hold isn't a cave
    const holdLight = new THREE.PointLight(PALETTE.accentB, 6, 8, 1.6);
    holdLight.position.set(0, 2, 0);
    this.group.add(holdLight);

    this.group.userData.guideTitle = 'THE HEART OF MILD INCONVENIENCE';
    this.group.userData.guideText =
      'A freighter. Top speed: adequate. Insurance status: philosophical.';
  }

  get position() { return this.group.position; }
  get quaternion() { return this.group.quaternion; }

  seatWorld(out = new THREE.Vector3()) {
    return out.copy(this.seatLocal).applyQuaternion(this.group.quaternion).add(this.group.position);
  }

  rampExitWorld(out = new THREE.Vector3()) {
    return out.copy(this.rampExitLocal).applyQuaternion(this.group.quaternion).add(this.group.position);
  }

  /**
   * World-space AABB colliders for the interior. Only valid while the ship
   * is axis-aligned (parked/docked, yaw snapped to a multiple of 90°).
   */
  colliders(): ColliderBox[] {
    const p = this.group.position;
    const yaw = Math.round(this.yaw() / (Math.PI / 2)) * (Math.PI / 2);
    const cos = Math.round(Math.cos(yaw));
    const sin = Math.round(Math.sin(yaw));
    return this.localColliders.map((b) => {
      // rotate the local center and swap extents for 90° turns
      const cx = b.x * cos + b.z * sin;
      const cz = -b.x * sin + b.z * cos;
      const w = Math.abs(cos) ? b.w : b.d;
      const d = Math.abs(cos) ? b.d : b.w;
      return {
        min: new THREE.Vector3(p.x + cx - w / 2, p.y + b.y - b.h / 2, p.z + cz - d / 2),
        max: new THREE.Vector3(p.x + cx + w / 2, p.y + b.y + b.h / 2, p.z + cz + d / 2),
      };
    });
  }

  yaw() {
    const e = new THREE.Euler().setFromQuaternion(this.group.quaternion, 'YXZ');
    return e.y;
  }

  /** Park: snap to position with yaw only (level flight attitude). */
  park(x: number, y: number, z: number, yaw: number) {
    this.group.position.set(x, y, z);
    this.group.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    this.velocity.set(0, 0, 0);
  }
}
