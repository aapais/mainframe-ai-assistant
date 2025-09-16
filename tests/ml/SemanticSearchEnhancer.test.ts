import { SemanticSearchEnhancer } from '../../src/services/ml/SemanticSearchEnhancer';
import { TrainingData } from '../../src/types/ml';

describe('SemanticSearchEnhancer', () => {
  let enhancer: SemanticSearchEnhancer;
  let mockTrainingData: TrainingData;

  beforeEach(() => {
    enhancer = new SemanticSearchEnhancer();
    mockTrainingData = {
      features: [
        'search for documents',
        'find research papers',
        'how to write code',
        'what is machine learning',
        'compare product prices',
        'navigate to settings'
      ],
      labels: ['search', 'search', 'help', 'help', 'compare', 'navigate'],
      metadata: {
        entities: [
          [{ type: 'object', value: 'documents', confidence: 0.9 }],
          [{ type: 'object', value: 'papers', confidence: 0.8 }],
          [{ type: 'skill', value: 'code', confidence: 0.7 }]
        ],
        contexts: [
          'user looking for files',
          'academic research',
          'programming help'
        ]
      }
    };
  });

  describe('training', () => {
    it('should train successfully with valid data', async () => {
      const evaluation = await enhancer.train(mockTrainingData);

      expect(evaluation).toBeDefined();
      expect(evaluation.accuracy).toBeGreaterThan(0);
      expect(evaluation.featureImportance).toBeDefined();
    });

    it('should build concept graph from training data', async () => {
      await enhancer.train(mockTrainingData);

      const conceptGraph = enhancer.getConceptGraph();
      expect(conceptGraph).toBeDefined();
      expect(conceptGraph.concepts.size).toBeGreaterThan(0);
    });

    it('should train intent classifier', async () => {
      await enhancer.train(mockTrainingData);

      const enhancement = await enhancer.enhanceQuery('search documents');
      expect(enhancement.intent).toBeDefined();
      expect(enhancement.intent).toBe('search');
    });
  });

  describe('query enhancement', () => {
    beforeEach(async () => {
      await enhancer.train(mockTrainingData);
    });

    it('should enhance queries with semantic information', async () => {
      const enhancement = await enhancer.enhanceQuery('find files');

      expect(enhancement).toBeDefined();
      expect(enhancement.originalQuery).toBe('find files');
      expect(enhancement.expandedQuery).toBeDefined();
      expect(enhancement.intent).toBeDefined();
      expect(enhancement.entities).toBeDefined();
      expect(enhancement.embeddings).toBeDefined();
    });

    it('should classify intent correctly', async () => {
      const searchEnhancement = await enhancer.enhanceQuery('search for documents');
      const helpEnhancement = await enhancer.enhanceQuery('how to do something');
      const navigateEnhancement = await enhancer.enhanceQuery('go to settings');

      expect(searchEnhancement.intent).toBe('search');
      expect(helpEnhancement.intent).toBe('help');
      expect(navigateEnhancement.intent).toBe('navigate');
    });

    it('should extract entities from queries', async () => {
      const enhancement = await enhancer.enhanceQuery('find research papers');

      expect(enhancement.entities).toBeDefined();
      expect(enhancement.entities.length).toBeGreaterThan(0);
    });

    it('should generate query embeddings', async () => {
      const enhancement = await enhancer.enhanceQuery('machine learning');

      expect(enhancement.embeddings).toBeDefined();
      expect(enhancement.embeddings.length).toBeGreaterThan(0);
      expect(enhancement.embeddings.every(val => typeof val === 'number')).toBe(true);
    });

    it('should expand queries with synonyms and related terms', async () => {
      const enhancement = await enhancer.enhanceQuery('find');

      expect(enhancement.expandedQuery).toBeDefined();
      expect(enhancement.expandedQuery.length).toBeGreaterThan(enhancement.originalQuery.length);
      expect(enhancement.synonyms.length).toBeGreaterThan(0);
    });
  });

  describe('entity recognition', () => {
    beforeEach(async () => {
      await enhancer.train(mockTrainingData);
    });

    it('should recognize different entity types', async () => {
      const queries = [
        'email user@domain.com',
        'call 555-123-4567',
        'deadline 2023-12-31',
        'budget $1000',
        'progress 85%'
      ];

      for (const query of queries) {
        const enhancement = await enhancer.enhanceQuery(query);
        expect(enhancement.entities.length).toBeGreaterThan(0);
      }
    });

    it('should provide confidence scores for entities', async () => {
      const enhancement = await enhancer.enhanceQuery('email me at test@example.com');

      enhancement.entities.forEach(entity => {
        expect(entity.confidence).toBeGreaterThan(0);
        expect(entity.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('complexity analysis', () => {
    beforeEach(async () => {
      await enhancer.train(mockTrainingData);
    });

    it('should analyze query complexity', async () => {
      const simpleComplexity = await enhancer.analyzeQueryComplexity('search');
      const complexComplexity = await enhancer.analyzeQueryComplexity('find detailed research papers about machine learning algorithms for natural language processing');

      expect(simpleComplexity).toBeGreaterThanOrEqual(0);
      expect(simpleComplexity).toBeLessThanOrEqual(1);
      expect(complexComplexity).toBeGreaterThanOrEqual(0);
      expect(complexComplexity).toBeLessThanOrEqual(1);
      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });

    it('should consider different complexity factors', async () => {
      const shortQuery = await enhancer.analyzeQueryComplexity('find');
      const longQuery = await enhancer.analyzeQueryComplexity('find research papers about machine learning');
      const entityQuery = await enhancer.analyzeQueryComplexity('email john@example.com about meeting at 2023-12-31');

      expect(longQuery).toBeGreaterThan(shortQuery);
      expect(entityQuery).toBeGreaterThan(shortQuery);
    });
  });

  describe('sentiment analysis', () => {
    beforeEach(async () => {
      await enhancer.train(mockTrainingData);
    });

    it('should analyze query sentiment', async () => {
      const positiveSentiment = await enhancer.analyzeSentiment('find great documents');
      const negativeSentiment = await enhancer.analyzeSentiment('terrible search results');
      const neutralSentiment = await enhancer.analyzeSentiment('search documents');

      expect(positiveSentiment).toBeGreaterThan(0);
      expect(negativeSentiment).toBeLessThan(0);
      expect(Math.abs(neutralSentiment)).toBeLessThan(Math.abs(positiveSentiment));
    });

    it('should handle queries without sentiment words', async () => {
      const sentiment = await enhancer.analyzeSentiment('search for files');

      expect(sentiment).toBe(0);
    });
  });

  describe('concept graph', () => {
    beforeEach(async () => {
      await enhancer.train(mockTrainingData);
    });

    it('should build concept relationships', async () => {
      const conceptGraph = enhancer.getConceptGraph();

      expect(conceptGraph.concepts.size).toBeGreaterThan(0);
      expect(conceptGraph.relationships.size).toBeGreaterThan(0);
    });

    it('should categorize concepts', async () => {
      const conceptGraph = enhancer.getConceptGraph();

      for (const concept of conceptGraph.concepts.values()) {
        expect(concept.category).toBeDefined();
        expect(concept.frequency).toBeGreaterThan(0);
      }
    });

    it('should find concept synonyms', async () => {
      const conceptGraph = enhancer.getConceptGraph();

      for (const concept of conceptGraph.concepts.values()) {
        expect(Array.isArray(concept.synonyms)).toBe(true);
      }
    });
  });

  describe('model management', () => {
    it('should return model info after training', async () => {
      await enhancer.train(mockTrainingData);

      const modelInfo = enhancer.getModelInfo();
      expect(modelInfo).toBeDefined();
      expect(modelInfo!.features.length).toBeGreaterThan(0);
    });

    it('should save and load models', async () => {
      await enhancer.train(mockTrainingData);

      await expect(enhancer.saveModel('/mock/path')).resolves.not.toThrow();
      await expect(enhancer.loadModel('/mock/path')).resolves.not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty queries', async () => {
      await enhancer.train(mockTrainingData);

      const enhancement = await enhancer.enhanceQuery('');
      expect(enhancement).toBeDefined();
      expect(enhancement.originalQuery).toBe('');
    });

    it('should handle special characters', async () => {
      await enhancer.train(mockTrainingData);

      const enhancement = await enhancer.enhanceQuery('search @#$%^&*()');
      expect(enhancement).toBeDefined();
    });

    it('should handle very long queries', async () => {
      await enhancer.train(mockTrainingData);

      const longQuery = 'search for '.repeat(100) + 'documents';
      const enhancement = await enhancer.enhanceQuery(longQuery);
      expect(enhancement).toBeDefined();
    });

    it('should handle non-English text', async () => {
      await enhancer.train(mockTrainingData);

      const enhancement = await enhancer.enhanceQuery('búsqueda de documentos');
      expect(enhancement).toBeDefined();
    });
  });

  describe('performance', () => {
    beforeEach(async () => {
      await enhancer.train(mockTrainingData);
    });

    it('should enhance queries quickly', async () => {
      const start = Date.now();
      await enhancer.enhanceQuery('search for documents');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(200); // Should complete in less than 200ms
    });

    it('should handle concurrent enhancement requests', async () => {
      const queries = [
        'search documents',
        'find files',
        'how to code',
        'machine learning',
        'compare prices'
      ];

      const promises = queries.map(query => enhancer.enhanceQuery(query));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(queries.length);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.intent).toBeDefined();
      });
    });
  });
});