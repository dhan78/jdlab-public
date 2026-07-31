// Next.js 16 ships native ESLint flat configs, so we import them directly
// instead of bridging the legacy "extends" format through FlatCompat (which
// hits a circular-structure error under eslint-config-next 16).
//   core-web-vitals -> React, React Hooks, jsx-a11y, @next/next rules
//   typescript      -> TypeScript-aware rules (fast, non-type-checked)
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

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
  ...nextCoreWebVitals,
  ...nextTypescript,
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
      // New in the Next 16 react-hooks plugin. It flags setState() inside an
      // effect as a cascading-render risk, but this repo uses that pattern
      // deliberately (hydration guards, async data loads, viewer resets) where
      // it's correct. Advisory/perf, not correctness — off to avoid noise.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default eslintConfig
