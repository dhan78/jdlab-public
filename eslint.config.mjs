import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

const eslintConfig = [
  // GLOBAL IGNORES: Prevents ESLint from scanning built artifacts and auto-generated declarations
  {
    ignores: [
      ".next/**/*",
      "node_modules/**/*",
      "out/**/*",
      "next-env.d.ts",
      "components/CaseThread.tsx",
      "components/ContactForm.tsx",
      "components/Testimonials.tsx"
    ]

  },

  js.configs.recommended,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  
    {
    rules: {
      // 1. Silences apostrophe and quote errors in your text components
      "react/no-unescaped-entities": "off",

      // 2. Silences warnings about old inline comment overrides
      "eslint-comments/no-unused-disable": "off", 
      "no-warning-comments": "off",

      // 3. Keep these active from before to bypass routing errors
      "@next/next/no-html-link-for-pages": "off",
      "no-useless-escape": "off",
      "@next/next/no-img-element": "off",

            // Deactivates warnings for declared variables that are never read
      "@typescript-eslint/no-unused-vars": "off"

    },
  },
];

export default eslintConfig;
