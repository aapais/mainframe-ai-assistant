# React SSO Integration Guide

## 🚀 Overview

This guide demonstrates how to integrate the Mainframe AI Assistant SSO system with React applications, covering both client-side and server-side authentication patterns.

## 📦 Installation

### Required Dependencies

```bash
# Core authentication libraries
npm install @azure/msal-react @azure/msal-browser
npm install react-router-dom
npm install js-cookie
npm install axios

# Optional: For enhanced security
npm install crypto-js
npm install jwt-decode

# Development dependencies
npm install --save-dev @types/js-cookie
```

## ⚙️ Configuration Setup

### Environment Variables

```bash
# .env
REACT_APP_API_BASE_URL=https://api.yourapp.com
REACT_APP_AUTH_REDIRECT_URI=http://localhost:3000/auth/callback
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_MICROSOFT_CLIENT_ID=your_microsoft_client_id

# Production
REACT_APP_PRODUCTION_API_URL=https://api.yourapp.com
REACT_APP_PRODUCTION_REDIRECT_URI=https://yourapp.com/auth/callback
```

### Auth Configuration

```javascript
// src/config/auth.js
export const authConfig = {
  apiBaseUrl: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000',

  providers: {
    google: {
      clientId: process.env.REACT_APP_GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email']
    },

    microsoft: {
      clientId: process.env.REACT_APP_MICROSOFT_CLIENT_ID,
      authority: 'https://login.microsoftonline.com/common',
      scopes: ['openid', 'profile', 'email', 'User.Read']
    }
  },

  redirectUri: process.env.REACT_APP_AUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',

  // Token storage configuration
  storage: {
    tokenKey: 'auth_token',
    refreshKey: 'refresh_token',
    userKey: 'user_data'
  },

  // Security settings
  security: {
    tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    timeoutMs: 10000
  }
};
```

## 🏗️ Core Authentication Service

### AuthService Class

