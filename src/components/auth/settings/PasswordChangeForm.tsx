import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { PasswordChangeData } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Progress } from '../../ui/Progress';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Shield, Key } from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface PasswordChangeFormProps {
  className?: string;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  label: string;
  color: string;
}

const calculatePasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  const feedback: string[] = [];

  // Length check
  if (password.length >= 8) {
    score += 25;
  } else {
    feedback.push('Use at least 8 characters');
  }

  // Uppercase check
  if (/[A-Z]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Include uppercase letters');
  }

  // Lowercase check
  if (/[a-z]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Include lowercase letters');
  }

  // Number check
  if (/\d/.test(password)) {
    score += 20;
  } else {
    feedback.push('Include numbers');
  }

  // Special character check
  if (/[^\w\s]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Include special characters');
  }

  let label: string;
  let color: string;

  if (score >= 80) {
    label = 'Strong';
    color = 'text-green-600';
  } else if (score >= 60) {
    label = 'Good';
    color = 'text-yellow-600';
  } else if (score >= 40) {
    label = 'Fair';
    color = 'text-orange-600';
  } else {
    label = 'Weak';
    color = 'text-red-600';
  }

  return { score, feedback, label, color };
};

export const PasswordChangeForm: React.FC<PasswordChangeFormProps> = ({ className }) => {
  const { changePassword } = useAuth();
  const [formData, setFormData] = useState<PasswordChangeData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  const handleInputChange = (field: keyof PasswordChangeData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);

    // Calculate password strength for new password
    if (field === 'newPassword') {
      if (value) {
        setPasswordStrength(calculatePasswordStrength(value));
      } else {
        setPasswordStrength(null);
      }
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.currentPassword) {
      setError('Current password is required');
      return false;
    }

    if (!formData.newPassword) {
      setError('New password is required');
      return false;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return false;
    }

    if (formData.newPassword === formData.currentPassword) {
      setError('New password must be different from current password');
      return false;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('New password and confirmation do not match');
      return false;
    }

    if (passwordStrength && passwordStrength.score < 60) {
      setError('Please use a stronger password');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await changePassword(formData);

      setSuccess('Password changed successfully');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordStrength(null);

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.currentPassword &&
      formData.newPassword &&
      formData.confirmPassword &&
      formData.newPassword === formData.confirmPassword &&
      passwordStrength &&
      passwordStrength.score >= 60
    );
  };

  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2'>
            <Key className='w-5 h-5' />
            <span>Change Password</span>
          </CardTitle>
          <p className='text-sm text-muted-foreground'>
            Update your password to keep your account secure
          </p>
        </CardHeader>
        <CardContent>
          {/* Alert Messages */}
          {error && (
            <Alert variant='destructive' className='mb-4'>
              <AlertCircle className='w-4 h-4' />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className='border-green-200 bg-green-50 text-green-800 mb-4'>
              <CheckCircle className='w-4 h-4' />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className='space-y-4'>
            {/* Current Password */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Current Password</label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <Input
                  type={showPasswords.current ? 'text' : 'password'}
                  className='pl-10 pr-10'
                  placeholder='Enter your current password'
                  value={formData.currentPassword}
                  onChange={e => handleInputChange('currentPassword', e.target.value)}
                  required
                />
                <button
                  type='button'
                  className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  onClick={() => togglePasswordVisibility('current')}
                >
                  {showPasswords.current ? (
                    <EyeOff className='w-4 h-4' />
                  ) : (
                    <Eye className='w-4 h-4' />
                  )}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>New Password</label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <Input
                  type={showPasswords.new ? 'text' : 'password'}
                  className='pl-10 pr-10'
                  placeholder='Enter your new password'
                  value={formData.newPassword}
                  onChange={e => handleInputChange('newPassword', e.target.value)}
                  required
                />
                <button
                  type='button'
                  className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  onClick={() => togglePasswordVisibility('new')}
                >
                  {showPasswords.new ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {passwordStrength && (
                <div className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs text-muted-foreground'>Password strength:</span>
                    <span className={cn('text-xs font-medium', passwordStrength.color)}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <Progress value={passwordStrength.score} className='h-2' />

                  {passwordStrength.feedback.length > 0 && (
                    <div className='space-y-1'>
                      {passwordStrength.feedback.map((item, index) => (
                        <p
                          key={index}
                          className='text-xs text-muted-foreground flex items-center space-x-1'
                        >
                          <span className='w-1 h-1 bg-muted-foreground rounded-full' />
                          <span>{item}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Confirm New Password</label>
              <div className='relative'>
                <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                <Input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  className={cn(
                    'pl-10 pr-10',
                    formData.confirmPassword && formData.newPassword !== formData.confirmPassword
                      ? 'border-red-300 focus:border-red-500'
                      : formData.confirmPassword &&
                          formData.newPassword === formData.confirmPassword
                        ? 'border-green-300 focus:border-green-500'
                        : ''
                  )}
                  placeholder='Confirm your new password'
                  value={formData.confirmPassword}
                  onChange={e => handleInputChange('confirmPassword', e.target.value)}
                  required
                />
                <button
                  type='button'
                  className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  onClick={() => togglePasswordVisibility('confirm')}
                >
                  {showPasswords.confirm ? (
                    <EyeOff className='w-4 h-4' />
                  ) : (
                    <Eye className='w-4 h-4' />
                  )}
                </button>
              </div>

              {/* Password Match Indicator */}
              {formData.confirmPassword && (
                <div className='flex items-center space-x-2 text-xs'>
                  {formData.newPassword === formData.confirmPassword ? (
                    <>
                      <CheckCircle className='w-3 h-3 text-green-600' />
                      <span className='text-green-600'>Passwords match</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className='w-3 h-3 text-red-600' />
                      <span className='text-red-600'>Passwords do not match</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button type='submit' className='w-full' disabled={isLoading || !isFormValid()}>
              {isLoading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2'>
            <Shield className='w-5 h-5' />
            <span>Password Security Tips</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3 text-sm'>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Use at least 12 characters with a mix of letters, numbers, and symbols</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Avoid using personal information like names, birthdays, or addresses</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Don't reuse passwords from other accounts</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Consider using a password manager to generate and store strong passwords</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Enable multi-factor authentication for additional security</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordChangeForm;
