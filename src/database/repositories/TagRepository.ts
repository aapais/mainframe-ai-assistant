/**
 * Tag Repository
 * Handles tag operations, associations, and analytics with optimized queries
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import {
  Tag,
  CreateTag,
  UpdateTag,
  TagAssociation,
  BulkTagOperation,
  BulkOperationResult,
  TagAnalytics,
  HierarchicalSchemaValidator,
} from '../schemas/HierarchicalCategories.schema';
import { AppError, ErrorCode } from '../../core/errors/AppError';

export interface TagQueryOptions {
  includeSystem?: boolean;
  categoryId?: string;
  sortBy?: 'name' | 'usage_count' | 'created_at';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TagSearchOptions {
  query?: string;
  categoryId?: string;
  excludeIds?: string[];
  limit?: number;
  fuzzy?: boolean;
}

export interface TagAssociationOptions {
  relevanceScore?: number;
  assignedBy?: 'user' | 'system' | 'ai';
  confidence?: number;
}

export class TagRepository {
  private db: Database.Database;
  private preparedStatements: Map<string, Database.Statement> = new Map();

  constructor(db: Database.Database) {
    this.db = db;
    this.initializePreparedStatements();
  }

  private initializePreparedStatements(): void {
    // Basic CRUD operations
    this.preparedStatements.set(
      'insertTag',
      this.db.prepare(`
      INSERT INTO tags (
        id, name, display_name, description, category_id,
        color, is_system, is_suggested, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    );

    this.preparedStatements.set(
      'updateTag',
      this.db.prepare(`
      UPDATE tags SET
        name = COALESCE(?, name),
        display_name = COALESCE(?, display_name),
        description = COALESCE(?, description),
        category_id = COALESCE(?, category_id),
        color = COALESCE(?, color),
        is_suggested = COALESCE(?, is_suggested),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND is_system = FALSE
    `)
    );

    this.preparedStatements.set(
      'deleteTag',
      this.db.prepare(`
      DELETE FROM tags WHERE id = ? AND is_system = FALSE
    `)
    );

    this.preparedStatements.set(
      'selectById',
      this.db.prepare(`
      SELECT * FROM v_tag_stats WHERE id = ?
    `)
    );

    this.preparedStatements.set(
      'selectByName',
      this.db.prepare(`
      SELECT * FROM v_tag_stats WHERE name = ?
    `)
    );

    // Association operations
    this.preparedStatements.set(
      'insertAssociation',
      this.db.prepare(`
      INSERT INTO tag_associations (
        id, entry_id, tag_id, relevance_score, assigned_by, confidence, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    );

    this.preparedStatements.set(
      'deleteAssociation',
      this.db.prepare(`
      DELETE FROM tag_associations WHERE entry_id = ? AND tag_id = ?
    `)
    );

    this.preparedStatements.set(
      'deleteAllAssociations',
      this.db.prepare(`
      DELETE FROM tag_associations WHERE entry_id = ?
    `)
    );

    this.preparedStatements.set(
      'selectEntryTags',
      this.db.prepare(`
      SELECT t.*, ta.relevance_score, ta.assigned_by, ta.confidence, ta.created_at as associated_at
      FROM tags t
      JOIN tag_associations ta ON t.id = ta.tag_id
      WHERE ta.entry_id = ?
      ORDER BY ta.relevance_score DESC NULLS LAST, t.name ASC
    `)
    );

    this.preparedStatements.set(
      'selectTagEntries',
      this.db.prepare(`
      SELECT e.*, ta.relevance_score, ta.assigned_by, ta.confidence
      FROM kb_entries e
      JOIN tag_associations ta ON e.id = ta.entry_id
      WHERE ta.tag_id = ?
      ORDER BY ta.relevance_score DESC NULLS LAST, e.updated_at DESC
    `)
    );

    // Search and suggestions
    this.preparedStatements.set(
      'searchTags',
      this.db.prepare(`
      SELECT * FROM v_tag_stats
      WHERE (name LIKE ? OR display_name LIKE ? OR description LIKE ?)
      ${'{CATEGORY_FILTER}'}
      ${'{EXCLUDE_FILTER}'}
      ORDER BY usage_count DESC, name ASC
      LIMIT ?
    `)
    );

    this.preparedStatements.set(
      'searchTagsFTS',
      this.db.prepare(`
      SELECT t.*, rank
      FROM tags_fts fts
      JOIN v_tag_stats t ON fts.id = t.id
      WHERE tags_fts MATCH ?
      ${'{CATEGORY_FILTER}'}
      ${'{EXCLUDE_FILTER}'}
      ORDER BY rank, usage_count DESC
      LIMIT ?
    `)
    );

    // Analytics
    this.preparedStatements.set(
      'updateTagAnalytics',
      this.db.prepare(`
      INSERT OR REPLACE INTO tag_analytics (
        tag_id, usage_count, entry_count, last_updated
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `)
    );

    // Bulk operations
    this.preparedStatements.set(
      'mergeTag',
      this.db.prepare(`
      UPDATE tag_associations SET tag_id = ? WHERE tag_id = ?
    `)
    );
  }

  /**
   * Create a new tag
   */
  async create(tagData: CreateTag, userId?: string): Promise<Tag> {
    const validatedData = HierarchicalSchemaValidator.validateCreateTag(tagData);

    const transaction = this.db.transaction(() => {
      // Check for duplicate name
      const existing = this.preparedStatements.get('selectByName')!.get(validatedData.name);
      if (existing) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Tag name already exists');
      }

      // Verify category exists if specified
      if (validatedData.category_id) {
        const category = this.db
          .prepare('SELECT id FROM categories WHERE id = ?')
          .get(validatedData.category_id);
        if (!category) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Category not found');
        }
      }

      const id = uuidv4();

      // Insert tag
      this.preparedStatements
        .get('insertTag')!
        .run(
          id,
          validatedData.name,
          validatedData.display_name,
          validatedData.description || null,
          validatedData.category_id || null,
          validatedData.color || null,
          validatedData.is_system === true,
          validatedData.is_suggested === true,
          userId || 'system'
        );

      return this.preparedStatements.get('selectById')!.get(id) as Tag;
    });

    return transaction();
  }

  /**
   * Update an existing tag
   */
  async update(id: string, updates: UpdateTag, userId?: string): Promise<Tag> {
    const validatedUpdates = HierarchicalSchemaValidator.validateUpdateTag(updates);

    const transaction = this.db.transaction(() => {
      const existing = this.preparedStatements.get('selectById')!.get(id) as any;
      if (!existing) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
      }

      if (existing.is_system) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot modify system tag');
      }

      // Check name uniqueness if changing
      if (validatedUpdates.name && validatedUpdates.name !== existing.name) {
        const duplicateCheck = this.preparedStatements
          .get('selectByName')!
          .get(validatedUpdates.name);
        if (duplicateCheck) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Tag name already exists');
        }
      }

      // Verify category exists if changing
      if (validatedUpdates.category_id) {
        const category = this.db
          .prepare('SELECT id FROM categories WHERE id = ?')
          .get(validatedUpdates.category_id);
        if (!category) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Category not found');
        }
      }

      // Update tag
      this.preparedStatements
        .get('updateTag')!
        .run(
          validatedUpdates.name,
          validatedUpdates.display_name,
          validatedUpdates.description,
          validatedUpdates.category_id,
          validatedUpdates.color,
          validatedUpdates.is_suggested,
          id
        );

      return this.preparedStatements.get('selectById')!.get(id) as Tag;
    });

    return transaction();
  }

  /**
   * Delete a tag
   */
  async delete(id: string, options?: { force?: boolean }): Promise<void> {
    const transaction = this.db.transaction(() => {
      const tag = this.preparedStatements.get('selectById')!.get(id) as any;
      if (!tag) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
      }

      if (tag.is_system && !options?.force) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete system tag');
      }

      // Check for associations
      const associationCount = this.db
        .prepare('SELECT COUNT(*) as count FROM tag_associations WHERE tag_id = ?')
        .get(id) as any;

      if (associationCount.count > 0 && !options?.force) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          `Tag is associated with ${associationCount.count} entries. Use force option to delete.`
        );
      }

      // Delete associations first
      this.db.prepare('DELETE FROM tag_associations WHERE tag_id = ?').run(id);

      // Delete tag
      const result = this.preparedStatements.get('deleteTag')!.run(id);
      if (result.changes === 0) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found or is system tag');
      }
    });

    transaction();
  }

  /**
   * Find tag by ID
   */
  async findById(id: string): Promise<Tag | null> {
    return this.preparedStatements.get('selectById')!.get(id) as Tag | null;
  }

  /**
   * Find tag by name
   */
  async findByName(name: string): Promise<Tag | null> {
    return this.preparedStatements.get('selectByName')!.get(name.toLowerCase()) as Tag | null;
  }

  /**
   * Search tags with various options
   */
  async search(options: TagSearchOptions): Promise<Tag[]> {
    let query = '';
    let params: any[] = [];

    if (options.fuzzy && options.query) {
      // Use FTS search for fuzzy matching
      query = this.preparedStatements.get('searchTagsFTS')!.source;
      params = [options.query];
    } else if (options.query) {
      // Use LIKE search for exact matching
      query = this.preparedStatements.get('searchTags')!.source;
      const likeQuery = `%${options.query}%`;
      params = [likeQuery, likeQuery, likeQuery];
    } else {
      // Get all tags with filters
      query = `
        SELECT * FROM v_tag_stats
        WHERE 1=1
        {CATEGORY_FILTER}
        {EXCLUDE_FILTER}
        ORDER BY usage_count DESC, name ASC
        LIMIT ?
      `;
      params = [];
    }

    // Add category filter
    if (options.categoryId) {
      query = query.replace('{CATEGORY_FILTER}', 'AND category_id = ?');
      params.push(options.categoryId);
    } else {
      query = query.replace('{CATEGORY_FILTER}', '');
    }

    // Add exclude filter
    if (options.excludeIds && options.excludeIds.length > 0) {
      const placeholders = options.excludeIds.map(() => '?').join(',');
      query = query.replace('{EXCLUDE_FILTER}', `AND id NOT IN (${placeholders})`);
      params.push(...options.excludeIds);
    } else {
      query = query.replace('{EXCLUDE_FILTER}', '');
    }

    // Add limit
    params.push(options.limit || 20);

    return this.db.prepare(query).all(...params) as Tag[];
  }

  /**
   * Get all tags with optional filtering and pagination
   */
  async findAll(options: TagQueryOptions = {}): Promise<Tag[]> {
    let query = `
      SELECT * FROM v_tag_stats
      WHERE 1=1
    `;
    const params: any[] = [];

    if (!options.includeSystem) {
      query += ' AND is_system = FALSE';
    }

    if (options.categoryId) {
      query += ' AND category_id = ?';
      params.push(options.categoryId);
    }

    // Add sorting
    const sortBy = options.sortBy || 'name';
    const sortDirection = options.sortDirection || 'asc';
    query += ` ORDER BY ${sortBy} ${sortDirection.toUpperCase()}`;

    // Add pagination
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);

      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    return this.db.prepare(query).all(...params) as Tag[];
  }

  /**
   * Associate a tag with a KB entry
   */
  async associateWithEntry(
    entryId: string,
    tagId: string,
    options: TagAssociationOptions = {},
    userId?: string
  ): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Verify entry exists
      const entry = this.db.prepare('SELECT id FROM kb_entries WHERE id = ?').get(entryId);
      if (!entry) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'KB entry not found');
      }

      // Verify tag exists
      const tag = this.preparedStatements.get('selectById')!.get(tagId);
      if (!tag) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag not found');
      }

      // Check if association already exists
      const existing = this.db
        .prepare('SELECT id FROM tag_associations WHERE entry_id = ? AND tag_id = ?')
        .get(entryId, tagId);

      if (existing) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Tag is already associated with this entry');
      }

      const associationId = uuidv4();

      // Create association
      this.preparedStatements
        .get('insertAssociation')!
        .run(
          associationId,
          entryId,
          tagId,
          options.relevanceScore || null,
          options.assignedBy || 'user',
          options.confidence || null,
          userId || 'system'
        );
    });

    transaction();
  }

  /**
   * Remove tag association from a KB entry
   */
  async dissociateFromEntry(entryId: string, tagId: string): Promise<void> {
    const result = this.preparedStatements.get('deleteAssociation')!.run(entryId, tagId);
    if (result.changes === 0) {
      throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'Tag association not found');
    }
  }

  /**
   * Get all tags associated with a KB entry
   */
  async getEntryTags(entryId: string): Promise<(Tag & TagAssociation)[]> {
    return this.preparedStatements.get('selectEntryTags')!.all(entryId) as (Tag & TagAssociation)[];
  }

  /**
   * Get all KB entries associated with a tag
   */
  async getTagEntries(tagId: string): Promise<any[]> {
    return this.preparedStatements.get('selectTagEntries')!.all(tagId);
  }

  /**
   * Replace all tags for a KB entry
   */
  async replaceEntryTags(
    entryId: string,
    tagIds: string[],
    options: TagAssociationOptions = {},
    userId?: string
  ): Promise<void> {
    const transaction = this.db.transaction(() => {
      // Verify entry exists
      const entry = this.db.prepare('SELECT id FROM kb_entries WHERE id = ?').get(entryId);
      if (!entry) {
        throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, 'KB entry not found');
      }

      // Remove all existing associations
      this.preparedStatements.get('deleteAllAssociations')!.run(entryId);

      // Add new associations
      for (const tagId of tagIds) {
        const tag = this.preparedStatements.get('selectById')!.get(tagId);
        if (!tag) {
          throw new AppError(ErrorCode.RESOURCE_NOT_FOUND, `Tag ${tagId} not found`);
        }

        const associationId = uuidv4();
        this.preparedStatements
          .get('insertAssociation')!
          .run(
            associationId,
            entryId,
            tagId,
            options.relevanceScore || null,
            options.assignedBy || 'user',
            options.confidence || null,
            userId || 'system'
          );
      }
    });

    transaction();
  }

  /**
   * Get tag suggestions for a query
   */
  async getSuggestions(
    query: string,
    options: {
      limit?: number;
      categoryId?: string;
      contextEntryId?: string;
    } = {}
  ): Promise<Tag[]> {
    const limit = options.limit || 10;
    const suggestions = new Map<string, Tag>();

    // 1. Exact name matches
    const exactMatches = this.db
      .prepare(
        `
      SELECT * FROM v_tag_stats
      WHERE name LIKE ? OR display_name LIKE ?
      ${options.categoryId ? 'AND category_id = ?' : ''}
      ORDER BY usage_count DESC
      LIMIT ?
    `
      )
      .all(
        `${query}%`,
        `${query}%`,
        ...(options.categoryId ? [options.categoryId] : []),
        limit
      ) as Tag[];

    exactMatches.forEach(tag => suggestions.set(tag.id, tag));

    // 2. FTS matches if we have fewer than limit
    if (suggestions.size < limit) {
      const ftsMatches = this.db
        .prepare(
          `
        SELECT t.*, rank
        FROM tags_fts fts
        JOIN v_tag_stats t ON fts.id = t.id
        WHERE tags_fts MATCH ?
        ${options.categoryId ? 'AND t.category_id = ?' : ''}
        ORDER BY rank, usage_count DESC
        LIMIT ?
      `
        )
        .all(
          query,
          ...(options.categoryId ? [options.categoryId] : []),
          limit - suggestions.size
        ) as Tag[];

      ftsMatches.forEach(tag => {
        if (!suggestions.has(tag.id)) {
          suggestions.set(tag.id, tag);
        }
      });
    }

    // 3. Context-based suggestions if we have an entry context
    if (options.contextEntryId && suggestions.size < limit) {
      const contextTags = this.db
        .prepare(
          `
        SELECT DISTINCT t.*, 1.0 as relevance_boost
        FROM tags t
        JOIN tag_associations ta1 ON t.id = ta1.tag_id
        JOIN tag_associations ta2 ON ta1.entry_id != ta2.entry_id
        WHERE ta2.tag_id IN (
          SELECT tag_id FROM tag_associations WHERE entry_id = ?
        )
        AND t.name LIKE ?
        ORDER BY t.usage_count DESC
        LIMIT ?
      `
        )
        .all(options.contextEntryId, `%${query}%`, limit - suggestions.size) as Tag[];

      contextTags.forEach(tag => {
        if (!suggestions.has(tag.id)) {
          suggestions.set(tag.id, tag);
        }
      });
    }

    return Array.from(suggestions.values()).slice(0, limit);
  }

  /**
   * Bulk operations on tags
   */
  async bulkOperation(operation: BulkTagOperation): Promise<BulkOperationResult> {
    const startTime = Date.now();
    const transactionId = uuidv4();
    const result: BulkOperationResult = {
      operation: operation.operation,
      total_items: operation.tags.length,
      successful: 0,
      failed: 0,
      errors: [],
      execution_time: 0,
      transaction_id: transactionId,
    };

    const transaction = this.db.transaction(() => {
      for (const item of operation.tags) {
        try {
          switch (operation.operation) {
            case 'create':
              await this.create(item.data as CreateTag);
              break;
            case 'update':
              if (!item.id) throw new Error('ID required for update operation');
              await this.update(item.id, item.data as UpdateTag);
              break;
            case 'delete':
              if (!item.id) throw new Error('ID required for delete operation');
              await this.delete(item.id, { force: operation.options?.force_delete });
              break;
            case 'assign':
              if (!item.id || !item.entry_ids) {
                throw new Error('ID and entry_ids required for assign operation');
              }
              for (const entryId of item.entry_ids) {
                await this.associateWithEntry(entryId, item.id);
              }
              break;
            case 'unassign':
              if (!item.id || !item.entry_ids) {
                throw new Error('ID and entry_ids required for unassign operation');
              }
              for (const entryId of item.entry_ids) {
                await this.dissociateFromEntry(entryId, item.id);
              }
              break;
            case 'merge':
              if (!item.id || !item.merge_into_id) {
                throw new Error('ID and merge_into_id required for merge operation');
              }
              this.preparedStatements.get('mergeTag')!.run(item.merge_into_id, item.id);
              await this.delete(item.id, { force: true });
              break;
            default:
              throw new Error(`Unsupported operation: ${operation.operation}`);
          }
          result.successful++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            item_id: item.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            details: { item },
          });
        }
      }
    });

    try {
      transaction();
    } catch (error) {
      result.failed = result.total_items;
      result.successful = 0;
      result.errors = [
        {
          error: error instanceof Error ? error.message : 'Transaction failed',
          details: { operation },
        },
      ];
    }

    result.execution_time = Date.now() - startTime;
    return result;
  }

  /**
   * Get tag analytics
   */
  async getAnalytics(tagId: string): Promise<TagAnalytics | null> {
    const analytics = this.db
      .prepare(
        `
      SELECT
        ta.*,
        (
          SELECT GROUP_CONCAT(
            json_object('category_id', c.id, 'category_name', c.name, 'count', category_counts.count),
            ','
          )
          FROM (
            SELECT e.category_id, COUNT(*) as count
            FROM tag_associations tag_a
            JOIN kb_entries e ON tag_a.entry_id = e.id
            WHERE tag_a.tag_id = ta.tag_id AND e.category_id IS NOT NULL
            GROUP BY e.category_id
            ORDER BY count DESC
            LIMIT 10
          ) category_counts
          JOIN categories c ON category_counts.category_id = c.id
        ) as categories_json,
        (
          SELECT GROUP_CONCAT(
            json_object(
              'tag_id', co_tag.tag_id,
              'tag_name', t.display_name,
              'count', co_tag.count,
              'correlation', co_tag.correlation
            ),
            ','
          )
          FROM (
            SELECT
              ta2.tag_id,
              COUNT(*) as count,
              COUNT(*) * 1.0 / (
                SELECT COUNT(*) FROM tag_associations WHERE tag_id = ta.tag_id
              ) as correlation
            FROM tag_associations ta1
            JOIN tag_associations ta2 ON ta1.entry_id = ta2.entry_id
            WHERE ta1.tag_id = ta.tag_id AND ta2.tag_id != ta.tag_id
            GROUP BY ta2.tag_id
            ORDER BY count DESC
            LIMIT 10
          ) co_tag
          JOIN tags t ON co_tag.tag_id = t.id
        ) as co_occurrence_json
      FROM tag_analytics ta
      WHERE ta.tag_id = ?
    `
      )
      .get(tagId) as any;

    if (!analytics) return null;

    // Parse JSON fields
    let categories = [];
    let coOccurrence = [];

    if (analytics.categories_json) {
      try {
        categories = JSON.parse(`[${analytics.categories_json}]`);
      } catch {
        categories = [];
      }
    }

    if (analytics.co_occurrence_json) {
      try {
        coOccurrence = JSON.parse(`[${analytics.co_occurrence_json}]`);
      } catch {
        coOccurrence = [];
      }
    }

    return {
      ...analytics,
      categories,
      co_occurrence: coOccurrence,
      last_updated: new Date(analytics.last_updated),
    };
  }

  /**
   * Update tag analytics
   */
  async updateAnalytics(tagId: string, analytics: Partial<TagAnalytics>): Promise<void> {
    this.preparedStatements
      .get('updateTagAnalytics')!
      .run(tagId, analytics.usage_count || 0, analytics.entry_count || 0);
  }

  /**
   * Get most used tags
   */
  async getMostUsed(limit: number = 20): Promise<Tag[]> {
    return this.db
      .prepare(
        `
      SELECT * FROM v_tag_stats
      WHERE usage_count > 0
      ORDER BY usage_count DESC
      LIMIT ?
    `
      )
      .all(limit) as Tag[];
  }

  /**
   * Get trending tags (based on recent usage)
   */
  async getTrending(
    days: number = 7,
    limit: number = 20
  ): Promise<(Tag & { recent_usage: number })[]> {
    return this.db
      .prepare(
        `
      SELECT
        t.*,
        COUNT(ta.id) as recent_usage
      FROM v_tag_stats t
      JOIN tag_associations ta ON t.id = ta.tag_id
      WHERE ta.created_at > datetime('now', '-' || ? || ' days')
      GROUP BY t.id
      ORDER BY recent_usage DESC
      LIMIT ?
    `
      )
      .all(days, limit) as (Tag & { recent_usage: number })[];
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.preparedStatements.forEach(stmt => {
      try {
        stmt.finalize();
      } catch (error) {
        console.warn('Error finalizing statement:', error);
      }
    });
    this.preparedStatements.clear();
  }
}

export default TagRepository;
