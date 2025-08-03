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
  external: ['node:process'],
  outDir: './dist',
  dts: true,
  exports: true,
  shims: true,
  format: ['es', 'cjs'],
  report: true,
})
/* v8 ignore stop */
