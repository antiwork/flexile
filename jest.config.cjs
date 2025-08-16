// jest.config.js
const nextJest = require("next/jest");

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({
  dir: "./frontend",
});

// Any custom config you want to pass to Jest
const customJestConfig = {
  // Load polyfills before any modules are imported
  setupFiles: ["<rootDir>/jest.polyfills.js"],
  // Add more setup options before each test is run
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

  // Test environment for React components
  testEnvironment: "jest-environment-jsdom",

  // Handle TypeScript and module paths
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],

  // Path mapping to match tsconfig

  // Test patterns
  testMatch: ["<rootDir>/frontend/**/*.{spec,test}.{js,jsx,ts,tsx}"],

  // Ignore node_modules
  transformIgnorePatterns: ["/node_modules/(?!.*\\.mjs$)"],

  // Coverage configuration
  collectCoverageFrom: [
    "frontend/**/*.{js,jsx,ts,tsx}",
    "!frontend/**/*.d.ts",
    "!frontend/**/_*.{js,jsx,ts,tsx}",
    "!frontend/**/*.stories.{js,jsx,ts,tsx}",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ["json", "lcov", "text", "clover"],

  // Mock service worker setup
  globals: {
    "ts-jest": {
      tsconfig: "<rootDir>/frontend/tsconfig.json",
    },
    // Flag to identify test environment for MSW
    __MSW_TEST__: true,
  },

  // Important for Next.js absolute imports and Module Path Aliases
  moduleDirectories: ["node_modules", "<rootDir>/"],

  // Handle CSS and other assets
  moduleNameMapper: {
    "^.+\\.module\\.(css|sass|scss)$": "identity-obj-proxy",
    "^.+\\.(css|sass|scss)$": "<rootDir>/__mocks__/styleMock.js",
    "^.+\\.(jpg|jpeg|png|gif|webp|avif|svg)$": "<rootDir>/__mocks__/fileMock.js",
    "^@/(.*)$": "<rootDir>/frontend/$1",
    "^@test/(.*)$": "<rootDir>/e2e/$1",
  },

  // Resolve absolute imports
  roots: ["<rootDir>"],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
