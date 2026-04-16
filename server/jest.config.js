/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { isolatedModules: true }],
  },
  testTimeout: 20000,
  clearMocks: true,
  setupFiles: ["<rootDir>/src/__tests__/setupEnv.ts"],
};
