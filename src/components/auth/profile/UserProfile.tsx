import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { User } from '../types/auth.types';
import { Card, CardHeader, CardContent, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Alert, AlertDescription } from '../../ui/Alert';
import { Badge } from '../../ui/Badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../ui/Avatar';
import { Separator } from '../../ui/Separator';
import { 
  User as UserIcon, 
  Mail, 
  Calendar, 
  Shield, 
  Edit, 
  Save, 
  X, 
  Camera,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../../utils/cn';

export interface UserProfileProps {
  className?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({ className }) => {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});

  useEffect(() => {
    if (user) {
      setEditedUser({
        name: user.name,
        email: user.email
      });
    }
  }, [user]);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedUser({
      name: user?.name || '',
      email: user?.email || ''
    });
    setError(null);
  };

  const handleSave = async () => {
    if (!editedUser.name?.trim()) {
      setError('Name is required');
      return;
    }

    if (!editedUser.email?.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      await updateProfile({
        name: editedUser.name.trim(),
        email: editedUser.email.trim()
      });
      
      setSuccess('Profile updated successfully');
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setEditedUser(prev => ({
      ...prev,
      [field]: value
    }));
    setError(null);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/auth/profile/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const { avatarUrl } = await response.json();
      await updateProfile({ avatar: avatarUrl });
      setSuccess('Avatar updated successfully');
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProviderIcon = (providerType: string) => {
    switch (providerType) {
      case 'google':
        return '🔍';
      case 'microsoft':
        return '🪟';
      case 'github':
        return '🐙';
      case 'okta':
        return '🔐';
      default:
        return '🔒';
    }
  };

  if (!user) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No user data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <UserIcon className="w-5 h-5" />
              <span>Profile Information</span>
            </CardTitle>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Alert Messages */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-start space-x-6">
            {/* Avatar Section */}
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <label 
                  htmlFor="avatar-upload" 
                  className="absolute -bottom-1 -right-1 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/80 transition-colors"
                >
                  <Camera className="w-3 h-3" />
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={isLoading}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            {/* Profile Details */}
            <div className="flex-1 space-y-4">
              {/* Name Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                {isEditing ? (
                  <Input
                    value={editedUser.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your full name"
                    disabled={isLoading}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{user.name}</p>
                )}
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={editedUser.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                ) : (
                  <div className="flex items-center space-x-2">
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.emailVerified && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons for Editing */}
              {isEditing && (
                <div className="flex space-x-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={isLoading}
                    size="sm"
                  >
                    {isLoading ? (
                      <>Loading...</>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isLoading}
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Details */}
      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>Role</span>
              </label>
              <Badge className={getRoleColor(user.role)}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">SSO Provider</label>
              <div className="flex items-center space-x-2">
                <span>{getProviderIcon(user.provider.type)}</span>
                <span className="text-sm text-muted-foreground">{user.provider.name}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>Member Since</span>
              </label>
              <p className="text-sm text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Last Login</label>
              <p className="text-sm text-muted-foreground">
                {new Date(user.lastLogin).toLocaleString()}
              </p>
            </div>
          </div>

          <Separator />

          {/* Security Status */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Security Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Multi-Factor Authentication</span>
                <Badge variant={user.mfaEnabled ? 'default' : 'secondary'}>
                  {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Email Verification</span>
                <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
                  {user.emailVerified ? 'Verified' : 'Pending'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserProfile;