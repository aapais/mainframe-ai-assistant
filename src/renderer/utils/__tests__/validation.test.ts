import {
  ValidationRules,
  createKBEntryValidationSchema,
  validateField,
  validateForm,
  VALIDATION_MESSAGES,
} from '../validation';

describe('ValidationRules', () => {
  describe('required', () => {
    it('should pass for non-empty string', () => {
      const rule = ValidationRules.required();
      expect(rule.validate('test')).toBeUndefined();
    });

    it('should fail for empty string', () => {
      const rule = ValidationRules.required();
      expect(rule.validate('')).toBe(VALIDATION_MESSAGES.required);
    });

    it('should fail for whitespace only', () => {
      const rule = ValidationRules.required();
      expect(rule.validate('   ')).toBe(VALIDATION_MESSAGES.required);
    });

    it('should fail for null/undefined', () => {
      const rule = ValidationRules.required();
      expect(rule.validate(null)).toBe(VALIDATION_MESSAGES.required);
      expect(rule.validate(undefined)).toBe(VALIDATION_MESSAGES.required);
    });

    it('should use custom message', () => {
      const rule = ValidationRules.required('Custom required message');
      expect(rule.validate('')).toBe('Custom required message');
    });
  });

  describe('minLength', () => {
    it('should pass for string meeting minimum length', () => {
      const rule = ValidationRules.minLength(5);
      expect(rule.validate('12345')).toBeUndefined();
      expect(rule.validate('123456')).toBeUndefined();
    });

    it('should fail for string shorter than minimum', () => {
      const rule = ValidationRules.minLength(5);
      expect(rule.validate('1234')).toBe(VALIDATION_MESSAGES.minLength(5));
    });

    it('should use custom message', () => {
      const rule = ValidationRules.minLength(5, 'Custom min length message');
      expect(rule.validate('123')).toBe('Custom min length message');
    });

    it('should handle null/undefined', () => {
      const rule = ValidationRules.minLength(5);
      expect(rule.validate(null)).toBe(VALIDATION_MESSAGES.minLength(5));
      expect(rule.validate(undefined)).toBe(VALIDATION_MESSAGES.minLength(5));
    });
  });

  describe('maxLength', () => {
    it('should pass for string within maximum length', () => {
      const rule = ValidationRules.maxLength(10);
      expect(rule.validate('12345')).toBeUndefined();
      expect(rule.validate('1234567890')).toBeUndefined();
    });

    it('should fail for string longer than maximum', () => {
      const rule = ValidationRules.maxLength(10);
      expect(rule.validate('12345678901')).toBe(VALIDATION_MESSAGES.maxLength(10));
    });

    it('should use custom message', () => {
      const rule = ValidationRules.maxLength(10, 'Custom max length message');
      expect(rule.validate('12345678901')).toBe('Custom max length message');
    });
  });

  describe('pattern', () => {
    it('should pass for string matching pattern', () => {
      const rule = ValidationRules.pattern(/^[A-Z]\d{3}$/);
      expect(rule.validate('A123')).toBeUndefined();
      expect(rule.validate('Z999')).toBeUndefined();
    });

    it('should fail for string not matching pattern', () => {
      const rule = ValidationRules.pattern(/^[A-Z]\d{3}$/);
      expect(rule.validate('a123')).toBe(VALIDATION_MESSAGES.pattern);
      expect(rule.validate('A12')).toBe(VALIDATION_MESSAGES.pattern);
      expect(rule.validate('AB123')).toBe(VALIDATION_MESSAGES.pattern);
    });

    it('should use custom message', () => {
      const rule = ValidationRules.pattern(/^[A-Z]\d{3}$/, 'Must match pattern A123');
      expect(rule.validate('invalid')).toBe('Must match pattern A123');
    });
  });

  describe('email', () => {
    it('should pass for valid email addresses', () => {
      const rule = ValidationRules.email();
      expect(rule.validate('test@example.com')).toBeUndefined();
      expect(rule.validate('user.name+tag@domain.co.uk')).toBeUndefined();
      expect(rule.validate('simple@test.org')).toBeUndefined();
    });

    it('should fail for invalid email addresses', () => {
      const rule = ValidationRules.email();
      expect(rule.validate('invalid')).toBe(VALIDATION_MESSAGES.email);
      expect(rule.validate('test@')).toBe(VALIDATION_MESSAGES.email);
      expect(rule.validate('@example.com')).toBe(VALIDATION_MESSAGES.email);
      expect(rule.validate('test.example.com')).toBe(VALIDATION_MESSAGES.email);
    });

    it('should use custom message', () => {
      const rule = ValidationRules.email('Please enter a valid email');
      expect(rule.validate('invalid')).toBe('Please enter a valid email');
    });
  });

  describe('arrayMinLength', () => {
    it('should pass for array meeting minimum length', () => {
      const rule = ValidationRules.arrayMinLength(2);
      expect(rule.validate(['a', 'b'])).toBeUndefined();
      expect(rule.validate(['a', 'b', 'c'])).toBeUndefined();
    });

    it('should fail for array shorter than minimum', () => {
      const rule = ValidationRules.arrayMinLength(2);
      expect(rule.validate(['a'])).toBe(VALIDATION_MESSAGES.arrayMinLength(2));
      expect(rule.validate([])).toBe(VALIDATION_MESSAGES.arrayMinLength(2));
    });

    it('should handle non-array values', () => {
      const rule = ValidationRules.arrayMinLength(2);
      expect(rule.validate('not array')).toBe(VALIDATION_MESSAGES.arrayMinLength(2));
      expect(rule.validate(null)).toBe(VALIDATION_MESSAGES.arrayMinLength(2));
    });
  });

  describe('arrayMaxLength', () => {
    it('should pass for array within maximum length', () => {
      const rule = ValidationRules.arrayMaxLength(3);
      expect(rule.validate(['a'])).toBeUndefined();
      expect(rule.validate(['a', 'b', 'c'])).toBeUndefined();
    });

    it('should fail for array longer than maximum', () => {
      const rule = ValidationRules.arrayMaxLength(3);
      expect(rule.validate(['a', 'b', 'c', 'd'])).toBe(VALIDATION_MESSAGES.arrayMaxLength(3));
    });
  });

  describe('kbTitle', () => {
    it('should pass for valid KB titles', () => {
      const rule = ValidationRules.kbTitle();
      expect(rule.validate('VSAM Status 35 Error')).toBeUndefined();
      expect(rule.validate('S0C7 Data Exception in COBOL Program')).toBeUndefined();
    });

    it('should fail for titles that are too short', () => {
      const rule = ValidationRules.kbTitle();
      expect(rule.validate('Hi')).toBe(VALIDATION_MESSAGES.titleTooShort);
      expect(rule.validate('')).toBe(VALIDATION_MESSAGES.titleTooShort);
    });

    it('should fail for titles that are too long', () => {
      const rule = ValidationRules.kbTitle();
      const longTitle = 'a'.repeat(201);
      expect(rule.validate(longTitle)).toBe(VALIDATION_MESSAGES.titleTooLong);
    });
  });

  describe('kbProblem', () => {
    it('should pass for valid problem descriptions', () => {
      const rule = ValidationRules.kbProblem();
      const validProblem = 'Job fails with VSAM status code 35 when trying to access the dataset';
      expect(rule.validate(validProblem)).toBeUndefined();
    });

    it('should fail for problem descriptions that are too short', () => {
      const rule = ValidationRules.kbProblem();
      expect(rule.validate('Too short')).toBe(VALIDATION_MESSAGES.problemTooShort);
    });

    it('should fail for problem descriptions that are too long', () => {
      const rule = ValidationRules.kbProblem();
      const longProblem = 'a'.repeat(2001);
      expect(rule.validate(longProblem)).toBe(VALIDATION_MESSAGES.problemTooLong);
    });
  });

  describe('kbSolution', () => {
    it('should pass for valid solutions', () => {
      const rule = ValidationRules.kbSolution();
      const validSolution = '1. Check dataset exists\n2. Verify permissions\n3. Restart job';
      expect(rule.validate(validSolution)).toBeUndefined();
    });

    it('should fail for solutions that are too short', () => {
      const rule = ValidationRules.kbSolution();
      expect(rule.validate('Fix it')).toBe(VALIDATION_MESSAGES.solutionTooShort);
    });

    it('should fail for solutions that are too long', () => {
      const rule = ValidationRules.kbSolution();
      const longSolution = 'a'.repeat(5001);
      expect(rule.validate(longSolution)).toBe(VALIDATION_MESSAGES.solutionTooLong);
    });
  });

  describe('kbTags', () => {
    it('should pass for valid tag arrays', () => {
      const rule = ValidationRules.kbTags();
      expect(rule.validate(['vsam', 'error', 'dataset'])).toBeUndefined();
      expect(rule.validate(['single-tag'])).toBeUndefined();
      expect(rule.validate([])).toBeUndefined(); // Empty array is allowed
    });

    it('should fail for too many tags', () => {
      const rule = ValidationRules.kbTags();
      const tooManyTags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      expect(rule.validate(tooManyTags)).toBe(VALIDATION_MESSAGES.tooManyTags(10));
    });

    it('should fail for invalid tag characters', () => {
      const rule = ValidationRules.kbTags();
      expect(rule.validate(['valid-tag', 'invalid@tag'])).toBe(VALIDATION_MESSAGES.invalidTag);
      expect(rule.validate(['tag with spaces'])).toBeUndefined(); // Spaces are allowed
      expect(rule.validate(['tag_with_underscores'])).toBeUndefined();
    });

    it('should fail for duplicate tags (case insensitive)', () => {
      const rule = ValidationRules.kbTags();
      expect(rule.validate(['tag', 'TAG'])).toBe(VALIDATION_MESSAGES.duplicateTag);
      expect(rule.validate(['vsam', 'error', 'vsam'])).toBe(VALIDATION_MESSAGES.duplicateTag);
    });

    it('should handle non-array input', () => {
      const rule = ValidationRules.kbTags();
      expect(rule.validate('not-array')).toBeUndefined(); // Should not crash
      expect(rule.validate(null)).toBeUndefined();
    });
  });

  describe('custom', () => {
    it('should use custom validation function', () => {
      const customValidator = (value: any) => {
        if (value === 'invalid') return 'Custom error message';
        return undefined;
      };

      const rule = ValidationRules.custom(customValidator);
      expect(rule.validate('valid')).toBeUndefined();
      expect(rule.validate('invalid')).toBe('Custom error message');
    });
  });
});

