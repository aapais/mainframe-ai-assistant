import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Bell, Mail, Monitor, Smartphone, Clock, Volume2, AlertTriangle, Info } from 'lucide-react';

interface NotificationChannel {
  id: string;
  name: string;
  enabled: boolean;
  icon: React.ReactNode;
  description: string;
}

interface AlertLevel {
  id: string;
  name: string;
  enabled: boolean;
  color: string;
  sound: boolean;
  vibrate: boolean;
}

interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: string[];
}

const NotificationSettings: React.FC = () => {
  const [channels, setChannels] = useState<NotificationChannel[]>([
    {
      id: 'email',
      name: 'Email',
      enabled: true,
      icon: <Mail size={20} />,
      description: 'Receive notifications via email'
    },
    {
      id: 'desktop',
      name: 'Desktop',
      enabled: true,
      icon: <Monitor size={20} />,
      description: 'Show desktop notifications'
    },
    {
      id: 'mobile',
      name: 'Mobile Push',
      enabled: false,
      icon: <Smartphone size={20} />,
      description: 'Push notifications to mobile app'
    },
    {
      id: 'in-app',
      name: 'In-App',
      enabled: true,
      icon: <Bell size={20} />,
      description: 'Show notifications within the application'
    }
  ]);

  const [alertLevels, setAlertLevels] = useState<AlertLevel[]>([
    {
      id: 'critical',
      name: 'Critical',
      enabled: true,
      color: 'red',
      sound: true,
      vibrate: true
    },
    {
      id: 'warning',
      name: 'Warning',
      enabled: true,
      color: 'yellow',
      sound: true,
      vibrate: false
    },
    {
      id: 'info',
      name: 'Information',
      enabled: true,
      color: 'blue',
      sound: false,
      vibrate: false
    },
    {
      id: 'success',
      name: 'Success',
      enabled: false,
      color: 'green',
      sound: false,
      vibrate: false
    }
  ]);

  const [quietHours, setQuietHours] = useState<QuietHours>({
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  });

  const [emailSettings, setEmailSettings] = useState({
    email: 'user@accenture.com',
    frequency: 'immediate',
    digest: false,
    includeAttachments: true
  });

  const [soundSettings, setSoundSettings] = useState({
    enabled: true,
    volume: 70,
    customSound: false,
    soundFile: 'default'
  });

  const toggleChannel = (channelId: string) => {
    setChannels(channels.map(c =>
      c.id === channelId ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const toggleAlertLevel = (levelId: string, field: 'enabled' | 'sound' | 'vibrate') => {
    setAlertLevels(alertLevels.map(l =>
      l.id === levelId ? { ...l, [field]: !l[field] } : l
    ));
  };

  const toggleQuietDay = (day: string) => {
    setQuietHours({
      ...quietHours,
      days: quietHours.days.includes(day)
        ? quietHours.days.filter(d => d !== day)
        : [...quietHours.days, day]
    });
  };

  const handleTestNotification = () => {
    alert('Test notification sent! Check your enabled notification channels.');
  };

  return (
    <div className="space-y-6">
      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="text-purple-600" size={20} />
            Notification Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {channels.map(channel => (
            <div key={channel.id} className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="text-purple-600">{channel.icon}</div>
                <div>
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{channel.description}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={channel.enabled}
                  onChange={() => toggleChannel(channel.id)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alert Severity Levels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-purple-600" size={20} />
            Alert Severity Levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alertLevels.map(level => (
              <div key={level.id} className="p-3 border rounded-lg dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full bg-${level.color}-500`}></div>
                    <span className="font-medium">{level.name}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={level.enabled}
                      onChange={() => toggleAlertLevel(level.id, 'enabled')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  </label>
                </div>
                {level.enabled && (
                  <div className="flex gap-4 ml-5">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={level.sound}
                        onChange={() => toggleAlertLevel(level.id, 'sound')}
                        className="w-4 h-4 text-purple-600"
                      />
                      <Volume2 size={14} />
                      Sound
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={level.vibrate}
                        onChange={() => toggleAlertLevel(level.id, 'vibrate')}
                        className="w-4 h-4 text-purple-600"
                      />
                      <Smartphone size={14} />
                      Vibrate
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      {channels.find(c => c.id === 'email')?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="text-purple-600" size={20} />
              Email Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email Address</label>
              <input
                type="email"
                value={emailSettings.email}
                onChange={(e) => setEmailSettings({...emailSettings, email: e.target.value})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Frequency</label>
              <select
                value={emailSettings.frequency}
                onChange={(e) => setEmailSettings({...emailSettings, frequency: e.target.value})}
                className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="immediate">Immediate</option>
                <option value="hourly">Hourly Digest</option>
                <option value="daily">Daily Digest</option>
                <option value="weekly">Weekly Summary</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailSettings.digest}
                  onChange={(e) => setEmailSettings({...emailSettings, digest: e.target.checked})}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Group similar notifications</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailSettings.includeAttachments}
                  onChange={(e) => setEmailSettings({...emailSettings, includeAttachments: e.target.checked})}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">Include attachments</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-purple-600" size={20} />
            Quiet Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Quiet Hours</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Mute non-critical notifications during specified times
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={quietHours.enabled}
                onChange={(e) => setQuietHours({...quietHours, enabled: e.target.checked})}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {quietHours.enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={quietHours.startTime}
                    onChange={(e) => setQuietHours({...quietHours, startTime: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={quietHours.endTime}
                    onChange={(e) => setQuietHours({...quietHours, endTime: e.target.value})}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Active Days</label>
                <div className="flex gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <button
                      key={day}
                      onClick={() => toggleQuietDay(day)}
                      className={`px-3 py-1 rounded-md text-sm ${
                        quietHours.days.includes(day)
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Notification */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Info className="text-purple-600" size={20} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Test your notification settings
            </span>
          </div>
          <Button
            onClick={handleTestNotification}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Send Test Notification
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;