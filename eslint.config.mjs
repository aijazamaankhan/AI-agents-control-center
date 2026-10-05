import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/generated/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "desktop/node_modules/**",
      "desktop/dist/**",
    ],
  },
  {
    // Electron main/preload are CommonJS (sandboxed preloads can't be ES modules).
    files: ["desktop/**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default config;
