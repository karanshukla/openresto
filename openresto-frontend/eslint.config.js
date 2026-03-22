// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*", "node_modules/*", ".expo/*", "android/*", "ios/*"],
  },
  {
    rules: {
      // `'` and `"` in JSX text are fine in React Native — not HTML
      "react/no-unescaped-entities": "off",

      // Catch unused variables; allow _ prefix for intentional ignores
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],

      // `any` is sometimes unavoidable in RN web platform overrides — warn not error
      "@typescript-eslint/no-explicit-any": "warn",

      // Console statements should be cleaned up before shipping
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // Prefer const
      "prefer-const": "error",

      // No var declarations
      "no-var": "error",
    },
  },
]);
