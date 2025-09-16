/**
 * Validation System Usage Examples
 * 
 * This file demonstrates how to use the comprehensive validation system
 * with real-world examples and best practices.
 */

import {
  createValidator,
  createSchemaValidator,
  createValidationSuite,
  setupValidation,
  RealTimeValidator,
  StringValidators,
  ArrayValidators,
  AsyncValidators,
  CrossFieldValidators,
  ValidationPresets,
  KBValidationRules,
  ValidationErrorFormatter,
  getValidationMessage,
  ValidationEngine,
  ValidationResult,
  FieldValidationState,
  KBEntry
} from './index';

/**
 * Example 1: Basic KB Entry Validation
 */
export async function basicValidationExample() {
  console.log('=== Basic Validation Example ===');
  
  // Create a validator with default rules
  const validator = createValidator('en');
  
  // Sample KB entry with issues
  const kbEntry: Partial<KBEntry> = {
    title: 'Error', // Too short
    problem: 'Job failed', // Too short
    solution: 'Fix it', // Too short and unstructured
    category: 'InvalidCategory', // Invalid enum value
    tags: ['tag1', 'tag1', 'invalid tag!'], // Duplicates and invalid format
    severity: 'urgent' as any // Invalid severity
  };
  
  // Validate the entry
  const result = await validator.validateEntry(kbEntry);
  
  console.log('Validation Result:', ValidationErrorFormatter.toText(result));
  console.log('JSON Output:', JSON.stringify(ValidationErrorFormatter.toJSON(result), null, 2));
}

/**
 * Example 2: Schema-Based Validation
 */
export async function schemaValidationExample() {
  console.log('\n=== Schema Validation Example ===');
  
  const schemaValidator = createSchemaValidator();
  
  // Valid KB entry for creation
  const validEntry: Partial<KBEntry> = {
    title: 'VSAM Status 35 - File Not Found Error',
    problem: 'Job abends with VSAM status code 35 when trying to open the customer master file. The error occurs during the nightly batch processing and affects multiple programs that read from CUST.MASTER.VSAM dataset.',
    solution: '1. Verify the dataset exists using LISTCAT command\n2. Check the JCL DD statement for correct DSN parameter\n3. Ensure the file is properly cataloged\n4. Verify RACF permissions using LISTDSD command\n5. Check if the file was deleted or renamed recently\n6. Confirm the correct catalog is being used',
    category: 'VSAM',
    severity: 'high',
    tags: ['vsam', 'status-35', 'file-not-found', 'catalog', 'batch']
  };
  
  // Validate for creation
  const createResult = await schemaValidator.validateKBEntryCreate(validEntry);
  console.log('Create Validation:', createResult.isValid ? '✓ Valid' : '✗ Invalid');
  
  if (!createResult.isValid) {
    console.log('Errors:', createResult.errors.map(e => `${e.field}: ${e.message}`));
  }
  
  // Validate for update (with ID)
  const updateEntry = { ...validEntry, id: 'kb-123', title: 'Updated Title - VSAM Status 35 Error' };
  const updateResult = await schemaValidator.validateKBEntryUpdate(updateEntry);
  console.log('Update Validation:', updateResult.isValid ? '✓ Valid' : '✗ Invalid');
}

/**
 * Example 3: Real-Time Validation Setup
 */
