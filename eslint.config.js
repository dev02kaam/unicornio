const js = require('@eslint/js');
const security = require('eslint-plugin-security');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**', 'artifacts/**'] },
  {
    files: ['server/**/*.js', 'scripts/**/*.js', 'test/**/*.js', 'e2e/**/*.js', 'eslint.config.js', 'playwright.config.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      'no-console': 'off',
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['public/js/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: { ...globals.browser },
    },
    rules: {
      'no-console': 'off',
      // Los scripts clasicos comparten funciones globales entre etiquetas <script>.
      'no-unused-vars': 'off',
    },
  },
];
