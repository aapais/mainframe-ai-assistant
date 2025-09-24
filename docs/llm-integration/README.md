# LLM Integration System - Banking AI Assistant

## Overview

The LLM Integration System provides a comprehensive, enterprise-grade solution for integrating multiple Large Language Model providers into banking applications. The system features intelligent fallback mechanisms, RAG (Retrieval Augmented Generation) capabilities, and specialized banking domain knowledge.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LLM Service   │◄──►│ Prompt Template  │◄──►│  RAG Pipeline   │
│                 │    │    Manager       │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Multi-Provider│    │ Banking Domain   │    │ Vector Database │
│   Fallback      │    │   Templates      │    │   (ChromaDB)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                          ┌─────────────────┐
│ OpenAI │ Claude │                          │ Embedding       │
│ Azure  │ Others │                          │ Service         │
└─────────────────┘                          └─────────────────┘
```

## Features

### 🚀 Multi-Provider Support
- **OpenAI GPT-4 Turbo**: Primary provider with advanced reasoning
- **Anthropic Claude 3**: Reliable fallback with strong safety features
- **Azure OpenAI**: Enterprise-grade deployment option
- **Intelligent Fallback**: Automatic provider switching on failures

### 🏦 Banking Domain Specialization
- **Fraud Detection**: Real-time transaction analysis
- **Compliance Checking**: Regulatory framework validation
- **Risk Assessment**: Comprehensive risk analysis
- **Credit Evaluation**: Automated creditworthiness assessment
- **Market Analysis**: Financial market intelligence

### 🔍 RAG (Retrieval Augmented Generation)
- **Semantic Search**: Context-aware document retrieval
- **ChromaDB Integration**: High-performance vector storage
- **Smart Chunking**: Intelligent document segmentation
- **Reranking**: Relevance-based result optimization

### 🛡️ Enterprise Security
- **Data Anonymization**: Automatic PII protection
- **Compliance Modes**: Strict/moderate/relaxed settings
- **Audit Logging**: Comprehensive operation tracking
- **Rate Limiting**: Advanced request throttling

## Quick Start

### Installation

```bash
# Install required dependencies
npm install openai @anthropic-ai/sdk chromadb

# Set up environment variables
cp .env.example .env
# Configure your API keys and settings
```

### Basic Usage

```javascript
const LLMService = require('./src/services/llm-integration/LLMService');

// Initialize with configuration
const llmService = new LLMService({
    providers: {
        openai: {
            enabled: true,
            apiKey: process.env.OPENAI_API_KEY
        },
        claude: {
            enabled: true,
            apiKey: process.env.ANTHROPIC_API_KEY
        }
    },
    features: {
        ragEnabled: true,
        fraudDetection: true,
        complianceCheck: true
    }
});

// Generate response with automatic fallback
const response = await llmService.generateResponse(
    "Analyze this transaction for fraud risk",
    { useRAG: true }
);

console.log(response.content);
```

### Banking-Specific Features

```javascript
// Fraud Detection
const fraudAnalysis = await llmService.analyzeFraudRisk({
    amount: 5000,
    merchant: "Unknown Vendor",
    location: "Foreign Country",
    time: "3:00 AM"
});

// Compliance Check
const complianceResult = await llmService.checkCompliance(
    document,
    ["Basel III", "Dodd-Frank", "GDPR"]
);

// Risk Assessment
const riskAnalysis = await llmService.analyzeRisk(
    portfolioData,
    "credit_risk",
    { criteria: "conservative" }
);
```

## Configuration

### Environment Variables

```env
# Primary LLM Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_claude_key
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com

# Provider Settings
LLM_PRIMARY_PROVIDER=openai
LLM_FALLBACK_PROVIDERS=claude,azure
LLM_ENABLE_FALLBACK=true

# RAG Configuration
RAG_ENABLED=true
RAG_TOP_K_RESULTS=5
RAG_SIMILARITY_THRESHOLD=0.7

# ChromaDB Settings
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=banking_knowledge