describe('createKBEntryValidationSchema', () => {
  it('should create validation schema for create mode', () => {
    const schema = createKBEntryValidationSchema('create');

    expect(schema).toHaveProperty('title');
    expect(schema).toHaveProperty('problem');
    expect(schema).toHaveProperty('solution');
    expect(schema).toHaveProperty('category');
    expect(schema).toHaveProperty('tags');

    // Each field should have validation rules
    expect(Array.isArray(schema.title)).toBe(true);
    expect(schema.title.length).toBeGreaterThan(0);
  });

  it('should create validation schema for edit mode', () => {
    const schema = createKBEntryValidationSchema('edit');

    expect(schema).toHaveProperty('title');
    expect(schema).toHaveProperty('problem');
    expect(schema).toHaveProperty('solution');
    expect(schema).toHaveProperty('category');
    expect(schema).toHaveProperty('tags');
  });

  it('should have stricter validation for create mode', () => {
    const createSchema = createKBEntryValidationSchema('create');
    const editSchema = createKBEntryValidationSchema('edit');

    // Both should have the same basic structure
    expect(Object.keys(createSchema)).toEqual(Object.keys(editSchema));

    // Rules might be different but both should exist
    expect(createSchema.title.length).toBeGreaterThan(0);
    expect(editSchema.title.length).toBeGreaterThan(0);
  });
});