export async function realTimeValidationExample() {
  console.log('\n=== Real-Time Validation Example ===');
  
  // Create real-time validator with custom config
  const realTimeValidator = new RealTimeValidator({
    debounceMs: 300,
    validateOnChange: true,
    validateOnBlur: true,
    autoSuggest: true,
    maxSuggestions: 5
  });
  
  // Setup fields for validation
  realTimeValidator.setupField('title', {
    rules: KBValidationRules.title,
    suggestions: true
  });
  
  realTimeValidator.setupField('category', {
    rules: KBValidationRules.category,
    suggestions: true
  });
  
  // Listen for validation events
  realTimeValidator.on('validation', (event) => {
    console.log(`Validation Event - ${event.type}:`, {
      field: event.field,
      isValid: (event.state as FieldValidationState).isValid,
      errors: (event.state as FieldValidationState).errors,
      suggestions: (event.state as FieldValidationState).suggestions
    });
  });
  
  // Simulate user typing
  console.log('Simulating user input...');
  
  // Short title (will trigger validation error)
  await realTimeValidator.validateField('title', 'Error', 'change');
  
  // Better title (will pass validation)
  await realTimeValidator.validateField('title', 'VSAM Status 35 - File Not Found', 'change');
  
  // Invalid category (with suggestion)
  await realTimeValidator.validateField('category', 'Vsam', 'blur');
  
  // Valid category
  await realTimeValidator.validateField('category', 'VSAM', 'blur');
}

/**
 * Example 4: Custom Validation Rules
 */
export async function customValidationExample() {
  console.log('\n=== Custom Validation Example ===');
  
  const validator = createValidator();
  
  // Create custom rule for mainframe error codes
  const errorCodeValidator = {
    name: 'mainframeErrorCode',
    validate: (value: string) => {
      const errorPatterns = [
        /^S\d{3}[A-Z]?$/, // S0C7, S0C4
        /^[A-Z]\d{3,4}[A-Z]?$/, // IEF212I, WER027A
        /^\w+CODE\s*-?\d+$/i, // SQLCODE -904, RETURN-CODE 8
        /^U\d{4}$/ // U0778
      ];
      
      const hasErrorCode = errorPatterns.some(pattern => pattern.test(value));
      
      return {
        isValid: hasErrorCode,
        errors: !hasErrorCode ? [{
          field: '',
          code: 'INVALID_ERROR_CODE',
          message: 'Must contain a valid mainframe error code (S0C7, IEF212I, SQLCODE -904, etc.)',
          value
        }] : [],
        warnings: []
      };
    },
    errorMessage: 'Invalid mainframe error code format'
  };
  
  // Register custom field validation
  validator.registerField({
    name: 'errorCode',
    rules: [
      StringValidators.required('Error code is required'),
      errorCodeValidator
    ]
  });
  
  // Test the custom validator
  const testCases = ['S0C7', 'IEF212I', 'SQLCODE -904', 'U0778', 'InvalidCode'];
  
  for (const testCase of testCases) {
    const result = await validator.validateField('errorCode', testCase);
    console.log(`Error code "${testCase}":`, result.isValid ? '✓ Valid' : '✗ Invalid');
    if (!result.isValid) {
      console.log('  Error:', result.errors[0].message);
    }
  }
}

/**
 * Example 5: Async Validation with Database Checks
 */
export async function asyncValidationExample() {
  console.log('\n=== Async Validation Example ===');
  
  // Mock database function
  const mockCheckTitleUnique = async (title: string): Promise<boolean> => {
    // Simulate database lookup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Mock some existing titles
    const existingTitles = [
      'VSAM Status 35 - File Not Found',
      'S0C7 Data Exception in COBOL',
      'JCL Error - Dataset Not Found'
    ];
    
    return !existingTitles.includes(title);
  };
  
  // Create unique title validator
  const uniqueTitleValidator = AsyncValidators.unique(
    mockCheckTitleUnique,
    'Title already exists in the knowledge base'
  );
  
  // Create validator with async rule
  const validator = createValidator();
  validator.registerField({
    name: 'title',
    rules: [
      ...KBValidationRules.title,
      uniqueTitleValidator
    ]
  });
  
  // Test with duplicate title
  console.log('Testing duplicate title...');
  const duplicateResult = await validator.validateField('title', 'VSAM Status 35 - File Not Found');
  console.log('Duplicate check:', duplicateResult.isValid ? '✓ Unique' : '✗ Duplicate');
  
  // Test with unique title
  console.log('Testing unique title...');
  const uniqueResult = await validator.validateField('title', 'New CICS ASRA Error Resolution');
  console.log('Unique check:', uniqueResult.isValid ? '✓ Unique' : '✗ Duplicate');
}

