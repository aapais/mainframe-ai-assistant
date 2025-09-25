import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../../ui/Button';

export interface SSOCallbackProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type CallbackState = 'loading' | 'success' | 'error' | 'mfa_required';

export const SSOCallback: React.FC<SSOCallbackProps> = ({ onSuccess, onError }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [state, setState] = useState<CallbackState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const provider = searchParams.get('provider') || 'unknown';
      
      setProvider(provider);

      // Handle OAuth errors
      if (error) {
        throw new Error(errorDescription || `Authentication failed: ${error}`);
      }

      // Validate required parameters
      if (!code) {
        throw new Error('Missing authorization code');
      }

      // Exchange code for tokens
      const response = await fetch('/api/auth/sso/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          provider
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'MFA_REQUIRED') {
          setState('mfa_required');
          setMfaToken(data.mfaToken);
          return;
        }
        throw new Error(data.message || 'Authentication failed');
      }

      // Store tokens and update auth state
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
      }

      setState('success');
      onSuccess?.();
      
      // Redirect after a brief success message
      setTimeout(() => {
        const redirectTo = searchParams.get('redirect') || '/';
        navigate(redirectTo, { replace: true });
      }, 1500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
      setError(errorMessage);
      setState('error');
      onError?.(errorMessage);
    }
  };

  const handleMFAComplete = async (mfaCode: string) => {
    try {
      setState('loading');
      
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mfaToken,
          code: mfaCode
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'MFA verification failed');
      }

      localStorage.setItem('auth_token', data.token);
      setState('success');
      onSuccess?.();
      
      setTimeout(() => {
        const redirectTo = searchParams.get('redirect') || '/';
        navigate(redirectTo, { replace: true });
      }, 1500);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'MFA verification failed';
      setError(errorMessage);
      setState('error');
    }
  };

  const handleRetry = () => {
    setState('loading');
    setError(null);
    handleCallback();
  };

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="flex flex-col items-center space-y-4 text-center py-8">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Completing sign in...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify your {provider} authentication.
              </p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center space-y-4 text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-green-700">Sign in successful!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecting you to the application...
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center space-y-4 text-center py-8">
            <XCircle className="w-12 h-12 text-red-500" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-red-700">Sign in failed</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {error || 'An unexpected error occurred during authentication.'}
              </p>
            </div>
            <div className="flex space-x-3 pt-4">
              <Button variant="outline" onClick={handleRetry}>
                Try Again
              </Button>
              <Button onClick={() => navigate('/login')}>
                Back to Login
              </Button>
            </div>
          </div>
        );

      case 'mfa_required':
        return (
          <MFAVerification
            provider={provider || 'SSO'}
            onVerify={handleMFAComplete}
            onCancel={() => navigate('/login')}
            isLoading={false}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>SSO Authentication</CardTitle>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
};

// MFA Verification Component
interface MFAVerificationProps {
  provider: string;
  onVerify: (code: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const MFAVerification: React.FC<MFAVerificationProps> = ({
  provider,
  onVerify,
  onCancel,
  isLoading
}) => {
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mfaCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    setError(null);
    onVerify(mfaCode);
  };

  return (
    <div className="flex flex-col items-center space-y-6 text-center py-4">
      <AlertTriangle className="w-12 h-12 text-yellow-500" />
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Multi-Factor Authentication Required</h3>
        <p className="text-sm text-muted-foreground">
          Your {provider} account requires additional verification.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <label htmlFor="mfa-code" className="text-sm font-medium">
            Enter 6-digit verification code
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="w-full px-3 py-2 border border-input rounded-md text-center text-lg font-mono tracking-widest"
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
            disabled={isLoading}
          />
        </div>

        <div className="flex space-x-3 pt-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={mfaCode.length !== 6 || isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Verify
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SSOCallback;