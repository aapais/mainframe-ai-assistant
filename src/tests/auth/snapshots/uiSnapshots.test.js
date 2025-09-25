/**
 * Snapshot Tests for SSO UI Components
 */

const { render } = require('@testing-library/react');
const React = require('react');
const { UserFactory } = require('../factories/userFactory');

// Mock components for snapshot testing
const LoginButton = ({ provider, onClick, loading, disabled }) => {
  return React.createElement(
    'button',
    {
      className: `login-button login-button--${provider.name} ${loading ? 'loading' : ''} ${disabled ? 'disabled' : ''}`,
      onClick,
      disabled: disabled || loading,
      'data-provider': provider.name,
    },
    [
      React.createElement('img', {
        key: 'icon',
        src: `/icons/${provider.name}.svg`,
        alt: '',
        className: 'provider-icon',
      }),
      React.createElement(
        'span',
        {
          key: 'text',
          className: 'button-text',
        },
        loading ? 'Signing in...' : `Continue with ${provider.displayName}`
      ),
    ]
  );
};

const UserProfile = ({ user, compact = false }) => {
  return React.createElement(
    'div',
    {
      className: `user-profile ${compact ? 'user-profile--compact' : ''}`,
    },
    [
      React.createElement(
        'div',
        {
          key: 'avatar',
          className: 'user-avatar',
        },
        user.avatar
          ? React.createElement('img', {
              src: user.avatar,
              alt: `${user.firstName} ${user.lastName}`,
              className: 'avatar-image',
            })
          : React.createElement(
              'div',
              {
                className: 'avatar-placeholder',
              },
              user.firstName?.[0] || '?'
            )
      ),
      React.createElement(
        'div',
        {
          key: 'info',
          className: 'user-info',
        },
        [
          React.createElement(
            'h3',
            {
              key: 'name',
              className: 'user-name',
            },
            `${user.firstName} ${user.lastName}`
          ),
          React.createElement(
            'p',
            {
              key: 'email',
              className: 'user-email',
            },
            user.email
          ),
          !compact &&
            React.createElement(
              'div',
              {
                key: 'provider',
                className: 'user-provider',
              },
              [
                React.createElement('img', {
                  key: 'provider-icon',
                  src: `/icons/${user.provider}.svg`,
                  alt: '',
                  className: 'provider-icon-small',
                }),
                React.createElement(
                  'span',
                  {
                    key: 'provider-text',
                  },
                  `Connected via ${user.provider}`
                ),
              ]
            ),
        ]
      ),
    ]
  );
};

const AuthenticationStatus = ({ isAuthenticated, user, lastLogin, sessionExpiry }) => {
  return React.createElement(
    'div',
    {
      className: `auth-status ${isAuthenticated ? 'authenticated' : 'unauthenticated'}`,
    },
    [
      React.createElement(
        'div',
        {
          key: 'status-indicator',
          className: 'status-indicator',
        },
        [
          React.createElement('div', {
            key: 'dot',
            className: `status-dot ${isAuthenticated ? 'online' : 'offline'}`,
          }),
          React.createElement(
            'span',
            {
              key: 'text',
              className: 'status-text',
            },
            isAuthenticated ? 'Authenticated' : 'Not Authenticated'
          ),
        ]
      ),
      isAuthenticated &&
        user &&
        React.createElement(
          'div',
          {
            key: 'user-details',
            className: 'user-details',
          },
          [
            React.createElement(UserProfile, {
              key: 'profile',
              user,
              compact: true,
            }),
            React.createElement(
              'div',
              {
                key: 'session-info',
                className: 'session-info',
              },
              [
                lastLogin &&
                  React.createElement(
                    'p',
                    {
                      key: 'last-login',
                      className: 'last-login',
                    },
                    `Last login: ${new Date(lastLogin).toLocaleDateString()}`
                  ),
                sessionExpiry &&
                  React.createElement(
                    'p',
                    {
                      key: 'expires',
                      className: 'session-expiry',
                    },
                    `Session expires: ${new Date(sessionExpiry).toLocaleString()}`
                  ),
              ]
            ),
          ]
        ),
    ]
  );
};