/**
 * Example 6: Internationalization
 */
export async function i18nValidationExample() {
  console.log('\n=== Internationalization Example ===');
  
  // Create validators for different locales
  const englishValidator = createValidator('en');
  const portugueseValidator = createValidator('pt');
  const spanishValidator = createValidator('es');
  
  const invalidEntry: Partial<KBEntry> = {
    title: '', // Empty title
    problem: '', // Empty problem
    category: 'Invalid'
  };
  
  // Validate in different languages
  const enResult = await englishValidator.validateEntry(invalidEntry);
  const ptResult = await portugueseValidator.validateEntry(invalidEntry);
  const esResult = await spanishValidator.validateEntry(invalidEntry);
  
  console.log('English errors:', enResult.errors.map(e => e.message));
  console.log('Portuguese errors:', ptResult.errors.map(e => e.message));
  console.log('Spanish errors:', esResult.errors.map(e => e.message));
  
  // Custom message usage
  console.log('\nCustom messages:');
  console.log('English:', getValidationMessage('REQUIRED_FIELD', { field: 'Title' }, 'en'));
  console.log('Portuguese:', getValidationMessage('REQUIRED_FIELD', { field: 'Título' }, 'pt'));
  console.log('Spanish:', getValidationMessage('REQUIRED_FIELD', { field: 'Título' }, 'es'));
}

/**
 * Example 7: Validation Presets for Different Scenarios
 */
export async function validationPresetsExample() {
  console.log('\n=== Validation Presets Example ===');
  
  // Setup validation for different scenarios
  const strictValidation = setupValidation('strict', undefined, 'en');
  const lenientValidation = setupValidation('lenient', undefined, 'en');
  const realTimeValidation = setupValidation('realTime', { maxSuggestions: 3 }, 'en');
  
  const testEntry: Partial<KBEntry> = {
    title: 'Error in system', // Somewhat short, lacks mainframe terms
    problem: 'Job fails sometimes with an error in the batch processing system', // Could be more detailed
    solution: 'Check the logs and fix the issue', // Unstructured, lacks steps
    category: 'Batch',
    tags: ['error', 'batch']
  };
  
  // Test with strict validation
  console.log('Strict validation (shows warnings as errors):');
  const strictResult = await strictValidation.engine.validateEntry(testEntry);
  console.log(ValidationErrorFormatter.toText(strictResult));
  
  // Test with lenient validation
  console.log('\nLenient validation (warnings only):');
  const lenientResult = await lenientValidation.engine.validateEntry(testEntry);
  console.log(ValidationErrorFormatter.toText(lenientResult));
  
  // Show preset configurations
  console.log('\nValidation Preset Configurations:');
  Object.entries(ValidationPresets).forEach(([name, config]) => {
    console.log(`${name}:`, JSON.stringify(config, null, 2));
  });
}

/**
 * Example 8: Performance Monitoring
 */
