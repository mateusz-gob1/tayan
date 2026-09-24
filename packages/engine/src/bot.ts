import { getDeclarations } from './declarations';
import type { Rng } from './rng';
import type { Intent, PlayerView } from './types';

/** A bot sees exactly what a human sees (`PlayerView`), so it cannot cheat. */
export interface Bot {
  decide(view: PlayerView): Intent;
}

/**
 * Plays a random legal move; used for simulations, tests and the lobby's test bots.
 * Raises are usually small (the offset above the minimum is skewed towards 0), so a game
 * does not jump to the top hands in the first bid.
 */
export function randomBot(rng: Rng, checkChance = 0.4): Bot {
  return {
    decide(view) {
      const list = getDeclarations(view.settings);
      const remaining = list.length - view.allowedDeclarationMinOrder;
      if (view.canCheck && (remaining <= 0 || rng.int(1000) < checkChance * 1000)) {
        return { type: 'CHECK' };
      }
      const t = rng.int(1000) / 1000;
      const offset = Math.floor(t ** 4 * remaining);
      const pick = list[view.allowedDeclarationMinOrder + offset];
      if (!pick) return { type: 'CHECK' };
      return { type: 'DECLARE', declarationId: pick.id };
    },
  };
}