const ProviderList = ({ providers, onSelect, selectedProvider, showStatus = true }) => {
  return React.createElement(
    'div',
    {
      className: 'provider-list',
    },
    [
      React.createElement(
        'h2',
        {
          key: 'title',
          className: 'provider-list-title',
        },
        'Available Providers'
      ),
      React.createElement(
        'div',
        {
          key: 'providers',
          className: 'providers-grid',
        },
        providers.map(provider =>
          React.createElement(
            'div',
            {
              key: provider.name,
              className: `provider-card ${selectedProvider === provider.name ? 'selected' : ''} ${provider.available ? 'available' : 'unavailable'}`,
            },
            [
              React.createElement('img', {
                key: 'logo',
                src: `/logos/${provider.name}-logo.png`,
                alt: provider.displayName,
                className: 'provider-logo',
              }),
              React.createElement(
                'h3',
                {
                  key: 'name',
                  className: 'provider-name',
                },
                provider.displayName
              ),
              provider.description &&
                React.createElement(
                  'p',
                  {
                    key: 'description',
                    className: 'provider-description',
                  },
                  provider.description
                ),
              showStatus &&
                React.createElement(
                  'div',
                  {
                    key: 'status',
                    className: 'provider-status',
                  },
                  [
                    React.createElement(
                      'span',
                      {
                        key: 'status-text',
                        className: `status-badge ${provider.available ? 'available' : 'unavailable'}`,
                      },
                      provider.available ? 'Available' : 'Unavailable'
                    ),
                    provider.maintenanceMode &&
                      React.createElement(
                        'span',
                        {
                          key: 'maintenance',
                          className: 'maintenance-badge',
                        },
                        'Maintenance'
                      ),
                  ]
                ),
              React.createElement(
                'button',
                {
                  key: 'select',
                  className: 'provider-select-btn',
                  onClick: () => onSelect(provider.name),
                  disabled: !provider.available,
                },
                selectedProvider === provider.name ? 'Selected' : 'Select'
              ),
            ]
          )
        )
      ),
    ]
  );
};

const SecuritySettings = ({ user, securityOptions, onUpdate }) => {
  return React.createElement(
    'div',
    {
      className: 'security-settings',
    },
    [
      React.createElement(
        'h2',
        {
          key: 'title',
          className: 'settings-title',
        },
        'Security Settings'
      ),
      React.createElement(
        'div',
        {
          key: 'two-factor',
          className: 'setting-group',
        },
        [
          React.createElement(
            'h3',
            {
              key: 'title',
              className: 'setting-title',
            },
            'Two-Factor Authentication'
          ),
          React.createElement(
            'div',
            {
              key: 'content',
              className: 'setting-content',
            },
            [
              React.createElement(
                'p',
                {
                  key: 'description',
                  className: 'setting-description',
                },
                'Add an extra layer of security to your account'
              ),
              React.createElement(
                'div',
                {
                  key: 'toggle',
                  className: 'setting-toggle',
                },
                [
                  React.createElement('input', {
                    key: 'checkbox',
                    type: 'checkbox',
                    id: 'two-factor',
                    checked: securityOptions.twoFactorEnabled,
                    onChange: e => onUpdate({ twoFactorEnabled: e.target.checked }),
                    className: 'toggle-input',
                  }),
                  React.createElement(
                    'label',
                    {
                      key: 'label',
                      htmlFor: 'two-factor',
                      className: 'toggle-label',
                    },
                    securityOptions.twoFactorEnabled ? 'Enabled' : 'Disabled'
                  ),
                ]
              ),
            ]
          ),
        ]
      ),
      React.createElement(
        'div',
        {
          key: 'session-timeout',
          className: 'setting-group',
        },
        [
          React.createElement(
            'h3',
            {
              key: 'title',
              className: 'setting-title',
            },
            'Session Timeout'
          ),
          React.createElement(
            'div',
            {
              key: 'content',
              className: 'setting-content',
            },
            [
              React.createElement(
                'p',
                {
                  key: 'description',
                  className: 'setting-description',
                },
                'Automatically sign out after a period of inactivity'
              ),
              React.createElement(
                'select',
                {
                  key: 'select',
                  value: securityOptions.sessionTimeout,
                  onChange: e => onUpdate({ sessionTimeout: parseInt(e.target.value) }),
                  className: 'timeout-select',
                },
                [
                  React.createElement('option', { key: '15', value: 15 }, '15 minutes'),
                  React.createElement('option', { key: '30', value: 30 }, '30 minutes'),
                  React.createElement('option', { key: '60', value: 60 }, '1 hour'),
                  React.createElement('option', { key: '240', value: 240 }, '4 hours'),
                  React.createElement('option', { key: '480', value: 480 }, '8 hours'),
                ]
              ),
            ]
          ),
        ]
      ),
      React.createElement(
        'div',
        {
          key: 'active-sessions',
          className: 'setting-group',
        },
        [
          React.createElement(
            'h3',
            {
              key: 'title',
              className: 'setting-title',
            },
            'Active Sessions'
          ),
          React.createElement(
            'div',
            {
              key: 'content',
              className: 'setting-content',
            },
            [
              React.createElement(
                'p',
                {
                  key: 'description',
                  className: 'setting-description',
                },
                'Manage your active sessions across different devices'
              ),
              React.createElement(
                'div',
                {
                  key: 'sessions',
                  className: 'sessions-list',
                },
                securityOptions.activeSessions?.map((session, index) =>
                  React.createElement(
                    'div',
                    {
                      key: session.id || index,
                      className: 'session-item',
                    },
                    [
                      React.createElement(
                        'div',
                        {
                          key: 'info',
                          className: 'session-info',
                        },
                        [
                          React.createElement(
                            'p',
                            {
                              key: 'device',
                              className: 'session-device',
                            },
                            session.device
                          ),
                          React.createElement(
                            'p',
                            {
                              key: 'location',
                              className: 'session-location',
                            },
                            session.location
                          ),
                          React.createElement(
                            'p',
                            {
                              key: 'last-active',
                              className: 'session-last-active',
                            },
                            `Last active: ${new Date(session.lastActive).toLocaleString()}`
                          ),
                        ]
                      ),
                      React.createElement(
                        'button',
                        {
                          key: 'revoke',
                          className: 'revoke-session-btn',
                          onClick: () => onUpdate({ revokeSession: session.id }),
                          disabled: session.current,
                        },
                        session.current ? 'Current Session' : 'Revoke'
                      ),
                    ]
                  )
                ) || []
              ),
            ]
          ),
        ]
      ),
    ]
  );
};

