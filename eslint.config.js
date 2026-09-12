import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";

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
      languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    ...react.configs.flat.recommended,
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/prop-types": ["error", { skipUndeclared: true }], // Remove if prop-types are intended to be used.
      "no-unused-vars": "off", // Set "off" -> "warn" once project is reaching later stages of completion. Remove completely once no unused vars are expected.
    }
  },
];