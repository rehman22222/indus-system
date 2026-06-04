import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

// Flat config using the installed @typescript-eslint/{parser,eslint-plugin}
// packages directly (the `typescript-eslint` meta-package is not a
// dependency of this project).
export default [
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: globals.browser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // TypeScript (enforced via `tsc -b` in the build) is the source of
      // truth for these; the core JS rules produce false positives on
      // type-only references, so disable them for TS files — this mirrors
      // the typescript-eslint recommended preset.
      "no-undef": "off",
      "no-redeclare": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // This codebase deliberately uses `any` for PostgREST joined rows.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Service worker scripts (static, not app source) — they run in the
    // ServiceWorkerGlobalScope (self, caches, fetch, importScripts…).
    files: ["public/**/*.js"],
    languageOptions: {
      // `firebase` is provided by importScripts() of the Firebase compat SDK.
      globals: { ...globals.serviceworker, ...globals.browser, firebase: "readonly" },
    },
  },
];
