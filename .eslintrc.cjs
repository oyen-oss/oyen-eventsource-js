module.exports = {
  root: true,
  extends: ['@block65/eslint-config', '@block65/eslint-config/typescript'],
  parserOptions: {
    project: ['./tsconfig.json', './test/tsconfig.json'],
  },
};
