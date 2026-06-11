import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

// Load-once, clone-many GLTF cache. Every spawned instance is an
// independent scene graph (SkeletonUtils handles skinned meshes), so
// per-instance tweaks never bleed between copies.
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

export interface NormalizeOpts {
  height?: number; // scale so bounding height = this (characters)
  length?: number; // scale so bounding depth = this (vehicles)
}

function getGltf(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    p = loader.loadAsync(url);
    cache.set(url, p);
  }
  return p;
}

/** Warm the cache (call during the boot screen). */
export function preloadModels(urls: string[]): Promise<unknown> {
  return Promise.allSettled(urls.map(getGltf));
}

/**
 * Get an independent, normalized instance of a model: feet at y=0,
 * centered on x/z, scaled per opts, shadows enabled. Also returns the
 * source animation clips (shared, read-only) and a mixer factory.
 */
export async function instantiate(url: string, opts: NormalizeOpts = {}) {
  const gltf = await getGltf(url);
  const model = SkeletonUtils.clone(gltf.scene);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  let scale = 1;
  if (opts.height) scale = opts.height / size.y;
  else if (opts.length) scale = opts.length / size.z;
  model.scale.setScalar(scale);
  model.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;

  model.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });

  const wrapper = new THREE.Group();
  wrapper.add(model);
  return { root: wrapper, inner: model, animations: gltf.animations };
}
