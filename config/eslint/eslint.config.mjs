// ESLint v9+ Flat Configuration
// Modern flat config format for future-proof linting

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import security from 'eslint-plugin-security';
import electron from 'eslint-plugin-electron';
import prettier from 'eslint-config-prettier';

export default [
  // Base configuration for all files
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'build/**',
      'coverage/**',
      '*.min.js',
      'public/**',
      '.cache/**',
      'temp/**',
      'tmp/**',
      '*.d.ts'
    ]
  },
  
  // JavaScript/TypeScript base configuration
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: ['./tsconfig.json', './tsconfig.*.json'],
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      'import': importPlugin,
      'security': security
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      ...typescript.configs['recommended-requiring-type-checking'].rules,
      ...typescript.configs.strict.rules,
      ...security.configs.recommended.rules,
      
      // TypeScript Rules
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // Import/Export Rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index'
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc'
          }
        }
      ],
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',
      'import/no-unused-modules': 'warn',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      
      // Security Rules
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-require': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-eval-with-expression': 'error',
      
      // General Rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error'
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./tsconfig.json', './tsconfig.*.json']
        },
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx']
        }
      }
    }
  },
  
  // React/JSX configuration
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      
      // React Rules
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/jsx-uses-vars': 'error',
      'react/no-unescaped-entities': 'warn',
      'react/display-name': 'off',
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/jsx-no-script-url': 'error',
      'react/no-danger': 'warn',
      'react/no-deprecated': 'error',
      
      // React Hooks Rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // Accessibility Rules
      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-has-content': 'error',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn'
    }
  },
  
  // Electron Main Process configuration
  {
    files: ['src/main/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...js.environments.node.globals,
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly'
      }
    },
    plugins: {
      electron
    },
    rules: {
      ...electron.configs.recommended.rules,
      'electron/no-remote': 'error',
      'electron/no-unsafe-eval': 'error',
      'security/detect-child-process': 'error',
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  
  // Electron Renderer Process configuration
  {
    files: ['src/renderer/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...js.environments.browser.globals,
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly'
      }
    },
    plugins: {
      electron
    },
    rules: {
      'electron/no-node-integration': 'error',
      'security/detect-non-literal-fs-filename': 'off',
      'no-console': 'warn'
    }
  },
  
  // Electron Preload Scripts configuration
  {
    files: ['src/preload/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        ...js.environments.node.globals,
        ...js.environments.browser.globals
      }
    },
    plugins: {
      electron
    },
    rules: {
      'electron/isolated-context': 'error',
      'electron/no-node-integration': 'error'
    }
  },
  
  // Test files configuration
  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...js.environments.jest.globals,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'security/detect-object-injection': 'off'
    }
  },
  
  // Plain JavaScript files
  {
    files: ['*.js', '*.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  
  // Configuration files
  {
    files: [
      'vite.config.*',
      'vitest.config.*',
      'jest.config.*',
      'webpack.config.*',
      'rollup.config.*',
      'tailwind.config.*',
      'postcss.config.*'
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  
  // Apply Prettier config last to override formatting rules
  prettier
];