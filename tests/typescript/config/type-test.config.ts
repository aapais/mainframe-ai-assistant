/**
 * Type Test Configuration
 * Centralized configuration for TypeScript type testing framework
 */

export interface TypeTestConfig {
  // Type Checker Configuration
  typeChecker: {
    strictMode: boolean;
    allowAny: boolean;
    checkGenerics: boolean;
    validateConstraints: boolean;
    reportWarnings: boolean;
    cacheResults: boolean;
  };

  // Prop Validator Configuration
  propValidator: {
    strict: boolean;
    allowUndefined: boolean;
    allowNull: boolean;
    validateDefaults: boolean;
    checkEnums: boolean;
    validateEventHandlers: boolean;
    validateRefs: boolean;
  };

  // Generic Type Test Runner Configuration
  genericTester: {
    enableCoverage: boolean;
    trackPerformance: boolean;
    maxExecutionTime: number;
    parallelExecution: boolean;
    complexityThreshold: number;
  };

  // Interface Validator Configuration
  interfaceValidator: {
    strict: boolean;
    allowExtraProperties: boolean;
    allowExtraMethods: boolean;
    validateMethodImplementations: boolean;
    checkReturnTypes: boolean;
    validateGenerics: boolean;
    validateInheritance: boolean;
  };

  // Type Safety Reporter Configuration
  reporter: {
    includeDetails: boolean;
    includeRecommendations: boolean;
    includeTrends: boolean;
    includeCodeExamples: boolean;
    format: 'JSON' | 'HTML' | 'MARKDOWN' | 'PDF';
    outputPath: string;
    generateExecutiveSummary: boolean;
    trackHistoricalData: boolean;
  };

  // Test Environment Configuration
  environment: {
    testFramework: 'jest' | 'vitest' | 'mocha';
    reactVersion: string;
    typescriptVersion: string;
    enableSourceMaps: boolean;
    enableCoverage: boolean;
    timeouts: {
      typeCheck: number;
      propValidation: number;
      genericTest: number;
      interfaceValidation: number;
    };
  };

  // Advanced Features
  advanced: {
    enableASTAnalysis: boolean;
    enableCompilerAPIIntegration: boolean;
    enableTemplateTypeChecking: boolean;
    enableConditionalTypeValidation: boolean;
    enableMappedTypeSupport: boolean;
    enableUtilityTypeValidation: boolean;
  };
}

/**
 * Default configuration for type testing
 */
export const defaultTypeTestConfig: TypeTestConfig = {
  typeChecker: {
    strictMode: true,
    allowAny: false,
    checkGenerics: true,
    validateConstraints: true,
    reportWarnings: true,
    cacheResults: true
  },

  propValidator: {
    strict: true,
    allowUndefined: false,
    allowNull: false,
    validateDefaults: true,
    checkEnums: true,
    validateEventHandlers: true,
    validateRefs: true
  },

  genericTester: {
    enableCoverage: true,
    trackPerformance: true,
    maxExecutionTime: 5000,
    parallelExecution: true,
    complexityThreshold: 10
  },

  interfaceValidator: {
    strict: true,
    allowExtraProperties: false,
    allowExtraMethods: false,
    validateMethodImplementations: true,
    checkReturnTypes: true,
    validateGenerics: true,
    validateInheritance: true
  },

  reporter: {
    includeDetails: true,
    includeRecommendations: true,
    includeTrends: false,
    includeCodeExamples: true,
    format: 'JSON',
    outputPath: './reports/type-safety',
    generateExecutiveSummary: true,
    trackHistoricalData: true
  },

  environment: {
    testFramework: 'jest',
    reactVersion: '18.x',
    typescriptVersion: '5.x',
    enableSourceMaps: true,
    enableCoverage: true,
    timeouts: {
      typeCheck: 1000,
      propValidation: 500,
      genericTest: 2000,
      interfaceValidation: 1500
    }
  },

  advanced: {
    enableASTAnalysis: false,
    enableCompilerAPIIntegration: false,
    enableTemplateTypeChecking: true,
    enableConditionalTypeValidation: true,
    enableMappedTypeSupport: true,
    enableUtilityTypeValidation: true
  }
};

/**
 * Development configuration (more lenient)
 */
export const developmentTypeTestConfig: Partial<TypeTestConfig> = {
  typeChecker: {
    strictMode: false,
    allowAny: true,
    reportWarnings: true
  },

  propValidator: {
    strict: false,
    allowUndefined: true,
    allowNull: true
  },

  interfaceValidator: {
    strict: false,
    allowExtraProperties: true,
    allowExtraMethods: true
  },

  reporter: {
    includeDetails: false,
    includeRecommendations: true,
    format: 'MARKDOWN'
  }
};

/**
 * Production configuration (strict)
 */
export const productionTypeTestConfig: Partial<TypeTestConfig> = {
  typeChecker: {
    strictMode: true,
    allowAny: false,
    reportWarnings: false
  },

  propValidator: {
    strict: true,
    allowUndefined: false,
    allowNull: false
  },

  interfaceValidator: {
    strict: true,
    allowExtraProperties: false,
    allowExtraMethods: false
  },

  reporter: {
    includeDetails: true,
    includeRecommendations: true,
    includeTrends: true,
    format: 'HTML'
  }
};

