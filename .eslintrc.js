module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    mocha: true,
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 'latest',
    parser: 'babel-eslint',
    // ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    indent: 'off',
    'space-before-function-paren': 'off',
    quotes: ['error', 'single', { avoidEscape: true }],
    'n/no-path-concat': 'off',
    'comma-dangle': ['off', 'always-multiline'],
    // we want to force semicolons
    semi: ['off', 'never'],
    // we use 2 spaces to indent our code
    indent: ['error', 2],
    // we want to avoid extraneous spaces
    'no-multi-spaces': ['error'],
    'max-len': ['error', { code: 150 }],
  },
};
