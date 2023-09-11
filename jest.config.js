export default {
  modulePathIgnorePatterns: ['<rootDir>/dist', '<rootDir>/__tests__/dist'],
  testMatch: ['<rootDir>/__tests__/**/*.test.[jt]s?(x)'],
  moduleNameMapper: {
    '^(\\..*)\\.jsx?$': '$1', // support for ts imports with .js extensions
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};
