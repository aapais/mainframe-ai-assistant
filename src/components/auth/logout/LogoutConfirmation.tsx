import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../ui/Dialog';
import { Button } from '../../ui/Button';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Checkbox } from '../../ui/Checkbox';
import { 
  LogOut, 
  AlertTriangle, 
  Monitor, 
  Smartphone,
  Shield,
  Clock,
  CheckCircle
} from 'lucide-react';

export interface LogoutConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  className?: string;
}

export const LogoutConfirmation: React.FC<LogoutConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  className
}) => {
  const { logout, user, getSessions } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [revokeAllSessions, setRevokeAllSessions] = useState(false);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSessionCount();
    }
  }, [isOpen]);

  const loadSessionCount = async () => {
    try {
      const sessions = await getSessions();
      setSessionCount(sessions.filter(session => session.isActive).length);
    } catch (err) {
      console.error('Failed to load session count:', err);
    }
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setError(null);

      if (revokeAllSessions) {
        // First revoke all other sessions
        const sessions = await getSessions();
        const currentSessionId = localStorage.getItem('session_id');
        const otherSessions = sessions.filter(
          session => session.id !== currentSessionId && session.isActive
        );

        await Promise.all(
          otherSessions.map(session => 
            fetch(`/api/auth/sessions/${session.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              }
            })
          )
        );
      }

      // Then logout from current session
      await logout();
      
      onConfirm?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to logout');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCancel = () => {
    if (!isLoggingOut) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <LogOut className="w-5 h-5" />
            <span>Confirm Logout</span>
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to sign out of your account?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* User Info */}
          {user && (
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          )}

          {/* Session Information */}
          {sessionCount > 1 && (
            <div className="space-y-3">
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  You have {sessionCount} active session{sessionCount !== 1 ? 's' : ''} across different devices.
                </AlertDescription>
              </Alert>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="revoke-all"
                  checked={revokeAllSessions}
                  onCheckedChange={(checked) => setRevokeAllSessions(checked as boolean)}
                  disabled={isLoggingOut}
                />
                <div className="flex-1">
                  <label htmlFor="revoke-all" className="text-sm font-medium cursor-pointer">
                    Sign out from all devices
                  </label>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will end all your active sessions and sign you out from all devices where you're currently logged in.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <Alert>
            <Clock className="w-4 h-4" />
            <AlertDescription>
              For your security, always sign out when using shared or public computers.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoggingOut}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex-1"
            >
              {isLoggingOut ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Signing out...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </div>
              )}
            </Button>
          </div>

          {/* Additional Info */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              You can sign back in anytime using your credentials or SSO provider.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Quick Logout Button Component
export interface QuickLogoutButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  showConfirmation?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const QuickLogoutButton: React.FC<QuickLogoutButtonProps> = ({
  variant = 'outline',
  size = 'md',
  showConfirmation = true,
  className,
  children
}) => {
  const { logout } = useAuth();
  const [showDialog, setShowDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (showConfirmation) {
      setShowDialog(true);
    } else {
      try {
        setIsLoading(true);
        await logout();
      } catch (error) {
        console.error('Logout failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleConfirmLogout = () => {
    setShowDialog(false);
    // The LogoutConfirmation component handles the actual logout
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleLogout}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
        ) : (
          <>
            <LogOut className="w-4 h-4 mr-2" />
            {children || 'Sign Out'}
          </>
        )}
      </Button>

      <LogoutConfirmation
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
};

export default LogoutConfirmation;