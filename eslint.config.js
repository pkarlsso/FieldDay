import js from "@eslint/js";
import globals from "globals";

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
    files: ["frontend/**/*.js"],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
];