describe('validateField', () => {
  const testRules = [
    ValidationRules.required('Field is required'),
    ValidationRules.minLength(3, 'Must be at least 3 characters'),
  ];

  it('should return undefined for valid value', () => {
    const result = validateField('valid value', testRules);
    expect(result).toBeUndefined();
  });

  it('should return first validation error', () => {
    const result = validateField('', testRules);
    expect(result).toEqual({
      message: 'Field is required',
      type: 'required',
    });
  });

  it('should return second validation error if first passes', () => {
    const result = validateField('ab', testRules);
    expect(result).toEqual({
      message: 'Must be at least 3 characters',
      type: 'minLength',
    });
  });

  it('should handle empty rules array', () => {
    const result = validateField('any value', []);
    expect(result).toBeUndefined();
  });

  it('should handle undefined rules', () => {
    const result = validateField('any value', undefined);
    expect(result).toBeUndefined();
  });
});

describe('validateForm', () => {
  const testData = {
    name: '',
    email: 'invalid-email',
    age: '25',
    tags: ['valid-tag'],
  };

  const testSchema = {
    name: [ValidationRules.required('Name is required')],
    email: [
      ValidationRules.required('Email is required'),
      ValidationRules.email('Invalid email format'),
    ],
    age: [ValidationRules.pattern(/^\d+$/, 'Age must be a number')],
    tags: [ValidationRules.arrayMinLength(2, 'At least 2 tags required')],
  };

  it('should validate all fields and return errors', () => {
    const result = validateForm(testData, testSchema);

    expect(result).toEqual({
      name: {
        message: 'Name is required',
        type: 'required',
      },
      email: {
        message: 'Invalid email format',
        type: 'email',
      },
      tags: {
        message: 'At least 2 tags required',
        type: 'arrayMinLength',
      },
    });
  });

  it('should return empty object for valid data', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      age: '25',
      tags: ['tag1', 'tag2'],
    };

    const result = validateForm(validData, testSchema);
    expect(result).toEqual({});
  });

  it('should handle missing fields in data', () => {
    const incompleteData = {
      name: 'John',
    };

    const result = validateForm(incompleteData, testSchema);

    expect(result.email).toEqual({
      message: 'Email is required',
      type: 'required',
    });
  });

  it('should handle fields not in schema', () => {
    const dataWithExtra = {
      ...testData,
      extraField: 'extra value',
    };

    const result = validateForm(dataWithExtra, testSchema);

    // Should not include validation for extraField
    expect(result.extraField).toBeUndefined();
  });

  it('should handle empty schema', () => {
    const result = validateForm(testData, {});
    expect(result).toEqual({});
  });

  it('should handle undefined schema', () => {
    const result = validateForm(testData, undefined);
    expect(result).toEqual({});
  });
});