```javascript
// src/services/AuthService.js
import axios from 'axios';
import Cookies from 'js-cookie';
import jwtDecode from 'jwt-decode';
import { authConfig } from '../config/auth';

class AuthService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: authConfig.apiBaseUrl,
      timeout: authConfig.security.timeoutMs,
      withCredentials: true
    });

    // Add token to requests automatically
    this.apiClient.interceptors.request.use(this.addAuthHeader.bind(this));

    // Handle token refresh on 401s
    this.apiClient.interceptors.response.use(
      (response) => response,
      this.handleAuthError.bind(this)
    );
  }

  // Generate secure state parameter
  generateState() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  // Store state securely
  storeState(state, provider) {
    const stateData = {
      value: state,
      provider: provider,
      timestamp: Date.now(),
      nonce: crypto.randomUUID()
    };

    sessionStorage.setItem('oauth_state', JSON.stringify(stateData));
    return stateData.nonce;
  }

  // Validate state parameter
  validateState(receivedState) {
    const stored = sessionStorage.getItem('oauth_state');

    if (!stored) {
      throw new Error('No stored state found');
    }

    const stateData = JSON.parse(stored);

    // Check expiration (5 minutes)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      sessionStorage.removeItem('oauth_state');
      throw new Error('State expired');
    }

    if (stateData.value !== receivedState) {
      sessionStorage.removeItem('oauth_state');
      throw new Error('State mismatch');
    }

    sessionStorage.removeItem('oauth_state');
    return stateData;
  }

  // Initiate OAuth flow
  async initiateAuth(provider) {
    try {
      const state = this.generateState();
      const nonce = this.storeState(state, provider);

      const authUrl = new URL(`${authConfig.apiBaseUrl}/api/v2/auth/${provider}/authorize`);
      authUrl.searchParams.set('redirect_uri', authConfig.redirectUri);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('nonce', nonce);

      // Add PKCE for enhanced security
      if (provider === 'google' || provider === 'microsoft') {
        const pkce = await this.generatePKCE();
        authUrl.searchParams.set('code_challenge', pkce.codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        sessionStorage.setItem('pkce_verifier', pkce.codeVerifier);
      }

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Auth initiation failed:', error);
      throw new Error('Failed to start authentication process');
    }
  }

  // Generate PKCE challenge
  async generatePKCE() {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    return {
      codeVerifier,
      codeChallenge
    };
  }

  generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);

    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Handle auth callback
  async handleCallback(code, state, provider) {
    try {
      // Validate state
      const stateData = this.validateState(state);

      if (stateData.provider !== provider) {
        throw new Error('Provider mismatch');
      }

      // Prepare callback request
      const requestData = {
        code,
        state,
        provider
      };

      // Add PKCE verifier if available
      const pkceVerifier = sessionStorage.getItem('pkce_verifier');
      if (pkceVerifier) {
        requestData.code_verifier = pkceVerifier;
        sessionStorage.removeItem('pkce_verifier');
      }

      // Exchange code for tokens
      const response = await this.apiClient.post(
        `/api/v2/auth/${provider}/callback`,
        requestData
      );

      const { access_token, refresh_token, user } = response.data;

      // Store tokens securely
      this.storeTokens(access_token, refresh_token);
      this.storeUser(user);

      return { user, tokens: { access_token, refresh_token } };

    } catch (error) {
      console.error('Callback handling failed:', error);
      this.clearAuth();
      throw error;
    }
  }

  // Token storage with security measures
  storeTokens(accessToken, refreshToken) {
    // Store access token in memory for security
    this.accessToken = accessToken;

    // Store refresh token in httpOnly cookie (handled by backend)
    // or in secure localStorage with encryption
    if (refreshToken) {
      const encrypted = this.encryptToken(refreshToken);
      localStorage.setItem(authConfig.storage.refreshKey, encrypted);
    }

    // Store access token with expiration check
    const tokenData = {
      token: accessToken,
      expiresAt: this.getTokenExpiration(accessToken)
    };

    sessionStorage.setItem(authConfig.storage.tokenKey, JSON.stringify(tokenData));
  }

  // Simple token encryption for client-side storage
  encryptToken(token) {
    // In production, use proper encryption library
    // This is a simplified example
    const key = 'your-encryption-key'; // Should be environment-specific
    return btoa(token + '|' + key);
  }

  decryptToken(encrypted) {
    try {
      const decoded = atob(encrypted);
      const [token, key] = decoded.split('|');
      return key === 'your-encryption-key' ? token : null;
    } catch {
      return null;
    }
  }

  // Get token expiration from JWT
  getTokenExpiration(token) {
    try {
      const decoded = jwtDecode(token);
      return decoded.exp * 1000; // Convert to milliseconds
    } catch {
      return Date.now() + (15 * 60 * 1000); // Default 15 minutes
    }
  }

  // Store user data
  storeUser(user) {
    localStorage.setItem(authConfig.storage.userKey, JSON.stringify(user));
  }

  // Get current user
  getCurrentUser() {
    try {
      const userData = localStorage.getItem(authConfig.storage.userKey);
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  // Get valid access token
  async getAccessToken() {
    const tokenData = sessionStorage.getItem(authConfig.storage.tokenKey);

    if (!tokenData) {
      return null;
    }

    try {
      const { token, expiresAt } = JSON.parse(tokenData);

      // Check if token is expired or about to expire
      if (Date.now() >= expiresAt - authConfig.security.tokenRefreshThreshold) {
        return await this.refreshAccessToken();
      }

      return token;
    } catch {
      return null;
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const encryptedRefreshToken = localStorage.getItem(authConfig.storage.refreshKey);

      if (!encryptedRefreshToken) {
        throw new Error('No refresh token available');
      }

      const refreshToken = this.decryptToken(encryptedRefreshToken);

      if (!refreshToken) {
        throw new Error('Invalid refresh token');
      }

      const response = await this.apiClient.post('/api/v2/auth/token/refresh', {
        refresh_token: refreshToken
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // Store new tokens
      this.storeTokens(access_token, newRefreshToken);

      return access_token;

    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuth();
      throw error;
    }
  }

  // Add auth header to requests
  async addAuthHeader(config) {
    const token = await this.getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  }

  // Handle authentication errors
  async handleAuthError(error) {
    if (error.response?.status === 401) {
      // Try to refresh token once
      try {
        const newToken = await this.refreshAccessToken();

        if (newToken) {
          // Retry original request with new token
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return this.apiClient.request(error.config);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }

      // Clear auth and redirect to login
      this.clearAuth();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }

  // Check if user is authenticated
  isAuthenticated() {
    const user = this.getCurrentUser();
    const tokenData = sessionStorage.getItem(authConfig.storage.tokenKey);

    return !!(user && tokenData);
  }

  // Logout user
  async logout() {
    try {
      const token = await this.getAccessToken();

      if (token) {
        await this.apiClient.post('/api/v2/auth/logout', {
          everywhere: false // Logout from current session only
        });
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.clearAuth();
      window.location.href = '/login';
    }
  }

  // Clear authentication data
  clearAuth() {
    this.accessToken = null;
    sessionStorage.removeItem(authConfig.storage.tokenKey);
    localStorage.removeItem(authConfig.storage.refreshKey);
    localStorage.removeItem(authConfig.storage.userKey);
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('pkce_verifier');
  }
}

export default new AuthService();
```

