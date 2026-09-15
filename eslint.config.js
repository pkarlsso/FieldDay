// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint"
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  // ---------------------------------------------------------------
  // 1. Ignore build output, deps, logs, etc. everywhere
  // ---------------------------------------------------------------
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/logs/**",
      "**/*.min.js",
    ],
  },

  // ---------------------------------------------------------------
  // 2. Baseline rules for every JS file
  //    (no `files` key = applies to everything)
  // ---------------------------------------------------------------
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs,cjs}"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // ---------------------------------------------------------------
  // 3. Frontend — browser + React
  // ---------------------------------------------------------------
  {
    files: ["frontend/**/*.{js,jsx,mjs,cjs}", "src/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        process: "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules, // no need for `import React`
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/prop-types": "off", // turn on if you don't use TS/PropTypes
      "react-hooks/set-state-in-effect": "warn",   // remove once issue is fixed
    },
  },

  // ---------------------------------------------------------------
  // 4. TS baseline - Scoped
  // ---------------------------------------------------------------
    ...tseslint.configs.recommended.map((c) => ({
    ...c,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { project: true },
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // ---------------------------------------------------------------
  // 5. Backend — Node, CommonJS
  //    This is what your winston file needs.
  // ---------------------------------------------------------------
  {
    files: [
      "backend/**/*.{js,cjs}",
      "backend/**/*.mjs",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs", // treat .js as CJS by default here
      globals: {
        ...globals.node, // require, module, __dirname, process, Buffer, console...
      },
    },
    rules: {
      "no-console": "off", // server code logs to console legitimately
      "@typescript-eslint/no-require-imports": "warn",   // delete this after import has been fixed to new syntax
    },
  },

  // ---------------------------------------------------------------
  // 5b. Backend ESM files (if any use import/export)
  // ---------------------------------------------------------------
  {
    files: ["backend/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // ---------------------------------------------------------------
  // 6a. Misc systems in root — scripts, tooling, config files
  // ---------------------------------------------------------------
  {
    files: [
      "*.{js,cjs}",
      "scripts/**/*.{js,cjs}",
      "tools/**/*.{js,cjs}",
      "config/**/*.{js,cjs}",
    ],
    ignores: ["eslint.config.js"], // handled separately below
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "warn", // delete this after import has been fixed to new syntax
      "no-redeclare": "warn", // remove once this is fixed
    },
  },

  // ---------------------------------------------------------------
  // 6b. Misc systems in root — ESM
  // ---------------------------------------------------------------
  {
    files: [
      "*.mjs",
      "scripts/**/*.mjs",
      "tools/**/*.mjs",
      "config/**/*.mjs",
    ],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "warn", // delete this after import has been fixed to new syntax
      "no-redeclare": "warn", // remove once this is fixed
    },
  },

  // ---------------------------------------------------------------
  // 7. The ESLint config itself (and other ESM config files)
  // ---------------------------------------------------------------
  {
    files: ["eslint.config.js", "*.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];