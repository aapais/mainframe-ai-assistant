# Microsoft Entra ID (Azure AD) Setup Guide

## 📋 Overview

This guide covers integrating Microsoft Entra ID (formerly Azure Active Directory) with the Mainframe AI Assistant SSO system using OpenID Connect.

## 🔧 Prerequisites

- Microsoft Entra ID tenant
- Global Administrator or Application Administrator role
- Azure CLI (optional)

## 🚀 Quick Setup

### 1. Azure Portal Configuration

#### Register Application

1. Sign in to the [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory > App registrations**
3. Click **New registration**
4. Fill out the registration form:

```json
{
  "name": "Mainframe AI Assistant",
  "supported_account_types": "Accounts in this organizational directory only",
  "redirect_uri": {
    "type": "Web",
    "value": "https://yourapp.com/api/v2/auth/microsoft/callback"
  }
}
```

#### Configure Authentication

1. Go to **Authentication** in your app registration
2. Add additional redirect URIs:
   - `https://yourapp.com/api/v2/auth/microsoft/callback`
   - `http://localhost:3000/api/v2/auth/microsoft/callback` (development)
3. Configure **Implicit grant and hybrid flows**:
   - ✅ ID tokens
   - ❌ Access tokens (not needed for OIDC)

#### Create Client Secret

1. Navigate to **Certificates & secrets**
2. Click **New client secret**
3. Set description: "SSO Integration"
4. Set expiration: 24 months (recommended)
5. **Save the secret value immediately** (you won't see it again)

### 2. Environment Configuration

```bash
# Microsoft Entra ID Configuration
MICROSOFT_CLIENT_ID=your_application_client_id
MICROSOFT_CLIENT_SECRET=your_client_secret
MICROSOFT_TENANT_ID=your_tenant_id
MICROSOFT_REDIRECT_URI=https://yourapp.com/api/v2/auth/microsoft/callback

# Optional: Custom Microsoft Graph scopes
MICROSOFT_SCOPES=openid,profile,email,User.Read
```

### 3. Application Configuration

#### Node.js/Express Example

```javascript
// config/microsoft.js
const microsoftConfig = {
  // Application details
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  tenantId: process.env.MICROSOFT_TENANT_ID,

  // OpenID Connect endpoints
  authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`,
  discoveryEndpoint: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0/.well-known/openid_configuration`,

  // Application configuration
  redirectUri: process.env.MICROSOFT_REDIRECT_URI,
  postLogoutRedirectUri: `${process.env.APP_URL}/logout`,

  // Scopes
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read'
  ],

  // Security settings
  responseType: 'code',
  responseMode: 'query',

  // Additional options
  prompt: 'select_account', // Allow user to choose account
  maxAge: 3600 // Token max age in seconds
};

module.exports = { microsoftConfig };
```

## 🔐 Multi-Tenant Configuration

### Single Tenant (Recommended)

```javascript
// For single organization
const singleTenantConfig = {
  authority: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  validateIssuer: true,
  allowedTenants: [tenantId]
};
```

### Multi-Tenant Setup

```javascript
// For multiple organizations
const multiTenantConfig = {
  authority: 'https://login.microsoftonline.com/common/v2.0',
  validateIssuer: false, // Must validate manually
  allowedTenants: ['tenant1-id', 'tenant2-id'] // Or 'common' for all
};

// Custom tenant validation
function validateTenant(tenantId, allowedTenants) {
  if (allowedTenants.includes('common')) {
    return true; // Allow all tenants
  }
  return allowedTenants.includes(tenantId);
}
```

## 🌐 Frontend Integration

### MSAL.js 2.0 Integration

```html
<!-- Microsoft Authentication Library -->
<script src="https://alcdn.msauth.net/browser/2.38.1/js/msal-browser.min.js"></script>

<script>
  // MSAL configuration
  const msalConfig = {
    auth: {
      clientId: 'your-client-id',
      authority: 'https://login.microsoftonline.com/your-tenant-id',
      redirectUri: window.location.origin + '/auth/callback'
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: true
    }
  };

  // Initialize MSAL
  const msalInstance = new msal.PublicClientApplication(msalConfig);

  // Login function
  async function loginWithMicrosoft() {
    const loginRequest = {
      scopes: ['openid', 'profile', 'email', 'User.Read']
    };

    try {
      const response = await msalInstance.loginPopup(loginRequest);

      // Send ID token to your backend
      const backendResponse = await fetch('/api/v2/auth/microsoft/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: response.idToken,
          access_token: response.accessToken
        })
      });

      const data = await backendResponse.json();
      localStorage.setItem('access_token', data.access_token);

    } catch (error) {
      console.error('Login failed:', error);
    }
  }
</script>
```

### React with MSAL

```jsx
// components/MicrosoftAuth.jsx
import React from 'react';
import { useMsal } from '@azure/msal-react';

const MicrosoftAuth = () => {
  const { instance, accounts } = useMsal();

  const handleMicrosoftLogin = async () => {
    const loginRequest = {
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      prompt: 'select_account'
    };

    try {
      const response = await instance.loginPopup(loginRequest);

      // Send to your backend for processing
      const authResponse = await fetch('/api/v2/auth/microsoft/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: response.idToken
        })
      });

      if (authResponse.ok) {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Microsoft login failed:', error);
    }
  };

  return (
    <button
      onClick={handleMicrosoftLogin}
      className="microsoft-auth-button"
    >
      <img src="/microsoft-icon.svg" alt="Microsoft" />
      Sign in with Microsoft
    </button>
  );
};

export default MicrosoftAuth;
```

## ⚙️ Advanced Configuration

### Microsoft Graph Integration

```javascript
// Microsoft Graph API client
const graphConfig = {
  baseURL: 'https://graph.microsoft.com/v1.0',
  scopes: [
    'User.Read',
    'User.ReadBasic.All',
    'Calendars.Read',
    'Mail.Read'
  ]
};

// Graph API helper
class GraphAPIClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  async getUser() {
    const response = await fetch(`${graphConfig.baseURL}/me`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }

  async getUserPhoto() {
    const response = await fetch(`${graphConfig.baseURL}/me/photo/$value`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (response.ok) {
      return response.blob();
    }
    return null;
  }
}
```

### Custom Claims Mapping

```javascript
// Map Microsoft user data to application schema
function mapMicrosoftUser(msUser, idToken) {
  return {
    id: msUser.id || idToken.sub,
    email: msUser.userPrincipalName || idToken.email,
    name: msUser.displayName || idToken.name,
    given_name: msUser.givenName || idToken.given_name,
    family_name: msUser.surname || idToken.family_name,
    picture: null, // Fetch separately from Graph API
    locale: msUser.preferredLanguage || 'en-US',
    job_title: msUser.jobTitle,
    department: msUser.department,
    office_location: msUser.officeLocation,
    provider: 'microsoft',
    provider_id: msUser.id,
    tenant_id: idToken.tid,
    created_at: new Date(),
    updated_at: new Date()
  };
}
```

## 🔍 Token Validation

### ID Token Validation

```javascript
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// JWKS client for Microsoft
const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Validate Microsoft ID token
function validateMicrosoftToken(idToken, tenantId, clientId) {
  return new Promise((resolve, reject) => {
    jwt.verify(idToken, getKey, {
      audience: clientId,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`
      ],
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}
```

## 🚨 Common Issues

### Issue: AADSTS50011 - Invalid redirect URI

**Problem**: Redirect URI mismatch

**Solution**:
```javascript
// Ensure exact match in Azure Portal
// ❌ Wrong: trailing slash mismatch
redirectUri: 'https://yourapp.com/auth/callback/'
// Azure: 'https://yourapp.com/auth/callback'

