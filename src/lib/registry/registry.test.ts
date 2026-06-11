import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { registry } from './AssetRegistry';
import './prefabs';
import { material } from '../materials/MaterialLibrary';

describe('AssetRegistry', () => {
  it('spawns procedural prefabs with parts and guide metadata', () => {
    const { root, parts } = registry.spawn('drone-loss-prevention');
    expect(root.userData.prefabId).toBe('drone-loss-prevention');
    expect(root.userData.guideTitle).toBe('LOSS-PREVENTION DRONE');
    expect(parts?.core).toBeInstanceOf(THREE.Mesh);
    expect(parts?.ring).toBeInstanceOf(THREE.Mesh);
    expect(parts?.eye).toBeInstanceOf(THREE.Mesh);
  });

  it('spawns independent instances', () => {
    const a = registry.spawn('salvage-crate');
    const b = registry.spawn('salvage-crate');
    expect(a.root).not.toBe(b.root);
    a.root.position.set(9, 9, 9);
    expect(b.root.position.x).toBe(0);
  });

  it('honors overrides', () => {
    const big = registry.spawn('salvage-crate', { size: 2 }).root as THREE.Mesh;
    const geo = big.geometry as THREE.BoxGeometry;
    expect(geo.parameters.width).toBe(2);
  });

  it('catalogues by tag', () => {
    expect(registry.ids('character').length).toBe(5);
    expect(registry.ids('enemy')).toContain('drone-loss-prevention');
  });

  it('refuses wrong spawn kind', () => {
    expect(() => registry.spawn('ship-imperial')).toThrow(/model/);
  });
});

describe('MaterialLibrary', () => {
  it('shares instances for plain lookups', () => {
    expect(material('deck-plate')).toBe(material('deck-plate'));
  });

  it('derives fresh instances for overrides', () => {
    const variant = material('glow-pink', { color: 0x123456 });
    expect(variant).not.toBe(material('glow-pink'));
    expect(((variant as THREE.MeshBasicMaterial).color.getHex())).toBe(0x123456);
  });
});
