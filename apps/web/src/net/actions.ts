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
