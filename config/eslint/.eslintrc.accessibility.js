module.exports = {
  extends: [
    'plugin:jsx-a11y/recommended'
  ],
  plugins: ['jsx-a11y'],
  rules: {
    // Core WCAG AA Requirements
    'jsx-a11y/alt-text': 'error',
    'jsx-a11y/anchor-has-content': 'error',
    'jsx-a11y/anchor-is-valid': 'error',
    'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
    'jsx-a11y/aria-props': 'error',
    'jsx-a11y/aria-proptypes': 'error',
    'jsx-a11y/aria-role': 'error',
    'jsx-a11y/aria-unsupported-elements': 'error',

    // Form Accessibility
    'jsx-a11y/label-has-associated-control': 'error',
    'jsx-a11y/form-has-label': 'error',
    'jsx-a11y/autocomplete-valid': 'error',

    // Interactive Elements
    'jsx-a11y/click-events-have-key-events': 'error',
    'jsx-a11y/interactive-supports-focus': 'error',
    'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
    'jsx-a11y/no-noninteractive-element-interactions': 'error',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
    'jsx-a11y/no-noninteractive-tabindex': 'error',

    // Focus and Navigation
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/tabindex-no-positive': 'error',
    'jsx-a11y/no-redundant-roles': 'error',

    // Content and Structure
    'jsx-a11y/heading-has-content': 'error',
    'jsx-a11y/html-has-lang': 'error',
    'jsx-a11y/img-redundant-alt': 'error',
    'jsx-a11y/lang': 'error',
    'jsx-a11y/no-access-key': 'warn',

    // ARIA and Role Management
    'jsx-a11y/role-has-required-aria-props': 'error',
    'jsx-a11y/role-supports-aria-props': 'error',
    'jsx-a11y/scope': 'error',

    // Media and Content
    'jsx-a11y/media-has-caption': 'warn',
    'jsx-a11y/mouse-events-have-key-events': 'error',

    // Specific to our components
    'jsx-a11y/no-static-element-interactions': ['error', {
      handlers: [
        'onClick',
        'onMouseDown',
        'onMouseUp',
        'onKeyPress',
        'onKeyDown',
        'onKeyUp'
      ]
    }]
  },

  // Override for specific file patterns
  overrides: [
    {
      files: ['**/*.test.tsx', '**/*.spec.tsx'],
      rules: {
        // Relax some rules for test files
        'jsx-a11y/no-autofocus': 'off',
        'jsx-a11y/no-static-element-interactions': 'off'
      }
    },
    {
      files: ['**/*.stories.tsx'],
      rules: {
        // Relax some rules for Storybook stories
        'jsx-a11y/no-autofocus': 'off'
      }
    }
  ]
};