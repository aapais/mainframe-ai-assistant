/**
 * Mock SSO Providers for Testing
 */

class MockOAuthProvider {
  constructor(config = {}) {
    this.config = {
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret',
      redirectUri: 'http://localhost:3000/auth/callback',
      scope: ['profile', 'email'],
      ...config,
    };
    this.responses = new Map();
  }

  setMockResponse(method, response) {
    this.responses.set(method, response);
  }

  async getAuthorizationUrl(state) {
    return `https://mock-provider.com/oauth/authorize?client_id=${this.config.clientId}&redirect_uri=${this.config.redirectUri}&state=${state}&scope=${this.config.scope.join(' ')}`;
  }

  async exchangeCodeForToken(code) {
    const mockResponse = this.responses.get('exchangeCodeForToken') || {
      access_token: 'mock-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock-refresh-token',
    };

    if (code === 'invalid-code') {
      throw new Error('Invalid authorization code');
    }

    return mockResponse;
  }

  async getUserProfile(accessToken) {
    const mockResponse = this.responses.get('getUserProfile') || {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://mock-provider.com/avatar/123.jpg',
      verified_email: true,
    };

    if (accessToken === 'invalid-token') {
      throw new Error('Invalid access token');
    }

    return mockResponse;
  }

  async refreshToken(refreshToken) {
    const mockResponse = this.responses.get('refreshToken') || {
      access_token: 'new-mock-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    if (refreshToken === 'invalid-refresh-token') {
      throw new Error('Invalid refresh token');
    }

    return mockResponse;
  }

  async revokeToken(token) {
    if (token === 'invalid-token') {
      throw new Error('Token revocation failed');
    }
    return { success: true };
  }
}

// Specific provider mocks
class MockGoogleProvider extends MockOAuthProvider {
  constructor() {
    super({
      name: 'google',
      authUrl: 'https://accounts.google.com/oauth2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scope: ['profile', 'email', 'openid'],
    });
  }
}

class MockMicrosoftProvider extends MockOAuthProvider {
  constructor() {
    super({
      name: 'microsoft',
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
      scope: ['User.Read', 'profile', 'email'],
    });
  }
}

class MockOktaProvider extends MockOAuthProvider {
  constructor() {
    super({
      name: 'okta',
      authUrl: 'https://dev-123456.okta.com/oauth2/v1/authorize',
      tokenUrl: 'https://dev-123456.okta.com/oauth2/v1/token',
      userInfoUrl: 'https://dev-123456.okta.com/oauth2/v1/userinfo',
      scope: ['openid', 'profile', 'email'],
    });
  }
}

// SAML Mock Provider
class MockSAMLProvider {
  constructor(config = {}) {
    this.config = {
      entryPoint: 'https://mock-saml-provider.com/sso',
      issuer: 'mock-saml-provider',
      cert: 'mock-certificate',
      ...config,
    };
  }

  generateSAMLRequest() {
    return {
      id: 'mock-saml-request-id',
      xml: '<samlp:AuthnRequest>Mock SAML Request</samlp:AuthnRequest>',
      url: `${this.config.entryPoint}?SAMLRequest=encodedRequest`,
    };
  }

  validateSAMLResponse(response) {
    if (response.includes('invalid')) {
      throw new Error('Invalid SAML response');
    }

    return {
      nameID: 'saml-user-123',
      attributes: {
        email: 'saml.user@example.com',
        firstName: 'SAML',
        lastName: 'User',
        groups: ['users', 'developers'],
      },
    };
  }
}

// JWT Mock Provider
class MockJWTProvider {
  constructor(secret = 'test-jwt-secret') {
    this.secret = secret;
  }

  generateToken(payload, options = {}) {
    return `mock.jwt.${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }

  verifyToken(token) {
    if (token === 'invalid.jwt.token') {
      throw new Error('Invalid JWT token');
    }

    if (token === 'expired.jwt.token') {
      throw new Error('JWT token expired');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Malformed JWT token');
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[2], 'base64').toString());
      return payload;
    } catch (error) {
      throw new Error('Invalid JWT payload');
    }
  }

  refreshToken(refreshToken) {
    if (refreshToken === 'invalid-refresh') {
      throw new Error('Invalid refresh token');
    }

    return {
      accessToken: this.generateToken({ userId: 'user-123' }),
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    };
  }
}

module.exports = {
  MockOAuthProvider,
  MockGoogleProvider,
  MockMicrosoftProvider,
  MockOktaProvider,
  MockSAMLProvider,
  MockJWTProvider,
};
