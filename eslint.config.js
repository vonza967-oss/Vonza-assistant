import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "docs/sql/**",
      "supabase/**",
      "db/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "no-constant-binary-expression": "error",
      "no-dupe-keys": "warn",
      "no-duplicate-imports": "warn",
      "no-empty": "warn",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-template-curly-in-string": "error",
      "no-unreachable": "warn",
      "no-unmodified-loop-condition": "error",
      "no-useless-assignment": "warn",
      "no-useless-escape": "warn",
    },
  },
  {
    files: ["frontend/**/*.js", "embed.js", "embed-lite.js", "service-worker.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
