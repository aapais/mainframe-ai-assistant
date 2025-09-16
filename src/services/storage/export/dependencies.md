# Enhanced Export/Import Dependencies

## Required Dependencies

### Core Dependencies (Already Available)
```bash
# These are already in the project
npm install csv-parse csv-stringify xml2js
```

### Additional Dependencies for Advanced Formats

#### Zod for Enhanced Validation
```bash
npm install zod
```

#### Advanced Format Support (Optional)
```bash
# For Parquet support
npm install parquetjs

# For Avro support  
npm install avsc

# For ORC support (requires native compilation)
npm install orc

# For advanced compression
npm install @gzip-js/gzip
npm install brotli
```

### Development Dependencies
```bash
# For testing the new services
npm install --save-dev @types/xml2js
npm install --save-dev jest
npm install --save-dev supertest
```

## Package.json Updates

Add these to your package.json dependencies:

```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "parquetjs": "^0.11.2",
    "avsc": "^5.7.7",
    "@gzip-js/gzip": "^1.1.2"
  },
  "devDependencies": {
    "@types/xml2js": "^0.4.14"
  },
  "optionalDependencies": {
    "orc": "^0.1.0",
    "brotli": "^1.3.3"
  }
}
```

## Installation Script

```bash
#!/bin/bash
# install-export-dependencies.sh

echo "Installing enhanced export/import dependencies..."

# Core validation
npm install zod

# Advanced formats (with error handling)
echo "Installing advanced format support..."

# Parquet
if npm install parquetjs; then
    echo "✅ Parquet support installed"
else
    echo "⚠️  Parquet support failed - will use JSON fallback"
fi

# Avro
if npm install avsc; then
    echo "✅ Avro support installed"
else
    echo "⚠️  Avro support failed - will use JSON fallback"
fi

# ORC (optional, requires compilation)
if npm install orc; then
    echo "✅ ORC support installed"
else
    echo "⚠️  ORC support failed - will use JSON fallback (requires build tools)"
fi

# Compression
if npm install @gzip-js/gzip; then
    echo "✅ Gzip compression installed"
else
    echo "⚠️  Gzip compression failed - will use Node.js zlib"
fi

if npm install brotli; then
    echo "✅ Brotli compression installed"
else
    echo "⚠️  Brotli compression failed - will use Node.js zlib"
fi

# Development dependencies
npm install --save-dev @types/xml2js

echo "✅ Enhanced export/import dependencies installation complete!"
echo ""
echo "Note: Some advanced formats are optional and have fallbacks."
echo "The system will work with basic formats (JSON, CSV, XML) even if"
echo "advanced format libraries fail to install."
```

## Runtime Feature Detection

The services include runtime feature detection:

```typescript
// FormatConverter automatically detects available libraries
const converter = new FormatConverter();

// Check what formats are actually available
const supportedFormats = converter.getSupportedFormats();
console.log('Available formats:', supportedFormats);

// The system gracefully falls back to JSON for unsupported formats
try {
  const result = await converter.convert(data, 'parquet', options);
} catch (error) {
  console.warn('Parquet not available, falling back to JSON');
  const result = await converter.convert(data, 'json', options);
}
```

## Environment-Specific Notes

### Windows
- ORC format may require Visual Studio Build Tools
- Recommend using Windows Subsystem for Linux (WSL) for better compatibility

### Linux
- All formats should work with standard build tools (gcc, make)
- May need python3-dev for some native modules

### macOS
- Xcode command line tools required for native modules
- All formats generally work well

### Docker
```dockerfile
# For full format support in Docker
FROM node:18-alpine

# Install build dependencies for native modules
RUN apk add --no-cache python3 make gcc g++ 

# Copy and install Node.js dependencies
COPY package*.json ./
RUN npm ci --only=production

# The rest of your Dockerfile...
```

## Graceful Degradation

The export/import services are designed to work even if advanced format libraries are not available:

1. **Parquet** → Falls back to JSON with metadata indicating original intent
2. **Avro** → Falls back to JSON with schema information preserved
3. **ORC** → Falls back to JSON with structured format
4. **Advanced compression** → Falls back to Node.js built-in zlib

This ensures the core functionality works in any environment while providing enhanced capabilities when possible.