import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import playwright from "eslint-plugin-playwright";
import unicorn from "eslint-plugin-unicorn";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "_site/",
    "_site-test/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    "screenshots/",
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  // Turns off rules that clash with Prettier; must come before our rules so `curly` stays on
  prettier,

  {
    plugins: { unicorn },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      curly: ["error", "all"],
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": "error",
      "prefer-arrow-callback": "error",
      "prefer-template": "error",
      "no-else-return": ["error", { allowElseIf: false }],
      "no-lonely-if": "error",
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",
      "no-implicit-coercion": "error",
      "no-param-reassign": "error",
      "@typescript-eslint/no-shadow": "error",
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "max-nested-callbacks": ["error", 3],
      complexity: ["warn", 12],
      "id-length": ["error", { min: 2, properties: "never", exceptions: ["x", "y", "_"] }],
      "unicorn/name-replacements": ["error", { checkFilenames: false }],
      "@typescript-eslint/consistent-type-imports": ["error", { disallowTypeAnnotations: false }],
      // Numbers read fine in messages and selectors, e.g. `at ${width}px`
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // `||` on strings is deliberate: an empty text falls back like a missing one
      "@typescript-eslint/prefer-nullish-coalescing": [
        "error",
        { ignorePrimitives: { string: true } },
      ],
    },
  },

  {
    // Eleventy is plain JavaScript: its plugins and config methods have no precise types
    files: ["eleventy.config.ts"],
    rules: { "@typescript-eslint/no-unsafe-argument": "off" },
  },

  {
    files: ["js/**/*.ts", "admin/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ["*.config.ts", "lib/**/*.ts", "tests/support/**/*.ts"],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["tests/**/*.ts"],
    ...playwright.configs["flat/recommended"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      ...playwright.configs["flat/recommended"].rules,
      "max-nested-callbacks": ["error", 4],
      // page.evaluate((y) => …, y) runs in the browser and must take its values as arguments
      "@typescript-eslint/no-shadow": "off",
    },
  },

  {
    // The link checker has to wait until every resource has loaded or failed
    files: ["tests/links.spec.ts"],
    rules: { "playwright/no-networkidle": "off" },
  },
]);