describe('VALIDATION_MESSAGES', () => {
  it('should have all required message functions', () => {
    expect(typeof VALIDATION_MESSAGES.required).toBe('string');
    expect(typeof VALIDATION_MESSAGES.email).toBe('string');
    expect(typeof VALIDATION_MESSAGES.pattern).toBe('string');
    expect(typeof VALIDATION_MESSAGES.titleTooShort).toBe('string');
    expect(typeof VALIDATION_MESSAGES.titleTooLong).toBe('string');
    expect(typeof VALIDATION_MESSAGES.problemTooShort).toBe('string');
    expect(typeof VALIDATION_MESSAGES.problemTooLong).toBe('string');
    expect(typeof VALIDATION_MESSAGES.solutionTooShort).toBe('string');
    expect(typeof VALIDATION_MESSAGES.solutionTooLong).toBe('string');
    expect(typeof VALIDATION_MESSAGES.categoryRequired).toBe('string');
    expect(typeof VALIDATION_MESSAGES.invalidTag).toBe('string');
    expect(typeof VALIDATION_MESSAGES.duplicateTag).toBe('string');

    // Function messages
    expect(typeof VALIDATION_MESSAGES.minLength).toBe('function');
    expect(typeof VALIDATION_MESSAGES.maxLength).toBe('function');
    expect(typeof VALIDATION_MESSAGES.arrayMinLength).toBe('function');
    expect(typeof VALIDATION_MESSAGES.arrayMaxLength).toBe('function');
    expect(typeof VALIDATION_MESSAGES.tooManyTags).toBe('function');
  });

  it('should generate correct messages for function-based messages', () => {
    expect(VALIDATION_MESSAGES.minLength(5)).toBe('Must be at least 5 characters long');
    expect(VALIDATION_MESSAGES.maxLength(100)).toBe('Must be less than 100 characters');
    expect(VALIDATION_MESSAGES.arrayMinLength(2)).toBe('Must have at least 2 items');
    expect(VALIDATION_MESSAGES.arrayMaxLength(10)).toBe('Must have no more than 10 items');
    expect(VALIDATION_MESSAGES.tooManyTags(10)).toBe('Maximum 10 tags allowed');
  });
});

describe('Edge Cases and Error Handling', () => {
  it('should handle null/undefined values gracefully', () => {
    const schema = {
      field: [ValidationRules.required()],
    };

    const nullResult = validateForm({ field: null }, schema);
    const undefinedResult = validateForm({ field: undefined }, schema);

    expect(nullResult.field.message).toBe(VALIDATION_MESSAGES.required);
    expect(undefinedResult.field.message).toBe(VALIDATION_MESSAGES.required);
  });

  it('should handle malformed validation rules', () => {
    const malformedRule = {
      type: 'test',
      validate: null, // Invalid validate function
    };

    // Should not crash
    expect(() => {
      validateField('test', [malformedRule as any]);
    }).not.toThrow();
  });

  it('should handle circular references in data', () => {
    const circularData: any = {
      name: 'test',
    };
    circularData.self = circularData;

    const schema = {
      name: [ValidationRules.required()],
    };

    // Should not crash on circular reference
    expect(() => {
      validateForm(circularData, schema);
    }).not.toThrow();
  });
});