## 🔐 React Context for Authentication

### Auth Context Provider

```javascript
// src/contexts/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AuthService from '../services/AuthService';

// Auth context
const AuthContext = createContext();

// Auth actions
const authActions = {
  LOGIN_START: 'LOGIN_START',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILURE: 'LOGIN_FAILURE',
  LOGOUT: 'LOGOUT',
  SET_LOADING: 'SET_LOADING',
  SET_USER: 'SET_USER'
};

// Auth reducer
function authReducer(state, action) {
  switch (action.type) {
    case authActions.LOGIN_START:
      return {
        ...state,
        isLoading: true,
        error: null
      };

    case authActions.LOGIN_SUCCESS:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        error: null
      };

    case authActions.LOGIN_FAILURE:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: action.payload.error
      };

    case authActions.LOGOUT:
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        error: null
      };

    case authActions.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };

    case authActions.SET_USER:
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload
      };

    default:
      return state;
  }
}

// Initial state
const initialState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null
};

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (AuthService.isAuthenticated()) {
          const user = AuthService.getCurrentUser();

          // Validate token by making a test request
          const token = await AuthService.getAccessToken();

          if (token && user) {
            dispatch({
              type: authActions.LOGIN_SUCCESS,
              payload: { user }
            });
          } else {
            throw new Error('Invalid session');
          }
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        AuthService.clearAuth();
        dispatch({ type: authActions.LOGOUT });
      } finally {
        dispatch({ type: authActions.SET_LOADING, payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (provider) => {
    try {
      dispatch({ type: authActions.LOGIN_START });
      await AuthService.initiateAuth(provider);
    } catch (error) {
      dispatch({
        type: authActions.LOGIN_FAILURE,
        payload: { error: error.message }
      });
    }
  };

  // Handle auth callback
  const handleCallback = async (code, state, provider) => {
    try {
      dispatch({ type: authActions.LOGIN_START });

      const result = await AuthService.handleCallback(code, state, provider);

      dispatch({
        type: authActions.LOGIN_SUCCESS,
        payload: { user: result.user }
      });

      return result;
    } catch (error) {
      dispatch({
        type: authActions.LOGIN_FAILURE,
        payload: { error: error.message }
      });
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    dispatch({ type: authActions.SET_LOADING, payload: true });

    try {
      await AuthService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }

    dispatch({ type: authActions.LOGOUT });
  };

  // Update user data
  const updateUser = (userData) => {
    AuthService.storeUser(userData);
    dispatch({ type: authActions.SET_USER, payload: userData });
  };

  const value = {
    ...state,
    login,
    logout,
    handleCallback,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
```

## 🔒 Protected Route Component

```javascript
// src/components/auth/ProtectedRoute.js
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

const ProtectedRoute = ({
  children,
  requiredRoles = [],
  fallback = null
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth
  if (isLoading) {
    return fallback || <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access
  if (requiredRoles.length > 0) {
    const userRoles = user?.roles || [];
    const hasRequiredRole = requiredRoles.some(role =>
      userRoles.includes(role)
    );

    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
```

## 🎨 Auth Components

### Login Component

