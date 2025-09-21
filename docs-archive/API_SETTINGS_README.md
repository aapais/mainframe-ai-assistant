# API Settings Component - Comprehensive Documentation

## Overview

The API Settings component provides a secure, enterprise-grade interface for managing AI service API keys within the Accenture Mainframe AI Assistant. This system implements industry-standard security practices for handling sensitive credentials while maintaining a user-friendly interface.

## Features

### 🔐 Security First
- **AES-256-GCM Encryption**: All API keys are encrypted at rest using enterprise-grade encryption
- **Memory Protection**: Keys are cleared from memory immediately after use
- **Session-Only Keys**: Option to store keys only for the current session
- **Secure IPC**: All communication between renderer and main process is validated and secured
- **Key Masking**: API keys are never displayed in full in the UI
- **Audit Trail**: All key operations are logged for security monitoring

### 🚀 Supported Providers
1. **OpenAI** - GPT models for text generation and completion
2. **Anthropic Claude** - Advanced reasoning and conversation
3. **Google Gemini** - Multimodal AI capabilities
4. **GitHub Copilot** - AI-powered code completion

### 📊 Management Features
- **Connection Testing**: Validate API keys before saving
- **Usage Statistics**: Track requests, costs, and performance metrics
- **Cost Monitoring**: Set monthly limits and track spending
- **Import/Export**: Migrate from .env files or backup configurations
- **Bulk Operations**: Manage multiple keys efficiently
- **Real-time Status**: Live connection status indicators

## Architecture

### File Structure
```
src/
├── main/
│   ├── services/
│   │   ├── APIKeyManager.ts    # Core encryption and storage service
│   │   └── APIKeyManager.js    # JavaScript version for runtime
│   └── ipc/
│       └── handlers/
│           ├── APISettingsHandler.ts  # IPC communication handlers
│           └── APISettingsHandler.js  # JavaScript version for runtime
├── renderer/
│   ├── components/
│   │   └── settings/
│   │       └── APISettings.tsx        # Main React component
│   ├── pages/
│   │   └── Settings.tsx               # Settings page wrapper
│   └── types/
│       └── api-settings.ts            # TypeScript definitions
└── docs/
    └── API_SETTINGS_README.md         # This documentation
```

### Security Architecture

#### Encryption Layer
- **Master Key**: Generated on first run, stored with restricted permissions
- **Key Derivation**: Uses PBKDF2 for additional security
- **Authentication**: GCM mode provides authenticity verification
- **Salt**: Random initialization vectors for each encryption operation

#### Storage Layer
- **Encrypted Files**: Keys stored in encrypted binary format
- **Secure Locations**: Uses Electron's userData directory with restricted access
- **Session Storage**: Temporary keys stored only in memory
- **Backup Protection**: Exported configurations exclude actual keys

#### Communication Layer
- **IPC Validation**: All channels whitelist validated
- **Parameter Sanitization**: Input validation on all endpoints
- **Error Handling**: Secure error messages without sensitive data exposure
- **Rate Limiting**: Built-in protection against brute force attempts

## API Reference

### Main Service Methods

#### APIKeyManager

```typescript
class APIKeyManager {
  // Provider management
  getProviders(): APIProvider[]
  getProvider(providerId: string): APIProvider | undefined

  // Key lifecycle
  storeApiKey(providerId: string, keyName: string, apiKey: string, isSessionOnly?: boolean, monthlyLimit?: number): Promise<string>
  getApiKey(keyId: string): Promise<string | null>
  deleteApiKey(keyId: string): Promise<boolean>
  updateKeyStatus(keyId: string, isActive: boolean): Promise<boolean>

  // Security operations
  testConnection(providerId: string, apiKey: string): Promise<ConnectionTestResult>
  validateKeyFormat(providerId: string, apiKey: string): boolean

  // Data management
  importFromEnv(envFilePath: string): Promise<ImportResult>
  exportConfiguration(): Promise<string>
  clearAllKeys(): Promise<void>

  // Usage tracking
  recordUsage(providerId: string, requestCount?: number, cost?: number, responseTime?: number, isError?: boolean): Promise<void>
  getUsageStats(providerId?: string): APIUsageStats[]
}
```

