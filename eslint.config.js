import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

const reactNativeGlobals = {
  __DEV__: "readonly",
  global: "readonly",
  fetch: "readonly",
  WebSocket: "readonly",
  XMLHttpRequest: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  File: "readonly",
  FileReader: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  queueMicrotask: "readonly",
  process: "readonly",
  Buffer: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  requestAnimationFrame: "readonly",
  cancelAnimationFrame: "readonly",
};

export default [
  js.configs.recommended,
  {
    ignores: ["**/node_modules/", "**/dist/", "**/build/"],
  },
  {
    files: ["backend/**/*.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ["frontend/**/*.{js,jsx}"],
      ...react.configs.flat.recommended,
      languageOptions: {
      globals: {
        ...globals.browser,
        ...reactNativeGlobals
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/prop-types": ["error", { skipUndeclared: true }], // Remove if prop-types are intended to be used.
      "no-unused-vars": "off", // Set "off" -> "warn" once project is reaching later stages of completion. Remove completely once no unused vars are expected.
    }
  },
];