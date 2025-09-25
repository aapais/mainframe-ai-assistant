const React = require('react');
const { useState, useEffect } = React;

const NotificationSettings = ({ settings, onUpdate, onMarkChanged }) => {
    const [notifications, setNotifications] = useState(settings?.notifications || {
        email: true,
        desktop: true,
        sound: true,
        incident_updates: true,
        system_alerts: true,
        mentions: true
    });
    const [testingNotification, setTestingNotification] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState('default');

    useEffect(() => {
        if (settings?.notifications) {
            setNotifications(settings.notifications);
        }
        
        // Check notification permission status
        if ('Notification' in window) {
            setPermissionStatus(Notification.permission);
        }
    }, [settings]);

    const notificationTypes = [
        {
            key: 'email',
            label: 'Email Notifications',
            description: 'Receive notifications via email',
            icon: '📧',
            category: 'delivery'
        },
        {
            key: 'desktop',
            label: 'Desktop Notifications',
            description: 'Show browser notifications',
            icon: '🔔',
            category: 'delivery'
        },
        {
            key: 'sound',
            label: 'Sound Alerts',
            description: 'Play notification sounds',
            icon: '🔊',
            category: 'delivery'
        },
        {
            key: 'incident_updates',
            label: 'Incident Updates',
            description: 'Notifications for incident status changes',
            icon: '🚨',
            category: 'content'
        },
        {
            key: 'system_alerts',
            label: 'System Alerts',
            description: 'Important system notifications and maintenance',
            icon: '⚠️',
            category: 'content'
        },
        {
            key: 'mentions',
            label: 'Mentions & Messages',
            description: 'When someone mentions you or sends a message',
            icon: '💬',
            category: 'content'
        }
    ];

    const handleNotificationToggle = async (key, value) => {
        const updatedNotifications = {
            ...notifications,
            [key]: value
        };
        
        setNotifications(updatedNotifications);
        onMarkChanged();
        
        // If enabling desktop notifications, request permission
        if (key === 'desktop' && value && permissionStatus !== 'granted') {
            await requestNotificationPermission();
        }
        
        // Update settings in backend
        const result = await onUpdate({ notifications: updatedNotifications });
        
        if (!result.success) {
            // Revert on error
            setNotifications(settings?.notifications || {});
        }
    };

    const requestNotificationPermission = async () => {
        if ('Notification' in window && Notification.permission !== 'granted') {
            try {
                const permission = await Notification.requestPermission();
                setPermissionStatus(permission);
                return permission === 'granted';
            } catch (error) {
                console.error('Error requesting notification permission:', error);
                return false;
            }
        }
        return Notification.permission === 'granted';
    };

    const testNotification = async () => {
        setTestingNotification(true);
        
        try {
            if (notifications.desktop) {
                const hasPermission = await requestNotificationPermission();
                if (hasPermission) {
                    new Notification('Mainframe AI Assistant', {
                        body: 'Test notification - your settings are working correctly!',
                        icon: '/favicon.ico',
                        tag: 'test-notification'
                    });
                }
            }
            
            if (notifications.sound) {
                // Play a test sound
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBDuU2O');
                audio.volume = 0.3;
                audio.play().catch(e => console.warn('Could not play test sound:', e));
            }
            
            // Show success message
            setTimeout(() => {
                alert('Test notification sent! Check your notification settings if you didn\'t receive it.');
            }, 500);
        } catch (error) {
            console.error('Error sending test notification:', error);
            alert('Failed to send test notification: ' + error.message);
        } finally {
            setTimeout(() => setTestingNotification(false), 1000);
        }
    };

    const getPermissionStatusColor = () => {
        switch (permissionStatus) {
            case 'granted': return 'text-green-600 dark:text-green-400';
            case 'denied': return 'text-red-600 dark:text-red-400';
            default: return 'text-yellow-600 dark:text-yellow-400';
        }
    };

    const getPermissionStatusText = () => {
        switch (permissionStatus) {
            case 'granted': return 'Granted';
            case 'denied': return 'Denied - Please enable in browser settings';
            default: return 'Not requested';
        }
    };

    const deliverySettings = notificationTypes.filter(n => n.category === 'delivery');
    const contentSettings = notificationTypes.filter(n => n.category === 'content');

    return React.createElement('div', {
        className: 'space-y-6'
    }, [
        // Header
        React.createElement('div', {
            key: 'header'
        }, [
            React.createElement('h3', {
                key: 'title',
                className: 'text-lg font-semibold text-gray-900 dark:text-white mb-2'
            }, 'Notification Settings'),
            React.createElement('p', {
                key: 'description',
                className: 'text-sm text-gray-600 dark:text-gray-400'
            }, 'Manage how and when you receive notifications from the Mainframe AI Assistant')
        ]),
        
        // Permission Status (for desktop notifications)
        React.createElement('div', {
            key: 'permission-status',
            className: 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('div', {
                key: 'permission-header',
                className: 'flex items-center justify-between mb-2'
            }, [
                React.createElement('h4', {
                    key: 'permission-title',
                    className: 'font-medium text-gray-900 dark:text-white'
                }, 'Browser Permission Status'),
                React.createElement('span', {
                    key: 'permission-badge',
                    className: `px-2 py-1 rounded-full text-xs font-medium ${getPermissionStatusColor()} bg-current bg-opacity-10`
                }, getPermissionStatusText())
            ]),
            React.createElement('p', {
                key: 'permission-desc',
                className: 'text-sm text-gray-600 dark:text-gray-400 mb-3'
            }, 'Desktop notifications require browser permission to work properly.'),
            permissionStatus !== 'granted' && React.createElement('button', {
                key: 'request-permission',
                onClick: requestNotificationPermission,
                className: 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm'
            }, 'Request Permission')
        ]),
        
        // Delivery Methods
        React.createElement('div', {
            key: 'delivery-methods',
            className: 'space-y-4'
        }, [
            React.createElement('h4', {
                key: 'delivery-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Delivery Methods'),
            
            React.createElement('div', {
                key: 'delivery-grid',
                className: 'space-y-3'
            }, deliverySettings.map(notification => 
                React.createElement('div', {
                    key: notification.key,
                    className: 'flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600'
                }, [
                    React.createElement('div', {
                        key: 'info',
                        className: 'flex items-center gap-3'
                    }, [
                        React.createElement('span', {
                            key: 'icon',
                            className: 'text-xl'
                        }, notification.icon),
                        React.createElement('div', {
                            key: 'text'
                        }, [
                            React.createElement('h5', {
                                key: 'label',
                                className: 'font-medium text-gray-900 dark:text-white'
                            }, notification.label),
                            React.createElement('p', {
                                key: 'desc',
                                className: 'text-sm text-gray-600 dark:text-gray-400'
                            }, notification.description)
                        ])
                    ]),
                    
                    React.createElement('button', {
                        key: 'toggle',
                        onClick: () => handleNotificationToggle(notification.key, !notifications[notification.key]),
                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            notifications[notification.key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`,
                        disabled: notification.key === 'desktop' && permissionStatus === 'denied'
                    }, [
                        React.createElement('span', {
                            key: 'handle',
                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                notifications[notification.key] ? 'translate-x-6' : 'translate-x-1'
                            }`
                        })
                    ])
                ])
            ))
        ]),
        
        // Content Types
        React.createElement('div', {
            key: 'content-types',
            className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('h4', {
                key: 'content-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Notification Types'),
            
            React.createElement('div', {
                key: 'content-grid',
                className: 'space-y-3'
            }, contentSettings.map(notification => 
                React.createElement('div', {
                    key: notification.key,
                    className: 'flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600'
                }, [
                    React.createElement('div', {
                        key: 'info',
                        className: 'flex items-center gap-3'
                    }, [
                        React.createElement('span', {
                            key: 'icon',
                            className: 'text-xl'
                        }, notification.icon),
                        React.createElement('div', {
                            key: 'text'
                        }, [
                            React.createElement('h5', {
                                key: 'label',
                                className: 'font-medium text-gray-900 dark:text-white'
                            }, notification.label),
                            React.createElement('p', {
                                key: 'desc',
                                className: 'text-sm text-gray-600 dark:text-gray-400'
                            }, notification.description)
                        ])
                    ]),
                    
                    React.createElement('button', {
                        key: 'toggle',
                        onClick: () => handleNotificationToggle(notification.key, !notifications[notification.key]),
                        className: `relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            notifications[notification.key] ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                        }`
                    }, [
                        React.createElement('span', {
                            key: 'handle',
                            className: `inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                notifications[notification.key] ? 'translate-x-6' : 'translate-x-1'
                            }`
                        })
                    ])
                ])
            ))
        ]),
        
        // Test Notifications
        React.createElement('div', {
            key: 'test-section',
            className: 'space-y-4 pt-6 border-t border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('h4', {
                key: 'test-title',
                className: 'font-medium text-gray-900 dark:text-white'
            }, 'Test Notifications'),
            React.createElement('p', {
                key: 'test-desc',
                className: 'text-sm text-gray-600 dark:text-gray-400'
            }, 'Send a test notification to verify your settings are working correctly.'),
            
            React.createElement('button', {
                key: 'test-btn',
                onClick: testNotification,
                disabled: testingNotification || (!notifications.desktop && !notifications.sound),
                className: `px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${
                    testingNotification ? 'animate-pulse' : ''
                }`
            }, testingNotification ? 'Sending...' : 'Send Test Notification')
        ]),
        
        // Quick Actions
        React.createElement('div', {
            key: 'quick-actions',
            className: 'flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-600'
        }, [
            React.createElement('button', {
                key: 'enable-all',
                onClick: async () => {
                    const allEnabled = {};
                    notificationTypes.forEach(n => {
                        allEnabled[n.key] = true;
                    });
                    await handleNotificationToggle('all', allEnabled);
                    setNotifications(allEnabled);
                },
                className: 'px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm'
            }, 'Enable All'),
            
            React.createElement('button', {
                key: 'disable-all',
                onClick: async () => {
                    const allDisabled = {};
                    notificationTypes.forEach(n => {
                        allDisabled[n.key] = false;
                    });
                    await handleNotificationToggle('all', allDisabled);
                    setNotifications(allDisabled);
                },
                className: 'px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm'
            }, 'Disable All')
        ]),
        
        // Current Settings Summary
        React.createElement('div', {
            key: 'summary',
            className: 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4'
        }, [
            React.createElement('h4', {
                key: 'summary-title',
                className: 'font-medium text-gray-900 dark:text-white mb-2'
            }, 'Current Notification Settings'),
            React.createElement('div', {
                key: 'summary-content',
                className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1'
            }, [
                React.createElement('div', {
                    key: 'enabled-count'
                }, `Active notifications: ${Object.values(notifications).filter(Boolean).length} of ${notificationTypes.length}`),
                React.createElement('div', {
                    key: 'permission-status'
                }, `Browser permission: ${getPermissionStatusText()}`),
                React.createElement('div', {
                    key: 'delivery-methods'
                }, `Delivery: ${[notifications.email && 'Email', notifications.desktop && 'Desktop', notifications.sound && 'Sound'].filter(Boolean).join(', ') || 'None'}`)
            ])
        ])
    ]);
};

// Make component available globally
if (typeof window !== 'undefined') {
    window.NotificationSettings = NotificationSettings;
}

module.exports = NotificationSettings;
