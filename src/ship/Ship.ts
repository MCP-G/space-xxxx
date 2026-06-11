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
  readonly exterior = new THREE.Group();
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
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    // decorative exterior — swapped out when a downloaded hull model loads
    this.group.add(this.exterior);
    const addExt = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      this.exterior.add(m);
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
    const noseA = addExt(new THREE.BoxGeometry(3.6, 2.2, 1.8), hullMat, 0, 1.15, -4.0);
    noseA.rotation.x = 0.04;
    const noseB = addExt(new THREE.BoxGeometry(2.7, 1.7, 1.6), hullMat, 0, 1.0, -5.5);
    noseB.rotation.x = 0.1;
    const noseC = addExt(new THREE.BoxGeometry(1.7, 1.0, 1.6), hullMat, 0, 0.85, -6.9);
    noseC.rotation.x = 0.16;
    addExt(new THREE.BoxGeometry(0.9, 0.5, 1.2), stripeMat, 0, 0.72, -7.9).rotation.x = 0.2;
    // canopy: angled mirror-glass slab over the cockpit
    const canopy = addExt(new THREE.BoxGeometry(1.7, 0.7, 2.0), canopyMat, 0, 2.05, -4.4);
    canopy.rotation.x = -0.32;
    // hull racing stripes (every disreputable freighter has them)
    addExt(new THREE.BoxGeometry(0.5, 0.06, 6.4), stripeMat, -1.2, 2.73, 0);
    addExt(new THREE.BoxGeometry(0.5, 0.06, 6.4), stripeMat, 1.2, 2.73, 0);

    // swept wings + tail fin
    const wingL = addExt(new THREE.BoxGeometry(3.4, 0.18, 2.6), hullMat, -3.6, 0.6, 1.2);
    wingL.rotation.z = 0.1; wingL.rotation.y = -0.35;
    const wingR = addExt(new THREE.BoxGeometry(3.4, 0.18, 2.6), hullMat, 3.6, 0.6, 1.2);
    wingR.rotation.z = -0.1; wingR.rotation.y = 0.35;
    addExt(new THREE.BoxGeometry(0.5, 0.1, 1.4), stripeMat, -4.9, 0.78, 1.7).rotation.y = -0.35;
    addExt(new THREE.BoxGeometry(0.5, 0.1, 1.4), stripeMat, 4.9, 0.78, 1.7).rotation.y = 0.35;
    const fin = addExt(new THREE.BoxGeometry(0.16, 1.8, 1.6), hullMat, 0, 3.4, 2.4);
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
    addExt(new THREE.CylinderGeometry(0.6, 0.8, 2.4), hullMat, -2.6, 1.2, 2.4).rotation.x = Math.PI / 2;
    addExt(new THREE.CylinderGeometry(0.6, 0.8, 2.4), hullMat, 2.6, 1.2, 2.4).rotation.x = Math.PI / 2;
    // engine glow
    const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.trim });
    addExt(new THREE.BoxGeometry(0.7, 0.7, 0.1), glowMat, -2.6, 1.2, 3.62);
    addExt(new THREE.BoxGeometry(0.7, 0.7, 0.1), glowMat, 2.6, 1.2, 3.62);

    // --- greebles: the difference between "shape" and "machine"
    // landing skids
    for (const sx of [-1.9, 1.9]) {
      addExt(new THREE.BoxGeometry(0.22, 0.25, 0.22), darkMat, sx, -0.3, -2.2);
      addExt(new THREE.BoxGeometry(0.45, 0.1, 1.9), darkMat, sx, -0.4, -2.2);
      addExt(new THREE.BoxGeometry(0.22, 0.25, 0.22), darkMat, sx, -0.3, 1.8);
      addExt(new THREE.BoxGeometry(0.45, 0.1, 1.9), darkMat, sx, -0.4, 1.8);
    }
    // antennae cluster on the roof
    addExt(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 4), darkMat, -0.8, 3.4, -1.6);
    addExt(new THREE.CylinderGeometry(0.015, 0.015, 1.1, 4), darkMat, -0.95, 3.2, -1.4);
    addExt(new THREE.SphereGeometry(0.07, 6, 5), stripeMat, -0.8, 4.2, -1.6);
    // sensor dish, slightly off true because of course it is
    const dish = addExt(new THREE.CylinderGeometry(0.35, 0.1, 0.18, 10), hullMat, 0.9, 3.0, -1.2);
    dish.rotation.z = -0.4; dish.rotation.x = 0.2;
    // hull panel lines: thin dark strips along the sides
    for (const sx of [-2.21, 2.21]) {
      addExt(new THREE.BoxGeometry(0.05, 0.06, 5.6), darkMat, sx * 1.01, 1.9, 0);
      addExt(new THREE.BoxGeometry(0.05, 0.06, 5.6), darkMat, sx * 1.01, 0.5, 0);
      addExt(new THREE.BoxGeometry(0.05, 0.8, 0.06), darkMat, sx * 1.01, 1.2, -1.4);
      addExt(new THREE.BoxGeometry(0.05, 0.8, 0.06), darkMat, sx * 1.01, 1.2, 1.2);
    }
    // vents behind the cockpit
    for (let i = 0; i < 4; i++) {
      addExt(new THREE.BoxGeometry(0.5, 0.05, 0.16), darkMat, -1.1 + i * 0.7, 2.72, -2.6);
    }
    // engine pod detail rings + intake cones
    for (const sx of [-2.6, 2.6]) {
      addExt(new THREE.TorusGeometry(0.66, 0.05, 6, 12), darkMat, sx, 1.2, 2.0).rotation.x = 0;
      addExt(new THREE.TorusGeometry(0.7, 0.05, 6, 12), darkMat, sx, 1.2, 3.0).rotation.x = 0;
      const cone = addExt(new THREE.ConeGeometry(0.5, 0.7, 10), darkMat, sx, 1.2, 1.0);
      cone.rotation.x = -Math.PI / 2;
    }
    // running lights: red port, green starboard (tradition survives everything)
    addExt(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff3030 }), -5.0, 0.7, 1.7);
    addExt(new THREE.SphereGeometry(0.08, 6, 5), new THREE.MeshBasicMaterial({ color: 0x30ff60 }), 5.0, 0.7, 1.7);

    // cockpit dashboard: button rows and a tiny screen that worries
    const dashTop = addExt(new THREE.BoxGeometry(1.7, 0.1, 0.7), darkMat, 0, 1.28, -3.45);
    dashTop.rotation.x = 0.25;
    for (let i = 0; i < 6; i++) {
      const lit = i % 2 === 0;
      addExt(
        new THREE.BoxGeometry(0.1, 0.05, 0.1),
        new THREE.MeshBasicMaterial({ color: lit ? 0x7fffd4 : 0xff2e88 }),
        -0.6 + i * 0.24, 1.36, -3.42
      );
    }
    const dashScreen = addExt(new THREE.BoxGeometry(0.5, 0.3, 0.04), new THREE.MeshBasicMaterial({ color: 0x103830 }), 0, 1.55, -3.62);
    dashScreen.rotation.x = -0.2;
    // a steering yoke, vestigial but reassuring
    addExt(new THREE.TorusGeometry(0.18, 0.025, 6, 12), darkMat, 0, 1.15, -3.15).rotation.x = 0.4;

    // hold shelving + strapped cargo
    addExt(new THREE.BoxGeometry(0.16, 1.8, 2.6), darkMat, -2.05, 0.9, 1.4);
    addExt(new THREE.BoxGeometry(0.7, 0.08, 2.4), darkMat, -1.8, 1.0, 1.4);
    addExt(new THREE.BoxGeometry(0.7, 0.08, 2.4), darkMat, -1.8, 1.7, 1.4);
    addExt(new THREE.BoxGeometry(0.5, 0.5, 0.6), trimMat, -1.8, 1.32, 0.7);
    addExt(new THREE.BoxGeometry(0.5, 0.4, 0.5), stripeMat, -1.8, 1.27, 1.9);

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

  /**
   * Replace the procedural exterior with a downloaded hull model. The
   * walkable interior stays exactly where it was — the model is a shell
   * around it (its inside faces are backface-culled, so the hold still
   * reads clean from within).
   */
  private externalModel: THREE.Object3D | null = null;

  useExternalModel(model: THREE.Object3D) {
    this.exterior.visible = false;
    model.position.y = -0.2;        // settle the hull around the deck plane
    model.position.z = -1.2;        // nose-weighted, ramp clear at the stern
    this.externalModel = model;
    this.group.add(model);
  }

  /** Hide the hull shell while piloting so the camera isn't inside it. */
  setPilotView(piloting: boolean) {
    if (this.externalModel) this.externalModel.visible = !piloting;
    else this.exterior.visible = !piloting ? true : this.exterior.visible;
  }

  /** Park: snap to position with yaw only (level flight attitude). */
  park(x: number, y: number, z: number, yaw: number) {
    this.group.position.set(x, y, z);
    this.group.quaternion.setFromEuler(new THREE.Euler(0, yaw, 0));
    this.velocity.set(0, 0, 0);
  }
}
