// @ts-check
import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'test/**/*.ts'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
]
