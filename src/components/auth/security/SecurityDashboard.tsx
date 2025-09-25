import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { SecurityEvent, User } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Progress } from '../../ui/Progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Key, 
  Smartphone,
  Activity,
  Lock,
  Unlock,
  UserCheck,
  Calendar,
  MapPin,
  RefreshCw,
  Settings,
  Eye,
  Download
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface SecurityDashboardProps {
  className?: string;
}

const severityColors = {
  low: 'text-blue-600 bg-blue-50 border-blue-200',
  medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  high: 'text-orange-600 bg-orange-50 border-orange-200',
  critical: 'text-red-600 bg-red-50 border-red-200'
};

const eventTypeIcons = {
  login: Activity,
  logout: Activity,
  password_change: Lock,
  mfa_setup: Smartphone,
  api_key_created: Key,
  suspicious_activity: AlertTriangle
};

interface SecurityScore {
  score: number;
  factors: {
    mfa: { enabled: boolean; score: number; weight: number };
    passwordStrength: { score: number; weight: number };
    recentActivity: { score: number; weight: number };
    accountAge: { score: number; weight: number };
    emailVerified: { enabled: boolean; score: number; weight: number };
  };
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({ className }) => {
  const { user, getSecurityEvents } = useAuth();
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>('7d');

  useEffect(() => {
    loadSecurityData();
  }, [selectedTimeRange]);

  const loadSecurityData = async () => {
    try {
      setIsLoading(true);
      const [events, score] = await Promise.all([
        getSecurityEvents(),
        calculateSecurityScore()
      ]);
      
      setSecurityEvents(events);
      setSecurityScore(score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load security data');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSecurityScore = async (): Promise<SecurityScore> => {
    if (!user) {
      throw new Error('User not available');
    }

    const factors = {
      mfa: {
        enabled: user.mfaEnabled,
        score: user.mfaEnabled ? 100 : 0,
        weight: 0.3
      },
      passwordStrength: {
        score: 85, // Would be calculated based on password complexity
        weight: 0.2
      },
      recentActivity: {
        score: 90, // Based on recent login patterns
        weight: 0.2
      },
      accountAge: {
        score: Math.min(100, Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365) * 20)), // 20 points per year, max 100
        weight: 0.1
      },
      emailVerified: {
        enabled: user.emailVerified,
        score: user.emailVerified ? 100 : 0,
        weight: 0.2
      }
    };

    const totalScore = Object.values(factors).reduce((sum, factor) => {
      return sum + (factor.score * factor.weight);
    }, 0);

    return {
      score: Math.round(totalScore),
      factors
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportSecurityReport = async () => {
    try {
      const response = await fetch('/api/auth/security/report', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate security report');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export security report');
    }
  };

  const filteredEvents = securityEvents.filter(event => {
    const eventDate = new Date(event.createdAt);
    const now = new Date();
    
    switch (selectedTimeRange) {
      case '24h':
        return eventDate.getTime() > now.getTime() - 24 * 60 * 60 * 1000;
      case '7d':
        return eventDate.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return eventDate.getTime() > now.getTime() - 30 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  });

  const criticalEvents = filteredEvents.filter(event => event.severity === 'critical' || event.severity === 'high');

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Security Dashboard</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor your account security and recent activity
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={loadSecurityData} disabled={isLoading}>
                <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                Refresh
              </Button>
              <Button variant="outline" onClick={exportSecurityReport}>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Security Score */}
      {securityScore && (
        <Card>
          <CardHeader>
            <CardTitle>Security Score</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your overall security posture based on various factors
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="none"
                      className="text-muted-foreground opacity-20"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray={`${(securityScore.score / 100) * 251.2} 251.2`}
                      className={getScoreColor(securityScore.score)}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className={cn("text-2xl font-bold", getScoreColor(securityScore.score))}>
                        {securityScore.score}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getScoreLabel(securityScore.score)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3">
                {Object.entries(securityScore.factors).map(([key, factor]) => {
                  const label = {
                    mfa: 'Multi-Factor Authentication',
                    passwordStrength: 'Password Strength',
                    recentActivity: 'Recent Activity',
                    accountAge: 'Account Age',
                    emailVerified: 'Email Verification'
                  }[key] || key;

                  return (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm">{label}</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24">
                          <Progress value={factor.score} className="h-2" />
                        </div>
                        <span className="text-sm font-medium w-10">{factor.score}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Critical Alerts */}
      {criticalEvents.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                You have {criticalEvents.length} critical security alert{criticalEvents.length !== 1 ? 's' : ''} requiring attention
              </span>
              <Button size="sm" variant="outline">
                <Eye className="w-3 h-3 mr-1" />
                Review
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Security Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Security Events</CardTitle>
            <div className="flex items-center space-x-2">
              <select
                value={selectedTimeRange}
                onChange={(e) => setSelectedTimeRange(e.target.value)}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Events</TabsTrigger>
              <TabsTrigger value="logins">Logins</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="suspicious">Suspicious</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="space-y-4 mt-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">No events found</p>
                  <p className="text-sm text-muted-foreground">
                    No security events in the selected time range
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => {
                    const IconComponent = eventTypeIcons[event.type] || Activity;
                    return (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className={cn(
                          "p-2 rounded-lg",
                          severityColors[event.severity]
                        )}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{event.description}</h4>
                            <Badge variant={event.severity === 'critical' || event.severity === 'high' ? 'destructive' : 'secondary'}>
                              {event.severity}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(event.createdAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{event.ipAddress}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="logins">
              {/* Login events only */}
              <div className="space-y-3">
                {filteredEvents
                  .filter(event => event.type === 'login' || event.type === 'logout')
                  .map((event) => {
                    const IconComponent = eventTypeIcons[event.type];
                    return (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <IconComponent className="w-4 h-4 text-blue-600" />
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium">{event.description}</h4>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                            <span>{formatDate(event.createdAt)}</span>
                            <span>{event.ipAddress}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </TabsContent>
            
            <TabsContent value="security">
              {/* Security-related events */}
              <div className="space-y-3">
                {filteredEvents
                  .filter(event => event.type === 'password_change' || event.type === 'mfa_setup')
                  .map((event) => {
                    const IconComponent = eventTypeIcons[event.type];
                    return (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <IconComponent className="w-4 h-4 text-green-600" />
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium">{event.description}</h4>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                            <span>{formatDate(event.createdAt)}</span>
                            <span>{event.ipAddress}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </TabsContent>
            
            <TabsContent value="suspicious">
              {/* Suspicious activities */}
              <div className="space-y-3">
                {filteredEvents
                  .filter(event => event.type === 'suspicious_activity' || event.severity === 'high' || event.severity === 'critical')
                  .map((event) => {
                    const IconComponent = eventTypeIcons[event.type] || AlertTriangle;
                    return (
                      <div key={event.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <div className="p-2 bg-red-50 rounded-lg">
                          <IconComponent className="w-4 h-4 text-red-600" />
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-medium">{event.description}</h4>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              <span>{formatDate(event.createdAt)}</span>
                              <span>{event.ipAddress}</span>
                            </div>
                            <Badge variant="destructive">
                              {event.severity}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityDashboard;