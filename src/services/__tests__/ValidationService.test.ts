import { ValidationService } from '../ValidationService';
import {
  ValidationConfig,
  KBEntryInput,
  KBEntryUpdate,
  SearchOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  CustomValidator,
  ServiceError
} from '../../types/services';

describe('ValidationService', () => {
  let validationService: ValidationService;
  let config: ValidationConfig;

  beforeEach(() => {
    config = {
      strict: false,
      sanitize: true,
      maxLength: {
        title: 200,
        problem: 5000,
        solution: 10000,
        tags: 30,
      },
      minLength: {
        title: 5,
        problem: 20,
        solution: 30,
      },
      patterns: {
        category: ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'],
        tag: /^[a-zA-Z0-9-_]+$/,
      },
    };
    validationService = new ValidationService(config);
  });

  describe('Entry Validation', () => {
    describe('Required Fields', () => {
      it('validates required fields are present', () => {
        const entry: KBEntryInput = {
          title: '',
          problem: '',
          solution: '',
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(3);
        expect(result.errors.map(e => e.field)).toEqual(['title', 'problem', 'solution']);
        expect(result.errors.every(e => e.code === 'REQUIRED')).toBe(true);
      });

      it('passes validation when all required fields are provided', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem description with enough content',
          solution: 'Valid solution with enough detailed content',
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('validates category is required', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: undefined as any,
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'category')).toBeDefined();
      });
    });

    describe('Field Length Validation', () => {
      it('validates title maximum length', () => {
        const entry: KBEntryInput = {
          title: 'a'.repeat(201),
          problem: 'Valid problem description',
          solution: 'Valid solution description',
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'title' && e.code === 'MAX_LENGTH')).toBeDefined();
      });

      it('validates title minimum length in strict mode', () => {
        const strictConfig = { ...config, strict: true };
        const strictService = new ValidationService(strictConfig);
        
        const entry: KBEntryInput = {
          title: 'a',
          problem: 'Valid problem description with enough content',
          solution: 'Valid solution description with enough content',
          category: 'JCL',
        };

        const result = strictService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'title' && e.code === 'MIN_LENGTH')).toBeDefined();
      });

      it('creates warnings for minimum length in non-strict mode', () => {
        const entry: KBEntryInput = {
          title: 'ab',
          problem: 'Short',
          solution: 'Short',
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(true); // Still valid in non-strict mode
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.find(w => w.field === 'title' && w.code === 'MIN_LENGTH')).toBeDefined();
      });

      it('validates problem maximum length', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'a'.repeat(5001),
          solution: 'Valid solution',
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'problem' && e.code === 'MAX_LENGTH')).toBeDefined();
      });

      it('validates solution maximum length', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'a'.repeat(10001),
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'solution' && e.code === 'MAX_LENGTH')).toBeDefined();
      });
    });

    describe('Category Validation', () => {
      it('validates valid categories', () => {
        const validCategories = ['JCL', 'VSAM', 'DB2', 'Batch', 'Functional', 'Other'];
        
        validCategories.forEach(category => {
          const entry: KBEntryInput = {
            title: 'Valid Title',
            problem: 'Valid problem description',
            solution: 'Valid solution description',
            category: category as any,
          };

          const result = validationService.validateEntry(entry);
          expect(result.valid).toBe(true);
        });
      });

      it('rejects invalid categories', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'INVALID_CATEGORY' as any,
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'category' && e.code === 'INVALID_CATEGORY')).toBeDefined();
      });
    });

    describe('Tags Validation', () => {
      it('validates valid tags array', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem description',
          solution: 'Valid solution description',
          category: 'JCL',
          tags: ['valid-tag', 'another_tag', 'tag123'],
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(true);
      });

      it('rejects non-array tags', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'JCL',
          tags: 'not-an-array' as any,
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'tags' && e.code === 'INVALID_TYPE')).toBeDefined();
      });

      it('rejects non-string tag elements', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'JCL',
          tags: ['valid-tag', 123, 'another-tag'] as any,
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'tags[1]' && e.code === 'INVALID_TYPE')).toBeDefined();
      });

      it('validates tag length', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'JCL',
          tags: ['a'.repeat(31)], // Exceeds maxLength
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'tags[0]' && e.code === 'MAX_LENGTH')).toBeDefined();
      });

      it('validates tag format', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'JCL',
          tags: ['invalid tag!', 'valid-tag'],
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'tags[0]' && e.code === 'INVALID_FORMAT')).toBeDefined();
      });

      it('warns about duplicate tags', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem description',
          solution: 'Valid solution description',
          category: 'JCL',
          tags: ['duplicate', 'unique', 'DUPLICATE'], // Case insensitive duplicates
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(true);
        expect(result.warnings.find(w => w.field === 'tags' && w.code === 'DUPLICATE_TAGS')).toBeDefined();
      });

      it('warns about too many tags', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem description',
          solution: 'Valid solution description',
          category: 'JCL',
          tags: Array.from({ length: 15 }, (_, i) => `tag${i}`),
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(true);
        expect(result.warnings.find(w => w.field === 'tags' && w.code === 'TOO_MANY_TAGS')).toBeDefined();
      });
    });

    describe('Created By Validation', () => {
      it('validates valid created_by field', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem description',
          solution: 'Valid solution description',
          category: 'JCL',
          created_by: 'user@example.com',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(true);
      });

      it('rejects empty created_by field', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'JCL',
          created_by: '',
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'created_by' && e.code === 'INVALID_FORMAT')).toBeDefined();
      });

      it('validates created_by length', () => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: 'Valid problem',
          solution: 'Valid solution',
          category: 'JCL',
          created_by: 'a'.repeat(101),
        };

        const result = validationService.validateEntry(entry);

        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.field === 'created_by' && e.code === 'MAX_LENGTH')).toBeDefined();
      });
    });
  });

  describe('Update Validation', () => {
    it('warns when no fields are being updated', () => {
      const updates: KBEntryUpdate = {};

      const result = validationService.validateUpdate(updates);

      expect(result.warnings.find(w => w.code === 'NO_UPDATES')).toBeDefined();
    });

    it('validates title updates', () => {
      const updates: KBEntryUpdate = {
        title: '',
      };

      const result = validationService.validateUpdate(updates);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'title' && e.code === 'INVALID_VALUE')).toBeDefined();
    });

    it('validates problem updates', () => {
      const updates: KBEntryUpdate = {
        problem: 'a'.repeat(5001),
      };

      const result = validationService.validateUpdate(updates);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'problem' && e.code === 'MAX_LENGTH')).toBeDefined();
    });

    it('validates category updates', () => {
      const updates: KBEntryUpdate = {
        category: 'INVALID' as any,
      };

      const result = validationService.validateUpdate(updates);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'category' && e.code === 'INVALID_CATEGORY')).toBeDefined();
    });

    it('validates tags updates', () => {
      const updates: KBEntryUpdate = {
        tags: 'not-an-array' as any,
      };

      const result = validationService.validateUpdate(updates);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'tags' && e.code === 'INVALID_TYPE')).toBeDefined();
    });

    it('passes validation with valid updates', () => {
      const updates: KBEntryUpdate = {
        title: 'Updated Title',
        category: 'VSAM',
        tags: ['updated-tag'],
      };

      const result = validationService.validateUpdate(updates);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Search Validation', () => {
    it('requires a search query', () => {
      const result = validationService.validateSearch('');

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'query' && e.code === 'EMPTY')).toBeDefined();
    });

    it('rejects null or undefined queries', () => {
      const result1 = validationService.validateSearch(null as any);
      const result2 = validationService.validateSearch(undefined as any);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(false);
      expect(result1.errors.find(e => e.code === 'REQUIRED')).toBeDefined();
      expect(result2.errors.find(e => e.code === 'REQUIRED')).toBeDefined();
    });

    it('validates query length', () => {
      const longQuery = 'a'.repeat(501);
      const result = validationService.validateSearch(longQuery);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'query' && e.code === 'MAX_LENGTH')).toBeDefined();
    });

    it('warns about very short queries', () => {
      const result = validationService.validateSearch('a');

      expect(result.valid).toBe(true);
      expect(result.warnings.find(w => w.field === 'query' && w.code === 'MIN_LENGTH')).toBeDefined();
    });

    it('detects SQL injection patterns', () => {
      const maliciousQueries = [
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users",
        "' OR 1=1 --",
        "'; DELETE FROM entries; --",
      ];

      maliciousQueries.forEach(query => {
        const result = validationService.validateSearch(query);
        expect(result.valid).toBe(false);
        expect(result.errors.find(e => e.code === 'SECURITY_RISK')).toBeDefined();
      });
    });

    it('validates search options', () => {
      const options: SearchOptions = {
        limit: -1,
        offset: -1,
        category: 'INVALID' as any,
        tags: 'not-an-array' as any,
        sortBy: 'invalid' as any,
        sortOrder: 'invalid' as any,
        threshold: 2,
      };

      const result = validationService.validateSearch('valid query', options);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.field === 'limit')).toBeDefined();
      expect(result.errors.find(e => e.field === 'offset')).toBeDefined();
      expect(result.errors.find(e => e.field === 'category')).toBeDefined();
      expect(result.errors.find(e => e.field === 'tags')).toBeDefined();
      expect(result.errors.find(e => e.field === 'sortBy')).toBeDefined();
      expect(result.errors.find(e => e.field === 'sortOrder')).toBeDefined();
      expect(result.errors.find(e => e.field === 'threshold')).toBeDefined();
    });

    it('warns about performance impact with large limits', () => {
      const options: SearchOptions = { limit: 1001 };
      const result = validationService.validateSearch('query', options);

      expect(result.valid).toBe(true);
      expect(result.warnings.find(w => w.field === 'limit' && w.code === 'HIGH_VALUE')).toBeDefined();
    });
  });

  describe('Batch Validation', () => {
    it('validates multiple entries', () => {
      const entries: KBEntryInput[] = [
        {
          title: 'Valid Title 1',
          problem: 'Valid problem description 1',
          solution: 'Valid solution description 1',
          category: 'JCL',
        },
        {
          title: '',
          problem: 'Valid problem 2',
          solution: 'Valid solution 2',
          category: 'VSAM',
        },
      ];

      const results = validationService.validateBatch(entries);

      expect(results).toHaveLength(2);
      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[1].errors.find(e => e.field === 'entry[1].title')).toBeDefined();
    });

    it('handles validation errors gracefully', () => {
      const entries = [{ invalid: 'data' }] as any[];

      const results = validationService.validateBatch(entries);

      expect(results).toHaveLength(1);
      expect(results[0].valid).toBe(false);
      expect(results[0].errors[0].field).toBe('entry[0]');
    });

    it('rejects non-array input', () => {
      expect(() => {
        validationService.validateBatch('not an array' as any);
      }).toThrow(ServiceError);
    });
  });

  describe('Sanitization', () => {
    it('sanitizes entry strings', () => {
      const entry: KBEntryInput = {
        title: '  Title with  extra   spaces  ',
        problem: 'Problem with <script>alert("xss")</script> tags',
        solution: 'Solution with javascript:alert("xss") content',
        category: 'JCL',
        created_by: '  user@example.com  ',
      };

      const sanitized = validationService.sanitizeEntry(entry);

      expect(sanitized.title).toBe('Title with extra spaces');
      expect(sanitized.problem).not.toContain('<script>');
      expect(sanitized.solution).not.toContain('javascript:');
      expect(sanitized.created_by).toBe('user@example.com');
    });

    it('sanitizes tags', () => {
      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Valid problem description',
        solution: 'Valid solution description',
        category: 'JCL',
        tags: ['  TAG-with_Special!@#$%  ', 'normal-tag', '', '   '],
      };

      const sanitized = validationService.sanitizeEntry(entry);

      expect(sanitized.tags).not.toContain('');
      expect(sanitized.tags).not.toContain('   ');
      expect(sanitized.tags![0]).toMatch(/^[a-zA-Z0-9-_]+$/);
    });

    it('limits tag count during sanitization', () => {
      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Valid problem description',
        solution: 'Valid solution description',
        category: 'JCL',
        tags: Array.from({ length: 15 }, (_, i) => `tag${i}`),
      };

      const sanitized = validationService.sanitizeEntry(entry);

      expect(sanitized.tags).toHaveLength(10); // Limited to 10 tags
    });

    it('skips sanitization when disabled', () => {
      const noSanitizeConfig = { ...config, sanitize: false };
      const noSanitizeService = new ValidationService(noSanitizeConfig);

      const entry: KBEntryInput = {
        title: '  Unsanitized  ',
        problem: 'Problem',
        solution: 'Solution',
        category: 'JCL',
      };

      const sanitized = noSanitizeService.sanitizeEntry(entry);

      expect(sanitized.title).toBe('  Unsanitized  ');
    });
  });

  describe('Content Quality Checks', () => {
    it('warns about brief problem descriptions', () => {
      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Short problem',
        solution: 'Valid solution with enough detailed content here',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.warnings.find(w => w.field === 'problem' && w.code === 'CONTENT_QUALITY')).toBeDefined();
    });

    it('warns about brief solution descriptions', () => {
      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Valid problem description with enough content',
        solution: 'Short solution',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.warnings.find(w => w.field === 'solution' && w.code === 'CONTENT_QUALITY')).toBeDefined();
    });

    it('warns about potentially non-mainframe content', () => {
      const entry: KBEntryInput = {
        title: 'Web Development Issue',
        problem: 'JavaScript error in web application',
        solution: 'Fix the React component state',
        category: 'Other',
      };

      const result = validationService.validateEntry(entry);

      expect(result.warnings.find(w => w.code === 'CONTENT_RELEVANCE')).toBeDefined();
    });

    it('suggests actionable solution steps', () => {
      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Valid problem description with enough content',
        solution: 'This is a description without action words',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.warnings.find(w => w.field === 'solution' && w.code === 'CONTENT_QUALITY')).toBeDefined();
    });
  });

  describe('Security Checks', () => {
    it('detects potential sensitive information', () => {
      const sensitiveEntries = [
        'password: secretpass123',
        'api_key: abcd1234567890',
        'secret=mysecretvalue',
        'token: bearer_token_here',
      ];

      sensitiveEntries.forEach(sensitive => {
        const entry: KBEntryInput = {
          title: 'Valid Title',
          problem: `Problem with ${sensitive}`,
          solution: 'Valid solution',
          category: 'JCL',
        };

        const result = validationService.validateEntry(entry);
        expect(result.warnings.find(w => w.code === 'SENSITIVE_DATA')).toBeDefined();
      });
    });

    it('detects sensitive URLs', () => {
      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Check this URL: https://example.com/api?password=secret123',
        solution: 'Valid solution',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.warnings.find(w => w.code === 'SENSITIVE_URL')).toBeDefined();
    });
  });

  describe('Custom Validators', () => {
    it('adds and executes custom validators', () => {
      const customValidator: CustomValidator = {
        code: 'CUSTOM_RULE',
        message: 'Title must contain "mainframe"',
        validate: (value: string) => value.toLowerCase().includes('mainframe'),
      };

      validationService.addCustomValidator('title', customValidator);

      const entry: KBEntryInput = {
        title: 'Generic Title',
        problem: 'Valid problem description',
        solution: 'Valid solution description',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.valid).toBe(false);
      expect(result.errors.find(e => e.code === 'CUSTOM_RULE')).toBeDefined();
    });

    it('removes custom validators', () => {
      const customValidator: CustomValidator = {
        code: 'CUSTOM_RULE',
        message: 'Custom rule',
        validate: () => false,
      };

      validationService.addCustomValidator('title', customValidator);
      validationService.removeCustomValidator('title');

      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Valid problem description',
        solution: 'Valid solution description',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.valid).toBe(true);
      expect(result.errors.find(e => e.code === 'CUSTOM_RULE')).toBeUndefined();
    });

    it('handles custom validator errors gracefully', () => {
      const faultyValidator: CustomValidator = {
        code: 'FAULTY_RULE',
        message: 'This will throw',
        validate: () => {
          throw new Error('Validator error');
        },
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      validationService.addCustomValidator('title', faultyValidator);

      const entry: KBEntryInput = {
        title: 'Valid Title',
        problem: 'Valid problem description',
        solution: 'Valid solution description',
        category: 'JCL',
      };

      const result = validationService.validateEntry(entry);

      expect(result.valid).toBe(true); // Should continue despite validator error
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Quality Score Calculation', () => {
    it('calculates quality scores based on content', () => {
      const goodEntry: KBEntryInput = {
        title: 'Comprehensive VSAM Status 35 Resolution',
        problem: 'When a COBOL program tries to open a VSAM file and receives status code 35, it indicates that the file was not found. This typically happens during file processing operations and can be caused by several factors including incorrect dataset names, catalog issues, or file deletion.',
        solution: '1. Verify the dataset exists using LISTCAT command\n2. Check the DD statement in JCL for correct DSN\n3. Ensure file is properly cataloged\n4. Verify RACF permissions using LISTDSD command\n5. Check if file was deleted or renamed\n6. Verify the correct catalog is being used',
        category: 'VSAM',
        tags: ['vsam', 'status-35', 'file-not-found'],
      };

      const result = validationService.validateEntry(goodEntry);

      expect(result.score).toBeGreaterThan(90);
    });

    it('penalizes entries with errors and warnings', () => {
      const poorEntry: KBEntryInput = {
        title: '', // Missing title
        problem: 'Short', // Too short
        solution: 'Brief', // Too short
        category: 'JCL',
        tags: Array.from({ length: 15 }, (_, i) => `tag${i}`), // Too many tags
      };

      const result = validationService.validateEntry(poorEntry);

      expect(result.score).toBeLessThan(50);
    });

    it('gives bonus points for good practices', () => {
      const wellStructuredEntry: KBEntryInput = {
        title: 'Well Structured COBOL Debugging Guide',
        problem: 'When debugging COBOL programs with complex data structures and multiple file operations, developers often struggle to identify the exact location and cause of runtime errors, leading to extended troubleshooting time.',
        solution: '1. Enable compile-time debugging options\n2. Use DISPLAY statements strategically\n3. Check working storage initialization\n4. Validate input data formats\n5. Use CEDF for interactive debugging\n6. Review compile listings for warnings',
        category: 'Batch',
        tags: ['cobol', 'debugging', 'mainframe', 'troubleshooting'],
      };

      const result = validationService.validateEntry(wellStructuredEntry);

      expect(result.score).toBeGreaterThan(95);
      expect(result.valid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('handles malformed input gracefully', () => {
      const malformedEntry = {
        title: null,
        problem: undefined,
        solution: 123,
        category: [],
        tags: { invalid: 'object' },
      } as any;

      expect(() => {
        validationService.validateEntry(malformedEntry);
      }).not.toThrow();
    });

    it('provides detailed error information', () => {
      const entry: KBEntryInput = {
        title: 'a'.repeat(250),
        problem: '',
        solution: '',
        category: 'INVALID' as any,
        tags: ['invalid tag!', 123] as any,
      };

      const result = validationService.validateEntry(entry);

      expect(result.errors.length).toBeGreaterThan(0);
      result.errors.forEach(error => {
        expect(error).toHaveProperty('field');
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('severity');
      });
    });
  });
});