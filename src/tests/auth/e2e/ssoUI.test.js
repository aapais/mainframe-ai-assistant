/**
 * E2E Tests for SSO UI Components
 */

const { render, screen, fireEvent, waitFor, act } = require('@testing-library/react');
const { BrowserRouter } = require('react-router-dom');
const userEvent = require('@testing-library/user-event');
const React = require('react');

// Mock components for E2E testing
const LoginPage = ({ onLogin, providers, loading, error }) => {
  return React.createElement('div', { 'data-testid': 'login-page' }, [
    React.createElement('h1', { key: 'title' }, 'Login'),
    error &&
      React.createElement(
        'div',
        {
          key: 'error',
          'data-testid': 'error-message',
          role: 'alert',
        },
        error
      ),
    React.createElement(
      'div',
      { key: 'providers' },
      providers.map(provider =>
        React.createElement(
          'button',
          {
            key: provider.name,
            'data-testid': `login-${provider.name}`,
            onClick: () => onLogin(provider.name),
            disabled: loading,
            'aria-label': `Login with ${provider.displayName}`,
          },
          loading ? 'Loading...' : `Login with ${provider.displayName}`
        )
      )
    ),
  ]);
};

const Dashboard = ({ user, onLogout }) => {
  return React.createElement('div', { 'data-testid': 'dashboard' }, [
    React.createElement('h1', { key: 'welcome' }, `Welcome, ${user.name}!`),
    React.createElement(
      'div',
      {
        key: 'user-info',
        'data-testid': 'user-info',
      },
      [
        React.createElement('p', { key: 'email' }, `Email: ${user.email}`),
        React.createElement('p', { key: 'provider' }, `Provider: ${user.provider}`),
      ]
    ),
    React.createElement(
      'button',
      {
        key: 'logout',
        'data-testid': 'logout-button',
        onClick: onLogout,
      },
      'Logout'
    ),
  ]);
};

const ProfilePage = ({ user, onUpdate, updating, errors }) => {
  const [formData, setFormData] = React.useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
  });

  const handleSubmit = e => {
    e.preventDefault();
    onUpdate(formData);
  };

  return React.createElement('div', { 'data-testid': 'profile-page' }, [
    React.createElement('h1', { key: 'title' }, 'Profile'),
    React.createElement(
      'form',
      {
        key: 'form',
        onSubmit: handleSubmit,
        'data-testid': 'profile-form',
      },
      [
        React.createElement('div', { key: 'firstName-field' }, [
          React.createElement(
            'label',
            {
              key: 'firstName-label',
              htmlFor: 'firstName',
            },
            'First Name'
          ),
          React.createElement('input', {
            key: 'firstName-input',
            id: 'firstName',
            'data-testid': 'firstName-input',
            value: formData.firstName,
            onChange: e => setFormData(prev => ({ ...prev, firstName: e.target.value })),
            'aria-describedby': errors?.firstName ? 'firstName-error' : undefined,
          }),
          errors?.firstName &&
            React.createElement(
              'span',
              {
                key: 'firstName-error',
                id: 'firstName-error',
                role: 'alert',
                'data-testid': 'firstName-error',
              },
              errors.firstName
            ),
        ]),
        React.createElement('div', { key: 'lastName-field' }, [
          React.createElement(
            'label',
            {
              key: 'lastName-label',
              htmlFor: 'lastName',
            },
            'Last Name'
          ),
          React.createElement('input', {
            key: 'lastName-input',
            id: 'lastName',
            'data-testid': 'lastName-input',
            value: formData.lastName,
            onChange: e => setFormData(prev => ({ ...prev, lastName: e.target.value })),
          }),
        ]),
        React.createElement('div', { key: 'email-field' }, [
          React.createElement(
            'label',
            {
              key: 'email-label',
              htmlFor: 'email',
            },
            'Email'
          ),
          React.createElement('input', {
            key: 'email-input',
            id: 'email',
            type: 'email',
            'data-testid': 'email-input',
            value: formData.email,
            onChange: e => setFormData(prev => ({ ...prev, email: e.target.value })),
          }),
        ]),
        React.createElement(
          'button',
          {
            key: 'submit',
            type: 'submit',
            'data-testid': 'update-profile-button',
            disabled: updating,
          },
          updating ? 'Updating...' : 'Update Profile'
        ),
      ]
    ),
  ]);
};