export async function performanceMonitoringExample() {
  console.log('\n=== Performance Monitoring Example ===');
  
  const validator = createValidator();
  
  // Simulate multiple validation operations
  const testEntries = [
    { title: 'Valid Title', problem: 'Valid problem description with sufficient detail', solution: '1. Step one\n2. Step two', category: 'JCL' },
    { title: 'Another Valid Entry', problem: 'Another problem with good description and context', solution: '1. Check this\n2. Verify that', category: 'VSAM' },
    { title: '', problem: 'Invalid', solution: '', category: 'Invalid' } // Invalid entry
  ];
  
  console.log('Running performance test...');
  const startTime = Date.now();
  
  const results = [];
  for (let i = 0; i < 100; i++) {
    const entry = testEntries[i % testEntries.length];
    const validationStart = Date.now();
    const result = await validator.validateEntry(entry);
    const validationTime = Date.now() - validationStart;
    
    results.push({
      duration: validationTime,
      isValid: result.isValid,
      errorCount: result.errors.length
    });
  }
  
  const totalTime = Date.now() - startTime;
  const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const successRate = results.filter(r => r.isValid).length / results.length;
  
  console.log(`Performance Results:`);
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Average validation time: ${avgTime.toFixed(2)}ms`);
  console.log(`  Success rate: ${(successRate * 100).toFixed(1)}%`);
  console.log(`  Validations per second: ${(100 / (totalTime / 1000)).toFixed(1)}`);
}

/**
 * Example 9: Complete Form Validation Workflow
 */
export async function completeFormValidationExample() {
  console.log('\n=== Complete Form Validation Workflow ===');
  
  // Create validation suite
  const validationSuite = createValidationSuite('en');
  
  // Simulate form data from user input
  const formData = {
    title: 'CICS ASRA Abend - Program Check',
    problem: 'Transaction abends with ASRA (0C4) when processing customer inquiry. Error occurs in CUSTINQ program at offset +000234. The abend happens intermittently, usually during high-volume periods.',
    solution: '1. Review the compile listing at offset +000234\n2. Check for uninitialized pointer or addressing issue\n3. Enable CEDF trace for detailed analysis\n4. Verify WORKING-STORAGE initialization\n5. Check COMMAREA length and usage\n6. Test with CICS trace if needed',
    category: 'CICS',
    severity: 'high',
    tags: ['cics', 'asra', 'abend', '0c4', 'program-check']
  };
  
  console.log('Validating complete form...');
  
  // Validate entire form
  const formResult = await validationSuite.validateEntry(formData);
  console.log('Form validation result:', formResult.isValid ? '✓ Valid' : '✗ Invalid');
  
  if (!formResult.isValid) {
    console.log('\nForm errors:');
    formResult.errors.forEach(error => {
      console.log(`  ${error.field}: ${error.message}`);
    });
  }
  
  if (formResult.warnings.length > 0) {
    console.log('\nForm warnings:');
    formResult.warnings.forEach(warning => {
      console.log(`  ${warning.field}: ${warning.message}`);
    });
  }
  
  // Validate individual fields
  console.log('\nIndividual field validation:');
  const fieldTests = [
    { field: 'title', value: formData.title },
    { field: 'problem', value: formData.problem },
    { field: 'solution', value: formData.solution },
    { field: 'category', value: formData.category },
    { field: 'tags', value: formData.tags }
  ];
  
  for (const test of fieldTests) {
    const fieldResult = await validationSuite.validateField(test.field, test.value);
    const status = fieldResult.isValid ? '✓' : '✗';
    console.log(`  ${test.field}: ${status}`);
    
    if (!fieldResult.isValid) {
      fieldResult.errors.forEach(error => {
        console.log(`    Error: ${error.message}`);
      });
    }
    
    if (fieldResult.warnings.length > 0) {
      fieldResult.warnings.forEach(warning => {
        console.log(`    Warning: ${warning.message}`);
      });
    }
  }
  
  // Show formatted output
  console.log('\n=== Formatted Validation Results ===');
  console.log('Text format:');
  console.log(ValidationErrorFormatter.toText(formResult));
  
  console.log('\nMarkdown format:');
  console.log(ValidationErrorFormatter.toMarkdown(formResult));
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🚀 Running Validation System Examples\n');
  
  try {
    await basicValidationExample();
    await schemaValidationExample();
    await realTimeValidationExample();
    await customValidationExample();
    await asyncValidationExample();
    await i18nValidationExample();
    await validationPresetsExample();
    await performanceMonitoringExample();
    await completeFormValidationExample();
    
    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example failed:', error);
  }
}

// Export individual examples for selective testing
export {
  basicValidationExample,
  schemaValidationExample,
  realTimeValidationExample,
  customValidationExample,
  asyncValidationExample,
  i18nValidationExample,
  validationPresetsExample,
  performanceMonitoringExample,
  completeFormValidationExample
};

// If running this file directly, run all examples
if (require.main === module) {
  runAllExamples().catch(console.error);
}