```javascript
// src/components/auth/Login.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Login = () => {
  const { login, isLoading, error, isAuthenticated } = useAuth();
  const [selectedProvider, setSelectedProvider] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleLogin = async (provider) => {
    setSelectedProvider(provider);

    try {
      await login(provider);
    } catch (error) {
      setSelectedProvider(null);
    }
  };

  const LoginButton = ({ provider, icon, text, disabled }) => (
    <button
      onClick={() => handleLogin(provider)}
      disabled={disabled || isLoading}
      className={`
        w-full flex items-center justify-center px-4 py-3 border border-gray-300
        rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white
        hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2
        focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
        ${selectedProvider === provider ? 'opacity-50' : ''}
      `}
    >
      {(isLoading && selectedProvider === provider) ? (
        <>
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
          Connecting...
        </>
      ) : (
        <>
          <img src={icon} alt={provider} className="w-5 h-5 mr-3" />
          {text}
        </>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Choose your preferred authentication method
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <LoginButton
            provider="google"
            icon="/icons/google.svg"
            text="Continue with Google"
            disabled={isLoading}
          />

          <LoginButton
            provider="microsoft"
            icon="/icons/microsoft.svg"
            text="Continue with Microsoft"
            disabled={isLoading}
          />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">Or</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/contact')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Need access? Contact administrator
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            By signing in, you agree to our{' '}
            <a href="/terms" className="underline">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
```

### Auth Callback Handler

```javascript
// src/components/auth/AuthCallback.js
import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LoadingSpinner from '../ui/LoadingSpinner';

const AuthCallback = () => {
  const { handleCallback } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const provider = window.location.pathname.split('/')[2]; // Extract from /auth/{provider}/callback

        // Handle OAuth errors
        if (errorParam) {
          throw new Error(`OAuth error: ${errorParam}`);
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error('Missing required authentication parameters');
        }

        setStatus('authenticating');

        // Handle the callback
        const result = await handleCallback(code, state, provider);

        setStatus('success');

        // Redirect to intended destination
        const redirectTo = sessionStorage.getItem('auth_redirect') || '/dashboard';
        sessionStorage.removeItem('auth_redirect');

        setTimeout(() => {
          navigate(redirectTo, { replace: true });
        }, 1000);

      } catch (error) {
        console.error('Auth callback failed:', error);
        setStatus('error');
        setError(error.message);

        // Redirect to login after delay
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    };

    processCallback();
  }, [searchParams, handleCallback, navigate]);

  const StatusMessage = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-lg text-gray-600">Processing authentication...</p>
          </div>
        );

      case 'authenticating':
        return (
          <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-lg text-gray-600">Authenticating user...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-green-500">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg text-gray-600">Authentication successful!</p>
            <p className="text-sm text-gray-500">Redirecting...</p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 text-red-500">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg text-red-600">Authentication failed</p>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <p className="text-sm text-gray-500">Redirecting to login...</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full">
        <StatusMessage />
      </div>
    </div>
  );
};

export default AuthCallback;
```

## 🛠️ Custom Hooks

### useApi Hook

```javascript
// src/hooks/useApi.js
import { useState, useCallback } from 'react';
import AuthService from '../services/AuthService';

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (url, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const response = await AuthService.apiClient.request({
        url,
        ...options
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback((url, params = {}) => {
    return request(url, { method: 'GET', params });
  }, [request]);

  const post = useCallback((url, data = {}) => {
    return request(url, { method: 'POST', data });
  }, [request]);

  const put = useCallback((url, data = {}) => {
    return request(url, { method: 'PUT', data });
  }, [request]);

  const del = useCallback((url) => {
    return request(url, { method: 'DELETE' });
  }, [request]);

  return {
    loading,
    error,
    request,
    get,
    post,
    put,
    delete: del
  };
};
```

### useAuth Hook Extensions