#### IPC Channels

```typescript
interface APISettingsIPC {
  // Provider operations
  'api-settings:get-providers': () => Promise<APIProvider[]>
  'api-settings:get-provider': (providerId: string) => Promise<APIProvider | null>

  // Key operations
  'api-settings:store-key': (providerId: string, keyName: string, apiKey: string, isSessionOnly?: boolean, monthlyLimit?: number) => Promise<{success: boolean, keyId?: string, error?: string}>
  'api-settings:delete-key': (keyId: string) => Promise<{success: boolean, error?: string}>
  'api-settings:test-connection': (providerId: string, apiKey: string) => Promise<ConnectionTestResult>

  // Additional operations...
}
```

### React Component API

```typescript
interface APISettingsProps {
  className?: string;
  onKeyAdded?: (keyId: string) => void;
  onKeyDeleted?: (keyId: string) => void;
  onTestCompleted?: (result: ConnectionTestResult) => void;
}
```

## Usage Examples

### Basic Integration

```typescript
import React from 'react';
import APISettings from '../components/settings/APISettings';

function SettingsPage() {
  const handleKeyAdded = (keyId: string) => {
    console.log('New API key added:', keyId);
  };

  return (
    <APISettings
      onKeyAdded={handleKeyAdded}
      onTestCompleted={(result) => {
        if (result.success) {
          console.log('Connection test passed');
        }
      }}
    />
  );
}
```

### Manual Key Storage

```typescript
// In main process
const keyManager = APIKeyManager.getInstance();

try {
  const keyId = await keyManager.storeApiKey(
    'openai',
    'Production Key',
    'sk-...',
    false, // Not session-only
    100.00 // Monthly limit in USD
  );
  console.log('Key stored with ID:', keyId);
} catch (error) {
  console.error('Failed to store key:', error.message);
}
```

### Connection Testing

```typescript
// Test a key before storing
const result = await keyManager.testConnection('openai', 'sk-...');
if (result.success) {
  console.log(`Connection successful in ${result.responseTime}ms`);
  if (result.rateLimitInfo) {
    console.log(`Rate limit: ${result.rateLimitInfo.remaining}/${result.rateLimitInfo.limit}`);
  }
} else {
  console.error('Connection failed:', result.error);
}
```

### Usage Tracking

```typescript
// Record API usage
await keyManager.recordUsage(
  'openai',
  1,      // 1 request
  0.002,  // Cost in USD
  150,    // Response time in ms
  false   // Not an error
);

// Get usage statistics
const stats = keyManager.getUsageStats('openai');
console.log('Total requests:', stats[0]?.requestCount);
console.log('Total cost:', stats[0]?.totalCost);
```

## Security Best Practices

### For Developers

1. **Never Log Keys**: Ensure API keys are never written to logs
2. **Validate Inputs**: Always validate user inputs before processing
3. **Use Session Keys**: For temporary operations, prefer session-only keys
4. **Regular Cleanup**: Implement periodic cleanup of unused keys
5. **Monitor Usage**: Track unusual API usage patterns

### For Users

1. **Strong Keys**: Use the most restrictive API key permissions possible
2. **Regular Rotation**: Rotate API keys periodically
3. **Monitor Costs**: Set up monthly limits to prevent overspending
4. **Secure Environment**: Keep the application and system updated
5. **Backup Configuration**: Regularly export configuration (without keys)

### Environment Security

```bash
# Secure the application directory
chmod 700 ~/.config/accenture-mainframe-ai-assistant/

# Verify encryption key permissions
ls -la ~/.config/accenture-mainframe-ai-assistant/master.key
# Should show: -rw------- (600 permissions)
```

## Configuration

### Provider Configuration

Each provider is configured with:

