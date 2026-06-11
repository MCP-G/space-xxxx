import { sfc32 } from '../world/sector';

// The Galactic Economy, abridged. Prices are seeded per location so trade
// routes are stable within a sector and worthless knowledge in the next.
export interface Commodity {
  id: string;
  name: string;
  base: number; // baseline price
}

export const COMMODITIES: Commodity[] = [
  { id: 'towels',  name: 'COMMEMORATIVE TOWELS',        base: 12 },
  { id: 'peanuts', name: 'EMERGENCY PEANUTS',           base: 8 },
  { id: 'poetry',  name: 'BOTTLED POETRY (VOGON-FREE)', base: 40 },
  { id: 'gravity', name: 'ARTISANAL GRAVITY (TINNED)',  base: 65 },
  { id: 'scrap',   name: 'SCRAP (PROVENANCE: DUBIOUS)', base: 30 },
  { id: 'regret',  name: 'SURPLUS REGRET (BULK)',       base: 5 },
];

export const CARGO_CAPACITY = 12;

export interface MarketListing {
  commodity: Commodity;
  buy: number;  // what the market charges you
  sell: number; // what the market pays you
}

/** Stable per-location price table derived from sector seed + market id. */
export function marketPrices(sectorSeed: number, marketId: number): MarketListing[] {
  const rnd = sfc32(0xc0ffee, marketId * 7919, 0x5eed, sectorSeed);
  return COMMODITIES.map((c) => {
    const drift = 0.5 + rnd() * 1.4; // 0.5x..1.9x — arbitrage lives here
    const mid = Math.max(1, Math.round(c.base * drift));
    return {
      commodity: c,
      buy: Math.max(2, Math.round(mid * 1.12)),
      sell: Math.max(1, Math.round(mid * 0.88)),
    };
  });
}

export class PlayerState {
  credits = 100;
  hull = 100;
  engineLevel = 1;
  cargo = new Map<string, number>();

  cargoCount(): number {
    let n = 0;
    for (const v of this.cargo.values()) n += v;
    return n;
  }

  add(id: string, n = 1): boolean {
    if (this.cargoCount() + n > CARGO_CAPACITY) return false;
    this.cargo.set(id, (this.cargo.get(id) ?? 0) + n);
    return true;
  }

  remove(id: string, n = 1): boolean {
    const have = this.cargo.get(id) ?? 0;
    if (have < n) return false;
    if (have === n) this.cargo.delete(id);
    else this.cargo.set(id, have - n);
    return true;
  }

  save() {
    localStorage.setItem('player-state', JSON.stringify({
      credits: this.credits,
      engineLevel: this.engineLevel,
      cargo: [...this.cargo.entries()],
    }));
  }

  load() {
    try {
      const raw = localStorage.getItem('player-state');
      if (!raw) return;
      const s = JSON.parse(raw);
      this.credits = s.credits ?? 100;
      this.engineLevel = s.engineLevel ?? 1;
      this.cargo = new Map(s.cargo ?? []);
    } catch { /* corrupted save: the Ministry regrets nothing */ }
  }
}
