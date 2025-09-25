import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SSOProvider, LoginFormData } from '../types/auth.types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Loader2, Eye, EyeOff, Shield, Mail, Lock } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface LoginPageProps {
  redirectTo?: string;
  onSuccess?: () => void;
  className?: string;
}

const providerIcons: Record<string, React.ComponentType<any>> = {
  google: () => (
    <svg className='w-5 h-5' viewBox='0 0 24 24'>
      <path
        fill='#4285F4'
        d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
      />
      <path
        fill='#34A853'
        d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
      />
      <path
        fill='#FBBC05'
        d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
      />
      <path
        fill='#EA4335'
        d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
      />
    </svg>
  ),
  microsoft: () => (
    <svg className='w-5 h-5' viewBox='0 0 24 24'>
      <path fill='#f25022' d='M1 1h10v10H1z' />
      <path fill='#00a4ef' d='M13 1h10v10H13z' />
      <path fill='#7fba00' d='M1 13h10v10H1z' />
      <path fill='#ffb900' d='M13 13h10v10H13z' />
    </svg>
  ),
  github: () => (
    <svg className='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
    </svg>
  ),
  okta: () => (
    <svg className='w-5 h-5' viewBox='0 0 24 24' fill='currentColor'>
      <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' />
      <circle cx='12' cy='12' r='3' />
    </svg>
  ),
  saml: () => <Shield className='w-5 h-5' />,
};

export const LoginPage: React.FC<LoginPageProps> = ({ redirectTo, onSuccess, className }) => {
  const { login, providers, isLoading, error } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'sso' | 'credentials'>('sso');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSSOLogin = async (provider: SSOProvider) => {
    if (provider.type === 'saml' || provider.type === 'okta') {
      // Redirect to SSO provider
      window.location.href = `/api/auth/sso/${provider.id}?redirect=${encodeURIComponent(redirectTo || '/')}`;
    } else {
      try {
        setIsSubmitting(true);
        await login({ provider: provider.id });
        onSuccess?.();
      } catch (error) {
        console.error('SSO login failed:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      return;
    }

    try {
      setIsSubmitting(true);
      await login(formData);
      onSuccess?.();
    } catch (error) {
      console.error('Credentials login failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='flex flex-col items-center space-y-4'>
          <Loader2 className='w-8 h-8 animate-spin' />
          <p className='text-sm text-muted-foreground'>Loading authentication...</p>
        </div>
      </div>
    );
  }

  const enabledProviders = providers.filter(p => p.enabled);

  return (
    <div
      className={cn('flex items-center justify-center min-h-screen bg-background p-4', className)}
    >
      <Card className='w-full max-w-md'>
        <CardHeader className='space-y-1 text-center'>
          <CardTitle className='text-2xl font-bold'>Sign In</CardTitle>
          <p className='text-sm text-muted-foreground'>Choose your preferred sign-in method</p>
        </CardHeader>
        <CardContent className='space-y-6'>
          {error && (
            <Alert variant='destructive'>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Mode Toggle */}
          <div className='flex space-x-1 p-1 bg-muted rounded-lg'>
            <button
              onClick={() => setLoginMode('sso')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                loginMode === 'sso'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              SSO Login
            </button>
            <button
              onClick={() => setLoginMode('credentials')}
              className={cn(
                'flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                loginMode === 'credentials'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Email & Password
            </button>
          </div>

          {loginMode === 'sso' ? (
            <div className='space-y-3'>
              {enabledProviders.length > 0 ? (
                enabledProviders.map(provider => {
                  const IconComponent = providerIcons[provider.type] || Shield;
                  return (
                    <Button
                      key={provider.id}
                      variant='outline'
                      className='w-full justify-start space-x-3 h-11'
                      onClick={() => handleSSOLogin(provider)}
                      disabled={isSubmitting}
                    >
                      <IconComponent />
                      <span>Continue with {provider.name}</span>
                    </Button>
                  );
                })
              ) : (
                <Alert>
                  <AlertDescription>
                    No SSO providers are currently configured. Please contact your administrator.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <form onSubmit={handleCredentialsLogin} className='space-y-4'>
              <div className='space-y-2'>
                <label htmlFor='email' className='text-sm font-medium'>
                  Email
                </label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                  <Input
                    id='email'
                    name='email'
                    type='email'
                    autoComplete='email'
                    required
                    className='pl-10'
                    placeholder='Enter your email'
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className='space-y-2'>
                <label htmlFor='password' className='text-sm font-medium'>
                  Password
                </label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                  <Input
                    id='password'
                    name='password'
                    type={showPassword ? 'text' : 'password'}
                    autoComplete='current-password'
                    required
                    className='pl-10 pr-10'
                    placeholder='Enter your password'
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                  <button
                    type='button'
                    className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                  </button>
                </div>
              </div>

              <div className='flex items-center space-x-2'>
                <input
                  id='rememberMe'
                  name='rememberMe'
                  type='checkbox'
                  className='rounded border-gray-300'
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                />
                <label htmlFor='rememberMe' className='text-sm text-muted-foreground'>
                  Remember me for 30 days
                </label>
              </div>

              <Button
                type='submit'
                className='w-full'
                disabled={isSubmitting || !formData.email || !formData.password}
              >
                {isSubmitting && <Loader2 className='w-4 h-4 mr-2 animate-spin' />}
                Sign In
              </Button>
            </form>
          )}

          <div className='text-center space-y-2'>
            <a
              href='/forgot-password'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              Forgot your password?
            </a>
            <div className='text-sm text-muted-foreground'>
              Don't have an account?{' '}
              <a href='/register' className='text-primary hover:underline'>
                Sign up
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
