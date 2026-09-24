import { describe, expect, it } from 'vitest';
import { loadConfig, originMatchers, parseOrigins } from '../src/config';

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

  it('supports a wildcard subdomain for preview deployments', () => {
    const [fixed, preview] = originMatchers(
      parseOrigins('https://tayan.pages.dev,https://*.tayan.pages.dev'),
    );
    expect(fixed).toBe('https://tayan.pages.dev');
    const re = preview as RegExp;
    expect(re.test('https://feat-pixel.tayan.pages.dev')).toBe(true);
    expect(re.test('https://a1b2c3d4.tayan.pages.dev')).toBe(true);
    expect(re.test('https://tayan.pages.dev')).toBe(false);
    expect(re.test('https://evil.example.com')).toBe(false);
    expect(re.test('https://a.b.tayan.pages.dev')).toBe(false);
    expect(re.test('https://x.tayan.pages.dev.evil.com')).toBe(false);
  });
});