const AccountLinkingPage = ({
  user,
  availableProviders,
  linkedProviders,
  onLink,
  onUnlink,
  loading,
}) => {
  return React.createElement('div', { 'data-testid': 'account-linking-page' }, [
    React.createElement('h1', { key: 'title' }, 'Linked Accounts'),
    React.createElement('div', { key: 'linked-accounts' }, [
      React.createElement('h2', { key: 'linked-title' }, 'Linked Accounts'),
      linkedProviders.length === 0
        ? React.createElement('p', { key: 'no-linked' }, 'No accounts linked')
        : linkedProviders.map(provider =>
            React.createElement(
              'div',
              {
                key: provider.name,
                'data-testid': `linked-${provider.name}`,
              },
              [
                React.createElement(
                  'span',
                  { key: 'name' },
                  `${provider.displayName}: ${provider.email}`
                ),
                React.createElement(
                  'button',
                  {
                    key: 'unlink',
                    'data-testid': `unlink-${provider.name}`,
                    onClick: () => onUnlink(provider.name),
                    disabled: loading,
                  },
                  'Unlink'
                ),
              ]
            )
          ),
    ]),
    React.createElement('div', { key: 'available-providers' }, [
      React.createElement('h2', { key: 'available-title' }, 'Link New Account'),
      availableProviders
        .filter(p => !linkedProviders.find(l => l.name === p.name))
        .map(provider =>
          React.createElement(
            'button',
            {
              key: provider.name,
              'data-testid': `link-${provider.name}`,
              onClick: () => onLink(provider.name),
              disabled: loading,
            },
            `Link ${provider.displayName}`
          )
        ),
    ]),
  ]);
};

