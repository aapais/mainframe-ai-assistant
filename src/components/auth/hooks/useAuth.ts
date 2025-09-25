import { useState, useEffect, useContext, createContext, ReactNode } from 'react';
import { AuthState, AuthContextType, User, LoginFormData, PasswordChangeData, MFASetupData, Session, SecurityEvent, APIKey, UserPreferences, SSOProvider } from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    providers: [],
    session: null
  });

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Check for existing session
      const token = localStorage.getItem('auth_token');
      if (token) {
        const user = await validateToken(token);
        if (user) {
          setState(prev => ({
            ...prev,
            user,
            isAuthenticated: true,
            isLoading: false
          }));
        } else {
          localStorage.removeItem('auth_token');
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }

      // Load SSO providers
      const providers = await getAvailableProviders();
      setState(prev => ({ ...prev, providers }));
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Authentication failed',
        isLoading: false
      }));
    }
  };

  const validateToken = async (token: string): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch {
      return null;
    }
  };

  const getAvailableProviders = async (): Promise<SSOProvider[]> => {
    try {
      const response = await fetch('/api/auth/providers');
      if (response.ok) {
        return await response.json();
      }
      return [];
    } catch {
      return [];
    }
  };

  const login = async (data: LoginFormData): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const endpoint = data.provider ? `/api/auth/sso/${data.provider}` : '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const { user, token, session } = await response.json();
      localStorage.setItem('auth_token', token);
      
      setState(prev => ({
        ...prev,
        user,
        session,
        isAuthenticated: true,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      }));
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    } catch {
      // Continue with logout even if API call fails
    } finally {
      localStorage.removeItem('auth_token');
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        providers: state.providers,
        session: null
      });
    }
  };

  const refreshToken = async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const { token } = await response.json();
        localStorage.setItem('auth_token', token);
      } else {
        await logout();
      }
    } catch {
      await logout();
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<void> => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('Profile update failed');
      }

      const updatedUser = await response.json();
      setState(prev => ({ ...prev, user: updatedUser }));
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (data: PasswordChangeData): Promise<void> => {
    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Password change failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const setupMFA = async (data: MFASetupData): Promise<void> => {
    try {
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error('MFA setup failed');
      }

      const updatedUser = await response.json();
      setState(prev => ({ ...prev, user: updatedUser }));
    } catch (error) {
      throw error;
    }
  };

  const disableMFA = async (): Promise<void> => {
    try {
      const response = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('MFA disable failed');
      }

      const updatedUser = await response.json();
      setState(prev => ({ ...prev, user: updatedUser }));
    } catch (error) {
      throw error;
    }
  };

  const createAPIKey = async (name: string, permissions: string[]): Promise<APIKey> => {
    try {
      const response = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ name, permissions })
      });

      if (!response.ok) {
        throw new Error('API key creation failed');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const revokeAPIKey = async (keyId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/auth/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('API key revocation failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const getSessions = async (): Promise<Session[]> => {
    try {
      const response = await fetch('/api/auth/sessions', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const revokeSession = async (sessionId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Session revocation failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const getSecurityEvents = async (): Promise<SecurityEvent[]> => {
    try {
      const response = await fetch('/api/auth/security/events', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch security events');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  };

  const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<void> => {
    try {
      const response = await fetch('/api/auth/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(preferences)
      });

      if (!response.ok) {
        throw new Error('Preferences update failed');
      }
    } catch (error) {
      throw error;
    }
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    updateProfile,
    changePassword,
    setupMFA,
    disableMFA,
    createAPIKey,
    revokeAPIKey,
    getSessions,
    revokeSession,
    getSecurityEvents,
    updatePreferences
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;