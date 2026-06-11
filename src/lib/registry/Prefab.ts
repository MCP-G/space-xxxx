import * as THREE from 'three';

// A prefab is the single definition of a complex object: how it's built,
// what it's made of, what the Guide says about it, and what knobs exist.
// Spawn it anywhere; tweak it with overrides; never build it twice.

export interface SpawnContext<O = Record<string, unknown>> {
  overrides: O;
}

export interface SpawnResult {
  root: THREE.Object3D;
  /** Named sub-parts callers may need (e.g. drone 'core' for hit flashes). */
  parts?: Record<string, THREE.Object3D>;
}

export interface ProceduralPrefab<O = Record<string, unknown>> {
  id: string;
  kind: 'procedural';
  tags?: string[];
  guide?: [title: string, text: string];
  build: (ctx: SpawnContext<O>) => SpawnResult;
}

export interface ModelPrefab {
  id: string;
  kind: 'model';
  tags?: string[];
  guide?: [title: string, text: string];
  url: string;
  normalize: { height?: number; length?: number };
}

export type Prefab = ProceduralPrefab<any> | ModelPrefab;
