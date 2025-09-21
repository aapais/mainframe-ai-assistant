# Extending the Categorization System

## Overview

This guide provides comprehensive instructions for developers looking to extend, customize, or integrate with the Mainframe Knowledge Base's categorization and tagging system. The system is designed with extensibility in mind, offering multiple extension points and customization options.

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 UI Layer                        │
├─────────────────┬───────────────────────────────┤
│ React Components│ Extension Points              │
│ - TagInput      │ - Custom validators           │
│ - CategoryTree  │ - Custom suggestion sources   │
│ - SearchUI      │ - Custom renderers            │
└─────────────────┴───────────────────────────────┘
┌─────────────────────────────────────────────────┐
│                Service Layer                    │
├─────────────────┬───────────────────────────────┤
│ Core Services   │ Extension APIs                │
│ - TagService    │ - Plugin system               │
│ - CategorySvc   │ - Event hooks                 │
│ - SearchSvc     │ - Custom processors           │
└─────────────────┴───────────────────────────────┘
┌─────────────────────────────────────────────────┐
│               Repository Layer                  │
├─────────────────┬───────────────────────────────┤
│ Data Access     │ Customization Points          │
│ - TagRepository │ - Custom queries              │
│ - CategoryRepo  │ - Additional schemas          │
│ - SearchRepo    │ - Custom analytics            │
└─────────────────┴───────────────────────────────┘
```

## Extension Points

### 1. Custom Tag Suggestion Sources

Create intelligent tag suggestion sources that integrate with your existing systems.

#### Base Interface

```typescript
interface TagSuggestionSource {
  name: string;
  priority: number;
  getSuggestions(query: string, context: SuggestionContext): Promise<TagSuggestion[]>;
}

interface SuggestionContext {
  entryId?: string;
  categoryId?: string;
  existingTags: Tag[];
  userPreferences?: UserPreferences;
  contentAnalysis?: ContentAnalysis;
}
```

#### Example: JIRA Integration

```typescript
import { TagSuggestionSource, TagSuggestion } from '../types';

export class JiraSuggestionSource implements TagSuggestionSource {
  name = 'jira-integration';
  priority = 80; // Higher priority = earlier execution

  constructor(private jiraClient: JiraClient) {}

  async getSuggestions(
    query: string,
    context: SuggestionContext
  ): Promise<TagSuggestion[]> {
    // Search JIRA for similar issues
    const jiraIssues = await this.jiraClient.searchIssues({
      jql: `text ~ "${query}" AND project = MAINFRAME`,
      maxResults: 10
    });

    const suggestions: TagSuggestion[] = [];

    for (const issue of jiraIssues) {
      // Extract relevant tags from JIRA labels
      const jiraTags = this.extractTagsFromIssue(issue);

      for (const jiraTag of jiraTags) {
        // Check if tag already exists in our system
        const existingTag = await this.findExistingTag(jiraTag);

        if (existingTag) {
          suggestions.push({
            tag: existingTag,
            score: this.calculateRelevanceScore(query, issue, jiraTag),
            source: 'jira',
            reasoning: `Found in similar JIRA issue: ${issue.key}`,
            confidence: this.calculateConfidence(issue, jiraTag)
          });
        } else {
          // Suggest creating new tag
          suggestions.push({
            tag: {
              id: `jira-suggested-${Date.now()}`,
              name: this.normalizeTagName(jiraTag),
              display_name: jiraTag,
              is_suggested: true,
              source_metadata: {
                jira_issue: issue.key,
                jira_labels: issue.fields.labels
              }
            },
            score: this.calculateRelevanceScore(query, issue, jiraTag),
            source: 'jira',
            reasoning: `Suggested from JIRA issue pattern analysis`
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  }

  private extractTagsFromIssue(issue: JiraIssue): string[] {
    const tags = new Set<string>();

    // Extract from labels
    issue.fields.labels?.forEach(label => {
      if (this.isRelevantLabel(label)) {
        tags.add(label.toLowerCase());
      }
    });

    // Extract from component names
    issue.fields.components?.forEach(component => {
      tags.add(component.name.toLowerCase().replace(/\s+/g, '-'));
    });

    // Extract from issue type
    if (issue.fields.issuetype.name === 'Bug') {
      tags.add('error');
      tags.add('bug');
    }

    return Array.from(tags);
  }

  private calculateRelevanceScore(query: string, issue: JiraIssue, tag: string): number {
    let score = 0;

    // Text similarity between query and issue summary
    const summaryMatch = this.calculateTextSimilarity(query, issue.fields.summary);
    score += summaryMatch * 40;

    // Tag relevance to query
    const tagMatch = this.calculateTextSimilarity(query, tag);
    score += tagMatch * 30;

    // Issue priority boost
    const priorityMultiplier = {
      'Highest': 1.3,
      'High': 1.2,
      'Medium': 1.0,
      'Low': 0.8,
      'Lowest': 0.6
    };
    score *= priorityMultiplier[issue.fields.priority.name] || 1.0;

    // Recent issues get boost
    const issueAge = Date.now() - new Date(issue.fields.created).getTime();
    const daysSinceCreated = issueAge / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 30) {
      score *= 1.2;
    }

    return Math.min(100, Math.max(0, score));
  }

  private calculateConfidence(issue: JiraIssue, tag: string): number {
    let confidence = 0.5;

    // Higher confidence for resolved issues
    if (issue.fields.resolution) {
      confidence += 0.3;
    }

    // Higher confidence for issues with detailed descriptions
    if (issue.fields.description && issue.fields.description.length > 100) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }
}

// Register the suggestion source
TagService.registerSuggestionSource(new JiraSuggestionSource(jiraClient));
```

#### Example: AI-Enhanced Semantic Source

```typescript
export class SemanticSuggestionSource implements TagSuggestionSource {
  name = 'semantic-ai';
  priority = 70;

  constructor(
    private aiService: OpenAIService,
    private embeddingService: EmbeddingService
  ) {}

  async getSuggestions(
    query: string,
    context: SuggestionContext
  ): Promise<TagSuggestion[]> {
    // Get semantic embedding for the query
    const queryEmbedding = await this.embeddingService.getEmbedding(query);

    // Find similar tags using vector similarity
    const similarTags = await this.findSimilarTagsByEmbedding(
      queryEmbedding,
      { limit: 20, threshold: 0.7 }
    );

    // Use AI to analyze and rank suggestions
    const aiAnalysis = await this.aiService.analyzeTags({
      query,
      context: context.entryId ? await this.getEntryContent(context.entryId) : '',
      existingTags: context.existingTags.map(t => t.name),
      candidateTags: similarTags.map(t => t.name)
    });

    const suggestions: TagSuggestion[] = aiAnalysis.suggestions.map(suggestion => ({
      tag: similarTags.find(t => t.name === suggestion.tagName)!,
      score: suggestion.relevanceScore * 100,
      source: 'ai-semantic',
      reasoning: suggestion.reasoning,
      confidence: suggestion.confidence
    }));

    // Add AI-generated tags for novel concepts
    if (aiAnalysis.novelTags?.length > 0) {
      for (const novelTag of aiAnalysis.novelTags) {
        suggestions.push({
          tag: {
            id: `ai-generated-${Date.now()}-${Math.random()}`,
            name: this.normalizeTagName(novelTag.name),
            display_name: novelTag.displayName,
            description: novelTag.description,
            is_suggested: true,
            confidence: novelTag.confidence
          },
          score: novelTag.relevanceScore * 100,
          source: 'ai-generated',
          reasoning: novelTag.reasoning
        });
      }
    }

    return suggestions;
  }

  private async findSimilarTagsByEmbedding(
    queryEmbedding: number[],
    options: { limit: number; threshold: number }
  ): Promise<Tag[]> {
    // Implementation would use vector database or similarity search
    // This is a simplified version
    const allTags = await TagRepository.findAllWithEmbeddings();

    const similarities = allTags.map(tag => ({
      tag,
      similarity: this.cosineSimilarity(queryEmbedding, tag.embedding)
    }));

    return similarities
      .filter(s => s.similarity >= options.threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit)
      .map(s => s.tag);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }
}
```

### 2. Custom Validators

Implement business-specific validation rules for tags and categories.

#### Tag Validators

```typescript
interface TagValidator {
  name: string;
  priority: number;
  validate(tag: Tag, context: ValidationContext): Promise<ValidationResult>;
}

interface ValidationContext {
  operation: 'create' | 'update' | 'delete';
  existingTags: Tag[];
  category?: CategoryNode;
  user: User;
  entryContext?: KnowledgeEntry;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
}
```

#### Example: Business Rule Validator

```typescript
export class BusinessRuleTagValidator implements TagValidator {
  name = 'business-rules';
  priority = 90;

  private businessRules = {
    // Critical tags must have descriptions
    criticalTagsRequireDescription: true,
    // Maximum tags per entry
    maxTagsPerEntry: 15,
    // Naming conventions
    namingPattern: /^[a-z0-9-]+$/,
    // Reserved prefixes
    reservedPrefixes: ['sys-', 'auto-', 'ai-'],
    // Category-specific rules
    categoryRules: {
      'critical-systems': {
        requireApproval: true,
        allowedUsers: ['admin', 'senior-dev']
      }
    }
  };

  async validate(tag: Tag, context: ValidationContext): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Check naming convention
    if (!this.businessRules.namingPattern.test(tag.name)) {
      errors.push({
        code: 'INVALID_NAME_PATTERN',
        message: 'Tag name must contain only lowercase letters, numbers, and hyphens',
        field: 'name'
      });
      suggestions.push('Use lowercase letters and hyphens, e.g., "jcl-error" instead of "JCL_Error"');
    }

    // Check reserved prefixes
    const hasReservedPrefix = this.businessRules.reservedPrefixes.some(prefix =>
      tag.name.startsWith(prefix)
    );
    if (hasReservedPrefix && !context.user.roles.includes('admin')) {
      errors.push({
        code: 'RESERVED_PREFIX',
        message: 'Only administrators can create tags with reserved prefixes',
        field: 'name'
      });
    }

    // Critical category rules
    if (context.category?.slug === 'critical-systems') {
      if (!tag.description) {
        errors.push({
          code: 'DESCRIPTION_REQUIRED',
          message: 'Tags in critical systems category must have descriptions',
          field: 'description'
        });
      }

      const rules = this.businessRules.categoryRules['critical-systems'];
      if (rules.requireApproval && !context.user.roles.some(r => rules.allowedUsers.includes(r))) {
        errors.push({
          code: 'APPROVAL_REQUIRED',
          message: 'Creating tags in critical systems requires senior developer approval',
          field: 'category_id'
        });
      }
    }

    // Check entry tag limit
    if (context.entryContext && context.operation === 'create') {
      const currentTagCount = context.existingTags.length;
      if (currentTagCount >= this.businessRules.maxTagsPerEntry) {
        errors.push({
          code: 'TOO_MANY_TAGS',
          message: `Maximum ${this.businessRules.maxTagsPerEntry} tags allowed per entry`,
          field: 'entry'
        });
      } else if (currentTagCount >= this.businessRules.maxTagsPerEntry * 0.8) {
        warnings.push({
          code: 'APPROACHING_TAG_LIMIT',
          message: 'Approaching maximum tag limit - consider consolidating tags'
        });
      }
    }

    // Suggest similar existing tags to prevent duplicates
    if (context.operation === 'create') {
      const similarTags = await this.findSimilarTags(tag.name, context.existingTags);
      if (similarTags.length > 0) {
        warnings.push({
          code: 'SIMILAR_TAGS_EXIST',
          message: `Similar tags already exist: ${similarTags.map(t => t.name).join(', ')}`
        });
        suggestions.push('Consider using existing similar tags instead of creating new ones');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private async findSimilarTags(tagName: string, existingTags: Tag[]): Promise<Tag[]> {
    return existingTags.filter(tag => {
      const similarity = this.calculateStringSimilarity(tagName, tag.name);
      return similarity > 0.8 && similarity < 1.0; // Similar but not identical
    });
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

// Register the validator
TagService.addValidator(new BusinessRuleTagValidator());
```

#### Category Validators

```typescript
export class CategoryHierarchyValidator implements CategoryValidator {
  name = 'hierarchy-rules';
  priority = 95;

  private hierarchyRules = {
    maxDepth: 5,
    maxChildrenPerParent: 20,
    prohibitedMoves: [
      // System categories cannot be moved
      { condition: 'is_system', action: 'move', message: 'System categories cannot be moved' },
      // Certain categories must remain at root level
      { condition: 'slug', values: ['system', 'general'], level: 0, message: 'Must remain at root level' }
    ],
    namingRules: {
      pattern: /^[A-Z][a-zA-Z0-9\s-]+$/,
      maxLength: 50,
      minLength: 2,
      reservedNames: ['admin', 'system', 'temp', 'delete']
    }
  };

  async validate(
    category: CategoryNode,
    context: CategoryValidationContext
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    // Validate naming rules
    if (!this.hierarchyRules.namingRules.pattern.test(category.name)) {
      errors.push({
        code: 'INVALID_CATEGORY_NAME',
        message: 'Category name must start with uppercase letter and contain only letters, numbers, spaces, and hyphens',
        field: 'name'
      });
    }

    if (this.hierarchyRules.namingRules.reservedNames.includes(category.name.toLowerCase())) {
      errors.push({
        code: 'RESERVED_NAME',
        message: 'Category name is reserved',
        field: 'name'
      });
    }

    // Validate hierarchy depth
    if (category.level >= this.hierarchyRules.maxDepth) {
      errors.push({
        code: 'MAX_DEPTH_EXCEEDED',
        message: `Maximum hierarchy depth of ${this.hierarchyRules.maxDepth} exceeded`,
        field: 'parent_id'
      });
    }

    // Validate parent-child relationship
    if (context.operation === 'move' || context.operation === 'create') {
      if (category.parent_id) {
        const parent = await CategoryRepository.findById(category.parent_id);
        if (!parent) {
          errors.push({
            code: 'PARENT_NOT_FOUND',
            message: 'Parent category does not exist',
            field: 'parent_id'
          });
        } else {
          // Check if parent would exceed child limit
          const siblingCount = await CategoryRepository.countChildren(category.parent_id);
          if (siblingCount >= this.hierarchyRules.maxChildrenPerParent) {
            errors.push({
              code: 'TOO_MANY_CHILDREN',
              message: `Parent category already has maximum number of children (${this.hierarchyRules.maxChildrenPerParent})`,
              field: 'parent_id'
            });
          }
        }
      }
    }

    // Check prohibited moves
    if (context.operation === 'move') {
      for (const rule of this.hierarchyRules.prohibitedMoves) {
        if (this.matchesCondition(category, rule)) {
          errors.push({
            code: 'PROHIBITED_MOVE',
            message: rule.message,
            field: 'parent_id'
          });
          break;
        }
      }
    }

    // Validate circular references
    if (context.operation === 'move' && category.parent_id) {
      const wouldCreateCircularReference = await this.checkCircularReference(
        category.id,
        category.parent_id
      );
      if (wouldCreateCircularReference) {
        errors.push({
          code: 'CIRCULAR_REFERENCE',
          message: 'Move would create circular reference in hierarchy',
          field: 'parent_id'
        });
      }
    }

    // Suggest better organization
    if (context.operation === 'create' && category.level === 0) {
      const rootCategoryCount = await CategoryRepository.countRootCategories();
      if (rootCategoryCount >= 10) {
        warnings.push({
          code: 'TOO_MANY_ROOT_CATEGORIES',
          message: 'Many root categories exist - consider organizing under existing categories'
        });
        suggestions.push('Review existing root categories to see if this could be organized as a subcategory');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  private matchesCondition(category: CategoryNode, rule: any): boolean {
    switch (rule.condition) {
      case 'is_system':
        return category.is_system;
      case 'slug':
        return rule.values.includes(category.slug);
      default:
        return false;
    }
  }

  private async checkCircularReference(categoryId: string, newParentId: string): Promise<boolean> {
    let currentParentId = newParentId;

    while (currentParentId) {
      if (currentParentId === categoryId) {
        return true; // Circular reference found
      }

      const parent = await CategoryRepository.findById(currentParentId);
      currentParentId = parent?.parent_id || null;
    }

    return false;
  }
}
```

### 3. Custom UI Components

Extend the UI components with custom functionality and styling.

#### Custom Tag Input

```typescript
import { EnhancedTagInput } from '../components/tags/EnhancedTagInput';

interface CustomTagInputProps extends Omit<EnhancedTagInputProps, 'validator'> {
  businessRules?: BusinessRuleConfig;
  integrations?: IntegrationConfig;
  customSources?: TagSuggestionSource[];
}

export const CustomTagInput: React.FC<CustomTagInputProps> = ({
  businessRules,
  integrations,
  customSources = [],
  ...props
}) => {
  const customValidator = useCallback(async (tags: Tag[]) => {
    const results = await Promise.all([
      // Run standard validation
      standardValidator.validate(tags),
      // Run business rule validation
      businessRules && businessRuleValidator.validate(tags, businessRules),
      // Run integration-specific validation
      integrations && integrationValidator.validate(tags, integrations)
    ].filter(Boolean));

    return combineValidationResults(results);
  }, [businessRules, integrations]);

  const enhancedSuggestions = useCallback(async (query: string) => {
    const suggestions = await Promise.all([
      // Get standard suggestions
      getStandardSuggestions(query),
      // Get custom source suggestions
      ...customSources.map(source => source.getSuggestions(query, context))
    ]);

    return mergeSuggestions(suggestions.flat());
  }, [customSources]);

  return (
    <div className="custom-tag-input-wrapper">
      <EnhancedTagInput
        {...props}
        validator={customValidator}
        onSuggestionsRequest={enhancedSuggestions}
        className={`custom-tag-input ${props.className || ''}`}
      />
      {businessRules?.showComplianceStatus && (
        <ComplianceStatusIndicator tags={props.value} rules={businessRules} />
      )}
      {integrations?.showIntegrationStatus && (
        <IntegrationStatusPanel integrations={integrations} />
      )}
    </div>
  );
};

// Compliance status indicator
const ComplianceStatusIndicator: React.FC<{
  tags: Tag[];
  rules: BusinessRuleConfig;
}> = ({ tags, rules }) => {
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);

  useEffect(() => {
    checkCompliance();
  }, [tags, rules]);

  const checkCompliance = async () => {
    const status = await complianceChecker.check(tags, rules);
    setComplianceStatus(status);
  };

  if (!complianceStatus) return null;

  return (
    <div className={`compliance-indicator ${complianceStatus.level}`}>
      <div className="compliance-score">
        Compliance: {Math.round(complianceStatus.score * 100)}%
      </div>
      {complianceStatus.violations.length > 0 && (
        <div className="compliance-violations">
          {complianceStatus.violations.map((violation, index) => (
            <div key={index} className="violation">
              <span className="violation-code">{violation.code}</span>
              <span className="violation-message">{violation.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

#### Custom Category Tree

```typescript
interface CustomCategoryTreeProps extends EnhancedCategoryTreeProps {
  businessLogic?: CategoryBusinessLogic;
  customRenderers?: CategoryRenderers;
  integrationHooks?: CategoryIntegrationHooks;
}

export const CustomCategoryTree: React.FC<CustomCategoryTreeProps> = ({
  businessLogic,
  customRenderers,
  integrationHooks,
  ...props
}) => {
  const customOperations = useMemo(() => ({
    ...defaultOperations,

    // Custom create operation with business logic
    create: async (parentId: string | null, categoryData: Partial<CategoryNode>) => {
      if (businessLogic?.requireApproval) {
        const approval = await requestApproval({
          operation: 'create',
          parentId,
          data: categoryData,
          user: currentUser
        });

        if (!approval.approved) {
          throw new Error(`Approval required: ${approval.reason}`);
        }
      }

      const result = await defaultOperations.create(parentId, categoryData);

      // Trigger integration hooks
      if (integrationHooks?.onCreate) {
        await integrationHooks.onCreate(result);
      }

      return result;
    },

    // Custom move operation with validation
    move: async (sourceId: string, targetId: string | null, position: number) => {
      if (businessLogic?.validateMoves) {
        const validation = await validateMove(sourceId, targetId, position);
        if (!validation.isValid) {
          throw new Error(`Move not allowed: ${validation.reason}`);
        }
      }

      const result = await defaultOperations.move(sourceId, targetId, position);

      // Trigger integration hooks
      if (integrationHooks?.onMove) {
        await integrationHooks.onMove(sourceId, targetId, position);
      }

      return result;
    },

    // Custom delete with dependency checking
    delete: async (nodeId: string) => {
      if (businessLogic?.checkDependencies) {
        const dependencies = await checkCategoryDependencies(nodeId);
        if (dependencies.hasBlockingDependencies) {
          throw new Error(`Cannot delete: ${dependencies.reason}`);
        }
      }

      const result = await defaultOperations.delete(nodeId);

      // Cleanup integrations
      if (integrationHooks?.onDelete) {
        await integrationHooks.onDelete(nodeId);
      }

      return result;
    }
  }), [businessLogic, integrationHooks]);

  // Custom node renderer
  const renderNode = useCallback((node: CategoryNode, props: NodeRenderProps) => {
    if (customRenderers?.nodeRenderer) {
      return customRenderers.nodeRenderer(node, props);
    }

    return (
      <div className="custom-category-node">
        {/* Custom business indicators */}
        {businessLogic?.showBusinessMetrics && (
          <BusinessMetricsIndicator category={node} />
        )}

        {/* Standard node content */}
        <DefaultNodeRenderer node={node} {...props} />

        {/* Integration status */}
        {integrationHooks?.showIntegrationStatus && (
          <IntegrationStatusBadge categoryId={node.id} />
        )}
      </div>
    );
  }, [customRenderers, businessLogic, integrationHooks]);

  return (
    <EnhancedCategoryTree
      {...props}
      operations={customOperations}
      renderNode={renderNode}
      className={`custom-category-tree ${props.className || ''}`}
    />
  );
};
```

### 4. Custom Analytics and Reporting

Extend the analytics system with custom metrics and reporting capabilities.

#### Custom Analytics Collector

```typescript
interface CustomAnalyticsCollector {
  collectMetrics(timeRange: TimeRange): Promise<CustomMetrics>;
  generateReport(metrics: CustomMetrics, options: ReportOptions): Promise<Report>;
}

export class BusinessAnalyticsCollector implements CustomAnalyticsCollector {
  constructor(
    private db: Database,
    private tagRepository: TagRepository,
    private categoryRepository: CategoryRepository
  ) {}

  async collectMetrics(timeRange: TimeRange): Promise<CustomMetrics> {
    const [
      tagUsageMetrics,
      categoryHealthMetrics,
      complianceMetrics,
      integrationMetrics,
      userBehaviorMetrics
    ] = await Promise.all([
      this.collectTagUsageMetrics(timeRange),
      this.collectCategoryHealthMetrics(timeRange),
      this.collectComplianceMetrics(timeRange),
      this.collectIntegrationMetrics(timeRange),
      this.collectUserBehaviorMetrics(timeRange)
    ]);

    return {
      timeRange,
      collectedAt: new Date(),
      tagUsage: tagUsageMetrics,
      categoryHealth: categoryHealthMetrics,
      compliance: complianceMetrics,
      integration: integrationMetrics,
      userBehavior: userBehaviorMetrics,
      derived: await this.calculateDerivedMetrics({
        tagUsageMetrics,
        categoryHealthMetrics,
        complianceMetrics,
        integrationMetrics,
        userBehaviorMetrics
      })
    };
  }

  private async collectTagUsageMetrics(timeRange: TimeRange): Promise<TagUsageMetrics> {
    const query = `
      SELECT
        t.id,
        t.name,
        t.category_id,
        COUNT(ta.id) as usage_count,
        AVG(ta.relevance_score) as avg_relevance,
        COUNT(DISTINCT ta.entry_id) as unique_entries,
        COUNT(DISTINCT ta.created_by) as unique_users,
        MIN(ta.created_at) as first_use,
        MAX(ta.created_at) as last_use
      FROM tags t
      LEFT JOIN tag_associations ta ON t.id = ta.tag_id
      WHERE ta.created_at BETWEEN ? AND ?
      GROUP BY t.id
      ORDER BY usage_count DESC
    `;

    const results = this.db.prepare(query).all(timeRange.start, timeRange.end);

    return {
      totalTags: results.length,
      activeTagsInPeriod: results.filter(r => r.usage_count > 0).length,
      mostUsedTags: results.slice(0, 20),
      tagsByCategory: this.groupByCategory(results),
      usageDistribution: this.calculateUsageDistribution(results),
      relevanceScores: {
        average: results.reduce((sum, r) => sum + (r.avg_relevance || 0), 0) / results.length,
        distribution: this.calculateRelevanceDistribution(results)
      }
    };
  }

  private async collectCategoryHealthMetrics(timeRange: TimeRange): Promise<CategoryHealthMetrics> {
    const categories = await this.categoryRepository.getHierarchy({
      includeInactive: false,
      withStats: true
    });

    const healthScores = await Promise.all(
      categories.map(async category => ({
        categoryId: category.id,
        name: category.name,
        health: await this.calculateCategoryHealth(category, timeRange)
      }))
    );

    return {
      totalCategories: categories.length,
      activeCategories: categories.filter(c => c.is_active).length,
      healthScores,
      hierarchyMetrics: {
        maxDepth: Math.max(...categories.map(c => c.level)),
        avgDepth: categories.reduce((sum, c) => sum + c.level, 0) / categories.length,
        branchingFactor: this.calculateBranchingFactor(categories)
      },
      unusedCategories: healthScores.filter(h => h.health.usageScore === 0),
      overloadedCategories: healthScores.filter(h => h.health.entryCount > 100)
    };
  }

  private async collectComplianceMetrics(timeRange: TimeRange): Promise<ComplianceMetrics> {
    const allTags = await this.tagRepository.findAll();
    const complianceResults = await Promise.all(
      allTags.map(async tag => ({
        tagId: tag.id,
        name: tag.name,
        compliance: await this.checkTagCompliance(tag)
      }))
    );

    const violations = complianceResults.flatMap(r => r.compliance.violations);
    const violationsByType = this.groupBy(violations, 'type');

    return {
      totalTags: allTags.length,
      compliantTags: complianceResults.filter(r => r.compliance.isCompliant).length,
      complianceRate: complianceResults.filter(r => r.compliance.isCompliant).length / allTags.length,
      violations: {
        total: violations.length,
        byType: violationsByType,
        severity: this.groupBy(violations, 'severity')
      },
      trends: await this.calculateComplianceTrends(timeRange)
    };
  }

  async generateReport(metrics: CustomMetrics, options: ReportOptions): Promise<Report> {
    const sections: ReportSection[] = [];

    // Executive Summary
    sections.push({
      title: 'Executive Summary',
      type: 'summary',
      content: this.generateExecutiveSummary(metrics)
    });

    // Tag Usage Analysis
    if (options.includeTagAnalysis) {
      sections.push({
        title: 'Tag Usage Analysis',
        type: 'analysis',
        content: this.generateTagAnalysisSection(metrics.tagUsage),
        charts: await this.generateTagUsageCharts(metrics.tagUsage)
      });
    }

    // Category Health Report
    if (options.includeCategoryHealth) {
      sections.push({
        title: 'Category Health Report',
        type: 'health',
        content: this.generateCategoryHealthSection(metrics.categoryHealth),
        charts: await this.generateCategoryHealthCharts(metrics.categoryHealth)
      });
    }

    // Compliance Report
    if (options.includeCompliance) {
      sections.push({
        title: 'Compliance Report',
        type: 'compliance',
        content: this.generateComplianceSection(metrics.compliance),
        recommendations: this.generateComplianceRecommendations(metrics.compliance)
      });
    }

    // User Behavior Insights
    if (options.includeUserBehavior) {
      sections.push({
        title: 'User Behavior Insights',
        type: 'behavior',
        content: this.generateUserBehaviorSection(metrics.userBehavior)
      });
    }

    // Recommendations
    sections.push({
      title: 'Recommendations',
      type: 'recommendations',
      content: this.generateRecommendations(metrics)
    });

    return {
      id: `report-${Date.now()}`,
      title: options.title || 'Categorization System Analysis Report',
      generatedAt: new Date(),
      timeRange: metrics.timeRange,
      sections,
      metadata: {
        generator: 'CustomAnalyticsCollector',
        version: '1.0.0',
        metrics: metrics,
        options: options
      }
    };
  }
}
```

### 5. Plugin System

Implement a plugin architecture for maximum extensibility.

#### Plugin Interface

```typescript
interface SystemPlugin {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];

  // Lifecycle hooks
  onLoad?(context: PluginContext): Promise<void>;
  onUnload?(context: PluginContext): Promise<void>;
  onConfigChange?(config: PluginConfig, context: PluginContext): Promise<void>;

  // Extension points
  tagSuggestionSources?: TagSuggestionSource[];
  validators?: (TagValidator | CategoryValidator)[];
  customComponents?: ComponentMap;
  analyticsCollectors?: AnalyticsCollector[];
  integrationHandlers?: IntegrationHandler[];
}

interface PluginContext {
  services: ServiceContainer;
  configuration: Configuration;
  eventBus: EventBus;
  logger: Logger;
}
```

#### Example Plugin: ServiceNow Integration

```typescript
export class ServiceNowIntegrationPlugin implements SystemPlugin {
  name = 'servicenow-integration';
  version = '1.2.0';
  description = 'Integrates with ServiceNow for incident tracking and tag suggestions';
  dependencies = ['core-api', 'tag-service'];

  private serviceNowClient?: ServiceNowClient;
  private config?: ServiceNowConfig;

  async onLoad(context: PluginContext): Promise<void> {
    this.config = context.configuration.get('servicenow');

    if (!this.config?.enabled) {
      context.logger.info('ServiceNow integration disabled');
      return;
    }

    // Initialize ServiceNow client
    this.serviceNowClient = new ServiceNowClient({
      instanceUrl: this.config.instanceUrl,
      username: this.config.username,
      password: this.config.password,
      apiVersion: this.config.apiVersion || 'v1'
    });

    // Register suggestion source
    context.services.tagService.registerSuggestionSource(
      new ServiceNowTagSuggestionSource(this.serviceNowClient)
    );

    // Register incident sync handler
    context.eventBus.on('kb-entry-created', this.handleKBEntryCreated.bind(this));
    context.eventBus.on('kb-entry-resolved', this.handleKBEntryResolved.bind(this));

    // Start periodic sync
    this.startPeriodicSync(context);

    context.logger.info('ServiceNow integration loaded successfully');
  }

  async onUnload(context: PluginContext): Promise<void> {
    if (this.serviceNowClient) {
      // Cleanup resources
      await this.serviceNowClient.disconnect();
      this.serviceNowClient = undefined;
    }

    context.logger.info('ServiceNow integration unloaded');
  }

  private async handleKBEntryCreated(event: KBEntryCreatedEvent): Promise<void> {
    if (!this.serviceNowClient || !this.config?.syncToServiceNow) return;

    try {
      // Create corresponding ServiceNow knowledge article
      const article = await this.serviceNowClient.createKnowledgeArticle({
        short_description: event.entry.title,
        text: event.entry.content,
        category: event.entry.category,
        tags: event.entry.tags.map(t => t.name).join(','),
        source: 'mainframe-kb'
      });

      // Update KB entry with ServiceNow reference
      await this.updateKBEntryWithServiceNowReference(event.entry.id, article.sys_id);

    } catch (error) {
      context.logger.error('Failed to sync KB entry to ServiceNow', { error, entryId: event.entry.id });
    }
  }

  private startPeriodicSync(context: PluginContext): void {
    setInterval(async () => {
      try {
        await this.syncIncidentTags();
      } catch (error) {
        context.logger.error('Periodic ServiceNow sync failed', { error });
      }
    }, this.config?.syncIntervalMinutes * 60 * 1000 || 15 * 60 * 1000);
  }

  private async syncIncidentTags(): Promise<void> {
    if (!this.serviceNowClient) return;

    // Get recent incidents from ServiceNow
    const recentIncidents = await this.serviceNowClient.getIncidents({
      created_since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      category: 'mainframe',
      state: 'resolved'
    });

    // Extract and suggest tags based on incident patterns
    for (const incident of recentIncidents) {
      const suggestedTags = this.extractTagsFromIncident(incident);

      if (suggestedTags.length > 0) {
        // Add to suggestion cache for next time user searches similar content
        await this.cacheTagSuggestions(incident.short_description, suggestedTags);
      }
    }
  }
}

// Plugin registration
export function registerServiceNowPlugin(): void {
  PluginManager.register(new ServiceNowIntegrationPlugin());
}
```

### 6. Event System Integration

Implement event-driven extensions that react to system events.

#### Event Handlers

```typescript
interface EventHandler<T = any> {
  name: string;
  event: string;
  priority: number;
  handle(event: T, context: EventContext): Promise<void>;
}

// Tag lifecycle events
export class TagAuditEventHandler implements EventHandler<TagEvent> {
  name = 'tag-audit-handler';
  event = 'tag.*'; // Listen to all tag events
  priority = 50;

  async handle(event: TagEvent, context: EventContext): Promise<void> {
    const auditEntry: AuditEntry = {
      id: uuidv4(),
      event_type: event.type,
      resource_type: 'tag',
      resource_id: event.tag.id,
      user_id: context.user.id,
      timestamp: new Date(),
      changes: event.changes || {},
      metadata: {
        ip_address: context.request.ip,
        user_agent: context.request.userAgent,
        session_id: context.session.id
      }
    };

    await AuditRepository.create(auditEntry);

    // Send to external audit system if configured
    if (context.configuration.externalAudit?.enabled) {
      await this.sendToExternalAuditSystem(auditEntry);
    }
  }

  private async sendToExternalAuditSystem(auditEntry: AuditEntry): Promise<void> {
    // Implementation for external audit system integration
  }
}

// Category change notifications
export class CategoryChangeNotificationHandler implements EventHandler<CategoryEvent> {
  name = 'category-notification-handler';
  event = 'category.updated';
  priority = 30;

  async handle(event: CategoryEvent, context: EventContext): Promise<void> {
    const category = event.category;
    const changes = event.changes;

    // Notify users who have subscribed to this category
    const subscribers = await NotificationRepository.getCategorySubscribers(category.id);

    for (const subscriber of subscribers) {
      const notification: Notification = {
        id: uuidv4(),
        user_id: subscriber.user_id,
        type: 'category_updated',
        title: `Category "${category.name}" Updated`,
        message: this.formatCategoryUpdateMessage(changes),
        data: {
          category_id: category.id,
          category_name: category.name,
          changes: changes
        },
        created_at: new Date(),
        read: false
      };

      await NotificationRepository.create(notification);

      // Send real-time notification if user is online
      if (subscriber.preferences.real_time) {
        await WebSocketService.sendToUser(subscriber.user_id, {
          type: 'notification',
          data: notification
        });
      }
    }
  }
}

// Integration sync events
export class IntegrationSyncEventHandler implements EventHandler<SyncEvent> {
  name = 'integration-sync-handler';
  event = 'sync.*';
  priority = 40;

  async handle(event: SyncEvent, context: EventContext): Promise<void> {
    switch (event.type) {
      case 'sync.tags.requested':
        await this.handleTagSync(event.data);
        break;
      case 'sync.categories.requested':
        await this.handleCategorySync(event.data);
        break;
      case 'sync.external.webhook':
        await this.handleExternalWebhook(event.data);
        break;
    }
  }

  private async handleExternalWebhook(webhookData: WebhookData): Promise<void> {
    // Handle incoming webhooks from external systems
    // e.g., JIRA, ServiceNow, GitHub, etc.

    if (webhookData.source === 'jira') {
      await this.processJiraWebhook(webhookData);
    } else if (webhookData.source === 'servicenow') {
      await this.processServiceNowWebhook(webhookData);
    }
  }
}
```

## Testing Extensions

### Unit Testing

```typescript
describe('Custom Tag Suggestion Source', () => {
  let jiraSuggestionSource: JiraSuggestionSource;
  let mockJiraClient: jest.Mocked<JiraClient>;

  beforeEach(() => {
    mockJiraClient = createMockJiraClient();
    jiraSuggestionSource = new JiraSuggestionSource(mockJiraClient);
  });

  describe('getSuggestions', () => {
    it('should return relevant tags from JIRA issues', async () => {
      // Arrange
      const query = 'memory error';
      const mockIssues = [
        createMockJiraIssue({
          key: 'MAIN-123',
          summary: 'Memory allocation error in COBOL program',
          labels: ['memory', 'cobol', 'error'],
          priority: 'High'
        })
      ];
      mockJiraClient.searchIssues.mockResolvedValue(mockIssues);

      // Act
      const suggestions = await jiraSuggestionSource.getSuggestions(query, {});

      // Assert
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].tag.name).toBe('memory');
      expect(suggestions[0].source).toBe('jira');
      expect(suggestions[0].score).toBeGreaterThan(70);
      expect(suggestions[0].reasoning).toContain('MAIN-123');
    });

    it('should handle JIRA API errors gracefully', async () => {
      // Arrange
      mockJiraClient.searchIssues.mockRejectedValue(new Error('JIRA API unavailable'));

      // Act
      const suggestions = await jiraSuggestionSource.getSuggestions('test query', {});

      // Assert
      expect(suggestions).toEqual([]);
    });
  });
});

describe('Business Rule Validator', () => {
  let validator: BusinessRuleTagValidator;

  beforeEach(() => {
    validator = new BusinessRuleTagValidator();
  });

  describe('validate', () => {
    it('should reject tags with invalid naming patterns', async () => {
      // Arrange
      const tag: Tag = {
        id: 'test-id',
        name: 'Invalid Name!',
        // ... other properties
      };

      // Act
      const result = await validator.validate(tag, createMockValidationContext());

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_NAME_PATTERN');
    });

    it('should warn about similar existing tags', async () => {
      // Arrange
      const tag: Tag = {
        id: 'test-id',
        name: 'memory-erro', // Similar to existing 'memory-error'
        // ... other properties
      };
      const context = createMockValidationContext({
        existingTags: [{ name: 'memory-error' } as Tag]
      });

      // Act
      const result = await validator.validate(tag, context);

      // Assert
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('SIMILAR_TAGS_EXIST');
    });
  });
});
```

### Integration Testing

```typescript
describe('Plugin System Integration', () => {
  let pluginManager: PluginManager;
  let mockContext: PluginContext;

  beforeEach(async () => {
    pluginManager = new PluginManager();
    mockContext = createMockPluginContext();
  });

  afterEach(async () => {
    await pluginManager.unloadAll();
  });

  it('should load and initialize plugins correctly', async () => {
    // Arrange
    const plugin = new ServiceNowIntegrationPlugin();

    // Act
    await pluginManager.register(plugin);
    await pluginManager.load(plugin.name, mockContext);

    // Assert
    expect(pluginManager.isLoaded(plugin.name)).toBe(true);
    expect(mockContext.services.tagService.getSuggestionSources()).toContain(
      expect.objectContaining({ name: 'servicenow-integration' })
    );
  });

  it('should handle plugin dependencies correctly', async () => {
    // Arrange
    const dependentPlugin = new CustomPlugin();
    dependentPlugin.dependencies = ['nonexistent-plugin'];

    // Act & Assert
    await expect(
      pluginManager.register(dependentPlugin)
    ).rejects.toThrow('Missing dependency: nonexistent-plugin');
  });

  it('should unload plugins and clean up resources', async () => {
    // Arrange
    const plugin = new ServiceNowIntegrationPlugin();
    await pluginManager.register(plugin);
    await pluginManager.load(plugin.name, mockContext);

    // Act
    await pluginManager.unload(plugin.name);

    // Assert
    expect(pluginManager.isLoaded(plugin.name)).toBe(false);
    expect(mockContext.services.tagService.getSuggestionSources()).not.toContain(
      expect.objectContaining({ name: 'servicenow-integration' })
    );
  });
});
```

## Performance Considerations

### Caching Strategies

```typescript
// Implement caching for expensive operations
export class CachedTagSuggestionService extends TagSuggestionService {
  private cache = new Map<string, { suggestions: TagSuggestion[]; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async getSuggestions(query: string, context: SuggestionContext): Promise<TagSuggestion[]> {
    const cacheKey = this.generateCacheKey(query, context);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.suggestions;
    }

    const suggestions = await super.getSuggestions(query, context);

    this.cache.set(cacheKey, {
      suggestions,
      timestamp: Date.now()
    });

    return suggestions;
  }

  private generateCacheKey(query: string, context: SuggestionContext): string {
    return `${query}:${context.categoryId || 'all'}:${context.entryId || 'none'}`;
  }
}
```

### Database Optimization

```typescript
// Custom database indexes for extension queries
export class ExtensionDatabaseOptimizer {
  static async optimizeForExtensions(db: Database): Promise<void> {
    // Create indexes for custom tag sources
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tags_source_metadata
      ON tags(json_extract(source_metadata, '$.source'));
    `);

    // Create indexes for custom analytics
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tag_associations_relevance_created
      ON tag_associations(relevance_score, created_at);
    `);

    // Create indexes for plugin-specific queries
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_categories_custom_fields
      ON categories(json_extract(custom_data, '$.business_unit'));
    `);
  }
}
```

## Deployment and Configuration

### Extension Configuration

```yaml
# config/extensions.yml
extensions:
  suggestion_sources:
    jira:
      enabled: true
      priority: 80
      config:
        base_url: "${JIRA_BASE_URL}"
        username: "${JIRA_USERNAME}"
        api_token: "${JIRA_API_TOKEN}"
        project_filter: "MAINFRAME"

    semantic_ai:
      enabled: true
      priority: 70
      config:
        model: "text-embedding-ada-002"
        api_key: "${OPENAI_API_KEY}"
        similarity_threshold: 0.7

  validators:
    business_rules:
      enabled: true
      priority: 90
      config:
        max_tags_per_entry: 15
        naming_pattern: "^[a-z0-9-]+$"
        reserved_prefixes: ["sys-", "auto-"]

    compliance:
      enabled: true
      priority: 95
      config:
        required_descriptions_for_categories: ["critical-systems"]
        approval_required_for_categories: ["security", "compliance"]

  analytics:
    business_metrics:
      enabled: true
      config:
        collection_interval: "1h"
        retention_days: 90

    compliance_tracking:
      enabled: true
      config:
        check_interval: "24h"
        violation_threshold: 0.1

plugins:
  servicenow_integration:
    enabled: true
    config:
      instance_url: "${SERVICENOW_INSTANCE_URL}"
      username: "${SERVICENOW_USERNAME}"
      password: "${SERVICENOW_PASSWORD}"
      sync_interval_minutes: 15
      sync_to_servicenow: true
```

### Dynamic Loading

```typescript
// Extension loader that supports hot-reloading
export class ExtensionLoader {
  private loadedExtensions = new Map<string, LoadedExtension>();
  private watchers = new Map<string, fs.FSWatcher>();

  async loadExtension(extensionPath: string): Promise<void> {
    const extensionModule = await import(extensionPath);
    const extension = extensionModule.default || extensionModule;

    if (!this.isValidExtension(extension)) {
      throw new Error(`Invalid extension at ${extensionPath}`);
    }

    await this.unloadExtension(extension.name); // Unload if already loaded

    const loadedExtension: LoadedExtension = {
      name: extension.name,
      module: extension,
      path: extensionPath,
      loadedAt: new Date()
    };

    // Initialize the extension
    if (extension.initialize) {
      await extension.initialize(this.createExtensionContext());
    }

    this.loadedExtensions.set(extension.name, loadedExtension);

    // Set up hot-reloading watcher
    if (process.env.NODE_ENV === 'development') {
      this.setupHotReloading(extensionPath, extension.name);
    }
  }

  private setupHotReloading(extensionPath: string, extensionName: string): void {
    const watcher = fs.watch(path.dirname(extensionPath), { recursive: true });

    watcher.on('change', async (filename) => {
      if (filename.endsWith('.js') || filename.endsWith('.ts')) {
        console.log(`Extension ${extensionName} file changed, reloading...`);

        try {
          // Clear require cache
          delete require.cache[require.resolve(extensionPath)];

          // Reload extension
          await this.loadExtension(extensionPath);

          console.log(`Extension ${extensionName} reloaded successfully`);
        } catch (error) {
          console.error(`Failed to reload extension ${extensionName}:`, error);
        }
      }
    });

    this.watchers.set(extensionName, watcher);
  }
}
```

This comprehensive guide provides developers with everything they need to extend the categorization and tagging system. The extension points are designed to be flexible and powerful while maintaining system stability and performance.