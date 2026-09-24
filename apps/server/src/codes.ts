import { randomInt } from 'node:crypto';

/** No 0/O, 1/I/L: characters that are easy to mix up when read aloud or typed. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

export function generateRoomCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!exists(code)) return code;
  }
  throw new Error('could not generate a unique room code');
}
