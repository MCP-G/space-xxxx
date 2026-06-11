import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Loader for the CC0 Quaternius models in public/models (see LICENSE.txt).
const loader = new GLTFLoader();

/**
 * Load a GLB/glTF and normalize it: feet at y=0, scaled to `height` meters
 * (or `length` meters along Z if given instead), shadows enabled.
 */
export async function loadModel(
  url: string,
  opts: { height?: number; length?: number } = {}
): Promise<THREE.Group> {
  const gltf = await loader.loadAsync(url);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  let scale = 1;
  if (opts.height) scale = opts.height / size.y;
  else if (opts.length) scale = opts.length / size.z;
  model.scale.setScalar(scale);
  // re-measure and sit feet on the ground, centered on x/z
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const wrapper = new THREE.Group();
  wrapper.add(model);

  // rigged characters ship in T-pose with no clips; pose the arms down so
  // they look like people waiting rather than people being inspected
  model.traverse((o) => {
    // (GLTFLoader sanitizes "UpperArm.L" to "UpperArmL"; axes found empirically)
    if (o.name === 'UpperArmL') { o.rotation.z = -1.15; o.rotation.y += 1.1; }
    else if (o.name === 'UpperArmR') { o.rotation.z = 1.15; o.rotation.y -= 1.1; }
    else if (o.name === 'LowerArmL') o.rotation.z = -0.25;
    else if (o.name === 'LowerArmR') o.rotation.z = 0.25;
  });

  // ...and if a model does have an idle clip, prefer that
  if (gltf.animations.length > 0) {
    const mixer = new THREE.AnimationMixer(model);
    const idle =
      gltf.animations.find((c) => /idle/i.test(c.name)) ?? gltf.animations[0];
    mixer.clipAction(idle).play();
    activeMixers.push(mixer);
  }
  return wrapper;
}

/** Mixers needing update(dt) each frame — main's loop drains this. */
export const activeMixers: THREE.AnimationMixer[] = [];
