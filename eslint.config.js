import js from "@eslint/js";
import ts from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  ...svelte.configs["flat/prettier"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte"],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
      },
    },
  },
  {
    files: ["**/__tests__/**/*", "**/*.test.*", "**/*.spec.*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "none",
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-undef": "warn",
      "svelte/infinite-reactive-loop": "warn",
      "svelte/prefer-writable-derived": "warn",
      "svelte/no-at-html-tags": "warn",
      "no-unsafe-optional-chaining": "warn",
      "no-case-declarations": "warn",
      "svelte/valid-prop-names-in-kit-pages": "warn",
    },
  },
  {
    ignores: [
      "build/",
      ".svelte-kit/",
      "dist/",
      ".wrangler/",
      "worker/coverage/",
      "fix-*.cjs",
    ],
  },
];
