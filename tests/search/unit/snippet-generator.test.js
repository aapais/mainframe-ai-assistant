/**
 * Snippet Generation Unit Tests
 * Tests for search result snippet generation and highlighting
 */

const { SnippetGenerator } = require('../../../src/services/search/snippet-generator');

describe('Snippet Generator', () => {
  let generator;

  beforeEach(() => {
    generator = new SnippetGenerator({
      maxLength: 200,
      contextWords: 3,
      highlightTag: 'mark',
      ellipsis: '...'
    });
  });

  describe('Basic Snippet Generation', () => {
    test('should generate snippet within max length', () => {
      const content = 'This is a very long document about mainframe programming with JCL and COBOL that contains many technical details and examples that would normally exceed the maximum snippet length that we want to display to users in search results.';
      const query = ['mainframe', 'JCL'];

      const snippet = generator.generate(content, query);

      expect(snippet.length).toBeLessThanOrEqual(200);
    });

    test('should include highlighted query terms', () => {
      const content = 'Job Control Language (JCL) is used on mainframe systems.';
      const query = ['JCL', 'mainframe'];

      const snippet = generator.generate(content, query);

      expect(snippet).toContain('<mark>JCL</mark>');
      expect(snippet).toContain('<mark>mainframe</mark>');
    });

    test('should preserve context around highlighted terms', () => {
      const content = 'The Job Control Language (JCL) is a scripting language used on IBM mainframe operating systems.';
      const query = ['JCL'];

      const snippet = generator.generate(content, query);

      expect(snippet).toContain('Job Control Language');
      expect(snippet).toContain('<mark>JCL</mark>');
      expect(snippet).toContain('scripting language');
    });

    test('should handle case-insensitive matching', () => {
      const content = 'COBOL programming and cobol development on Mainframe systems.';
      const query = ['cobol', 'mainframe'];

      const snippet = generator.generate(content, query);

      expect(snippet).toContain('<mark>COBOL</mark>');
      expect(snippet).toContain('<mark>cobol</mark>');
      expect(snippet).toContain('<mark>Mainframe</mark>');
    });
  });

  describe('Context Selection', () => {
    test('should prefer sections with multiple query terms', () => {
      const content = `
        Section 1: This discusses COBOL programming in detail.
        Section 2: Here we cover JCL batch processing extensively.
        Section 3: Both JCL and COBOL work together on mainframe systems.
      `;
      const query = ['JCL', 'COBOL'];

      const snippet = generator.generate(content, query);

      // Should prefer section 3 where both terms appear
      expect(snippet).toContain('Both JCL and COBOL work together');
    });

    test('should handle proximity scoring', () => {
      const content = 'JCL is powerful. Later in the document, we discuss COBOL. JCL and COBOL integration is important.';
      const query = ['JCL', 'COBOL'];

      const snippet = generator.generate(content, query);

      // Should prefer the section where terms are closer
      expect(snippet).toContain('JCL and COBOL integration');
    });

    test('should respect context word limits', () => {
      const content = 'One two three four MAINFRAME five six seven eight nine ten.';
      const query = ['MAINFRAME'];

      const snippet = generator.generate(content, query);

      // Should include 3 words before and after (plus the term itself)
      const words = snippet.replace(/<\/?mark>/g, '').split(/\s+/);
      expect(words.length).toBeLessThanOrEqual(7); // 3 + 1 + 3
    });
  });

  describe('Highlighting Logic', () => {
    test('should handle overlapping matches', () => {
      const content = 'Job Control Language JCL programming';
      const query = ['Job Control Language', 'JCL'];

      const snippet = generator.generate(content, query);

      // Should not have nested or broken mark tags
      expect(snippet).not.toMatch(/<mark>.*<mark>/);
      expect(snippet).not.toMatch(/<\/mark>.*<\/mark>/);

      // Should highlight both terms appropriately
      expect(snippet).toContain('<mark>Job Control Language</mark>');
      expect(snippet).toContain('<mark>JCL</mark>');
    });

    test('should handle partial word matches correctly', () => {
      const content = 'Programming and programmer use programs';
      const query = ['program'];

      const snippet = generator.generate(content, query);

      // Should match the root term in all variations
      expect(snippet).toContain('<mark>Program</mark>ming');
      expect(snippet).toContain('<mark>program</mark>mer');
      expect(snippet).toContain('<mark>program</mark>s');
    });

    test('should preserve original case in highlights', () => {
      const content = 'JCL, Jcl, jcl are all job control language';
      const query = ['jcl'];

      const snippet = generator.generate(content, query);

      expect(snippet).toContain('<mark>JCL</mark>');
      expect(snippet).toContain('<mark>Jcl</mark>');
      expect(snippet).toContain('<mark>jcl</mark>');
    });

    test('should handle special characters in query terms', () => {
      const content = 'The z/OS operating system uses SYS1.PROCLIB datasets';
      const query = ['z/OS', 'SYS1.PROCLIB'];

      const snippet = generator.generate(content, query);

      expect(snippet).toContain('<mark>z/OS</mark>');
      expect(snippet).toContain('<mark>SYS1.PROCLIB</mark>');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty content', () => {
      const snippet = generator.generate('', ['query']);
      expect(snippet).toBe('');
    });

    test('should handle empty query', () => {
      const content = 'Some content here';
      const snippet = generator.generate(content, []);

      expect(snippet).toBe(content.substring(0, 200));
    });

    test('should handle content shorter than max length', () => {
      const content = 'Short JCL example';
      const query = ['JCL'];

      const snippet = generator.generate(content, query);

      expect(snippet).toBe('Short <mark>JCL</mark> example');
      expect(snippet).not.toContain('...');
    });

    test('should handle query terms not found in content', () => {
      const content = 'This content has no matching terms';
      const query = ['JCL', 'COBOL'];

      const snippet = generator.generate(content, query);

      expect(snippet).toBe(content);
      expect(snippet).not.toContain('<mark>');
    });

    test('should handle very long words', () => {
      const content = 'This has a veryveryverylongwordthatexceedsnormallimits in the middle';
      const query = ['veryveryverylongwordthatexceedsnormallimits'];

      const snippet = generator.generate(content, query);

      expect(snippet).toContain('<mark>veryveryverylongwordthatexceedsnormallimits</mark>');
    });
  });

  describe('Custom Configuration', () => {
    test('should respect custom highlight tags', () => {
      const customGenerator = new SnippetGenerator({
        highlightTag: 'strong',
        maxLength: 100
      });

      const content = 'JCL programming on mainframe systems';
      const query = ['JCL'];

      const snippet = customGenerator.generate(content, query);

      expect(snippet).toContain('<strong>JCL</strong>');
      expect(snippet).not.toContain('<mark>');
    });

    test('should respect custom context length', () => {
      const customGenerator = new SnippetGenerator({
        contextWords: 1,
        maxLength: 200
      });

      const content = 'Word1 word2 word3 MAINFRAME word5 word6 word7';
      const query = ['MAINFRAME'];

      const snippet = customGenerator.generate(content, query);

      // Should only include 1 word before and after
      expect(snippet).toContain('word3 <mark>MAINFRAME</mark> word5');
    });

    test('should respect custom ellipsis', () => {
      const customGenerator = new SnippetGenerator({
        maxLength: 20,
        ellipsis: '[more]'
      });

      const content = 'This is a very long content that will definitely exceed the maximum length';
      const query = ['content'];

      const snippet = customGenerator.generate(content, query);

      expect(snippet).toContain('[more]');
    });
  });

  describe('Performance', () => {
    test('should handle large content efficiently', () => {
      const largeContent = 'word '.repeat(10000) + 'MAINFRAME ' + 'word '.repeat(10000);
      const query = ['MAINFRAME'];

      const startTime = Date.now();
      const snippet = generator.generate(largeContent, query);
      const endTime = Date.now();

      expect(snippet).toContain('<mark>MAINFRAME</mark>');
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });

    test('should handle many query terms efficiently', () => {
      const content = 'mainframe JCL COBOL CICS IMS DB2 z/OS MVS TSO ISPF SDSF'.repeat(100);
      const query = ['mainframe', 'JCL', 'COBOL', 'CICS', 'IMS', 'DB2', 'z/OS', 'MVS'];

      const startTime = Date.now();
      const snippet = generator.generate(content, query);
      const endTime = Date.now();

      expect(snippet.match(/<mark>/g).length).toBeGreaterThan(5);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('Quality Metrics', () => {
    test('should maximize query term coverage in snippet', () => {
      const content = `
        Introduction about mainframe systems.
        Chapter 1: JCL basics and syntax.
        Chapter 2: COBOL programming fundamentals.
        Chapter 3: JCL and COBOL integration on mainframe.
        Conclusion and references.
      `;
      const query = ['mainframe', 'JCL', 'COBOL'];

      const snippet = generator.generate(content, query);

      // Should prefer section with all three terms
      expect(snippet).toContain('JCL and COBOL integration on mainframe');
    });

    test('should balance term density and readability', () => {
      const content = 'mainframe mainframe mainframe JCL JCL versus comprehensive guide to JCL programming on mainframe systems';
      const query = ['mainframe', 'JCL'];

      const snippet = generator.generate(content, query);

      // Should prefer the more readable section despite lower density
      expect(snippet).toContain('guide to JCL programming on mainframe');
    });
  });
});