// ✅ Correct: exact match
redirectUri: 'https://yourapp.com/auth/callback'
```

### Issue: AADSTS65001 - User consent required

**Problem**: Application requires admin consent

**Solution**:
1. Go to **API permissions** in Azure Portal
2. Click **Grant admin consent for [Tenant]**
3. Or implement incremental consent in your app

### Issue: Token validation failures

**Problem**: Invalid audience or issuer

**Solution**:
```javascript
// Validate both v1.0 and v2.0 issuers
const validIssuers = [
  `https://login.microsoftonline.com/${tenantId}/v2.0`,
  `https://sts.windows.net/${tenantId}/`,
  `https://login.microsoftonline.com/${tenantId}/`
];
```

## 📊 Monitoring and Analytics

### Authentication Metrics

```javascript
// Track Microsoft authentication events
const microsoftMetrics = {
  loginAttempts: 0,
  successfulLogins: 0,
  failedLogins: 0,
  tokenRefreshes: 0,

  trackLogin: (success, error = null) => {
    this.loginAttempts++;
    if (success) {
      this.successfulLogins++;
    } else {
      this.failedLogins++;
      console.error('Microsoft login failed:', error);
    }
  },

  getSuccessRate: () => {
    return this.loginAttempts > 0
      ? (this.successfulLogins / this.loginAttempts) * 100
      : 0;
  }
};
```

## 🔒 Security Best Practices

### Secure Token Storage

```javascript
// Secure token handling
class TokenManager {
  constructor() {
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  }

  encryptToken(token) {
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptToken(encryptedToken) {
    const crypto = require('crypto');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
```

### Rate Limiting

```javascript
// Rate limiting for Microsoft auth endpoints
const rateLimit = require('express-rate-limit');

const microsoftAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v2/auth/microsoft', microsoftAuthLimiter);
```

## 🔧 Testing Configuration

```javascript
// test/microsoft-auth.test.js
const nock = require('nock');

describe('Microsoft Entra ID Integration', () => {
  beforeEach(() => {
    // Mock Microsoft discovery endpoint
    nock('https://login.microsoftonline.com')
      .get(`/${process.env.MICROSOFT_TENANT_ID}/v2.0/.well-known/openid_configuration`)
      .reply(200, {
        authorization_endpoint: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        token_endpoint: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        jwks_uri: 'https://login.microsoftonline.com/tenant/discovery/v2.0/keys'
      });
  });

  it('should generate correct authorization URL', () => {
    const authUrl = generateMicrosoftAuthUrl();
    expect(authUrl).toContain('login.microsoftonline.com');
    expect(authUrl).toContain('response_type=code');
    expect(authUrl).toContain('client_id=');
  });

  it('should handle callback with valid authorization code', async () => {
    nock('https://login.microsoftonline.com')
      .post(`/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`)
      .reply(200, {
        access_token: 'mock_access_token',
        id_token: 'mock_id_token',
        expires_in: 3600,
        token_type: 'Bearer'
      });

    const response = await request(app)
      .get('/api/v2/auth/microsoft/callback')
      .query({
        code: 'mock_authorization_code',
        state: 'valid-state'
      });

    expect(response.status).toBe(200);
  });
});
```

## 📚 Additional Resources

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
- [Microsoft Graph API](https://docs.microsoft.com/en-us/graph/)
- [Azure AD App Registration Guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

**Next Steps**: Continue with [SAML Configuration](./saml.md) or review [Security Best Practices](../security/best-practices.md).