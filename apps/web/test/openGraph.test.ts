import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const meta = (attr: 'property' | 'name', key: string): string | undefined =>
  new RegExp(String.raw`<meta\s+${attr}="${key}"\s+content="([^"]*)"`, 's').exec(html)?.[1];

describe('link preview tags', () => {
  it('describe the game for chats and social networks', () => {
    expect(meta('property', 'og:title')).toBe('Tayan');
    expect(meta('property', 'og:type')).toBe('website');
    expect(meta('property', 'og:description')?.length).toBeGreaterThan(20);
  });

  it('point to an absolute image URL that exists in the public files', () => {
    const image = meta('property', 'og:image');
    expect(image).toMatch(/^https:\/\//);
    const file = new URL(`../public/${image?.split('/').pop()}`, import.meta.url);
    expect(existsSync(file)).toBe(true);
  });

  it('the image is 1280x640 as declared', () => {
    const png = readFileSync(new URL('../public/social-preview.png', import.meta.url));
    expect(png.readUInt32BE(16)).toBe(Number(meta('property', 'og:image:width')));
    expect(png.readUInt32BE(20)).toBe(Number(meta('property', 'og:image:height')));
  });
});
