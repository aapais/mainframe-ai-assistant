import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MFASetupData, MFAMethod } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/Dialog';
import {
  Smartphone,
  Mail,
  Key,
  QrCode,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Shield,
  Download,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface MFASetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  className?: string;
}

type SetupStep = 'method' | 'configure' | 'verify' | 'backup' | 'complete';

const mfaMethods = [
  {
    id: 'totp',
    name: 'Authenticator App',
    description: 'Use an app like Google Authenticator, Authy, or 1Password',
    icon: Smartphone,
    recommended: true,
  },
  {
    id: 'sms',
    name: 'SMS Text Message',
    description: 'Receive codes via SMS to your phone number',
    icon: Smartphone,
    recommended: false,
  },
  {
    id: 'email',
    name: 'Email',
    description: 'Receive codes via email (backup method only)',
    icon: Mail,
    recommended: false,
  },
];

export const MFASetupWizard: React.FC<MFASetupWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
  className,
}) => {
  const { setupMFA } = useAuth();
  const [currentStep, setCurrentStep] = useState<SetupStep>('method');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [setupData, setSetupData] = useState<Partial<MFASetupData>>({});
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [manualKey, setManualKey] = useState<string>('');
  const [copiedCodes, setCopiedCodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) {
      resetWizard();
    }
  }, [isOpen]);

  const resetWizard = () => {
    setCurrentStep('method');
    setSelectedMethod('');
    setSetupData({});
    setVerificationCode('');
    setPhoneNumber('');
    setBackupCodes([]);
    setError(null);
    setQrCodeUrl('');
    setManualKey('');
    setCopiedCodes(new Set());
  };

  const handleMethodSelect = (methodId: string) => {
    setSelectedMethod(methodId);
    setError(null);
  };

  const handleNextStep = async () => {
    setError(null);

    switch (currentStep) {
      case 'method':
        if (!selectedMethod) {
          setError('Please select an MFA method');
          return;
        }
        setCurrentStep('configure');
        if (selectedMethod === 'totp') {
          await generateTOTPSecret();
        }
        break;

      case 'configure':
        if (selectedMethod === 'sms' && !phoneNumber.trim()) {
          setError('Please enter your phone number');
          return;
        }
        setCurrentStep('verify');
        if (selectedMethod === 'sms' || selectedMethod === 'email') {
          await sendVerificationCode();
        }
        break;

      case 'verify':
        if (!verificationCode.trim()) {
          setError('Please enter the verification code');
          return;
        }
        await verifyAndSetupMFA();
        break;

      case 'backup':
        setCurrentStep('complete');
        break;

      case 'complete':
        onComplete();
        onClose();
        break;
    }
  };

  const handlePreviousStep = () => {
    switch (currentStep) {
      case 'configure':
        setCurrentStep('method');
        break;
      case 'verify':
        setCurrentStep('configure');
        break;
      case 'backup':
        setCurrentStep('verify');
        break;
      case 'complete':
        setCurrentStep('backup');
        break;
    }
  };

  const generateTOTPSecret = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/mfa/totp/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate TOTP secret');
      }

      const data = await response.json();
      setQrCodeUrl(data.qrCode);
      setManualKey(data.secret);
      setSetupData(prev => ({ ...prev, secret: data.secret }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate TOTP secret');
    } finally {
      setIsLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/mfa/send-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          method: selectedMethod,
          phoneNumber: phoneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyAndSetupMFA = async () => {
    try {
      setIsLoading(true);

      const mfaData: MFASetupData = {
        method: selectedMethod as 'totp' | 'sms' | 'email',
        ...(selectedMethod === 'sms' && { phoneNumber }),
        ...(selectedMethod === 'totp' && { secret: setupData.secret }),
      };

      // First verify the code
      const verifyResponse = await fetch('/api/auth/mfa/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          ...mfaData,
          code: verificationCode,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error('Invalid verification code');
      }

      // Then setup MFA
      await setupMFA(mfaData);

      // Generate backup codes
      const backupResponse = await fetch('/api/auth/mfa/backup-codes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (backupResponse.ok) {
        const { codes } = await backupResponse.json();
        setBackupCodes(codes);
        setCurrentStep('backup');
      } else {
        setCurrentStep('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, codeId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (codeId) {
        setCopiedCodes(prev => new Set([...prev, codeId]));
        setTimeout(() => {
          setCopiedCodes(prev => {
            const newSet = new Set(prev);
            newSet.delete(codeId);
            return newSet;
          });
        }, 2000);
      }
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const downloadBackupCodes = () => {
    const content = `Backup Codes for Multi-Factor Authentication\n\n${backupCodes
      .map((code, index) => `${index + 1}. ${code}`)
      .join(
        '\n'
      )}\n\nIMPORTANT:\n- Store these codes in a safe place\n- Each code can only be used once\n- Use these codes if you lose access to your primary MFA method\n\nGenerated on: ${new Date().toLocaleString()}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStepContent = () => {
    switch (currentStep) {
      case 'method':
        return (
          <div className='space-y-6'>
            <div className='text-center'>
              <h3 className='text-lg font-medium mb-2'>Choose Your MFA Method</h3>
              <p className='text-sm text-muted-foreground'>
                Select how you'd like to receive verification codes
              </p>
            </div>

            <div className='space-y-3'>
              {mfaMethods.map(method => {
                const IconComponent = method.icon;
                return (
                  <div
                    key={method.id}
                    className={cn(
                      'flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors',
                      selectedMethod === method.id
                        ? 'border-primary bg-primary/5'
                        : 'border-input hover:bg-muted'
                    )}
                    onClick={() => handleMethodSelect(method.id)}
                  >
                    <IconComponent className='w-5 h-5' />
                    <div className='flex-1'>
                      <div className='flex items-center space-x-2'>
                        <h4 className='font-medium'>{method.name}</h4>
                        {method.recommended && (
                          <Badge variant='secondary' className='text-xs'>
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className='text-sm text-muted-foreground'>{method.description}</p>
                    </div>
                    {selectedMethod === method.id && <Check className='w-5 h-5 text-primary' />}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'configure':
        if (selectedMethod === 'totp') {
          return (
            <div className='space-y-6'>
              <div className='text-center'>
                <h3 className='text-lg font-medium mb-2'>Set Up Authenticator App</h3>
                <p className='text-sm text-muted-foreground'>
                  Scan the QR code with your authenticator app
                </p>
              </div>

              {isLoading ? (
                <div className='text-center py-8'>
                  <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
                  <p className='text-sm text-muted-foreground'>Generating QR code...</p>
                </div>
              ) : (
                <div className='space-y-6'>
                  <div className='text-center'>
                    <div className='inline-block p-4 bg-white border rounded-lg'>
                      <img src={qrCodeUrl} alt='QR Code' className='w-48 h-48' />
                    </div>
                  </div>

                  <div className='space-y-2'>
                    <p className='text-sm font-medium'>Can't scan? Enter this key manually:</p>
                    <div className='flex items-center space-x-2'>
                      <code className='flex-1 px-3 py-2 bg-muted rounded font-mono text-sm'>
                        {manualKey}
                      </code>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => copyToClipboard(manualKey)}
                      >
                        <Copy className='w-4 h-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        } else if (selectedMethod === 'sms') {
          return (
            <div className='space-y-6'>
              <div className='text-center'>
                <h3 className='text-lg font-medium mb-2'>Enter Your Phone Number</h3>
                <p className='text-sm text-muted-foreground'>
                  We'll send verification codes to this number
                </p>
              </div>

              <div className='space-y-2'>
                <label className='text-sm font-medium'>Phone Number</label>
                <Input
                  type='tel'
                  placeholder='+1 (555) 123-4567'
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  Include your country code (e.g., +1 for US)
                </p>
              </div>
            </div>
          );
        } else {
          return (
            <div className='text-center py-8'>
              <Mail className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <h3 className='text-lg font-medium mb-2'>Email MFA Setup</h3>
              <p className='text-sm text-muted-foreground'>
                We'll send verification codes to your registered email address
              </p>
            </div>
          );
        }

      case 'verify':
        return (
          <div className='space-y-6'>
            <div className='text-center'>
              <h3 className='text-lg font-medium mb-2'>Enter Verification Code</h3>
              <p className='text-sm text-muted-foreground'>
                {selectedMethod === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app'
                  : selectedMethod === 'sms'
                    ? 'Enter the code sent to your phone'
                    : 'Enter the code sent to your email'}
              </p>
            </div>

            <div className='space-y-4'>
              <div className='space-y-2'>
                <label className='text-sm font-medium'>Verification Code</label>
                <Input
                  type='text'
                  inputMode='numeric'
                  pattern='[0-9]{6}'
                  maxLength={6}
                  className='text-center text-lg font-mono tracking-widest'
                  placeholder='000000'
                  value={verificationCode}
                  onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              {(selectedMethod === 'sms' || selectedMethod === 'email') && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={sendVerificationCode}
                  disabled={isLoading}
                  className='w-full'
                >
                  Resend Code
                </Button>
              )}
            </div>
          </div>
        );

      case 'backup':
        return (
          <div className='space-y-6'>
            <div className='text-center'>
              <h3 className='text-lg font-medium mb-2'>Save Your Backup Codes</h3>
              <p className='text-sm text-muted-foreground'>
                Store these codes in a safe place. You can use them to access your account if you
                lose your phone.
              </p>
            </div>

            <Alert>
              <AlertTriangle className='w-4 h-4' />
              <AlertDescription>
                Each backup code can only be used once. Generate new codes if you run out.
              </AlertDescription>
            </Alert>

            <div className='space-y-3'>
              {backupCodes.map((code, index) => (
                <div key={code} className='flex items-center justify-between p-3 bg-muted rounded'>
                  <span className='font-mono'>{code}</span>
                  <Button variant='ghost' size='sm' onClick={() => copyToClipboard(code, code)}>
                    {copiedCodes.has(code) ? (
                      <Check className='w-4 h-4 text-green-600' />
                    ) : (
                      <Copy className='w-4 h-4' />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <Button variant='outline' onClick={downloadBackupCodes} className='w-full'>
              <Download className='w-4 h-4 mr-2' />
              Download Backup Codes
            </Button>
          </div>
        );

      case 'complete':
        return (
          <div className='text-center space-y-6'>
            <div className='mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center'>
              <CheckCircle className='w-8 h-8 text-green-600' />
            </div>
            <div>
              <h3 className='text-lg font-medium mb-2'>MFA Setup Complete!</h3>
              <p className='text-sm text-muted-foreground'>
                Your account is now protected with multi-factor authentication.
              </p>
            </div>
            <Alert className='border-green-200 bg-green-50 text-green-800'>
              <Shield className='w-4 h-4' />
              <AlertDescription>
                Your account security has been significantly improved. You'll be asked for
                verification codes when signing in from new devices.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepProgress = () => {
    const steps: SetupStep[] = ['method', 'configure', 'verify', 'backup', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center space-x-2'>
            <Shield className='w-5 h-5' />
            <span>Setup Multi-Factor Authentication</span>
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Progress Bar */}
          <div className='space-y-2'>
            <div className='flex justify-between text-xs text-muted-foreground'>
              <span>
                Step{' '}
                {['method', 'configure', 'verify', 'backup', 'complete'].indexOf(currentStep) + 1}{' '}
                of 5
              </span>
              <span>{Math.round(getStepProgress())}%</span>
            </div>
            <div className='w-full bg-muted rounded-full h-2'>
              <div
                className='bg-primary h-2 rounded-full transition-all duration-300'
                style={{ width: `${getStepProgress()}%` }}
              />
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant='destructive'>
              <AlertTriangle className='w-4 h-4' />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step Content */}
          {getStepContent()}

          {/* Navigation Buttons */}
          <div className='flex space-x-2 pt-4'>
            {currentStep !== 'method' && currentStep !== 'complete' && (
              <Button variant='outline' onClick={handlePreviousStep} disabled={isLoading}>
                <ArrowLeft className='w-4 h-4 mr-1' />
                Back
              </Button>
            )}

            <Button
              onClick={handleNextStep}
              disabled={
                isLoading ||
                (currentStep === 'method' && !selectedMethod) ||
                (currentStep === 'configure' && selectedMethod === 'sms' && !phoneNumber.trim()) ||
                (currentStep === 'verify' && !verificationCode.trim())
              }
              className='flex-1'
            >
              {isLoading ? (
                'Processing...'
              ) : currentStep === 'complete' ? (
                'Finish'
              ) : (
                <>
                  {currentStep === 'verify' ? 'Verify & Enable' : 'Continue'}
                  <ArrowRight className='w-4 h-4 ml-1' />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MFASetupWizard;
