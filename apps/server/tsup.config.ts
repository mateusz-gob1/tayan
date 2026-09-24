import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // the engine is shipped as TypeScript source, so bundle it into the server
  noExternal: ['@tayan/engine'],
});
