/**
 * Unit Tests for SSO Service
 */

const { SSOService } = require('../../../services/auth/SSOService');
const { MockGoogleProvider, MockMicrosoftProvider, MockOktaProvider } = require('../mocks/ssoProviders.mock');
const { UserFactory } = require('../factories/userFactory');

describe('SSOService Unit Tests', () => {
  let ssoService;
  let mockUserRepository;
  let mockSessionRepository;

  beforeEach(() => {
    mockUserRepository = {
      findByEmail: jest.fn(),
      findByProviderId: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockSessionRepository = {
      create: jest.fn(),
      findByToken: jest.fn(),
      delete: jest.fn(),
      deleteByUserId: jest.fn()
    };

    ssoService = new SSOService({
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository
    });
  });

  describe('Provider Registration', () => {
    it('should register OAuth providers successfully', () => {
      const googleProvider = new MockGoogleProvider();

      ssoService.registerProvider('google', googleProvider);

      expect(ssoService.providers.get('google')).toBe(googleProvider);
    });

    it('should throw error when registering duplicate provider', () => {
      const googleProvider = new MockGoogleProvider();

      ssoService.registerProvider('google', googleProvider);

      expect(() => {
        ssoService.registerProvider('google', googleProvider);
      }).toThrow('Provider google is already registered');
    });

    it('should list all registered providers', () => {
      ssoService.registerProvider('google', new MockGoogleProvider());
      ssoService.registerProvider('microsoft', new MockMicrosoftProvider());

      const providers = ssoService.getRegisteredProviders();

      expect(providers).toEqual(['google', 'microsoft']);
    });
  });

  describe('Authorization URL Generation', () => {
    beforeEach(() => {
      ssoService.registerProvider('google', new MockGoogleProvider());
    });

    it('should generate authorization URL with state parameter', async () => {
      const state = 'random-state-123';

      const authUrl = await ssoService.getAuthorizationUrl('google', state);

      expect(authUrl).toContain('https://mock-provider.com/oauth/authorize');
      expect(authUrl).toContain(`state=${state}`);
      expect(authUrl).toContain('client_id=mock-client-id');
    });

    it('should throw error for unregistered provider', async () => {
      await expect(
        ssoService.getAuthorizationUrl('unknown', 'state')
      ).rejects.toThrow('Provider unknown is not registered');
    });
  });

  describe('OAuth Flow', () => {
    let mockProvider;

    beforeEach(() => {
      mockProvider = new MockGoogleProvider();
      ssoService.registerProvider('google', mockProvider);
    });

    describe('Token Exchange', () => {
      it('should exchange authorization code for tokens', async () => {
        const code = 'valid-auth-code';

        const tokens = await ssoService.exchangeCodeForTokens('google', code);

        expect(tokens).toEqual({
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token'
        });
      });

      it('should handle invalid authorization code', async () => {
        const code = 'invalid-code';

        await expect(
          ssoService.exchangeCodeForTokens('google', code)
        ).rejects.toThrow('Invalid authorization code');
      });
    });

    describe('User Profile Retrieval', () => {
      it('should fetch user profile with valid token', async () => {
        const profile = await ssoService.getUserProfile('google', 'valid-token');

        expect(profile).toEqual({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://mock-provider.com/avatar/123.jpg',
          verified_email: true
        });
      });

      it('should handle invalid access token', async () => {
        await expect(
          ssoService.getUserProfile('google', 'invalid-token')
        ).rejects.toThrow('Invalid access token');
      });
    });
  });

  describe('User Management', () => {
    let mockProvider;

    beforeEach(() => {
      mockProvider = new MockGoogleProvider();
      ssoService.registerProvider('google', mockProvider);
    });

    describe('User Creation/Update', () => {
      it('should create new user from OAuth profile', async () => {
        const profile = {
          id: 'google-123',
          email: 'newuser@example.com',
          name: 'New User',
          picture: 'avatar.jpg',
          verified_email: true
        };

        mockUserRepository.findByEmail.mockResolvedValue(null);
        mockUserRepository.findByProviderId.mockResolvedValue(null);

        const newUser = UserFactory.createOAuthUser('google');
        mockUserRepository.create.mockResolvedValue(newUser);

        const user = await ssoService.handleOAuthCallback('google', profile);

        expect(mockUserRepository.create).toHaveBeenCalledWith({
          email: profile.email,
          firstName: 'New',
          lastName: 'User',
          avatar: profile.picture,
          provider: 'google',
          providerId: profile.id,
          isVerified: true
        });
        expect(user).toEqual(newUser);
      });

      it('should update existing user profile', async () => {
        const profile = {
          id: 'google-123',
          email: 'existing@example.com',
          name: 'Updated User',
          picture: 'new-avatar.jpg',
          verified_email: true
        };

        const existingUser = UserFactory.createOAuthUser('google', {
          email: 'existing@example.com',
          providerId: 'google-123'
        });

        mockUserRepository.findByProviderId.mockResolvedValue(existingUser);
        mockUserRepository.update.mockResolvedValue({ ...existingUser, firstName: 'Updated' });

        const user = await ssoService.handleOAuthCallback('google', profile);

        expect(mockUserRepository.update).toHaveBeenCalledWith(existingUser.id, {
          firstName: 'Updated',
          lastName: 'User',
          avatar: profile.picture,
          lastLogin: expect.any(Date)
        });
      });

      it('should handle email conflicts', async () => {
        const profile = {
          id: 'google-456',
          email: 'conflict@example.com',
          name: 'Conflict User'
        };

        const existingUser = UserFactory.create({
          email: 'conflict@example.com',
          provider: 'local'
        });

        mockUserRepository.findByEmail.mockResolvedValue(existingUser);
        mockUserRepository.findByProviderId.mockResolvedValue(null);

        await expect(
          ssoService.handleOAuthCallback('google', profile)
        ).rejects.toThrow('Email address is already associated with another account');
      });
    });

    describe('Account Linking', () => {
      it('should link OAuth account to existing local account', async () => {
        const userId = 'user-123';
        const provider = 'google';
        const providerId = 'google-456';

        const existingUser = UserFactory.create({ id: userId, provider: 'local' });
        mockUserRepository.findByProviderId.mockResolvedValue(null);
        mockUserRepository.update.mockResolvedValue({
          ...existingUser,
          provider: 'google',
          providerId: 'google-456'
        });

        const result = await ssoService.linkAccount(userId, provider, providerId);

        expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
          provider,
          providerId
        });
        expect(result.provider).toBe('google');
      });

      it('should prevent linking already linked provider account', async () => {
        const userId = 'user-123';
        const provider = 'google';
        const providerId = 'google-456';

        const existingLinkedUser = UserFactory.createOAuthUser('google', {
          providerId: 'google-456'
        });
        mockUserRepository.findByProviderId.mockResolvedValue(existingLinkedUser);

        await expect(
          ssoService.linkAccount(userId, provider, providerId)
        ).rejects.toThrow('Provider account is already linked to another user');
      });
    });

    describe('Account Unlinking', () => {
      it('should unlink OAuth account from user', async () => {
        const userId = 'user-123';
        const provider = 'google';

        const user = UserFactory.createOAuthUser('google', { id: userId });
        mockUserRepository.update.mockResolvedValue({
          ...user,
          provider: 'local',
          providerId: null
        });

        const result = await ssoService.unlinkAccount(userId, provider);

        expect(mockUserRepository.update).toHaveBeenCalledWith(userId, {
          provider: 'local',
          providerId: null
        });
        expect(result.provider).toBe('local');
      });
    });
  });

  describe('Session Management', () => {
    let mockProvider;

    beforeEach(() => {
      mockProvider = new MockGoogleProvider();
      ssoService.registerProvider('google', mockProvider);
    });

    describe('Session Creation', () => {
      it('should create session for authenticated user', async () => {
        const user = UserFactory.createOAuthUser('google');
        const sessionData = {
          userId: user.id,
          token: 'session-token',
          refreshToken: 'refresh-token',
          expiresAt: new Date(Date.now() + 3600000)
        };

        mockSessionRepository.create.mockResolvedValue(sessionData);

        const session = await ssoService.createSession(user.id, {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600
        });

        expect(mockSessionRepository.create).toHaveBeenCalled();
        expect(session).toEqual(sessionData);
      });
    });

    describe('Token Refresh', () => {
      it('should refresh access token using refresh token', async () => {
        const refreshToken = 'valid-refresh-token';

        const newTokens = await ssoService.refreshAccessToken('google', refreshToken);

        expect(newTokens).toEqual({
          access_token: 'new-mock-access-token',
          token_type: 'Bearer',
          expires_in: 3600
        });
      });

      it('should handle invalid refresh token', async () => {
        const refreshToken = 'invalid-refresh-token';

        await expect(
          ssoService.refreshAccessToken('google', refreshToken)
        ).rejects.toThrow('Invalid refresh token');
      });
    });

    describe('Token Revocation', () => {
      it('should revoke access token', async () => {
        const accessToken = 'valid-access-token';

        const result = await ssoService.revokeToken('google', accessToken);

        expect(result).toEqual({ success: true });
      });

      it('should handle token revocation failure', async () => {
        const accessToken = 'invalid-token';

        await expect(
          ssoService.revokeToken('google', accessToken)
        ).rejects.toThrow('Token revocation failed');
      });
    });

    describe('Session Cleanup', () => {
      it('should delete user sessions on logout', async () => {
        const userId = 'user-123';

        mockSessionRepository.deleteByUserId.mockResolvedValue(3);

        const deletedCount = await ssoService.logout(userId);

        expect(mockSessionRepository.deleteByUserId).toHaveBeenCalledWith(userId);
        expect(deletedCount).toBe(3);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockProvider = new MockGoogleProvider();
      mockProvider.exchangeCodeForToken = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      ssoService.registerProvider('google', mockProvider);

      await expect(
        ssoService.exchangeCodeForTokens('google', 'code')
      ).rejects.toThrow('Network error');
    });

    it('should handle database errors gracefully', async () => {
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      const profile = {
        id: 'google-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.findByProviderId.mockResolvedValue(null);

      await expect(
        ssoService.handleOAuthCallback('google', profile)
      ).rejects.toThrow('Database error');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate provider configuration', () => {
      const invalidProvider = {
        // Missing required methods
      };

      expect(() => {
        ssoService.registerProvider('invalid', invalidProvider);
      }).toThrow('Provider must implement required OAuth methods');
    });

    it('should validate SSO service configuration', () => {
      expect(() => {
        new SSOService({
          // Missing required dependencies
        });
      }).toThrow('User repository is required');
    });
  });
});