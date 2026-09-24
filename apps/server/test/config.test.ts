import { describe, expect, it } from 'vitest';
import { loadConfig, parseOrigins } from '../src/config';

describe('config', () => {
  it('uses local defaults', () => {
    expect(loadConfig({})).toMatchObject({
      port: 3001,
      clientOrigin: 'http://localhost:5173',
      rateLimitPerSec: 10,
    });
  });

  it('reads the environment', () => {
    const c = loadConfig({
      PORT: '8080',
      CLIENT_ORIGIN: 'https://tayan.pages.dev',
      LOG_LEVEL: 'warn',
    });
    expect(c).toMatchObject({
      port: 8080,
      clientOrigin: 'https://tayan.pages.dev',
      logLevel: 'warn',
    });
  });

  it('accepts several comma-separated origins and ignores trailing slashes', () => {
    expect(parseOrigins('https://tayan.pages.dev/, https://tayan.example ,')).toEqual([
      'https://tayan.pages.dev',
      'https://tayan.example',
    ]);
    expect(parseOrigins('*')).toEqual(['*']);
  });
});
