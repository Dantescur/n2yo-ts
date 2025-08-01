/* v8 ignore start */
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  platform: 'neutral',
  attw: true,
  format: ['es'],
  exports: true,
})
/* v8 ignore stop */
