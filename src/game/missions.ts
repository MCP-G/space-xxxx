import { sfc32 } from '../world/sector';
import { COMMODITIES } from './economy';

// The contracts board: gainful employment for people with a ship, a blaster,
// and no questions. Three offers at a time, one active job, payment on
// completion, satisfaction not guaranteed or indeed mentioned.
export type MissionKind = 'deliver' | 'clear' | 'salvage';

export interface Mission {
  id: number;
  kind: MissionKind;
  title: string;
  desc: string;
  /** Dock name for deliver missions (e.g. 'NAV BEACON'). */
  targetDock?: string;
  commodityId?: string;
  qty: number;
  reward: number;
}

const DELIVER_FLAVOR = [
  'The recipient insists it is urgent. The recipient insists everything is urgent.',
  'Sender declined to say why. The crate declined to say anything.',
  'Insured for sentimental value: zero.',
];
const CLEAR_FLAVOR = [
  'The drones have unionized. Negotiations have moved to the ballistic phase.',
  'Salvage rights pending drone non-existence. Make it pending harder.',
  'They fired first. They will also fire second and third; bring a weapon.',
];
const SALVAGE_FLAVOR = [
  'One entity\'s catastrophe is another\'s procurement strategy.',
  'The Ministry classifies this as "recycling with ambition".',
  'Finders keepers is, in this sector, settled case law.',
];

export class MissionBoard {
  offers: Mission[] = [];
  active: Mission | null = null;
  progress = 0;
  private counter = 0;

  /** Three fresh offers, deterministic per sector seed + rolling counter. */
  generate(sectorSeed: number) {
    const rnd = sfc32(0xfeed, this.counter * 31 + 7, 0xbeef, sectorSeed);
    this.offers = [];
    const mk = (kind: MissionKind): Mission => {
      const id = ++this.counter;
      if (kind === 'deliver') {
        const c = COMMODITIES[Math.floor(rnd() * 4)]; // tradables only, not scrap/regret
        const qty = 2 + Math.floor(rnd() * 3);
        const target = rnd() > 0.5 ? 'NAV BEACON' : 'ROCK COLLECTION';
        return {
          id, kind, qty,
          commodityId: c.id,
          targetDock: target,
          reward: Math.round(c.base * qty * 1.6 + 40),
          title: `DELIVER ${qty}x ${c.name}`,
          desc: `To ${target}. ${DELIVER_FLAVOR[id % DELIVER_FLAVOR.length]}`,
        };
      }
      if (kind === 'clear') {
        return {
          id, kind, qty: 3,
          reward: 150 + Math.floor(rnd() * 60),
          title: 'CLEAR THE DERELICT DRONES',
          desc: CLEAR_FLAVOR[id % CLEAR_FLAVOR.length],
        };
      }
      const qty = 3 + Math.floor(rnd() * 3);
      return {
        id, kind, qty,
        reward: 30 * qty + Math.floor(rnd() * 30),
        title: `RECOVER ${qty}x SALVAGE`,
        desc: `Ore or scrap, picked up anywhere but bought nowhere. ${SALVAGE_FLAVOR[id % SALVAGE_FLAVOR.length]}`,
      };
    };
    this.offers = [mk('deliver'), mk('clear'), mk('salvage')];
    this.save();
  }

  accept(index: number): Mission | null {
    const m = this.offers[index];
    if (!m || this.active) return null;
    this.active = m;
    this.progress = 0;
    this.offers.splice(index, 1);
    this.save();
    return m;
  }

  abandon() {
    this.active = null;
    this.progress = 0;
    this.save();
  }

  /** Mark progress; returns true when the active mission just completed. */
  advance(n = 1): boolean {
    if (!this.active) return false;
    this.progress += n;
    if (this.progress >= this.active.qty) return true;
    this.save();
    return false;
  }

  /** Pay out and clear. Returns the reward. */
  complete(): number {
    const reward = this.active?.reward ?? 0;
    this.active = null;
    this.progress = 0;
    this.save();
    return reward;
  }

  statusLine(): string {
    if (!this.active) return '';
    const m = this.active;
    const p = m.kind === 'deliver' ? '' : ` ${this.progress}/${m.qty}`;
    return `JOB: ${m.title}${p} → ${m.reward}¢`;
  }

  save() {
    localStorage.setItem('missions', JSON.stringify({
      offers: this.offers, active: this.active, progress: this.progress, counter: this.counter,
    }));
  }

  load() {
    try {
      const raw = localStorage.getItem('missions');
      if (!raw) return false;
      const s = JSON.parse(raw);
      this.offers = s.offers ?? [];
      this.active = s.active ?? null;
      this.progress = s.progress ?? 0;
      this.counter = s.counter ?? 0;
      return this.offers.length > 0 || this.active !== null;
    } catch {
      return false;
    }
  }
}
