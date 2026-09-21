// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint"
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import reactNative from "eslint-plugin-react-native";
import reactNativeConfig from "@react-native/eslint-config/flat";

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
  // 3b. React Native — mobile environment
  // ---------------------------------------------------------------
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
                "__DEV__": "readonly",
        "__dirname": "readonly",
        "__fbBatchedBridgeConfig": "readonly",
        "alert": "readonly",
        "Buffer": "readonly",
        "cancelAnimationFrame": "readonly",
        "cancelIdleCallback": "readonly",
        "clearImmediate": "writable",
        "clearInterval": "readonly",
        "clearTimeout": "readonly",
        "console": "readonly",
        "document": "readonly",
        "escape": "readonly",
        "Event": "readonly",
        "EventTarget": "readonly",
        "exports": "readonly",
        "fetch": "readonly",
        "FormData": "readonly",
        "global": "readonly",
        "Map": "writable",
        "module": "readonly",
        "navigator": "readonly",
        "process": "readonly",
        "Promise": "writable",
        "requestAnimationFrame": "writable",
        "requestIdleCallback": "writable",
        "require": "readonly",
        "Set": "writable",
        "setImmediate": "writable",
        "setInterval": "readonly",
        "setTimeout": "readonly",
        "window": "readonly",
        "XMLHttpRequest": "readonly",
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
      "react-native/style-sheet-object-names": ["StyleSheet", "EStyleSheet"],
    },
    plugins: {
      react,
      "react-native": reactNative,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactNativeConfig[0].rules,
      //"react-native/no-inline-styles": "warn",
      //"react-native/no-unused-styles": "warn",
      //"react-native/no-color-literals": "warn",
      //"react-native/no-raw-text": "warn",
      //"react-native/split-platform-components": "warn",
      //"react-native/no-single-element-style-arrays": "warn",
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off", // Using TypeScript or prop-types
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
  {
    files: ["logger.js", "test-logger.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];