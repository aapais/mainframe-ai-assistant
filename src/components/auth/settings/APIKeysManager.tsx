import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { APIKey } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../ui/Dialog';
import { Checkbox } from '../../ui/Checkbox';
import {
  Key,
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Calendar,
  Activity,
  Shield,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface APIKeysManagerProps {
  className?: string;
}

const permissions = [
  { id: 'read', label: 'Read Access', description: 'View data and resources' },
  { id: 'write', label: 'Write Access', description: 'Create and modify data' },
  { id: 'delete', label: 'Delete Access', description: 'Remove data and resources' },
  { id: 'admin', label: 'Admin Access', description: 'Full administrative privileges' },
  { id: 'api', label: 'API Access', description: 'Use REST API endpoints' },
  { id: 'webhook', label: 'Webhook Access', description: 'Create and manage webhooks' },
];

export const APIKeysManager: React.FC<APIKeysManagerProps> = ({ className }) => {
  const { createAPIKey, revokeAPIKey } = useAuth();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyData, setNewKeyData] = useState({ name: '', permissions: [] as string[] });
  const [createdKey, setCreatedKey] = useState<APIKey | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/api-keys', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });

      if (response.ok) {
        const keys = await response.json();
        setApiKeys(keys);
      } else {
        throw new Error('Failed to load API keys');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyData.name.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    if (newKeyData.permissions.length === 0) {
      setError('Please select at least one permission');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const key = await createAPIKey(newKeyData.name.trim(), newKeyData.permissions);
      setCreatedKey(key);
      setApiKeys(prev => [...prev, key]);
      setSuccess('API key created successfully');

      // Reset form
      setNewKeyData({ name: '', permissions: [] });

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await revokeAPIKey(keyId);
      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      setSuccess('API key revoked successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key');
    }
  };

  const handleToggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setSuccess('API key copied to clipboard');
      setTimeout(() => setSuccess(null), 2000);
    } catch {
      setError('Failed to copy to clipboard');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setNewKeyData(prev => ({
      ...prev,
      permissions: checked
        ? [...prev.permissions, permissionId]
        : prev.permissions.filter(p => p !== permissionId),
    }));
  };

  const maskKey = (key: string) => {
    return key.slice(0, 8) + '...' + key.slice(-4);
  };

  const getStatusBadge = (key: APIKey) => {
    if (!key.isActive) {
      return <Badge variant='secondary'>Revoked</Badge>;
    }
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      return <Badge variant='destructive'>Expired</Badge>;
    }
    return <Badge variant='default'>Active</Badge>;
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center space-x-2'>
                <Key className='w-5 h-5' />
                <span>API Keys</span>
              </CardTitle>
              <p className='text-sm text-muted-foreground mt-1'>
                Manage your API keys for programmatic access
              </p>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className='w-4 h-4 mr-2' />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent className='sm:max-w-md'>
                <DialogHeader>
                  <DialogTitle>Create New API Key</DialogTitle>
                </DialogHeader>
                <div className='space-y-4'>
                  <div className='space-y-2'>
                    <label className='text-sm font-medium'>Key Name</label>
                    <Input
                      placeholder='Enter a descriptive name'
                      value={newKeyData.name}
                      onChange={e => setNewKeyData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className='space-y-3'>
                    <label className='text-sm font-medium'>Permissions</label>
                    <div className='space-y-3'>
                      {permissions.map(permission => (
                        <div key={permission.id} className='flex items-start space-x-3'>
                          <Checkbox
                            id={permission.id}
                            checked={newKeyData.permissions.includes(permission.id)}
                            onCheckedChange={checked =>
                              handlePermissionChange(permission.id, checked as boolean)
                            }
                          />
                          <div className='flex-1'>
                            <label
                              htmlFor={permission.id}
                              className='text-sm font-medium cursor-pointer'
                            >
                              {permission.label}
                            </label>
                            <p className='text-xs text-muted-foreground'>
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className='flex space-x-2 pt-4'>
                    <Button
                      variant='outline'
                      className='flex-1'
                      onClick={() => setShowCreateDialog(false)}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      className='flex-1'
                      onClick={handleCreateKey}
                      disabled={
                        isCreating || !newKeyData.name.trim() || newKeyData.permissions.length === 0
                      }
                    >
                      {isCreating ? 'Creating...' : 'Create Key'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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

          {/* New Key Display */}
          {createdKey && (
            <Alert className='mb-4 border-blue-200 bg-blue-50'>
              <Shield className='w-4 h-4' />
              <AlertDescription>
                <div className='space-y-2'>
                  <p className='font-medium text-blue-800'>Your new API key has been created!</p>
                  <div className='flex items-center space-x-2'>
                    <code className='flex-1 px-2 py-1 bg-white rounded text-sm font-mono'>
                      {createdKey.key}
                    </code>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleCopyKey(createdKey.key)}
                    >
                      <Copy className='w-3 h-3' />
                    </Button>
                  </div>
                  <p className='text-xs text-blue-600'>
                    <AlertTriangle className='w-3 h-3 inline mr-1' />
                    Make sure to copy this key now. You won't be able to see it again.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys ({apiKeys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='flex items-center justify-center py-8'>
              <div className='text-center'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
                <p className='text-sm text-muted-foreground'>Loading API keys...</p>
              </div>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className='text-center py-8'>
              <Key className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
              <p className='text-lg font-medium text-muted-foreground mb-2'>No API keys yet</p>
              <p className='text-sm text-muted-foreground mb-4'>
                Create your first API key to start using our programmatic access
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className='w-4 h-4 mr-2' />
                Create API Key
              </Button>
            </div>
          ) : (
            <div className='space-y-4'>
              {apiKeys.map(key => (
                <Card key={key.id} className='border'>
                  <CardContent className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1 space-y-3'>
                        <div className='flex items-center space-x-3'>
                          <h4 className='font-medium'>{key.name}</h4>
                          {getStatusBadge(key)}
                        </div>

                        <div className='flex items-center space-x-2'>
                          <code className='px-2 py-1 bg-muted rounded text-sm font-mono'>
                            {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                          </code>
                          <Button
                            size='sm'
                            variant='ghost'
                            onClick={() => handleToggleKeyVisibility(key.id)}
                          >
                            {visibleKeys.has(key.id) ? (
                              <EyeOff className='w-3 h-3' />
                            ) : (
                              <Eye className='w-3 h-3' />
                            )}
                          </Button>
                          <Button size='sm' variant='ghost' onClick={() => handleCopyKey(key.key)}>
                            <Copy className='w-3 h-3' />
                          </Button>
                        </div>

                        <div className='flex flex-wrap gap-1'>
                          {key.permissions.map(permission => (
                            <Badge key={permission} variant='secondary' className='text-xs'>
                              {permissions.find(p => p.id === permission)?.label || permission}
                            </Badge>
                          ))}
                        </div>

                        <div className='flex items-center space-x-4 text-xs text-muted-foreground'>
                          <div className='flex items-center space-x-1'>
                            <Calendar className='w-3 h-3' />
                            <span>Created {formatDate(key.createdAt)}</span>
                          </div>
                          {key.lastUsed && (
                            <div className='flex items-center space-x-1'>
                              <Activity className='w-3 h-3' />
                              <span>Last used {formatDate(key.lastUsed)}</span>
                            </div>
                          )}
                          {key.expiresAt && (
                            <div className='flex items-center space-x-1'>
                              <Calendar className='w-3 h-3' />
                              <span>Expires {formatDate(key.expiresAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className='ml-4'>
                        <Button
                          size='sm'
                          variant='destructive'
                          onClick={() => handleRevokeKey(key.id)}
                          disabled={!key.isActive}
                        >
                          <Trash2 className='w-3 h-3' />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default APIKeysManager;
