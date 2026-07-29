import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Bridge the Next.js shareable configs (still written in the legacy "extends"
// format) into ESLint 9's flat config. `next/core-web-vitals` pulls in the
// React, React Hooks, jsx-a11y and @next/next rules; `next/typescript` adds the
// TypeScript-aware rules (fast, non-type-checked — no parserOptions.project).
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  {
    // Generated output, vendored SQL/migrations and the Outline export mirror
    // aren't ours to lint. node_modules is ignored by ESLint automatically.
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'drizzle/**',
      'outline-export/**',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Literal apostrophes/quotes in JSX *text* render fine; this rule guards a
      // theoretical ambiguity that rarely matters and is commonly disabled. The
      // meaningful rules (react-hooks, jsx-a11y, @next/next, no-unused-vars) stay on.
      'react/no-unescaped-entities': 'off',
      // Pages-Router-era rule that misfires in App-Router projects (this repo has
      // no `pages/` dir). It false-positives here even though internal links all
      // use <Link> and the only <a> tags are tel:/mailto: (which must be anchors).
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
]

export default eslintConfig
