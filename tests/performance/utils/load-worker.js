/**
 * Load Worker
 * Worker thread for simulating individual user load
 */

const { parentPort, workerData } = require('worker_threads');
const { performance } = require('perf_hooks');

// Mock search service for testing
class MockSearchService {
  constructor() {
    this.cache = new Map();
    this.queryCount = 0;
  }

  async search(query) {
    this.queryCount++;
    
    // Simulate variable response times
    const baseLatency = 50 + Math.random() * 200; // 50-250ms base
    
    // Add complexity-based latency
    const complexityFactor = query.length > 50 ? 1.5 : 1;
    const latency = baseLatency * complexityFactor;
    
    // Simulate occasional slow queries (5% chance)
    const slowQuery = Math.random() < 0.05;
    const finalLatency = slowQuery ? latency * 3 : latency;
    
    await new Promise(resolve => setTimeout(resolve, finalLatency));
    
    // Simulate cache hits (70% for repeated queries)
    const cacheKey = query.toLowerCase().trim();
    const fromCache = this.cache.has(cacheKey) && Math.random() < 0.7;
    
    if (!fromCache) {
      this.cache.set(cacheKey, {
        results: this.generateMockResults(query),
        timestamp: Date.now()
      });
    }
    
    // Simulate occasional errors (1% chance)
    if (Math.random() < 0.01) {
      throw new Error('Simulated search service error');
    }
    
    return {
      query,
      results: this.cache.get(cacheKey).results,
      fromCache,
      responseTime: finalLatency,
      timestamp: Date.now()
    };
  }

  generateMockResults(query) {
    const resultCount = Math.floor(Math.random() * 100) + 1;
    return Array.from({ length: resultCount }, (_, i) => ({
      id: `result_${i}_${Date.now()}`,
      title: `Result ${i} for "${query}"`,
      content: `Mock content for search result ${i}`,
      score: Math.random()
    }));
  }
}

async function runUserSimulation() {
  const { userId, scenario, duration, startDelay } = workerData;
  
  const searchService = new MockSearchService();
  const results = {
    userId,
    scenario,
    startTime: performance.now(),
    endTime: null,
    duration: 0,
    completedRequests: 0,
    errors: 0,
    responseTimes: [],
    errorDetails: []
  };

  try {
    // Wait for start delay
    if (startDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, startDelay));
    }

    const endTime = performance.now() + duration;
    
    while (performance.now() < endTime) {
      try {
        const query = generateQuery(scenario, results.completedRequests);
        
        const requestStart = performance.now();
        await searchService.search(query);
        const requestEnd = performance.now();
        
        const responseTime = requestEnd - requestStart;
        results.responseTimes.push(responseTime);
        results.completedRequests++;
        
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          error: error.message,
          timestamp: performance.now()
        });
      }
      
      // Simulate user think time (100ms to 2s)
      const thinkTime = 100 + Math.random() * 1900;
      await new Promise(resolve => setTimeout(resolve, thinkTime));
    }
    
    results.endTime = performance.now();
    results.duration = results.endTime - results.startTime;
    
    // Send result back to main thread
    parentPort.postMessage({
      type: 'result',
      data: results
    });
    
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      data: {
        userId,
        error: error.message,
        partialResults: results
      }
    });
  }
}

function generateQuery(scenario, requestNumber) {
  const scenarios = {
    search: generateSearchQuery,
    complex: generateComplexQuery,
    repetitive: generateRepetitiveQuery,
    mixed: generateMixedQuery
  };
  
  const generator = scenarios[scenario] || scenarios.search;
  return generator(requestNumber);
}

function generateSearchQuery(requestNumber) {
  const terms = [
    'javascript', 'react', 'nodejs', 'database', 'api',
    'frontend', 'backend', 'typescript', 'testing', 'performance',
    'authentication', 'security', 'deployment', 'monitoring', 'optimization'
  ];
  
  // 30% single terms, 50% two terms, 20% three+ terms
  const complexity = Math.random();
  
  if (complexity < 0.3) {
    return terms[Math.floor(Math.random() * terms.length)];
  } else if (complexity < 0.8) {
    const term1 = terms[Math.floor(Math.random() * terms.length)];
    const term2 = terms[Math.floor(Math.random() * terms.length)];
    return `${term1} ${term2}`;
  } else {
    const term1 = terms[Math.floor(Math.random() * terms.length)];
    const term2 = terms[Math.floor(Math.random() * terms.length)];
    const term3 = terms[Math.floor(Math.random() * terms.length)];
    return `${term1} ${term2} ${term3}`;
  }
}

function generateComplexQuery(requestNumber) {
  const operators = ['AND', 'OR', 'NOT'];
  const terms = ['term1', 'term2', 'term3', 'term4'];
  
  const baseQuery = generateSearchQuery(requestNumber);
  const operator = operators[Math.floor(Math.random() * operators.length)];
  const additionalTerm = terms[Math.floor(Math.random() * terms.length)];
  
  // Add complexity elements
  const complexElements = [
    `"${baseQuery}"`, // Phrase search
    `${baseQuery}*`, // Wildcard
    `${baseQuery} ${operator} ${additionalTerm}`, // Boolean
    `${baseQuery}~2` // Fuzzy search
  ];
  
  return complexElements[Math.floor(Math.random() * complexElements.length)];
}

function generateRepetitiveQuery(requestNumber) {
  // Simulate users repeating common searches
  const commonQueries = [
    'dashboard',
    'user management',
    'reports',
    'settings',
    'help documentation'
  ];
  
  // 80% chance of using common query, 20% unique
  if (Math.random() < 0.8) {
    return commonQueries[Math.floor(Math.random() * commonQueries.length)];
  } else {
    return `unique query ${requestNumber} ${Date.now()}`;
  }
}

function generateMixedQuery(requestNumber) {
  const queryTypes = [generateSearchQuery, generateComplexQuery, generateRepetitiveQuery];
  const randomType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
  return randomType(requestNumber);
}

// Start the simulation
runUserSimulation().catch(error => {
  parentPort.postMessage({
    type: 'error',
    data: {
      userId: workerData.userId,
      error: error.message
    }
  });
});
