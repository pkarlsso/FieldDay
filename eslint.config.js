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

    // TS baseline
  ...tseslint.configs.recommended,
  {
    files: ["backend/**/*.ts", "frontend/**/*.ts", "frontend/**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: true },
    },
    rules: {
      "no-undef": "off", // TS handles this
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },

  // ---------------------------------------------------------------
  // 4. Backend — Node, CommonJS
  //    This is what your winston file needs.
  // ---------------------------------------------------------------
  {
    files: [
      "backend/**/*.{js,cjs}",
      "backend/**/*.mjs",
    ],
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
  // 4b. Backend ESM files (if any use import/export)
  // ---------------------------------------------------------------
  {
    files: ["backend/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // ---------------------------------------------------------------
  // 5. Misc systems in root — scripts, tooling, config files
  // ---------------------------------------------------------------
  {
    files: [
      "*.{js,cjs,mjs}",
      "scripts/**/*.{js,cjs,mjs}",
      "tools/**/*.{js,cjs,mjs}",
      "config/**/*.{js,cjs,mjs}",
    ],
    ignores: ["eslint.config.js"], // handled separately below
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
  // 6. The ESLint config itself (and other ESM config files)
  // ---------------------------------------------------------------
  {
    files: ["eslint.config.js", "*.config.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];