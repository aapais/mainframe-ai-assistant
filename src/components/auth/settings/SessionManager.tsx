import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Session } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Alert, AlertDescription } from '../../ui/Alert';
import {
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  Calendar,
  Activity,
  LogOut,
  CheckCircle,
  AlertCircle,
  Shield,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface SessionManagerProps {
  className?: string;
}

const getDeviceIcon = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return Smartphone;
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    return Tablet;
  }
  return Monitor;
};

const getDeviceInfo = (userAgent: string) => {
  const ua = userAgent.toLowerCase();

  let browser = 'Unknown Browser';
  let os = 'Unknown OS';

  // Detect browser
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';

  // Detect OS
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  return { browser, os };
};

const getLocationFromIP = (ipAddress: string) => {
  // In a real implementation, you would use an IP geolocation service
  // For now, return placeholder data
  const locations: Record<string, string> = {
    '127.0.0.1': 'Local Development',
    '::1': 'Local Development',
  };

  return locations[ipAddress] || 'Unknown Location';
};

export const SessionManager: React.FC<SessionManagerProps> = ({ className }) => {
  const { getSessions, revokeSession, user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revokingSession, setRevokingSession] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const sessionsData = await getSessions();
      setSessions(sessionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (
      !confirm(
        'Are you sure you want to revoke this session? You will be logged out from that device.'
      )
    ) {
      return;
    }

    try {
      setRevokingSession(sessionId);
      await revokeSession(sessionId);
      setSessions(prev => prev.filter(session => session.id !== sessionId));
      setSuccess('Session revoked successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setRevokingSession(null);
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    const currentSessionId = localStorage.getItem('session_id'); // Assuming current session ID is stored
    const otherSessions = sessions.filter(session => session.id !== currentSessionId);

    if (otherSessions.length === 0) {
      setError('No other sessions to revoke');
      return;
    }

    if (
      !confirm(
        `Are you sure you want to revoke all other sessions (${otherSessions.length})? This will log you out from all other devices.`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      await Promise.all(otherSessions.map(session => revokeSession(session.id)));
      setSessions(prev => prev.filter(session => session.id === currentSessionId));
      setSuccess(`Successfully revoked ${otherSessions.length} session(s)`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  const isCurrentSession = (session: Session) => {
    // Check if this is the current session by comparing with current user agent or session ID
    const currentSessionId = localStorage.getItem('session_id');
    return session.id === currentSessionId || session.userAgent === navigator.userAgent;
  };

  const getSessionStatus = (session: Session) => {
    if (!session.isActive) {
      return { label: 'Revoked', variant: 'secondary' as const };
    }

    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    if (expiresAt < now) {
      return { label: 'Expired', variant: 'destructive' as const };
    }

    if (isCurrentSession(session)) {
      return { label: 'Current Session', variant: 'default' as const };
    }

    return { label: 'Active', variant: 'secondary' as const };
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center space-x-2'>
                <Shield className='w-5 h-5' />
                <span>Active Sessions</span>
              </CardTitle>
              <p className='text-sm text-muted-foreground mt-1'>
                Manage your active sessions across all devices
              </p>
            </div>
            <div className='flex space-x-2'>
              <Button variant='outline' onClick={loadSessions} disabled={isLoading}>
                <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                variant='destructive'
                onClick={handleRevokeAllOtherSessions}
                disabled={isLoading || sessions.length <= 1}
              >
                <LogOut className='w-4 h-4 mr-2' />
                Revoke All Others
              </Button>
            </div>
          </div>
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
        </CardContent>
      </Card>

      {/* Sessions List */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions ({sessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <div className='text-center'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
                <p className='text-sm text-muted-foreground'>Loading sessions...</p>
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className='text-center py-8'>
              <Shield className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <p className='text-lg font-medium text-muted-foreground mb-2'>No active sessions</p>
              <p className='text-sm text-muted-foreground'>
                You don't have any active sessions at the moment
              </p>
            </div>
          ) : (
            <div className='space-y-4'>
              {sessions.map(session => {
                const deviceInfo = getDeviceInfo(session.userAgent);
                const DeviceIcon = getDeviceIcon(session.userAgent);
                const status = getSessionStatus(session);
                const isCurrent = isCurrentSession(session);

                return (
                  <Card
                    key={session.id}
                    className={cn(
                      'border transition-colors',
                      isCurrent && 'border-primary bg-primary/5'
                    )}
                  >
                    <CardContent className='p-4'>
                      <div className='flex items-start justify-between'>
                        <div className='flex items-start space-x-3'>
                          <div className='p-2 bg-muted rounded-lg'>
                            <DeviceIcon className='w-5 h-5' />
                          </div>

                          <div className='flex-1 space-y-2'>
                            <div className='flex items-center space-x-2'>
                              <h4 className='font-medium'>
                                {deviceInfo.browser} on {deviceInfo.os}
                              </h4>
                              <Badge variant={status.variant}>{status.label}</Badge>
                              {isCurrent && (
                                <Badge variant='outline' className='text-xs'>
                                  This device
                                </Badge>
                              )}
                            </div>

                            <div className='space-y-1 text-sm text-muted-foreground'>
                              <div className='flex items-center space-x-4'>
                                <div className='flex items-center space-x-1'>
                                  <MapPin className='w-3 h-3' />
                                  <span>{getLocationFromIP(session.ipAddress)}</span>
                                </div>
                                <div className='flex items-center space-x-1'>
                                  <span>IP: {session.ipAddress}</span>
                                </div>
                              </div>

                              <div className='flex items-center space-x-4'>
                                <div className='flex items-center space-x-1'>
                                  <Calendar className='w-3 h-3' />
                                  <span>
                                    Started{' '}
                                    {formatDate(
                                      new Date(session.expiresAt).getTime() - 24 * 60 * 60 * 1000
                                    )}
                                  </span>
                                </div>
                                <div className='flex items-center space-x-1'>
                                  <Activity className='w-3 h-3' />
                                  <span>Expires {formatDate(session.expiresAt)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className='ml-4'>
                          {!isCurrent && session.isActive && (
                            <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => handleRevokeSession(session.id)}
                              disabled={revokingSession === session.id}
                            >
                              {revokingSession === session.id ? (
                                <div className='animate-spin rounded-full h-3 w-3 border-b-2 border-white' />
                              ) : (
                                <>
                                  <Trash2 className='w-3 h-3 mr-1' />
                                  Revoke
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2'>
            <Shield className='w-5 h-5' />
            <span>Security Tips</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3 text-sm'>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Regularly review your active sessions and revoke any you don't recognize</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Always log out from shared or public computers</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Enable multi-factor authentication for enhanced security</p>
            </div>
            <div className='flex items-start space-x-2'>
              <CheckCircle className='w-4 h-4 text-green-500 mt-0.5 flex-shrink-0' />
              <p>Use unique, strong passwords for your account</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionManager;
