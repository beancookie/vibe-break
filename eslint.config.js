import js from "@eslint/js";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "dist/",
      "src-tauri/",
      "node_modules/",
      "*.config.*",
      ".svelte-kit/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs["flat/recommended"],
  prettier,
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      globals: {
        console: "readonly",
        window: "readonly",
        document: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        queueMicrotask: "readonly",
        performance: "readonly",
        MouseEvent: "readonly",
        KeyboardEvent: "readonly",
        WheelEvent: "readonly",
        HTMLElement: "readonly",
        HTMLCanvasElement: "readonly",
        innerWidth: "readonly",
        innerHeight: "readonly",
      },
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "svelte/no-at-html-tags": "off",
      "svelte/prefer-svelte-reactivity": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
];
