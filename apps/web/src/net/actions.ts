import type { GameSettings } from '@tayan/engine';
import { useStore } from '../store';
import { request } from './socket';

/** Sends an action and surfaces a failure as a global notice (translated by code). */
async function act(event: string, payload: unknown = {}): Promise<boolean> {
  const res = await request(event, payload);
  if (!res.ok) {
    useStore.getState().setNotice(res.error.code);
    return false;
  }
  return true;
}

export const startGame = () => act('game:start');
export const declare = (declarationId: string) => act('game:declare', { declarationId });
export const check = () => act('game:check');
export const ready = () => act('game:ready');
export const rematch = () => act('game:rematch');
export const kick = (playerId: string) => act('room:kick', { playerId });
export const voteKick = (playerId: string) => act('game:voteKick', { playerId });
export const setSettings = (settings: Partial<GameSettings>) => act('room:settings', settings);

export const addBot = () => act('room:addBot');

/**
 * Testing aid: tops the room up to 3 players with bots and starts the game.
 * Hidden with VITE_ENABLE_BOTS=false (the server can also refuse with ENABLE_BOTS=false).
 */
export async function playWithBots(): Promise<void> {
  const members = useStore.getState().room?.members.length ?? 1;
  for (let i = members; i < 3; i++) {
    if (!(await addBot())) return;
  }
  await startGame();
}
