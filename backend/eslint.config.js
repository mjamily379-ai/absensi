// eslint.config.js
const globals = require('globals');

module.exports = [
  {
    files: ["**/*.js"],
    ignores: ["node_modules/**", "uploads/**", "build/**"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "no-undef": "warn",
    },
  },
];
