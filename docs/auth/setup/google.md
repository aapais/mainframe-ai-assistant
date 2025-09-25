# Google OAuth 2.0 Setup Guide

## 📋 Overview

This guide walks you through setting up Google OAuth 2.0 authentication for the Mainframe AI Assistant SSO system.

## 🔧 Prerequisites

- Google Cloud Platform account
- Project with OAuth 2.0 enabled
- Domain verification (for production)

## 🚀 Quick Setup

### 1. Google Cloud Console Configuration

#### Create OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application** as application type

#### Configure OAuth Client

```json
{
  "name": "Mainframe AI Assistant",
  "authorized_javascript_origins": [
    "https://yourapp.com",
    "http://localhost:3000"
  ],
  "authorized_redirect_uris": [
    "https://yourapp.com/api/v2/auth/google/callback",
    "http://localhost:3000/api/v2/auth/google/callback"
  ]
}
```

### 2. Environment Configuration

Add the following to your `.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=https://yourapp.com/api/v2/auth/google/callback

# Optional: Google API Scopes
GOOGLE_SCOPES=openid,email,profile
```

### 3. Application Configuration

#### Node.js/Express Example

```javascript
// config/auth.js
const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  scopes: [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
  ],
  // Enable PKCE for enhanced security
  pkce: true,
  // Additional Google-specific options
  accessType: 'offline', // For refresh tokens
  prompt: 'consent'      // Always show consent screen
};

module.exports = { googleConfig };
```

## 🔐 Security Configuration

### PKCE Implementation

```javascript
// Enhanced security with PKCE
const crypto = require('crypto');

function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}
```

### State Parameter Validation

```javascript
// Generate secure state parameter
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Store state in session for validation
req.session.oauthState = generateState();
```

## 🌐 Frontend Integration

### React Example

```jsx
// components/GoogleAuth.jsx
import React from 'react';

const GoogleAuth = () => {
  const handleGoogleLogin = async () => {
    const response = await fetch('/api/v2/auth/providers');
    const { providers } = await response.json();

    const googleProvider = providers.find(p => p.id === 'google');
    if (googleProvider?.enabled) {
      window.location.href = `/api/v2/auth/google/authorize?` +
        `redirect_uri=${encodeURIComponent(window.location.origin + '/auth/callback')}&` +
        `state=${generateSecureState()}`;
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      className="google-auth-button"
    >
      <img src="/google-icon.svg" alt="Google" />
      Continue with Google
    </button>
  );
};

export default GoogleAuth;
```

### JavaScript SDK Integration

```html
<!-- Google Sign-In JavaScript SDK -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<script>
  function handleGoogleSignIn(response) {
    // Send the credential to your backend
    fetch('/api/v2/auth/google/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        credential: response.credential
      })
    })
    .then(response => response.json())
    .then(data => {
      // Handle successful authentication
      localStorage.setItem('access_token', data.access_token);
      window.location.href = '/dashboard';
    });
  }

  // Initialize Google Sign-In
  google.accounts.id.initialize({
    client_id: 'your_client_id.apps.googleusercontent.com',
    callback: handleGoogleSignIn
  });
</script>
```

## ⚙️ Advanced Configuration

### Scopes and Permissions

```javascript
// Available Google OAuth scopes
const googleScopes = {
  // Basic profile information
  profile: 'https://www.googleapis.com/auth/userinfo.profile',
  email: 'https://www.googleapis.com/auth/userinfo.email',
  openid: 'openid',

  // Google Workspace integration
  drive: 'https://www.googleapis.com/auth/drive.readonly',
  calendar: 'https://www.googleapis.com/auth/calendar.readonly',

  // Admin SDK (requires domain admin)
  admin: 'https://www.googleapis.com/auth/admin.directory.user.readonly'
};
```

### Custom User Mapping

```javascript
// Map Google user data to your application schema
function mapGoogleUser(googleUser) {
  return {
    id: googleUser.sub,
    email: googleUser.email,
    name: googleUser.name,
    given_name: googleUser.given_name,
    family_name: googleUser.family_name,
    picture: googleUser.picture,
    locale: googleUser.locale,
    email_verified: googleUser.email_verified,
    provider: 'google',
    provider_id: googleUser.sub,
    created_at: new Date(),
    updated_at: new Date()
  };
}
```

## 🔍 Testing and Validation

### Test Configuration

```javascript
// test/google-auth.test.js
describe('Google OAuth Integration', () => {
  it('should redirect to Google authorization URL', async () => {
    const response = await request(app)
      .get('/api/v2/auth/google/authorize')
      .query({
        redirect_uri: 'http://localhost:3000/auth/callback',
        state: 'test-state'
      });

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('accounts.google.com');
  });

  it('should handle callback with valid authorization code', async () => {
    // Mock Google token exchange
    nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer'
      });

    const response = await request(app)
      .get('/api/v2/auth/google/callback')
      .query({
        code: 'mock_authorization_code',
        state: 'valid-state'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('access_token');
  });
});
```

## 🚨 Common Issues

### Issue: Invalid redirect_uri

**Problem**: `redirect_uri_mismatch` error

**Solution**: Ensure redirect URIs in Google Console exactly match your application URLs:
```javascript
// ❌ Wrong
redirectUri: 'http://localhost:3000/auth/callback'
// Google Console: 'http://localhost:3000/auth/callback/'

// ✅ Correct - exact match required
redirectUri: 'http://localhost:3000/auth/callback/'
```

### Issue: Access blocked

**Problem**: "This app isn't verified" warning

**Solution**:
1. Complete OAuth consent screen configuration
2. Add test users during development
3. Submit for verification for production

### Issue: Token refresh failures

**Problem**: Refresh tokens not being issued

**Solution**:
```javascript
// Ensure offline access and consent prompt
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
```

## 📊 Monitoring and Analytics

### Usage Tracking

```javascript
// Track Google OAuth usage
const analytics = {
  trackGoogleLogin: (userId, success) => {
    console.log(`Google login: ${userId}, Success: ${success}`);
    // Your analytics implementation
  },

  trackTokenRefresh: (userId) => {
    console.log(`Token refresh: ${userId}`);
  }
};
```

### Performance Monitoring

```javascript
// Monitor Google API response times
const performanceMonitor = {
  measureGoogleAPI: async (operation, fn) => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      console.log(`Google ${operation}: ${duration}ms`);
      return result;
    } catch (error) {
      console.error(`Google ${operation} failed:`, error);
      throw error;
    }
  }
};
```

## 🔒 Security Checklist

- [ ] HTTPS enabled in production
- [ ] PKCE implemented for OAuth flow
- [ ] State parameter validation
- [ ] Secure session storage
- [ ] Token rotation implemented
- [ ] Rate limiting on auth endpoints
- [ ] Proper error handling (no sensitive data in responses)
- [ ] Audit logging enabled
- [ ] Domain verification completed
- [ ] OAuth consent screen configured

## 📚 Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Google Identity Platform](https://developers.google.com/identity)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

---

**Next Steps**: After configuring Google OAuth, proceed to [Microsoft Setup](./microsoft.md) or [SAML Configuration](./saml.md).