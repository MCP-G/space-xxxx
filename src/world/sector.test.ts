import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildSector, sfc32 } from './sector';
import type { World } from './station';

function emptyWorld(): World {
  return { scene: new THREE.Scene(), colliders: [], guideMeshes: [] };
}

// A sector's layout, flattened to a comparable string. If this ever differs
// for the same seed, somebody snuck nondeterminism into the generator and
// every deed the Ministry has issued becomes a lie.
function layoutHash(seed: number): string {
  const sector = buildSector(emptyWorld(), seed);
  const parts: string[] = [];
  for (const p of sector.pois) {
    parts.push(p.kind, p.position.toArray().map((n) => n.toFixed(6)).join(','));
    if (p.dock) parts.push(p.dock.shipPos.toArray().map((n) => n.toFixed(6)).join(','));
  }
  for (const a of sector.asteroids) {
    parts.push(a.position.toArray().map((n) => n.toFixed(6)).join(','), a.radius.toFixed(6));
  }
  return parts.join('|');
}

describe('sfc32', () => {
  it('is deterministic for a given seed', () => {
    const a = sfc32(1, 2, 3, 42);
    const b = sfc32(1, 2, 3, 42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('differs across seeds', () => {
    const a = sfc32(1, 2, 3, 42);
    const b = sfc32(1, 2, 3, 43);
    const runA = Array.from({ length: 10 }, a);
    const runB = Array.from({ length: 10 }, b);
    expect(runA).not.toEqual(runB);
  });
});

describe('buildSector', () => {
  it('same seed → identical layout', () => {
    expect(layoutHash(0xdecafbad)).toBe(layoutHash(0xdecafbad));
  });

  it('different seeds → different layouts', () => {
    expect(layoutHash(1)).not.toBe(layoutHash(2));
  });

  it('always produces the three M1 POI kinds with docks where promised', () => {
    const sector = buildSector(emptyWorld(), 7);
    const kinds = sector.pois.map((p) => p.kind).sort();
    expect(kinds).toEqual(['asteroids', 'beacon', 'derelict']);
    expect(sector.pois.find((p) => p.kind === 'beacon')?.dock).toBeDefined();
    expect(sector.pois.find((p) => p.kind === 'derelict')?.dock).toBeDefined();
    expect(sector.asteroids.length).toBeGreaterThan(0);
  });
});
