import * as THREE from 'three';

export interface Interactable {
  /** World position of the interaction point (updated externally if it moves). */
  position: THREE.Vector3;
  radius: number;
  label: string;
  enabled: boolean;
  onUse: () => void;
}

export class InteractionRegistry {
  private items: Interactable[] = [];

  add(item: Interactable) {
    this.items.push(item);
    return item;
  }

  /** Remove a previously-added interactable (dynamic planet dialogue, etc). */
  remove(item: Interactable) {
    const i = this.items.indexOf(item);
    if (i >= 0) this.items.splice(i, 1);
  }

  /** Nearest enabled interactable within reach of `from`, or null. */
  nearest(from: THREE.Vector3): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.items) {
      if (!it.enabled) continue;
      const d = from.distanceTo(it.position);
      if (d < it.radius && d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }
}
