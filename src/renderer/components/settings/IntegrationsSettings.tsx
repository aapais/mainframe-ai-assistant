import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Github, GitBranch, Link, Key, Globe, Webhook, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'error';
  description: string;
  lastSync?: Date;
  config?: any;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret: boolean;
  lastDelivery?: Date;
  successRate: number;
}

const IntegrationsSettings: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'github',
      name: 'GitHub',
      icon: <Github size={20} />,
      status: 'connected',
      description: 'Sync repositories and manage pull requests',
      lastSync: new Date(Date.now() - 3600000),
      config: {
        username: 'accenture-dev',
        repos: 12,
        accessLevel: 'read-write'
      }
    },
    {
      id: 'gitlab',
      name: 'GitLab',
      icon: <GitBranch size={20} />,
      status: 'disconnected',
      description: 'Connect to GitLab repositories',
    },
    {
      id: 'jira',
      name: 'Jira',
      icon: <Globe size={20} />,
      status: 'connected',
      description: 'Track issues and project management',
      lastSync: new Date(Date.now() - 7200000),
      config: {
        project: 'MAINFRAME-AI',
        issues: 247
      }
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: <Link size={20} />,
      status: 'error',
      description: 'Send notifications to Slack channels',
      config: {
        error: 'Token expired'
      }
    }
  ]);

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([
    {
      id: '1',
      url: 'https://api.accenture.com/webhooks/mainframe',
      events: ['incident.created', 'incident.resolved'],
      active: true,
      secret: true,
      lastDelivery: new Date(Date.now() - 1800000),
      successRate: 98.5
    },
    {
      id: '2',
      url: 'https://monitoring.accenture.com/hooks',
      events: ['system.alert', 'performance.threshold'],
      active: true,
      secret: false,
      lastDelivery: new Date(Date.now() - 900000),
      successRate: 100
    }
  ]);

  const [apiKeys, setApiKeys] = useState([
    {
      id: '1',
      name: 'Production API',
      key: 'ak_prod_****_****_****_7890',
      created: new Date(Date.now() - 86400000 * 30),
      lastUsed: new Date(Date.now() - 3600000),
      permissions: ['read', 'write', 'delete']
    },
    {
      id: '2',
      name: 'Development API',
      key: 'ak_dev_****_****_****_1234',
      created: new Date(Date.now() - 86400000 * 7),
      lastUsed: new Date(Date.now() - 7200000),
      permissions: ['read', 'write']
    }
  ]);

  const [oauthClients, setOauthClients] = useState([
    {
      id: '1',
      name: 'Mobile App',
      clientId: 'mob_****_****',
      redirectUri: 'com.accenture.mainframe://callback',
      scopes: ['profile', 'api.read', 'api.write']
    }
  ]);

  const handleConnect = (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (integration?.status === 'connected') {
      if (confirm(`Disconnect from ${integration.name}?`)) {
        setIntegrations(integrations.map(i =>
          i.id === integrationId ? { ...i, status: 'disconnected' } : i
        ));
      }
    } else {
      alert(`Connecting to ${integration?.name}... (OAuth flow would open here)`);
      setIntegrations(integrations.map(i =>
        i.id === integrationId ? { ...i, status: 'connected', lastSync: new Date() } : i
      ));
    }
  };

  const handleTestWebhook = (webhookId: string) => {
    const webhook = webhooks.find(w => w.id === webhookId);
    alert(`Testing webhook: ${webhook?.url}\nTest event sent successfully!`);
  };

  const generateNewApiKey = () => {
    const name = prompt('Enter a name for the new API key:');
    if (name) {
      const newKey = {
        id: String(apiKeys.length + 1),
        name,
        key: `ak_${Date.now()}_****_****`,
        created: new Date(),
        lastUsed: null,
        permissions: ['read']
      };
      setApiKeys([...apiKeys, newKey]);
      alert(`New API key created: ${newKey.key.replace('****_****', 'XXXX_XXXX')}`);
    }
  };

  const getStatusIcon = (status: Integration['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'error':
        return <XCircle className="text-red-500" size={16} />;
      default:
        return <AlertCircle className="text-gray-400" size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* External Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="text-purple-600" size={20} />
            External Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations.map(integration => (
              <div key={integration.id} className="p-4 border rounded-lg dark:border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="text-purple-600">{integration.icon}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{integration.name}</h4>
                        {getStatusIcon(integration.status)}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                </div>

                {integration.status === 'connected' && integration.config && (
                  <div className="mt-3 pt-3 border-t dark:border-gray-700 text-sm space-y-1">
                    {integration.config.username && (
                      <p>User: <span className="font-mono">{integration.config.username}</span></p>
                    )}
                    {integration.config.project && (
                      <p>Project: <span className="font-mono">{integration.config.project}</span></p>
                    )}
                    {integration.lastSync && (
                      <p className="text-gray-500">
                        Last sync: {new Date(integration.lastSync).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}

                {integration.status === 'error' && integration.config?.error && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-sm text-red-600 dark:text-red-400">
                    Error: {integration.config.error}
                  </div>
                )}

                <Button
                  onClick={() => handleConnect(integration.id)}
                  className={`mt-3 w-full ${
                    integration.status === 'connected'
                      ? 'bg-gray-600 hover:bg-gray-700'
                      : integration.status === 'error'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                  size="sm"
                >
                  {integration.status === 'connected' ? 'Disconnect' :
                   integration.status === 'error' ? 'Reconnect' : 'Connect'}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="text-purple-600" size={20} />
            Webhook Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {webhooks.map(webhook => (
              <div key={webhook.id} className="p-3 border rounded-lg dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono">{webhook.url}</code>
                      {webhook.secret && <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded">Secret</span>}
                      <span className={`text-xs px-2 py-1 rounded ${
                        webhook.active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}>
                        {webhook.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Events: {webhook.events.join(', ')}
                    </div>
                    {webhook.lastDelivery && (
                      <div className="text-xs text-gray-500 mt-1">
                        Last delivery: {webhook.lastDelivery.toLocaleTimeString()} •
                        Success rate: {webhook.successRate}%
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleTestWebhook(webhook.id)}
                      variant="outline"
                      size="sm"
                      className="border-purple-600 text-purple-600"
                    >
                      Test
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-gray-600 text-gray-600"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              Add Webhook Endpoint
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="text-purple-600" size={20} />
            API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {apiKeys.map(apiKey => (
              <div key={apiKey.id} className="p-3 border rounded-lg dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{apiKey.name}</div>
                    <code className="text-sm text-gray-600 dark:text-gray-400">{apiKey.key}</code>
                    <div className="text-xs text-gray-500 mt-1">
                      Created: {apiKey.created.toLocaleDateString()} •
                      {apiKey.lastUsed ? ` Last used: ${apiKey.lastUsed.toLocaleTimeString()}` : ' Never used'}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {apiKey.permissions.map(perm => (
                        <span key={perm} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                          {perm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-600"
                  >
                    Revoke
                  </Button>
                </div>
              </div>
            ))}
            <Button
              onClick={generateNewApiKey}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              Generate New API Key
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OAuth Clients */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="text-purple-600" size={20} />
            OAuth Applications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {oauthClients.map(client => (
              <div key={client.id} className="p-3 border rounded-lg dark:border-gray-700">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{client.name}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Client ID: <code>{client.clientId}</code>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Redirect: <code>{client.redirectUri}</code>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {client.scopes.map(scope => (
                        <span key={scope} className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded">
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-purple-600 text-purple-600">
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="border-red-600 text-red-600">
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            <Button className="w-full bg-purple-600 hover:bg-purple-700">
              Register New OAuth Application
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationsSettings;