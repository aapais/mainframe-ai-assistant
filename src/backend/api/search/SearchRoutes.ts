/**
 * Search API Routes Configuration
 * Defines all search-related endpoints with proper middleware and validation
 */

import { Router } from 'express';
import { FTS5SearchController } from './FTS5SearchController';
import { FTS5SearchService } from '../../../services/FTS5SearchService';
import { SearchResultsIntegrationAdapter } from '../../../services/SearchResultsIntegrationAdapter';
import { SearchServiceConfig } from '../../../types/services';

/**
 * Create and configure search routes
 */
export function createSearchRoutes(config: SearchServiceConfig): Router {
  const router = Router();

  // Initialize services
  const searchService = new FTS5SearchService(config);
  const integrationAdapter = new SearchResultsIntegrationAdapter();
  const controller = new FTS5SearchController(searchService, integrationAdapter);

  // Apply common middleware
  router.use(controller.getMiddleware());

  // Search endpoints
  router.post('/search', controller.search);
  router.get('/suggestions', controller.suggestions);
  router.get('/analytics', controller.analytics);
  router.get('/health', controller.healthCheck);

  // Admin endpoints
  router.post('/index/rebuild', controller.rebuildIndex);

  // Apply error handling
  router.use(controller.errorHandler());

  return router;
}

/**
 * Alternative route configuration for existing API structure
 */
export function configureSearchRoutes(
  router: Router,
  searchService: FTS5SearchService,
  integrationAdapter?: SearchResultsIntegrationAdapter
): void {
  const adapter = integrationAdapter || new SearchResultsIntegrationAdapter();
  const controller = new FTS5SearchController(searchService, adapter);

  // Apply middleware
  router.use('/search', controller.getMiddleware());

  // Main search routes
  router.post('/search/query', controller.search);
  router.get('/search/suggest', controller.suggestions);
  router.get('/search/stats', controller.analytics);
  router.get('/search/status', controller.healthCheck);

  // Management routes
  router.post('/search/admin/rebuild-index', controller.rebuildIndex);

  // Error handling
  router.use('/search', controller.errorHandler());
}

/**
 * Express.js route configuration for integration with existing backend
 */
export class SearchAPIRoutes {
  private router: Router;
  private controller: FTS5SearchController;

  constructor(
    searchService: FTS5SearchService,
    integrationAdapter?: SearchResultsIntegrationAdapter
  ) {
    this.router = Router();
    const adapter = integrationAdapter || new SearchResultsIntegrationAdapter();
    this.controller = new FTS5SearchController(searchService, adapter);
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Apply common middleware
    this.router.use(this.controller.getMiddleware());

    // API versioning
    const v1 = Router();
    const v2 = Router();

    // V1 routes (backward compatibility)
    v1.post('/search', this.controller.search);
    v1.get('/suggest', this.controller.suggestions);
    v1.get('/health', this.controller.healthCheck);

    // V2 routes (enhanced features)
    v2.post('/search', this.controller.search);
    v2.get('/suggestions', this.controller.suggestions);
    v2.get('/analytics', this.controller.analytics);
    v2.post('/index/rebuild', this.controller.rebuildIndex);
    v2.get('/health', this.controller.healthCheck);

    // Mount versioned routes
    this.router.use('/v1', v1);
    this.router.use('/v2', v2);

    // Default to v2
    this.router.use('/', v2);

    // Global error handler
    this.router.use(this.controller.errorHandler());
  }

  /**
   * Get the configured router
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * Get the controller instance for testing
   */
  getController(): FTS5SearchController {
    return this.controller;
  }
}

/**
 * Default export for easy integration
 */
export default SearchAPIRoutes;
