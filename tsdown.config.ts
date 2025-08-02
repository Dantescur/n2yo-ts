/* v8 ignore start */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  platform: 'neutral',
  target: 'es2022',
  format: ['es', 'cjs'],
  pub: true,
  outDir: './dist',
  dts: true,
  exports: true,
  shims: true,
  report: true,
})
/* v8 ignore stop */