```typescript
interface APIProvider {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  description: string;           // User-friendly description
  baseUrl: string;              // API base URL
  apiKeyFormat: string;         // Regex pattern for validation
  testEndpoint: string;         // Endpoint for connection testing
  pricingInfo: {                // Cost information
    inputCostPer1K: number;
    outputCostPer1K: number;
    currency: string;
  };
  documentationUrl: string;     // Link to provider docs
  setupInstructions: string[]; // Step-by-step setup guide
  requiredHeaders?: Record<string, string>; // HTTP headers template
}
```

### Application Settings

```typescript
// In main process initialization
const keyManager = APIKeyManager.getInstance();

// Configure custom storage location (optional)
const customStorePath = path.join(os.homedir(), '.secure-keys');
// Note: This requires modification to the APIKeyManager constructor
```

## Troubleshooting

### Common Issues

#### Connection Tests Failing
```typescript
// Check network connectivity
const testResult = await keyManager.testConnection('openai', 'sk-...');
if (!testResult.success) {
  console.log('Error details:', testResult.error);
  console.log('Status code:', testResult.statusCode);
}
```

#### Key Storage Issues
```typescript
// Verify storage permissions
const fs = require('fs');
const userDataPath = app.getPath('userData');
try {
  fs.accessSync(userDataPath, fs.constants.W_OK);
  console.log('Storage directory is writable');
} catch (error) {
  console.error('Storage permission issue:', error);
}
```

#### Encryption Errors
```typescript
// Regenerate master key if corrupted
const keyPath = path.join(app.getPath('userData'), 'master.key');
if (fs.existsSync(keyPath)) {
  // Backup existing keys first!
  fs.unlinkSync(keyPath);
  // Restart application to regenerate
}
```

### Debug Mode

Enable debug logging:

```typescript
// In development
process.env.DEBUG_API_SETTINGS = 'true';

// This will enable additional console output for troubleshooting
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Keys are loaded only when needed
2. **Memory Management**: Keys are cleared from memory after use
3. **Caching**: Provider configurations are cached for performance
4. **Batch Operations**: Multiple operations are batched when possible
5. **Background Processing**: Usage statistics are updated asynchronously

### Memory Usage

- **Encrypted Storage**: ~1KB per stored key
- **Runtime Memory**: ~50KB for manager instance
- **Session Keys**: Temporary memory allocation only
- **Statistics**: ~500 bytes per provider stats

## Future Enhancements

### Planned Features

1. **SAML/SSO Integration**: Enterprise authentication
2. **Key Rotation**: Automatic key rotation policies
3. **Advanced Monitoring**: Real-time usage dashboards
4. **Multi-tenancy**: Support for multiple user contexts
5. **Cloud Sync**: Secure cloud backup and sync
6. **Audit Logs**: Detailed security event logging
7. **Policy Engine**: Configurable usage policies
8. **Integration Hub**: Additional AI service providers

### API Roadmap

- **v1.1**: Enhanced security features and audit logging
- **v1.2**: Cloud synchronization and multi-device support
- **v1.3**: Advanced analytics and reporting
- **v2.0**: Enterprise features and policy management

## Contributing

### Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Mode**:
   ```bash
   npm run dev
   ```

3. **Test API Settings**:
   ```bash
   npm run test:api-settings
   ```

### Testing

```bash
# Unit tests
npm run test:unit src/main/services/APIKeyManager.test.js

# Integration tests
npm run test:integration src/renderer/components/settings/

# Security tests
npm run test:security
```

### Code Style

The project follows the Accenture coding standards:
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- JSDoc for documentation

## Support

For technical support or questions:

1. **Documentation**: Check this README and inline code comments
2. **Issues**: Report bugs via the project issue tracker
3. **Security**: Report security issues via secure channels
4. **Enterprise Support**: Contact Accenture support for enterprise customers

## License

© 2024 Accenture. All rights reserved. Proprietary software for internal Accenture use.

---

*This documentation covers the comprehensive API Settings system for the Accenture Mainframe AI Assistant. For the latest updates and additional features, refer to the project's change log and release notes.*