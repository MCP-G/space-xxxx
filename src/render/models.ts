import * as THREE from 'three';
import { instantiate, type NormalizeOpts } from '../lib/models/ModelCache';

// Character/vehicle load helper built on the shared ModelCache (load once,
// clone many). Adds the Quaternius-specific touches: posing rigged arms
// down out of T-pose, and playing idle clips when a model has them.

/** Mixers needing update(dt) each frame — main's loop drains this. */
export const activeMixers: THREE.AnimationMixer[] = [];

export async function loadModel(url: string, opts: NormalizeOpts = {}): Promise<THREE.Group> {
  const { root, inner, animations } = await instantiate(url, opts);

  // rigged characters ship in T-pose with no clips; pose the arms down so
  // they look like people waiting rather than people being inspected
  // (GLTFLoader sanitizes "UpperArm.L" to "UpperArmL"; axes found empirically)
  inner.traverse((o) => {
    if (o.name === 'UpperArmL') { o.rotation.z = -1.15; o.rotation.y += 1.1; }
    else if (o.name === 'UpperArmR') { o.rotation.z = 1.15; o.rotation.y -= 1.1; }
    else if (o.name === 'LowerArmL') o.rotation.z = -0.25;
    else if (o.name === 'LowerArmR') o.rotation.z = 0.25;
  });

  // ...and if a model does have an idle clip, prefer that
  if (animations.length > 0) {
    const mixer = new THREE.AnimationMixer(inner);
    const idle = animations.find((c) => /idle/i.test(c.name)) ?? animations[0];
    mixer.clipAction(idle).play();
    activeMixers.push(mixer);
  }
  return root;
}
