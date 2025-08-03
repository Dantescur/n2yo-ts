/* v8 ignore start */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    cli: './src/cli.ts',
  },
  platform: 'neutral',
  target: 'es2022',
  publint: true,
  attw: {
    excludeEntrypoints: ['cli'],
  },
  external: ['node:process', 'node:fs', 'node:path', 'node:os'],
  outDir: './dist',
  dts: true,
  shims: true,
  minify: true,
  format: ['es', 'cjs'],
  report: true,
})
/* v8 ignore stop */
