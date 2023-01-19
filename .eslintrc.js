module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    quotes: ['error', 'single'],
    // we want to force semicolons
    semi: ['error', 'never'],
    // we use 2 spaces to indent our code
    indent: ['error', 2],
    // we want to avoid extraneous spaces
    'no-multi-spaces': ['error'],
    'max-len': ['error', { code: 100 }],
  },
}