# Banking Features
LLM_ENABLE_FRAUD_DETECTION=true
LLM_ENABLE_COMPLIANCE_CHECK=true
LLM_ANONYMIZE_DATA=true
LLM_COMPLIANCE_MODE=strict
```

### Advanced Configuration

```javascript
const config = {
    providers: {
        openai: {
            enabled: true,
            model: "gpt-4-turbo-preview",
            temperature: 0.3,
            maxTokens: 4000
        }
    },
    fallback: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000
    },
    rateLimit: {
        rpm: 60,
        tpm: 100000
    },
    compliance: {
        mode: "strict",
        anonymizeData: true,
        logOperations: true
    }
};
```

## API Reference

### LLMService

#### `generateResponse(prompt, options)`
Generate AI response with fallback support.

**Parameters:**
- `prompt` (string|array): Input prompt or conversation history
- `options` (object): Generation options
  - `provider` (string): Specific provider to use
  - `temperature` (number): Response randomness (0-1)
  - `maxTokens` (number): Maximum response length
  - `useRAG` (boolean): Enable RAG enhancement

**Returns:** `Promise<Response>`

#### `analyzeFraudRisk(transactionData, options)`
Analyze transaction for fraud indicators.

**Parameters:**
- `transactionData` (object): Transaction details
- `options` (object): Analysis options

**Returns:** `Promise<FraudAnalysis>`

#### `checkCompliance(document, regulations, options)`
Check document compliance against regulations.

**Parameters:**
- `document` (string): Document to analyze
- `regulations` (array): Applicable regulations
- `options` (object): Compliance options

**Returns:** `Promise<ComplianceReport>`

### RAGPipeline

#### `retrieve(query, options)`
Retrieve relevant context for query.

**Parameters:**
- `query` (string): Search query
- `options` (object): Retrieval options
  - `topK` (number): Number of results
  - `threshold` (number): Similarity threshold
  - `filters` (object): Search filters

**Returns:** `Promise<Context[]>`

#### `addDocuments(documents, options)`
Add documents to knowledge base.

**Parameters:**
- `documents` (array): Documents to add
- `options` (object): Processing options

**Returns:** `Promise<AddResult>`

### PromptTemplateManager

#### `getTemplate(name)`
Get prompt template by name.

**Parameters:**
- `name` (string): Template name

**Returns:** `Promise<PromptTemplate>`

#### Banking Templates Available:
- `fraud_detection`: Transaction fraud analysis
- `compliance_check`: Regulatory compliance
- `risk_analysis`: Risk assessment
- `customer_service`: Customer support
- `transaction_analysis`: Payment analysis
- `regulatory_report`: Compliance reporting
- `credit_assessment`: Credit evaluation
- `market_analysis`: Market intelligence

## Monitoring and Metrics

### Health Check

```javascript
const health = await llmService.healthCheck();
console.log(health);
/*
{
  status: "healthy",
  providers: {
    openai: { status: "healthy", model: "gpt-4-turbo-preview" },
    claude: { status: "healthy", model: "claude-3-sonnet-20240229" }
  },
  features: {
    rag: true,
    embeddings: true,
    compliance: "strict"
  }
}
*/
```

### Metrics

```javascript
const metrics = llmService.getMetrics();
console.log(metrics);
/*
{
  requests: { openai: { count: 150, total: 150, average: 1 } },
  tokens: { openai: { count: 150, total: 45000, average: 300 } },
  latency: { openai: { count: 150, total: 75000, average: 500 } },
  errors: { claude: { count: 2, total: 2, average: 1 } }
}
*/
```

## Error Handling

### Custom Error Types

```javascript
const {
    LLMError,
    RateLimitError,
    TimeoutError,
    ComplianceError
} = require('./utils/LLMErrors');

try {
    const response = await llmService.generateResponse(prompt);
} catch (error) {
    if (error instanceof RateLimitError) {
        // Handle rate limiting
        await delay(error.retryAfter * 1000);
    } else if (error instanceof ComplianceError) {
        // Handle compliance violation
        logger.warn('Compliance issue:', error.message);
    } else {
        // Handle general LLM errors
        logger.error('LLM error:', error);
    }
}
```

## Testing

### Run Tests

```bash
# Run all LLM integration tests
npm test src/tests/services/llm-integration/

# Run specific test suite
npm test src/tests/services/llm-integration/LLMService.test.js
npm test src/tests/services/llm-integration/RAGPipeline.test.js

# Run with coverage
npm test -- --coverage src/services/llm-integration/
```

### Test Coverage

The test suite includes:
- ✅ Multi-provider fallback scenarios
- ✅ Banking domain feature validation
- ✅ RAG pipeline integration
- ✅ Compliance and security checks
- ✅ Error handling and recovery
- ✅ Performance and rate limiting
- ✅ Metrics and monitoring

## Performance Optimization

### Caching Strategy

```javascript
// Enable caching for better performance
const config = {
    performance: {
        cacheEnabled: true,
        cacheTTL: 3600000, // 1 hour
        parallelRetrieval: true,
        maxConcurrency: 5
    }
};
```

### Batch Processing

```javascript
// Process multiple requests efficiently
const embeddings = await embeddingService.generateEmbeddingsBatch(
    documents,
    { batchSize: 100, continueOnError: true }
);
```

## Security Best Practices

### Data Protection

1. **API Key Security**: Store keys in environment variables
2. **Data Anonymization**: Enable automatic PII masking
3. **Audit Logging**: Track all AI operations
4. **Rate Limiting**: Prevent API abuse
5. **Compliance Modes**: Configure for regulatory requirements

### Compliance Features

```javascript
const complianceConfig = {
    compliance: {
        mode: "strict",           // strict|moderate|relaxed
        anonymizeData: true,      // Mask sensitive information
        logOperations: true,      // Audit trail
        encryptLogs: true,        // Encrypted storage
        dataRetention: 90         // Days to retain logs
    }
};
```

## Troubleshooting

### Common Issues

1. **Provider API Failures**
   - Check API keys and quotas
   - Verify network connectivity
   - Monitor rate limits

2. **RAG Performance**
   - Optimize chunk sizes
   - Adjust similarity thresholds
   - Check vector database health

3. **Compliance Errors**
   - Review data anonymization settings
   - Validate input sanitization
   - Check compliance mode configuration

### Debug Mode

```javascript
// Enable detailed logging
process.env.DEBUG_LLM_OPERATIONS = "true";
process.env.LLM_LOG_REQUESTS = "true";
```

## Contributing

1. Follow existing code patterns
2. Add comprehensive tests
3. Update documentation
4. Ensure compliance with banking standards

## License

Enterprise License - See LICENSE file for details.

---

## Banking Domain Knowledge

The system includes specialized knowledge for:

- **Anti-Money Laundering (AML)**
- **Know Your Customer (KYC)**
- **Basel III Compliance**
- **Dodd-Frank Regulations**
- **GDPR Data Protection**
- **PCI DSS Security**
- **SOX Compliance**
- **FFIEC Guidelines**

For detailed banking domain documentation, see [Banking Domain Guide](./banking-domain.md).