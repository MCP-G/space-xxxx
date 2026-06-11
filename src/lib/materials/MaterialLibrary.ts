import * as THREE from 'three';
import { applyVertexSnap } from '../../render/PixelPipeline';

// The material library: every named surface in the game, defined once.
// Ask for a material by name; tweak the definition here and the whole
// universe updates. Overrides derive a variant without touching the shared
// instance.
export interface MaterialDef {
  color: number;
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
  envMapIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  /** 'basic' for unlit glow surfaces (screens, lamps, bolts). */
  unlit?: boolean;
  /** Skip the PS1 vertex snap (UI-ish surfaces). */
  noSnap?: boolean;
}

const DEFS = {
  // architecture
  'deck-plate':    { color: 0x2a2a3e, roughness: 0.82, metalness: 0.08 },
  'wall-panel':    { color: 0x3d3d5c, roughness: 0.82, metalness: 0.08 },
  'ceiling-dark':  { color: 0x14141f, roughness: 0.9,  metalness: 0.05 },
  'derelict-wall': { color: 0x3a3148, roughness: 0.9,  metalness: 0.1 },
  'derelict-roof': { color: 0x2a2438, roughness: 0.9,  metalness: 0.1 },
  // metals
  'hull-worn':     { color: 0x8a8ac0, roughness: 0.38, metalness: 0.7, envMapIntensity: 0.7 },
  'dark-metal':    { color: 0x14141f, roughness: 0.5,  metalness: 0.5, envMapIntensity: 0.8 },
  'machine-grey':  { color: 0x4a4060, roughness: 0.7,  metalness: 0.3 },
  'wreck-metal':   { color: 0x35304a, roughness: 0.85, metalness: 0.25 },
  'rock':          { color: 0x4a4060, roughness: 0.95, metalness: 0.02 },
  // accents
  'accent-pink':   { color: 0xff2e88, roughness: 0.3,  metalness: 0.6, emissive: 0x55092b },
  'accent-amber':  { color: 0xffd23e, roughness: 0.4,  metalness: 0.4, emissive: 0x553f00 },
  'glass-canopy':  { color: 0x60ffe8, roughness: 0.05, metalness: 1.0, emissive: 0x062a26, envMapIntensity: 2.2 },
  // glow (unlit)
  'glow-mint':     { color: 0x7fffd4, unlit: true },
  'glow-amber':    { color: 0xffd23e, unlit: true },
  'glow-pink':     { color: 0xff2e88, unlit: true },
  'glow-white':    { color: 0xffffff, unlit: true },
  'screen-dead':   { color: 0x2a4438, unlit: true },
  'lamp-warm':     { color: 0xfff0d8, unlit: true },
  // fx
  'field-shimmer': { color: 0x7fffd4, unlit: true, transparent: true, opacity: 0.12 },
} satisfies Record<string, MaterialDef>;

export type MaterialName = keyof typeof DEFS;

const cache = new Map<string, THREE.Material>();

function build(def: MaterialDef): THREE.Material {
  let mat: THREE.Material;
  if (def.unlit) {
    mat = new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: def.transparent ?? false,
      opacity: def.opacity ?? 1,
    });
  } else {
    const m = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: def.roughness ?? 0.8,
      metalness: def.metalness ?? 0.1,
      envMapIntensity: def.envMapIntensity ?? 1,
      transparent: def.transparent ?? false,
      opacity: def.opacity ?? 1,
    });
    if (def.emissive !== undefined) {
      m.emissive = new THREE.Color(def.emissive);
      m.emissiveIntensity = def.emissiveIntensity ?? 1;
    }
    mat = m;
  }
  if (!def.noSnap) applyVertexSnap(mat);
  return mat;
}

/**
 * Get a shared material by name, or a derived variant when overrides are
 * given. Shared instances must not be mutated by callers.
 */
export function material(name: MaterialName, overrides?: Partial<MaterialDef>): THREE.Material {
  if (!overrides) {
    let m = cache.get(name);
    if (!m) {
      m = build(DEFS[name]);
      cache.set(name, m);
    }
    return m;
  }
  return build({ ...DEFS[name], ...overrides });
}

/** Emissive-tinted variant of any base color (legacy palette helper). */
export function flat(color: number, opts: Partial<MaterialDef> = {}): THREE.Material {
  const key = `flat:${color}:${JSON.stringify(opts)}`;
  let m = cache.get(key);
  if (!m) {
    m = build({ color, roughness: 0.8, metalness: 0.1, ...opts });
    cache.set(key, m);
  }
  return m;
}
