module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Deve ser o último para desativar regras conflitantes
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['react', 'react-hooks'],
  rules: {
    // React
    'react/react-in-jsx-scope': 'off', // Não necessário com React 17+
    'react/prop-types': 'off', // Desativado se usar TypeScript

    // Variáveis não usadas - avisar mas não dar erro
    'no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],

    // Console - permitir em desenvolvimento
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',

    // Debugger - permitir em desenvolvimento
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

    // Permitir funções antes da declaração
    'no-use-before-define': ['error', { functions: false }],

    // Permitir _ para parâmetros não usados
    'no-unused-vars': ['warn', {
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  globals: {
    React: 'readonly',
    ReactDOM: 'readonly',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    '*.min.js',
    'coverage/',
  ],
};