import { defineConfig } from 'vitest/config'

// Keep test discovery to the real source tree. `next build` with
// `output: 'standalone'` traces the whole project (including tests/) into
// `.next/standalone/`, so without this exclude vitest picks up stale *copies*
// of every test and double-counts them.
export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    // The ingest-case test mocks @aws-sdk/client-s3 via vi.mock. Two things must
    // be routed through vitest's runner for that to apply, or the handler hits the
    // REAL S3 (Windows happened to inline it; Linux externalized it → flaky fail):
    //   1. the .mjs Lambda handler itself (else its native-ESM import of the SDK is
    //      resolved by Node and never sees the mock), and
    //   2. the @aws-sdk package it imports.
    server: { deps: { inline: [/@aws-sdk\//, /[\\/]lambda[\\/].*\.mjs$/] } },
  },
})
