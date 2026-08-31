import { defineConfig } from 'vitest/config'

// Keep test discovery to the real source tree. `next build` with
// `output: 'standalone'` traces the whole project (including tests/) into
// `.next/standalone/`, so without this exclude vitest picks up stale *copies*
// of every test and double-counts them.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
  },
})
