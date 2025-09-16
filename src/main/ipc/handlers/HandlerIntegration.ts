/**
 * Handler Integration Setup
 *
 * Demonstrates how to integrate the new categorization and tagging handlers
 * into the existing IPC system with proper service dependencies and configuration.
 */

import { IPCHandlerRegistry } from '../IPCHandlerRegistry';
import { DatabaseManager } from '../../database/DatabaseManager';
import { MultiLayerCacheManager } from '../../caching/MultiLayerCacheManager';

// Import all handlers
import {
  CategoryHandler,
  categoryHandlerConfigs
} from './CategoryHandler';
import {
  TagHandler,
  tagHandlerConfigs
} from './TagHandler';
import {
  AutocompleteHandler,
  autocompleteHandlerConfigs
} from './AutocompleteHandler';
import {
  BulkOperationsHandler,
  bulkOperationsHandlerConfigs
} from './BulkOperationsHandler';
import {
  RealtimeHandler,
  realtimeHandlerConfigs
} from './RealtimeHandler';

// Import services
import { CategoryService } from '../../services/CategoryService';
import { TagService } from '../../services/TagService';
import { AutocompleteService } from '../../services/AutocompleteService';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { TagRepository } from '../../database/repositories/TagRepository';

/**
 * Integration class for setting up all categorization and tagging handlers
 */
export class CategorizationHandlerIntegration {
  private categoryHandler: CategoryHandler;
  private tagHandler: TagHandler;
  private autocompleteHandler: AutocompleteHandler;
  private bulkOperationsHandler: BulkOperationsHandler;
  private realtimeHandler: RealtimeHandler;

  constructor(
    private dbManager: DatabaseManager,
    private cacheManager: MultiLayerCacheManager,
    private handlerRegistry: IPCHandlerRegistry
  ) {
    this.initializeServices();
    this.initializeHandlers();
  }

  private initializeServices(): void {
    // Initialize repositories
    const categoryRepository = new CategoryRepository(this.dbManager);
    const tagRepository = new TagRepository(this.dbManager);

    // Initialize services with proper dependencies
    const categoryService = new CategoryService(categoryRepository, this.cacheManager);
    const tagService = new TagService(tagRepository, this.cacheManager);

    // Initialize handlers with all dependencies
    this.categoryHandler = new CategoryHandler(this.dbManager, this.cacheManager);
    this.tagHandler = new TagHandler(this.dbManager, this.cacheManager);
    this.autocompleteHandler = new AutocompleteHandler(
      this.dbManager,
      this.cacheManager,
      categoryService,
      tagService
    );
    this.bulkOperationsHandler = new BulkOperationsHandler(
      this.dbManager,
      this.cacheManager,
      categoryService,
      tagService
    );
    this.realtimeHandler = new RealtimeHandler(this.dbManager, this.cacheManager);
  }

  private initializeHandlers(): void {
    // Register category handlers
    this.registerCategoryHandlers();

    // Register tag handlers
    this.registerTagHandlers();

    // Register autocomplete handlers
    this.registerAutocompleteHandlers();

    // Register bulk operations handlers
    this.registerBulkOperationsHandlers();

    // Register real-time handlers
    this.registerRealtimeHandlers();

    // Setup real-time event integration
    this.setupRealtimeIntegration();
  }

  private registerCategoryHandlers(): void {
    // Category CRUD operations
    this.handlerRegistry.register(
      'category:create',
      this.categoryHandler.handleCategoryCreate,
      categoryHandlerConfigs['category:create']
    );

    this.handlerRegistry.register(
      'category:update',
      this.categoryHandler.handleCategoryUpdate,
      categoryHandlerConfigs['category:update']
    );

    this.handlerRegistry.register(
      'category:delete',
      this.categoryHandler.handleCategoryDelete,
      categoryHandlerConfigs['category:delete']
    );

    // Category hierarchy operations
    this.handlerRegistry.register(
      'category:hierarchy',
      this.categoryHandler.handleGetHierarchy,
      categoryHandlerConfigs['category:hierarchy']
    );

    this.handlerRegistry.register(
      'category:move',
      this.categoryHandler.handleCategoryMove,
      categoryHandlerConfigs['category:move']
    );

    // Category bulk operations
    this.handlerRegistry.register(
      'category:bulk',
      this.categoryHandler.handleCategoryBulk,
      categoryHandlerConfigs['category:bulk']
    );

    // Category analytics
    this.handlerRegistry.register(
      'category:analytics',
      this.categoryHandler.handleCategoryAnalytics,
      categoryHandlerConfigs['category:analytics']
    );

    console.log('✅ Category handlers registered');
  }

  private registerTagHandlers(): void {
    // Tag CRUD operations
    this.handlerRegistry.register(
      'tag:create',
      this.tagHandler.handleTagCreate,
      tagHandlerConfigs['tag:create']
    );

    this.handlerRegistry.register(
      'tag:update',
      this.tagHandler.handleTagUpdate,
      tagHandlerConfigs['tag:update']
    );

    this.handlerRegistry.register(
      'tag:delete',
      this.tagHandler.handleTagDelete,
      tagHandlerConfigs['tag:delete']
    );

    // Tag association operations
    this.handlerRegistry.register(
      'tag:associate',
      this.tagHandler.handleTagAssociate,
      tagHandlerConfigs['tag:associate']
    );

    // Tag search and suggestions
    this.handlerRegistry.register(
      'tag:search',
      this.tagHandler.handleTagSearch,
      tagHandlerConfigs['tag:search']
    );

    this.handlerRegistry.register(
      'tag:suggestions',
      this.tagHandler.handleTagSuggestions,
      tagHandlerConfigs['tag:suggestions']
    );

    this.handlerRegistry.register(
      'tag:autocomplete',
      this.tagHandler.handleTagAutoComplete,
      tagHandlerConfigs['tag:autocomplete']
    );

    // Tag bulk operations
    this.handlerRegistry.register(
      'tag:bulk',
      this.tagHandler.handleTagBulk,
      tagHandlerConfigs['tag:bulk']
    );

    // Tag analytics
    this.handlerRegistry.register(
      'tag:analytics',
      this.tagHandler.handleTagAnalytics,
      tagHandlerConfigs['tag:analytics']
    );

    console.log('✅ Tag handlers registered');
  }

  private registerAutocompleteHandlers(): void {
    // Autocomplete operations
    this.handlerRegistry.register(
      'autocomplete:suggestions',
      this.autocompleteHandler.handleAutocomplete,
      autocompleteHandlerConfigs['autocomplete:suggestions']
    );

    this.handlerRegistry.register(
      'autocomplete:search',
      this.autocompleteHandler.handleSearch,
      autocompleteHandlerConfigs['autocomplete:search']
    );

    this.handlerRegistry.register(
      'autocomplete:learn',
      this.autocompleteHandler.handleLearn,
      autocompleteHandlerConfigs['autocomplete:learn']
    );

    // Cache management
    this.handlerRegistry.register(
      'autocomplete:cache',
      this.autocompleteHandler.handleCacheManagement,
      autocompleteHandlerConfigs['autocomplete:cache']
    );

    // Analytics
    this.handlerRegistry.register(
      'autocomplete:analytics',
      this.autocompleteHandler.handleAnalytics,
      autocompleteHandlerConfigs['autocomplete:analytics']
    );

    console.log('✅ Autocomplete handlers registered');
  }

  private registerBulkOperationsHandlers(): void {
    // Bulk operations
    this.handlerRegistry.register(
      'bulk:execute',
      this.bulkOperationsHandler.handleBulkExecute,
      bulkOperationsHandlerConfigs['bulk:execute']
    );

    this.handlerRegistry.register(
      'bulk:validate',
      this.bulkOperationsHandler.handleBulkValidate,
      bulkOperationsHandlerConfigs['bulk:validate']
    );

    this.handlerRegistry.register(
      'bulk:template',
      this.bulkOperationsHandler.handleBulkTemplate,
      bulkOperationsHandlerConfigs['bulk:template']
    );

    console.log('✅ Bulk operations handlers registered');
  }