/**
 * CI/CD configuration (fast and essential checks only)
 */
export const cicdTypeTestConfig: Partial<TypeTestConfig> = {
  typeChecker: {
    strictMode: true,
    allowAny: false,
    cacheResults: false
  },

  genericTester: {
    enableCoverage: false,
    trackPerformance: false,
    parallelExecution: true,
    maxExecutionTime: 2000
  },

  reporter: {
    includeDetails: false,
    includeRecommendations: false,
    includeTrends: false,
    includeCodeExamples: false,
    format: 'JSON'
  },

  environment: {
    enableSourceMaps: false,
    enableCoverage: false,
    timeouts: {
      typeCheck: 500,
      propValidation: 200,
      genericTest: 1000,
      interfaceValidation: 750
    }
  }
};

/**
 * Configuration builder utility
 */
export class TypeTestConfigBuilder {
  private config: TypeTestConfig;

  constructor(baseConfig: TypeTestConfig = defaultTypeTestConfig) {
    this.config = JSON.parse(JSON.stringify(baseConfig));
  }

  /**
   * Merges partial configuration
   */
  merge(partialConfig: Partial<TypeTestConfig>): this {
    this.config = this.deepMerge(this.config, partialConfig);
    return this;
  }

  /**
   * Sets environment-specific configuration
   */
  forEnvironment(env: 'development' | 'production' | 'ci' | 'test'): this {
    switch (env) {
      case 'development':
        return this.merge(developmentTypeTestConfig);
      case 'production':
        return this.merge(productionTypeTestConfig);
      case 'ci':
        return this.merge(cicdTypeTestConfig);
      case 'test':
        return this.merge({
          reporter: {
            includeDetails: true,
            format: 'MARKDOWN'
          }
        });
      default:
        return this;
    }
  }

  /**
   * Enables advanced features
   */
  enableAdvanced(features: Partial<TypeTestConfig['advanced']>): this {
    return this.merge({
      advanced: features
    });
  }

  /**
   * Sets timeout values
   */
  withTimeouts(timeouts: Partial<TypeTestConfig['environment']['timeouts']>): this {
    return this.merge({
      environment: {
        timeouts: {
          ...this.config.environment.timeouts,
          ...timeouts
        }
      }
    });
  }

  /**
   * Sets output configuration
   */
  withOutput(
    format: TypeTestConfig['reporter']['format'],
    outputPath?: string
  ): this {
    return this.merge({
      reporter: {
        format,
        outputPath: outputPath || this.config.reporter.outputPath
      }
    });
  }

  /**
   * Builds the final configuration
   */
  build(): TypeTestConfig {
    this.validateConfig();
    return this.config;
  }

  /**
   * Deep merge utility
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof target[key] === 'object' &&
          target[key] !== null &&
          !Array.isArray(target[key])
        ) {
          (result as any)[key] = this.deepMerge(target[key], source[key] as any);
        } else {
          (result as any)[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Validates the configuration
   */
  private validateConfig(): void {
    const { environment, genericTester, reporter } = this.config;

    // Validate timeouts
    if (environment.timeouts.typeCheck <= 0) {
      throw new Error('Type check timeout must be positive');
    }

    // Validate execution time
    if (genericTester.maxExecutionTime <= 0) {
      throw new Error('Max execution time must be positive');
    }

    // Validate output path
    if (!reporter.outputPath) {
      throw new Error('Output path must be specified');
    }

    // Validate format
    const validFormats = ['JSON', 'HTML', 'MARKDOWN', 'PDF'];
    if (!validFormats.includes(reporter.format)) {
      throw new Error(`Invalid format: ${reporter.format}`);
    }
  }
}

/**
 * Convenience function to create configuration
 */
export function createTypeTestConfig(
  environment: 'development' | 'production' | 'ci' | 'test' = 'development',
  customConfig?: Partial<TypeTestConfig>
): TypeTestConfig {
  const builder = new TypeTestConfigBuilder()
    .forEnvironment(environment);

  if (customConfig) {
    builder.merge(customConfig);
  }

  return builder.build();
}

/**
 * Configuration validation utilities
 */
export const configValidators = {
  /**
   * Validates if configuration is suitable for CI environment
   */
  isValidForCI(config: TypeTestConfig): boolean {
    return (
      config.genericTester.maxExecutionTime <= 5000 &&
      config.environment.timeouts.typeCheck <= 1000 &&
      !config.advanced.enableASTAnalysis // Too slow for CI
    );
  },

  /**
   * Validates if configuration has proper security settings
   */
  hasSecureSettings(config: TypeTestConfig): boolean {
    return (
      !config.typeChecker.allowAny &&
      config.typeChecker.strictMode &&
      config.propValidator.strict
    );
  },

  /**
   * Validates if configuration is performance-optimized
   */
  isPerformanceOptimized(config: TypeTestConfig): boolean {
    return (
      config.typeChecker.cacheResults &&
      config.genericTester.parallelExecution &&
      config.genericTester.maxExecutionTime <= 3000
    );
  }
};

export default defaultTypeTestConfig;