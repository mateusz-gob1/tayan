import { getDeclarations } from './declarations';
import type { Rng } from './rng';
import type { Intent, PlayerView } from './types';

/** A bot sees exactly what a human sees (`PlayerView`), so it cannot cheat. */
export interface Bot {
  decide(view: PlayerView): Intent;
}

/** Plays a uniformly random legal move; used for simulations and tests. */
export function randomBot(rng: Rng, checkChance = 0.4): Bot {
  return {
    decide(view) {
      const list = getDeclarations(view.settings);
      const remaining = list.length - view.allowedDeclarationMinOrder;
      if (view.canCheck && (remaining <= 0 || rng.int(1000) < checkChance * 1000)) {
        return { type: 'CHECK' };
      }
      // Bias towards small raises so bidding rounds are not over in one step.
      const span = Math.max(1, Math.min(remaining, 1 + rng.int(Math.max(1, remaining))));
      const pick = list[view.allowedDeclarationMinOrder + rng.int(span)];
      if (!pick) return { type: 'CHECK' };
      return { type: 'DECLARE', declarationId: pick.id };
    },
  };
}
