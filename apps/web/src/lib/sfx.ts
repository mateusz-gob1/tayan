import type { ServerEvent } from '../net/types';
import { playSound, playSoundAfter } from './sound';

/** Time between two cards being turned over at the reveal (matches the flip animation stagger). */
export const FLIP_STEP_MS = 130;
/** How many flips are voiced; a huge reveal would just be noise. */
const MAX_FLIP_SOUNDS = 10;
const DEAL_SOUNDS = 4;

/**
 * Turns game events into sounds. Called for every `game:event` the server sends; `me` is the
 * player's own id so that, for example, your own declaration is not announced twice.
 */
export function soundForEvent(event: ServerEvent, me: string | undefined): void {
  switch (event.type) {
    case 'ROUND_STARTED':
      for (let i = 0; i < DEAL_SOUNDS; i++) playSoundAfter('deal', i * 130);
      break;
    case 'DECLARED':
      if (event.playerId !== me) playSound('declare');
      break;
    case 'CHECKED':
      playSound('check');
      break;
    case 'REVEALED': {
      const result = event.result as { allHands?: Record<string, unknown[]> } | undefined;
      const cards = Object.values(result?.allHands ?? {}).reduce((n, hand) => n + hand.length, 0);
      const flips = Math.min(cards, MAX_FLIP_SOUNDS);
      for (let i = 0; i < flips; i++) playSoundAfter('flip', 250 + i * FLIP_STEP_MS);
      playSoundAfter('award', 250 + flips * FLIP_STEP_MS + 200);
      break;
    }
    case 'PLAYER_ELIMINATED':
      playSoundAfter('eliminated', 900);
      break;
    case 'GAME_OVER':
      playSoundAfter(event.winner === me ? 'win' : 'lose', 1400);
      break;
  }
}