describe('SSO UI Snapshot Tests', () => {
  describe('Login Components', () => {
    it('should match snapshot for Google login button', () => {
      const provider = { name: 'google', displayName: 'Google' };
      const { container } = render(
        React.createElement(LoginButton, {
          provider,
          onClick: jest.fn(),
          loading: false,
          disabled: false,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for loading login button', () => {
      const provider = { name: 'microsoft', displayName: 'Microsoft' };
      const { container } = render(
        React.createElement(LoginButton, {
          provider,
          onClick: jest.fn(),
          loading: true,
          disabled: false,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for disabled login button', () => {
      const provider = { name: 'okta', displayName: 'Okta' };
      const { container } = render(
        React.createElement(LoginButton, {
          provider,
          onClick: jest.fn(),
          loading: false,
          disabled: true,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for provider list', () => {
      const providers = [
        {
          name: 'google',
          displayName: 'Google',
          description: 'Sign in with your Google account',
          available: true,
        },
        {
          name: 'microsoft',
          displayName: 'Microsoft',
          description: 'Sign in with your Microsoft account',
          available: true,
        },
        {
          name: 'okta',
          displayName: 'Okta',
          description: 'Enterprise SSO via Okta',
          available: false,
          maintenanceMode: true,
        },
      ];

      const { container } = render(
        React.createElement(ProviderList, {
          providers,
          onSelect: jest.fn(),
          selectedProvider: 'google',
          showStatus: true,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('User Profile Components', () => {
    it('should match snapshot for full user profile', () => {
      const user = UserFactory.createOAuthUser('google', {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        avatar: 'https://example.com/avatar.jpg',
      });

      const { container } = render(
        React.createElement(UserProfile, {
          user,
          compact: false,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for compact user profile', () => {
      const user = UserFactory.createOAuthUser('microsoft', {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
        avatar: null,
      });

      const { container } = render(
        React.createElement(UserProfile, {
          user,
          compact: true,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for user with placeholder avatar', () => {
      const user = UserFactory.create({
        firstName: 'Bob',
        lastName: 'Wilson',
        email: 'bob@example.com',
        avatar: null,
        provider: 'local',
      });

      const { container } = render(
        React.createElement(UserProfile, {
          user,
          compact: false,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Authentication Status Components', () => {
    it('should match snapshot for authenticated status', () => {
      const user = UserFactory.createOAuthUser('google');
      const lastLogin = new Date('2023-12-01T10:00:00Z');
      const sessionExpiry = new Date('2023-12-01T18:00:00Z');

      const { container } = render(
        React.createElement(AuthenticationStatus, {
          isAuthenticated: true,
          user,
          lastLogin,
          sessionExpiry,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for unauthenticated status', () => {
      const { container } = render(
        React.createElement(AuthenticationStatus, {
          isAuthenticated: false,
          user: null,
          lastLogin: null,
          sessionExpiry: null,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for authenticated without session info', () => {
      const user = UserFactory.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
      });

      const { container } = render(
        React.createElement(AuthenticationStatus, {
          isAuthenticated: true,
          user,
          lastLogin: null,
          sessionExpiry: null,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Security Settings Components', () => {
    it('should match snapshot for security settings with 2FA enabled', () => {
      const user = UserFactory.createAdmin();
      const securityOptions = {
        twoFactorEnabled: true,
        sessionTimeout: 60,
        activeSessions: [
          {
            id: 'session-1',
            device: 'Chrome on Windows 10',
            location: 'New York, NY',
            lastActive: new Date('2023-12-01T10:00:00Z'),
            current: true,
          },
          {
            id: 'session-2',
            device: 'Safari on iPhone',
            location: 'San Francisco, CA',
            lastActive: new Date('2023-11-30T15:30:00Z'),
            current: false,
          },
        ],
      };

      const { container } = render(
        React.createElement(SecuritySettings, {
          user,
          securityOptions,
          onUpdate: jest.fn(),
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for security settings with 2FA disabled', () => {
      const user = UserFactory.create();
      const securityOptions = {
        twoFactorEnabled: false,
        sessionTimeout: 30,
        activeSessions: [
          {
            id: 'session-1',
            device: 'Chrome on macOS',
            location: 'Austin, TX',
            lastActive: new Date('2023-12-01T12:00:00Z'),
            current: true,
          },
        ],
      };

      const { container } = render(
        React.createElement(SecuritySettings, {
          user,
          securityOptions,
          onUpdate: jest.fn(),
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for security settings with no active sessions', () => {
      const user = UserFactory.create();
      const securityOptions = {
        twoFactorEnabled: false,
        sessionTimeout: 240,
        activeSessions: [],
      };

      const { container } = render(
        React.createElement(SecuritySettings, {
          user,
          securityOptions,
          onUpdate: jest.fn(),
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Error States', () => {
    it('should match snapshot for OAuth error message', () => {
      const ErrorMessage = ({ error, onRetry, onCancel }) => {
        return React.createElement(
          'div',
          {
            className: 'error-message oauth-error',
          },
          [
            React.createElement(
              'div',
              {
                key: 'icon',
                className: 'error-icon',
              },
              '⚠️'
            ),
            React.createElement(
              'h3',
              {
                key: 'title',
                className: 'error-title',
              },
              'Authentication Failed'
            ),
            React.createElement(
              'p',
              {
                key: 'message',
                className: 'error-description',
              },
              error.message || 'An unexpected error occurred during authentication.'
            ),
            React.createElement(
              'div',
              {
                key: 'actions',
                className: 'error-actions',
              },
              [
                React.createElement(
                  'button',
                  {
                    key: 'retry',
                    className: 'btn-primary',
                    onClick: onRetry,
                  },
                  'Try Again'
                ),
                React.createElement(
                  'button',
                  {
                    key: 'cancel',
                    className: 'btn-secondary',
                    onClick: onCancel,
                  },
                  'Cancel'
                ),
              ]
            ),
          ]
        );
      };

      const error = new Error('Provider service unavailable');

      const { container } = render(
        React.createElement(ErrorMessage, {
          error,
          onRetry: jest.fn(),
          onCancel: jest.fn(),
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for network error state', () => {
      const NetworkError = ({ onRetry }) => {
        return React.createElement(
          'div',
          {
            className: 'error-message network-error',
          },
          [
            React.createElement(
              'div',
              {
                key: 'icon',
                className: 'error-icon',
              },
              '🌐'
            ),
            React.createElement(
              'h3',
              {
                key: 'title',
                className: 'error-title',
              },
              'Connection Problem'
            ),
            React.createElement(
              'p',
              {
                key: 'message',
                className: 'error-description',
              },
              'Please check your internet connection and try again.'
            ),
            React.createElement(
              'button',
              {
                key: 'retry',
                className: 'btn-primary',
                onClick: onRetry,
              },
              'Retry Connection'
            ),
          ]
        );
      };

      const { container } = render(
        React.createElement(NetworkError, {
          onRetry: jest.fn(),
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Loading States', () => {
    it('should match snapshot for login loading state', () => {
      const LoadingSpinner = ({ message = 'Loading...' }) => {
        return React.createElement(
          'div',
          {
            className: 'loading-container',
          },
          [
            React.createElement('div', {
              key: 'spinner',
              className: 'loading-spinner',
            }),
            React.createElement(
              'p',
              {
                key: 'message',
                className: 'loading-message',
              },
              message
            ),
          ]
        );
      };

      const { container } = render(
        React.createElement(LoadingSpinner, {
          message: 'Authenticating with provider...',
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for profile update loading state', () => {
      const LoadingOverlay = ({ message, transparent = false }) => {
        return React.createElement(
          'div',
          {
            className: `loading-overlay ${transparent ? 'transparent' : ''}`,
          },
          [
            React.createElement(
              'div',
              {
                key: 'content',
                className: 'loading-content',
              },
              [
                React.createElement('div', {
                  key: 'spinner',
                  className: 'loading-spinner large',
                }),
                React.createElement(
                  'p',
                  {
                    key: 'message',
                    className: 'loading-message',
                  },
                  message
                ),
              ]
            ),
          ]
        );
      };

      const { container } = render(
        React.createElement(LoadingOverlay, {
          message: 'Updating profile...',
          transparent: true,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Responsive Variations', () => {
    it('should match snapshot for mobile provider list', () => {
      const providers = [
        { name: 'google', displayName: 'Google', available: true },
        { name: 'microsoft', displayName: 'Microsoft', available: true },
      ];

      const MobileProviderList = ({ providers, onSelect }) => {
        return React.createElement(
          'div',
          {
            className: 'provider-list mobile',
          },
          providers.map(provider =>
            React.createElement(
              'button',
              {
                key: provider.name,
                className: 'mobile-provider-btn',
                onClick: () => onSelect(provider.name),
              },
              [
                React.createElement('img', {
                  key: 'icon',
                  src: `/icons/${provider.name}.svg`,
                  alt: '',
                  className: 'mobile-provider-icon',
                }),
                React.createElement(
                  'span',
                  {
                    key: 'text',
                  },
                  provider.displayName
                ),
              ]
            )
          )
        );
      };

      const { container } = render(
        React.createElement(MobileProviderList, {
          providers,
          onSelect: jest.fn(),
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for tablet layout', () => {
      const user = UserFactory.createOAuthUser('google');

      const TabletDashboard = ({ user }) => {
        return React.createElement(
          'div',
          {
            className: 'dashboard tablet-layout',
          },
          [
            React.createElement(
              'aside',
              {
                key: 'sidebar',
                className: 'dashboard-sidebar',
              },
              [
                React.createElement(UserProfile, {
                  key: 'profile',
                  user,
                  compact: true,
                }),
                React.createElement(
                  'nav',
                  {
                    key: 'nav',
                    className: 'dashboard-nav',
                  },
                  [
                    React.createElement(
                      'a',
                      {
                        key: 'profile-link',
                        href: '#profile',
                        className: 'nav-link',
                      },
                      'Profile'
                    ),
                    React.createElement(
                      'a',
                      {
                        key: 'security-link',
                        href: '#security',
                        className: 'nav-link',
                      },
                      'Security'
                    ),
                    React.createElement(
                      'a',
                      {
                        key: 'linked-accounts-link',
                        href: '#linked-accounts',
                        className: 'nav-link',
                      },
                      'Linked Accounts'
                    ),
                  ]
                ),
              ]
            ),
            React.createElement(
              'main',
              {
                key: 'content',
                className: 'dashboard-content',
              },
              [
                React.createElement(
                  'h1',
                  {
                    key: 'welcome',
                    className: 'dashboard-title',
                  },
                  `Welcome back, ${user.firstName}!`
                ),
                React.createElement(
                  'div',
                  {
                    key: 'stats',
                    className: 'dashboard-stats',
                  },
                  [
                    React.createElement(
                      'div',
                      {
                        key: 'last-login',
                        className: 'stat-card',
                      },
                      [
                        React.createElement(
                          'h3',
                          {
                            key: 'title',
                          },
                          'Last Login'
                        ),
                        React.createElement(
                          'p',
                          {
                            key: 'value',
                          },
                          new Date(user.lastLogin).toLocaleDateString()
                        ),
                      ]
                    ),
                  ]
                ),
              ]
            ),
          ]
        );
      };

      const { container } = render(
        React.createElement(TabletDashboard, {
          user,
        })
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });

  describe('Dark Mode Variations', () => {
    it('should match snapshot for dark mode login buttons', () => {
      const DarkModeWrapper = ({ children }) => {
        return React.createElement(
          'div',
          {
            className: 'dark-mode',
          },
          children
        );
      };

      const provider = { name: 'google', displayName: 'Google' };

      const { container } = render(
        React.createElement(
          DarkModeWrapper,
          null,
          React.createElement(LoginButton, {
            provider,
            onClick: jest.fn(),
            loading: false,
            disabled: false,
          })
        )
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it('should match snapshot for dark mode user profile', () => {
      const user = UserFactory.createOAuthUser('microsoft');

      const { container } = render(
        React.createElement(
          'div',
          { className: 'dark-mode' },
          React.createElement(UserProfile, {
            user,
            compact: false,
          })
        )
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
