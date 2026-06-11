import * as THREE from 'three';
import type { Prefab, SpawnResult } from './Prefab';
import { instantiate, preloadModels } from '../models/ModelCache';

// The asset registry: every complex object in the game has an id here.
// Procedural prefabs spawn synchronously; model prefabs spawn from the
// cache after preload() (await spawnModel, or preload everything at boot
// and spawn freely).
class Registry {
  private prefabs = new Map<string, Prefab>();

  register(prefab: Prefab) {
    if (this.prefabs.has(prefab.id)) throw new Error(`prefab already registered: ${prefab.id}`);
    this.prefabs.set(prefab.id, prefab);
    return prefab;
  }

  get(id: string): Prefab {
    const p = this.prefabs.get(id);
    if (!p) throw new Error(`unknown prefab: ${id}`);
    return p;
  }

  /** Spawn a procedural prefab synchronously. */
  spawn(id: string, overrides: Record<string, unknown> = {}): SpawnResult {
    const p = this.get(id);
    if (p.kind !== 'procedural') throw new Error(`prefab ${id} is a model — use spawnModel`);
    const result = p.build({ overrides });
    this.applyMeta(p, result.root);
    return result;
  }

  /** Spawn a model prefab (cached after first load / preload). */
  async spawnModel(id: string): Promise<SpawnResult> {
    const p = this.get(id);
    if (p.kind !== 'model') throw new Error(`prefab ${id} is procedural — use spawn`);
    const { root } = await instantiate(p.url, p.normalize);
    this.applyMeta(p, root);
    return { root };
  }

  /** Warm every model prefab (call during the boot screen). */
  preload(): Promise<unknown> {
    const urls = [...this.prefabs.values()]
      .filter((p): p is Extract<Prefab, { kind: 'model' }> => p.kind === 'model')
      .map((p) => p.url);
    return preloadModels(urls);
  }

  ids(tag?: string): string[] {
    return [...this.prefabs.values()]
      .filter((p) => !tag || p.tags?.includes(tag))
      .map((p) => p.id);
  }

  private applyMeta(p: Prefab, root: THREE.Object3D) {
    if (p.guide) {
      root.userData.guideTitle = p.guide[0];
      root.userData.guideText = p.guide[1];
    }
    root.userData.prefabId = p.id;
  }
}

export const registry = new Registry();
