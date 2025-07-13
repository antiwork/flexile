import { fileURLToPath } from "node:url";
import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
import globals from "globals";
import tseslint from "typescript-eslint";

const nextIgnores = includeIgnoreFile(fileURLToPath(import.meta.resolve("./frontend/.gitignore")));
nextIgnores.ignores = nextIgnores.ignores.map((file) => `frontend/${file}`);

export default [
  includeIgnoreFile(fileURLToPath(import.meta.resolve("./.gitignore"))),
  nextIgnores,
  { ignores: ["frontend/utils/routes.*", "backend", ".github"] },
  prettierRecommended,
  js.configs.recommended,
  {
    plugins: { import: importPlugin },
    linterOptions: {
      reportUnusedDisableDirectives: process.env.DISABLE_TYPE_CHECKED ? "off" : "error",
    },
    rules: {
      "arrow-body-style": "error",
      eqeqeq: ["error", "smart"],
      "logical-assignment-operators": "error",
      "no-alert": "error",
      "no-console": "error",
      "no-else-return": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-lone-blocks": "error",
      "no-lonely-if": "error",
      "no-var": "error",
      "no-unneeded-ternary": "error",
      "no-useless-call": "error",
      "no-useless-computed-key": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "object-shorthand": "error",
      "operator-assignment": "error",
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-exponentiation-operator": "error",
      "prefer-numeric-literals": "error",
      "prefer-object-spread": "error",
      "prefer-promise-reject-errors": "error",
      "prefer-regex-literals": "error",
      "prefer-spread": "error",
      "prefer-template": "error",
      radix: "error",
      "require-await": "error",
      "require-unicode-regexp": "error",
      yoda: "error",
      "import/no-duplicates": "error",
      "import/order": [
        "error",
        {
          "newlines-between": "never",
          named: true,
          alphabetize: { order: "asc", caseInsensitive: true },
          pathGroups: [{ pattern: "@/**", group: "parent", position: "before" }],
        },
      ],
    },
    settings: {
      next: { rootDir: "frontend" },
    },
  },
  nextPlugin.flatConfig.recommended,
  ...tseslint.config({
    files: ["**/*.ts", "**/*.tsx"],
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-unnecessary-condition": ["error", { allowConstantLoopConditions: true }],
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          reportUsedIgnorePattern: true,
        },
      ],
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/require-array-sort-compare": ["error", { ignoreStringArrays: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/switch-exhaustiveness-check": ["error", { considerDefaultExhaustiveForUnions: true }],
      "@typescript-eslint/only-throw-error": "off", // to support `throw redirect`
    },
  }),
  ...tseslint.config({
    files: ["**/*.tsx"],
    extends: [reactPlugin.configs.flat.recommended],
    rules: {
      "@typescript-eslint/no-unnecessary-type-constraint": "off", // sometimes required in TSX lest it be parsed as a tag
      "react/iframe-missing-sandbox": "error",
      "react/jsx-no-leaked-render": "error",
      "react/jsx-boolean-value": "error",
      "react/jsx-curly-brace-presence": ["error", { props: "never", children: "never", propElementValues: "always" }],
      "react/jsx-fragments": "error",
      "react/jsx-no-constructed-context-values": "error",
      "react/jsx-no-script-url": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-unescaped-entities": "off",
      "react/no-unstable-nested-components": ["error", { allowAsProps: true }],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  }),
  ...tseslint.config({
    files: [
      ".puppeteerrc.cjs",
      "eslint.config.js",
      "frontend/next.config.ts",
      "frontend/drizzle.config.js",
      "playwright.config.ts",
      "docker/createCertificate.js",
    ],
    languageOptions: {
      globals: globals.node,
    },
    extends: [tseslint.configs.base, tseslint.configs.disableTypeChecked],
  }),
  ...tseslint.config({
    files: ["e2e/**/*.ts"],
    rules: {
      "no-console": "off",
      "no-debugger": "error",
      "no-empty-pattern": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='pause']",
          message: "page.pause() should not be committed to the codebase",
        },
      ],
    },
  }),
  prettierConfig,
  process.env.DISABLE_TYPE_CHECKED ? tseslint.configs.disableTypeChecked : {},
];