```javascript
// src/hooks/useAuthExtensions.js
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Hook for checking specific permissions
export const usePermissions = (requiredPermissions = []) => {
  const { user } = useAuth();

  const hasPermission = (permission) => {
    return user?.permissions?.includes(permission) || false;
  };

  const hasAllPermissions = () => {
    return requiredPermissions.every(permission => hasPermission(permission));
  };

  const hasAnyPermission = () => {
    return requiredPermissions.some(permission => hasPermission(permission));
  };

  return {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
    permissions: user?.permissions || []
  };
};

// Hook for token expiration monitoring
export const useTokenMonitor = () => {
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    const updateTokenInfo = () => {
      const tokenData = sessionStorage.getItem('auth_token');

      if (tokenData) {
        try {
          const { expiresAt } = JSON.parse(tokenData);
          setTokenExpiry(new Date(expiresAt));
          setTimeRemaining(Math.max(0, expiresAt - Date.now()));
        } catch (error) {
          setTokenExpiry(null);
          setTimeRemaining(null);
        }
      }
    };

    // Update immediately
    updateTokenInfo();

    // Update every minute
    const interval = setInterval(updateTokenInfo, 60000);

    return () => clearInterval(interval);
  }, []);

  const formatTimeRemaining = () => {
    if (!timeRemaining) return null;

    const minutes = Math.floor(timeRemaining / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  return {
    tokenExpiry,
    timeRemaining,
    formatTimeRemaining,
    isExpiringSoon: timeRemaining && timeRemaining < 5 * 60 * 1000 // 5 minutes
  };
};
```

## 🎛️ App Integration

### Main App Component

```javascript
// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import AuthCallback from './components/auth/AuthCallback';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import LoadingSpinner from './components/ui/LoadingSpinner';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Auth callback routes */}
            <Route path="/auth/google/callback" element={<AuthCallback />} />
            <Route path="/auth/microsoft/callback" element={<AuthCallback />} />

            {/* Protected routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute fallback={<LoadingSpinner />}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 route */}
            <Route path="*" element={<div>Page not found</div>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

## 🧪 Testing

### Auth Service Tests

```javascript
// src/services/__tests__/AuthService.test.js
import { jest } from '@jest/globals';
import AuthService from '../AuthService';

// Mock axios
jest.mock('axios');

describe('AuthService', () => {
  beforeEach(() => {
    // Clear storage
    sessionStorage.clear();
    localStorage.clear();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generateState', () => {
    it('should generate a unique state parameter', () => {
      const state1 = AuthService.generateState();
      const state2 = AuthService.generateState();

      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toBe(state2);
      expect(state1).toHaveLength(64); // 32 bytes * 2 hex chars
    });
  });

  describe('storeState', () => {
    it('should store state with metadata', () => {
      const state = 'test-state';
      const provider = 'google';

      const nonce = AuthService.storeState(state, provider);
      const stored = JSON.parse(sessionStorage.getItem('oauth_state'));

      expect(stored.value).toBe(state);
      expect(stored.provider).toBe(provider);
      expect(stored.timestamp).toBeCloseTo(Date.now(), -2); // Within 100ms
      expect(stored.nonce).toBe(nonce);
    });
  });

  describe('validateState', () => {
    it('should validate matching state', () => {
      const state = 'test-state';
      const provider = 'google';

      AuthService.storeState(state, provider);

      expect(() => {
        AuthService.validateState(state);
      }).not.toThrow();
    });

    it('should reject mismatched state', () => {
      const state = 'test-state';
      const wrongState = 'wrong-state';

      AuthService.storeState(state, 'google');

      expect(() => {
        AuthService.validateState(wrongState);
      }).toThrow('State mismatch');
    });

    it('should reject expired state', () => {
      const state = 'test-state';

      // Mock old timestamp
      const stateData = {
        value: state,
        provider: 'google',
        timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes ago
        nonce: 'test-nonce'
      };

      sessionStorage.setItem('oauth_state', JSON.stringify(stateData));

      expect(() => {
        AuthService.validateState(state);
      }).toThrow('State expired');
    });
  });

  describe('PKCE generation', () => {
    it('should generate valid PKCE challenge', async () => {
      const pkce = await AuthService.generatePKCE();

      expect(pkce.codeVerifier).toBeTruthy();
      expect(pkce.codeChallenge).toBeTruthy();
      expect(pkce.codeVerifier).toHaveLength(43);
      expect(pkce.codeChallenge).toHaveLength(43);
    });
  });
});
```

---

**Next Steps**: Explore [Node.js Integration](./nodejs.md) or [Angular Integration](./angular.md) guides for backend and other frontend framework implementations.