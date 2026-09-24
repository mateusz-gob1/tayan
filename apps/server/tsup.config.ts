import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // Ship one self-contained file: the container needs no node_modules at runtime.
  noExternal: [/.*/],
  external: ['bufferutil', 'utf-8-validate'], // optional native speed-ups of `ws`
  // some bundled CommonJS dependencies call require() at runtime
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
});