  private registerRealtimeHandlers(): void {
    // Real-time operations
    this.handlerRegistry.register(
      'realtime:subscribe',
      this.realtimeHandler.handleSubscribe,
      realtimeHandlerConfigs['realtime:subscribe']
    );

    this.handlerRegistry.register(
      'realtime:unsubscribe',
      this.realtimeHandler.handleUnsubscribe,
      realtimeHandlerConfigs['realtime:unsubscribe']
    );

    this.handlerRegistry.register(
      'realtime:broadcast',
      this.realtimeHandler.handleBroadcast,
      realtimeHandlerConfigs['realtime:broadcast']
    );

    this.handlerRegistry.register(
      'realtime:events',
      this.realtimeHandler.handleGetEvents,
      realtimeHandlerConfigs['realtime:events']
    );

    this.handlerRegistry.register(
      'realtime:status',
      this.realtimeHandler.handleStatus,
      realtimeHandlerConfigs['realtime:status']
    );

    console.log('✅ Real-time handlers registered');
  }

  private setupRealtimeIntegration(): void {
    // Hook into service events to emit real-time updates

    // Category events
    if (this.categoryHandler) {
      // In a real implementation, we'd listen to category service events
      // For now, this is a placeholder for the integration pattern
    }

    // Tag events
    if (this.tagHandler) {
      // In a real implementation, we'd listen to tag service events
      // For now, this is a placeholder for the integration pattern
    }

    console.log('✅ Real-time integration setup completed');
  }

  /**
   * Get real-time handler for external event emission
   */
  getRealtimeHandler(): RealtimeHandler {
    return this.realtimeHandler;
  }

  /**
   * Example of how services can emit real-time events
   */
  emitCategoryEvent(type: 'created' | 'updated' | 'deleted', categoryData: any): void {
    const eventType = `category_${type}` as any;
    this.realtimeHandler.emitRealtimeEvent(eventType, categoryData, {
      affected_entities: [`category_${categoryData.id}`],
      change_summary: `Category ${type}: ${categoryData.name}`
    });
  }

  emitTagEvent(type: 'created' | 'updated' | 'deleted', tagData: any): void {
    const eventType = `tag_${type}` as any;
    this.realtimeHandler.emitRealtimeEvent(eventType, tagData, {
      affected_entities: [`tag_${tagData.id}`],
      change_summary: `Tag ${type}: ${tagData.name}`
    });
  }

  emitBulkOperationEvent(operationResult: any): void {
    this.realtimeHandler.emitRealtimeEvent('bulk_operation_completed', operationResult, {
      affected_entities: operationResult.affected_entities || [],
      change_summary: `Bulk operation completed: ${operationResult.successful}/${operationResult.total_operations} successful`
    });
  }
}

/**
 * Factory function to create and initialize the categorization handler integration
 */
export function createCategorizationHandlerIntegration(
  dbManager: DatabaseManager,
  cacheManager: MultiLayerCacheManager,
  handlerRegistry: IPCHandlerRegistry
): CategorizationHandlerIntegration {
  return new CategorizationHandlerIntegration(dbManager, cacheManager, handlerRegistry);
}

/**
 * Example usage in main process initialization
 */
export function setupCategorizationHandlers(
  dbManager: DatabaseManager,
  cacheManager: MultiLayerCacheManager,
  handlerRegistry: IPCHandlerRegistry
): CategorizationHandlerIntegration {
  console.log('🚀 Setting up categorization and tagging handlers...');

  const integration = createCategorizationHandlerIntegration(
    dbManager,
    cacheManager,
    handlerRegistry
  );

  console.log('✅ Categorization and tagging system ready');
  console.log(`📊 Real-time subscriptions: ${integration.getRealtimeHandler().getSubscriptionCount()}`);

  return integration;
}