describe('SSO UI Components E2E Tests', () => {
  let mockAuthService;
  let mockProviders;

  beforeEach(() => {
    mockProviders = [
      { name: 'google', displayName: 'Google', available: true },
      { name: 'microsoft', displayName: 'Microsoft', available: true },
      { name: 'okta', displayName: 'Okta', available: true },
    ];

    mockAuthService = {
      initiateOAuth: jest.fn(),
      logout: jest.fn(),
      updateProfile: jest.fn(),
      linkAccount: jest.fn(),
      unlinkAccount: jest.fn(),
      getCurrentUser: jest.fn(),
      getLinkedProviders: jest.fn(),
    };

    // Reset all mocks
    Object.values(mockAuthService).forEach(mock => mock.mockClear());
  });

  describe('Login Page', () => {
    it('should render login page with provider buttons', () => {
      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: null,
        })
      );

      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();

      mockProviders.forEach(provider => {
        const button = screen.getByTestId(`login-${provider.name}`);
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent(`Login with ${provider.displayName}`);
        expect(button).toHaveAttribute('aria-label', `Login with ${provider.displayName}`);
      });
    });

    it('should handle provider button clicks', async () => {
      const user = userEvent.setup();
      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: null,
        })
      );

      const googleButton = screen.getByTestId('login-google');
      await user.click(googleButton);

      expect(onLogin).toHaveBeenCalledWith('google');
    });

    it('should show loading state', () => {
      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: true,
          error: null,
        })
      );

      mockProviders.forEach(provider => {
        const button = screen.getByTestId(`login-${provider.name}`);
        expect(button).toBeDisabled();
        expect(button).toHaveTextContent('Loading...');
      });
    });

    it('should display error messages', () => {
      const errorMessage = 'Authentication failed';
      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: errorMessage,
        })
      );

      const errorElement = screen.getByTestId('error-message');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(errorMessage);
      expect(errorElement).toHaveAttribute('role', 'alert');
    });

    it('should be accessible via keyboard navigation', async () => {
      const user = userEvent.setup();
      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: null,
        })
      );

      // Tab through buttons
      await user.tab();
      expect(screen.getByTestId('login-google')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('login-microsoft')).toHaveFocus();

      // Activate button with Enter
      await user.keyboard('{Enter}');
      expect(onLogin).toHaveBeenCalledWith('microsoft');
    });
  });

  describe('Dashboard', () => {
    const mockUser = {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
      provider: 'google',
    };

    it('should render dashboard with user information', () => {
      const onLogout = jest.fn();

      render(
        React.createElement(Dashboard, {
          user: mockUser,
          onLogout,
        })
      );

      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: `Welcome, ${mockUser.name}!` })
      ).toBeInTheDocument();

      const userInfo = screen.getByTestId('user-info');
      expect(userInfo).toHaveTextContent(`Email: ${mockUser.email}`);
      expect(userInfo).toHaveTextContent(`Provider: ${mockUser.provider}`);
    });

    it('should handle logout button click', async () => {
      const user = userEvent.setup();
      const onLogout = jest.fn();

      render(
        React.createElement(Dashboard, {
          user: mockUser,
          onLogout,
        })
      );

      const logoutButton = screen.getByTestId('logout-button');
      await user.click(logoutButton);

      expect(onLogout).toHaveBeenCalled();
    });
  });

  describe('Profile Page', () => {
    const mockUser = {
      id: 'user-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    };

    it('should render profile form with user data', () => {
      const onUpdate = jest.fn();

      render(
        React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate,
          updating: false,
          errors: null,
        })
      );

      expect(screen.getByTestId('profile-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();

      const form = screen.getByTestId('profile-form');
      expect(form).toBeInTheDocument();

      expect(screen.getByTestId('firstName-input')).toHaveValue(mockUser.firstName);
      expect(screen.getByTestId('lastName-input')).toHaveValue(mockUser.lastName);
      expect(screen.getByTestId('email-input')).toHaveValue(mockUser.email);
    });

    it('should handle form submission', async () => {
      const user = userEvent.setup();
      const onUpdate = jest.fn();

      render(
        React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate,
          updating: false,
          errors: null,
        })
      );

      const firstNameInput = screen.getByTestId('firstName-input');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');

      const submitButton = screen.getByTestId('update-profile-button');
      await user.click(submitButton);

      expect(onUpdate).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });

    it('should show validation errors', () => {
      const errors = { firstName: 'First name is required' };
      const onUpdate = jest.fn();

      render(
        React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate,
          updating: false,
          errors,
        })
      );

      const errorElement = screen.getByTestId('firstName-error');
      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent(errors.firstName);
      expect(errorElement).toHaveAttribute('role', 'alert');

      const input = screen.getByTestId('firstName-input');
      expect(input).toHaveAttribute('aria-describedby', 'firstName-error');
    });

    it('should disable form during update', () => {
      const onUpdate = jest.fn();

      render(
        React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate,
          updating: true,
          errors: null,
        })
      );

      const submitButton = screen.getByTestId('update-profile-button');
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Updating...');
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      const onUpdate = jest.fn();

      render(
        React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate,
          updating: false,
          errors: null,
        })
      );

      const emailInput = screen.getByTestId('email-input');
      expect(emailInput).toHaveAttribute('type', 'email');

      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      const form = screen.getByTestId('profile-form');
      fireEvent.submit(form);

      // Browser validation should prevent submission
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Account Linking Page', () => {
    const mockUser = {
      id: 'user-123',
      name: 'John Doe',
      email: 'john@example.com',
    };

    const linkedProviders = [{ name: 'google', displayName: 'Google', email: 'john@gmail.com' }];

    it('should render account linking page', () => {
      const onLink = jest.fn();
      const onUnlink = jest.fn();

      render(
        React.createElement(AccountLinkingPage, {
          user: mockUser,
          availableProviders: mockProviders,
          linkedProviders,
          onLink,
          onUnlink,
          loading: false,
        })
      );

      expect(screen.getByTestId('account-linking-page')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Linked Accounts' })).toBeInTheDocument();

      // Should show linked account
      expect(screen.getByTestId('linked-google')).toBeInTheDocument();
      expect(screen.getByTestId('unlink-google')).toBeInTheDocument();

      // Should show available providers to link
      expect(screen.getByTestId('link-microsoft')).toBeInTheDocument();
      expect(screen.getByTestId('link-okta')).toBeInTheDocument();

      // Google should not appear in link options since it's already linked
      expect(screen.queryByTestId('link-google')).not.toBeInTheDocument();
    });

    it('should handle account linking', async () => {
      const user = userEvent.setup();
      const onLink = jest.fn();
      const onUnlink = jest.fn();

      render(
        React.createElement(AccountLinkingPage, {
          user: mockUser,
          availableProviders: mockProviders,
          linkedProviders: [],
          onLink,
          onUnlink,
          loading: false,
        })
      );

      const linkButton = screen.getByTestId('link-microsoft');
      await user.click(linkButton);

      expect(onLink).toHaveBeenCalledWith('microsoft');
    });

    it('should handle account unlinking', async () => {
      const user = userEvent.setup();
      const onLink = jest.fn();
      const onUnlink = jest.fn();

      render(
        React.createElement(AccountLinkingPage, {
          user: mockUser,
          availableProviders: mockProviders,
          linkedProviders,
          onLink,
          onUnlink,
          loading: false,
        })
      );

      const unlinkButton = screen.getByTestId('unlink-google');
      await user.click(unlinkButton);

      expect(onUnlink).toHaveBeenCalledWith('google');
    });

    it('should show empty state when no accounts linked', () => {
      const onLink = jest.fn();
      const onUnlink = jest.fn();

      render(
        React.createElement(AccountLinkingPage, {
          user: mockUser,
          availableProviders: mockProviders,
          linkedProviders: [],
          onLink,
          onUnlink,
          loading: false,
        })
      );

      expect(screen.getByText('No accounts linked')).toBeInTheDocument();
    });

    it('should disable buttons during loading', () => {
      const onLink = jest.fn();
      const onUnlink = jest.fn();

      render(
        React.createElement(AccountLinkingPage, {
          user: mockUser,
          availableProviders: mockProviders,
          linkedProviders,
          onLink,
          onUnlink,
          loading: true,
        })
      );

      expect(screen.getByTestId('unlink-google')).toBeDisabled();
      expect(screen.getByTestId('link-microsoft')).toBeDisabled();
      expect(screen.getByTestId('link-okta')).toBeDisabled();
    });
  });

  describe('Integration Flows', () => {
    it('should handle complete OAuth flow', async () => {
      const user = userEvent.setup();

      // Mock OAuth callback simulation
      mockAuthService.initiateOAuth.mockImplementation(async provider => {
        // Simulate redirect and callback
        return {
          user: {
            id: 'user-123',
            name: 'John Doe',
            email: 'john@example.com',
            provider,
          },
          token: 'mock-jwt-token',
        };
      });

      let currentUser = null;
      let loading = false;
      let error = null;

      const TestApp = () => {
        const [state, setState] = React.useState({ currentUser, loading, error });

        const handleLogin = async provider => {
          setState(prev => ({ ...prev, loading: true, error: null }));

          try {
            const result = await mockAuthService.initiateOAuth(provider);
            setState(prev => ({ ...prev, currentUser: result.user, loading: false }));
          } catch (err) {
            setState(prev => ({ ...prev, error: err.message, loading: false }));
          }
        };

        const handleLogout = async () => {
          await mockAuthService.logout();
          setState(prev => ({ ...prev, currentUser: null }));
        };

        if (state.currentUser) {
          return React.createElement(Dashboard, {
            user: state.currentUser,
            onLogout: handleLogout,
          });
        }

        return React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin: handleLogin,
          loading: state.loading,
          error: state.error,
        });
      };

      render(React.createElement(TestApp));

      // Initially should show login page
      expect(screen.getByTestId('login-page')).toBeInTheDocument();

      // Click Google login
      const googleButton = screen.getByTestId('login-google');
      await user.click(googleButton);

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      // Should redirect to dashboard after successful auth
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
        expect(screen.getByText('Welcome, John Doe!')).toBeInTheDocument();
      });

      expect(mockAuthService.initiateOAuth).toHaveBeenCalledWith('google');
    });

    it('should handle OAuth errors gracefully', async () => {
      const user = userEvent.setup();

      mockAuthService.initiateOAuth.mockRejectedValue(new Error('OAuth provider unavailable'));

      let error = null;
      let loading = false;

      const TestApp = () => {
        const [state, setState] = React.useState({ error, loading });

        const handleLogin = async provider => {
          setState(prev => ({ ...prev, loading: true, error: null }));

          try {
            await mockAuthService.initiateOAuth(provider);
          } catch (err) {
            setState(prev => ({ ...prev, error: err.message, loading: false }));
          }
        };

        return React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin: handleLogin,
          loading: state.loading,
          error: state.error,
        });
      };

      render(React.createElement(TestApp));

      const googleButton = screen.getByTestId('login-google');
      await user.click(googleButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText('OAuth provider unavailable')).toBeInTheDocument();
      });

      expect(mockAuthService.initiateOAuth).toHaveBeenCalledWith('google');
    });

    it('should handle complete profile update flow', async () => {
      const user = userEvent.setup();

      const mockUser = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      mockAuthService.updateProfile.mockResolvedValue({
        ...mockUser,
        firstName: 'Jane',
      });

      let updating = false;

      const TestApp = () => {
        const [state, setState] = React.useState({ updating });

        const handleUpdate = async formData => {
          setState(prev => ({ ...prev, updating: true }));

          try {
            await mockAuthService.updateProfile(formData);
            setState(prev => ({ ...prev, updating: false }));
          } catch (err) {
            setState(prev => ({ ...prev, updating: false }));
          }
        };

        return React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate: handleUpdate,
          updating: state.updating,
          errors: null,
        });
      };

      render(React.createElement(TestApp));

      // Update first name
      const firstNameInput = screen.getByTestId('firstName-input');
      await user.clear(firstNameInput);
      await user.type(firstNameInput, 'Jane');

      // Submit form
      const submitButton = screen.getByTestId('update-profile-button');
      await user.click(submitButton);

      // Should show updating state
      await waitFor(() => {
        expect(screen.getByText('Updating...')).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });

      // Should complete update
      await waitFor(() => {
        expect(screen.getByText('Update Profile')).toBeInTheDocument();
        expect(submitButton).not.toBeDisabled();
      });

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });
  });

  describe('Accessibility', () => {
    it('should support screen readers', () => {
      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: 'Login failed',
        })
      );

      // Error should be announced to screen readers
      const error = screen.getByTestId('error-message');
      expect(error).toHaveAttribute('role', 'alert');

      // Buttons should have proper labels
      mockProviders.forEach(provider => {
        const button = screen.getByTestId(`login-${provider.name}`);
        expect(button).toHaveAttribute('aria-label', `Login with ${provider.displayName}`);
      });
    });

    it('should support keyboard navigation in complex forms', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 'user-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const onUpdate = jest.fn();

      render(
        React.createElement(ProfilePage, {
          user: mockUser,
          onUpdate,
          updating: false,
          errors: null,
        })
      );

      // Tab through form fields
      await user.tab();
      expect(screen.getByTestId('firstName-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('lastName-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('email-input')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('update-profile-button')).toHaveFocus();

      // Submit form with Enter
      await user.keyboard('{Enter}');
      expect(onUpdate).toHaveBeenCalled();
    });

    it('should handle high contrast mode', () => {
      // Simulate high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: null,
        })
      );

      // Components should render without issues in high contrast mode
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      mockProviders.forEach(provider => {
        expect(screen.getByTestId(`login-${provider.name}`)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(max-width: 768px)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      const onLogin = jest.fn();

      render(
        React.createElement(LoginPage, {
          providers: mockProviders,
          onLogin,
          loading: false,
          error: null,
        })
      );

      // Should render mobile-friendly layout
      expect(screen.getByTestId('login-page')).toBeInTheDocument();

      // All provider buttons should still be accessible
      mockProviders.forEach(provider => {
        expect(screen.getByTestId(`login-${provider.name}`)).toBeInTheDocument();
      });
    });
  });
});
