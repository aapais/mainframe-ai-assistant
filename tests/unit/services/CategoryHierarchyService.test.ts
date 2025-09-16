import { CategoryHierarchyService, CategoryNode, CategoryMoveOperation } from '../../../src/services/CategoryHierarchyService';

// Mock the KnowledgeBaseService
jest.mock('../../../src/services/KnowledgeBaseService');

describe('CategoryHierarchyService', () => {
  let service: CategoryHierarchyService;
  let mockKnowledgeBaseService: any;

  beforeEach(() => {
    mockKnowledgeBaseService = {
      findEntriesByCategory: jest.fn(),
      updateEntry: jest.fn(),
    };
    service = new CategoryHierarchyService(mockKnowledgeBaseService);
  });

  afterEach(() => {
    service.removeAllListeners();
    jest.clearAllMocks();
  });

  describe('createCategory', () => {
    it('should create a root category successfully', async () => {
      const categoryData = {
        name: 'Mainframe Systems',
        description: 'All mainframe-related categories',
        color: '#1f77b4',
        parent_id: null,
      };

      const result = await service.createCategory(categoryData);

      expect(result).toMatchObject({
        id: expect.any(String),
        name: 'Mainframe Systems',
        description: 'All mainframe-related categories',
        color: '#1f77b4',
        parent_id: null,
        level: 0,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      });
    });

    it('should create a child category with correct level', async () => {
      // First create parent
      const parentCategory = await service.createCategory({
        name: 'Parent',
        description: 'Parent category',
        color: '#000000',
        parent_id: null,
      });

      // Then create child
      const childData = {
        name: 'Child',
        description: 'Child category',
        color: '#ffffff',
        parent_id: parentCategory.id,
      };

      const childCategory = await service.createCategory(childData);

      expect(childCategory.level).toBe(1);
      expect(childCategory.parent_id).toBe(parentCategory.id);
    });

    it('should prevent circular references', async () => {
      const parentCategory = await service.createCategory({
        name: 'Parent',
        description: 'Parent category',
        color: '#000000',
        parent_id: null,
      });

      // Try to make parent a child of itself
      await expect(service.createCategory({
        name: 'Invalid',
        description: 'Invalid category',
        color: '#ffffff',
        parent_id: parentCategory.id,
      })).rejects.toThrow('Cannot create circular reference');
    });

    it('should enforce maximum depth limit', async () => {
      let currentParent = null;

      // Create categories up to max depth
      for (let i = 0; i < 10; i++) {
        const category = await service.createCategory({
          name: `Level ${i}`,
          description: `Category at level ${i}`,
          color: '#000000',
          parent_id: currentParent,
        });
        currentParent = category.id;
      }

      // Try to create one more level (should fail)
      await expect(service.createCategory({
        name: 'Too Deep',
        description: 'This should fail',
        color: '#ffffff',
        parent_id: currentParent,
      })).rejects.toThrow('Maximum category depth exceeded');
    });
  });

  describe('moveCategory', () => {
    it('should move category to new parent successfully', async () => {
      const parent1 = await service.createCategory({
        name: 'Parent 1',
        description: 'First parent',
        color: '#000000',
        parent_id: null,
      });

      const parent2 = await service.createCategory({
        name: 'Parent 2',
        description: 'Second parent',
        color: '#111111',
        parent_id: null,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#ffffff',
        parent_id: parent1.id,
      });

      const moveOperation: CategoryMoveOperation = {
        category_id: child.id,
        new_parent_id: parent2.id,
        validate_dependencies: true,
      };

      await service.moveCategory(moveOperation);

      const movedCategory = service.getCategory(child.id);
      expect(movedCategory?.parent_id).toBe(parent2.id);
    });

    it('should prevent moving to descendant (circular reference)', async () => {
      const grandparent = await service.createCategory({
        name: 'Grandparent',
        description: 'Grandparent category',
        color: '#000000',
        parent_id: null,
      });

      const parent = await service.createCategory({
        name: 'Parent',
        description: 'Parent category',
        color: '#111111',
        parent_id: grandparent.id,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#ffffff',
        parent_id: parent.id,
      });

      // Try to move grandparent under child (circular reference)
      const moveOperation: CategoryMoveOperation = {
        category_id: grandparent.id,
        new_parent_id: child.id,
        validate_dependencies: true,
      };

      await expect(service.moveCategory(moveOperation)).rejects.toThrow('Cannot move category to its descendant');
    });
  });

  describe('getCategoryTree', () => {
    it('should return complete tree structure', async () => {
      // Create test hierarchy
      const root = await service.createCategory({
        name: 'Root',
        description: 'Root category',
        color: '#000000',
        parent_id: null,
      });

      const child1 = await service.createCategory({
        name: 'Child 1',
        description: 'First child',
        color: '#111111',
        parent_id: root.id,
      });

      const child2 = await service.createCategory({
        name: 'Child 2',
        description: 'Second child',
        color: '#222222',
        parent_id: root.id,
      });

      const grandchild = await service.createCategory({
        name: 'Grandchild',
        description: 'Grandchild category',
        color: '#ffffff',
        parent_id: child1.id,
      });

      const tree = service.getCategoryTree();

      expect(tree).toHaveLength(1);
      expect(tree[0].category.name).toBe('Root');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].category.name).toBe('Grandchild');
    });

    it('should return subtree when root ID is specified', async () => {
      const root = await service.createCategory({
        name: 'Root',
        description: 'Root category',
        color: '#000000',
        parent_id: null,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#111111',
        parent_id: root.id,
      });

      const tree = service.getCategoryTree(child.id);

      expect(tree).toHaveLength(1);
      expect(tree[0].category.name).toBe('Child');
      expect(tree[0].children).toHaveLength(0);
    });
  });

  describe('getCategoryPath', () => {
    it('should return correct path for nested category', async () => {
      const root = await service.createCategory({
        name: 'Root',
        description: 'Root category',
        color: '#000000',
        parent_id: null,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#111111',
        parent_id: root.id,
      });

      const grandchild = await service.createCategory({
        name: 'Grandchild',
        description: 'Grandchild category',
        color: '#ffffff',
        parent_id: child.id,
      });

      const path = service.getCategoryPath(grandchild.id);

      expect(path).toEqual(['Root', 'Child', 'Grandchild']);
    });

    it('should return single item path for root category', async () => {
      const root = await service.createCategory({
        name: 'Root',
        description: 'Root category',
        color: '#000000',
        parent_id: null,
      });

      const path = service.getCategoryPath(root.id);

      expect(path).toEqual(['Root']);
    });
  });

  describe('searchCategories', () => {
    beforeEach(async () => {
      // Create test categories
      await service.createCategory({
        name: 'VSAM Management',
        description: 'Virtual Storage Access Method utilities and troubleshooting',
        color: '#1f77b4',
        parent_id: null,
      });

      await service.createCategory({
        name: 'JCL Processing',
        description: 'Job Control Language syntax and execution',
        color: '#ff7f0e',
        parent_id: null,
      });

      await service.createCategory({
        name: 'Database Operations',
        description: 'DB2 and other database management tasks',
        color: '#2ca02c',
        parent_id: null,
      });
    });

    it('should find categories by name', async () => {
      const results = await service.searchCategories({
        query: 'VSAM',
        searchFields: ['name'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].category.name).toBe('VSAM Management');
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should find categories by description', async () => {
      const results = await service.searchCategories({
        query: 'database',
        searchFields: ['description'],
      });

      expect(results).toHaveLength(1);
      expect(results[0].category.name).toBe('Database Operations');
    });

    it('should return results sorted by score', async () => {
      const results = await service.searchCategories({
        query: 'management',
        searchFields: ['name', 'description'],
      });

      expect(results.length).toBeGreaterThan(1);
      // Verify sorting by score (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should respect limit parameter', async () => {
      const results = await service.searchCategories({
        query: 'a', // Should match multiple categories
        searchFields: ['name', 'description'],
        limit: 1,
      });

      expect(results).toHaveLength(1);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category and move children to parent', async () => {
      const grandparent = await service.createCategory({
        name: 'Grandparent',
        description: 'Grandparent category',
        color: '#000000',
        parent_id: null,
      });

      const parent = await service.createCategory({
        name: 'Parent',
        description: 'Parent category',
        color: '#111111',
        parent_id: grandparent.id,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#ffffff',
        parent_id: parent.id,
      });

      await service.deleteCategory(parent.id, { moveChildrenToParent: true });

      // Child should now be under grandparent
      const updatedChild = service.getCategory(child.id);
      expect(updatedChild?.parent_id).toBe(grandparent.id);

      // Parent should be deleted
      const deletedParent = service.getCategory(parent.id);
      expect(deletedParent).toBeNull();
    });

    it('should delete category and all children recursively', async () => {
      const parent = await service.createCategory({
        name: 'Parent',
        description: 'Parent category',
        color: '#000000',
        parent_id: null,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#111111',
        parent_id: parent.id,
      });

      const grandchild = await service.createCategory({
        name: 'Grandchild',
        description: 'Grandchild category',
        color: '#ffffff',
        parent_id: child.id,
      });

      await service.deleteCategory(parent.id, { moveChildrenToParent: false });

      // All should be deleted
      expect(service.getCategory(parent.id)).toBeNull();
      expect(service.getCategory(child.id)).toBeNull();
      expect(service.getCategory(grandchild.id)).toBeNull();
    });

    it('should prevent deletion of categories with KB entries when not forced', async () => {
      const category = await service.createCategory({
        name: 'Category with entries',
        description: 'This category has KB entries',
        color: '#000000',
        parent_id: null,
      });

      // Mock KB service to return entries for this category
      mockKnowledgeBaseService.findEntriesByCategory.mockResolvedValue([
        { id: '1', title: 'Entry 1' },
        { id: '2', title: 'Entry 2' }
      ]);

      await expect(service.deleteCategory(category.id, { forceDelete: false }))
        .rejects.toThrow('Cannot delete category with existing entries');
    });
  });

  describe('event emission', () => {
    it('should emit category_created event when category is created', async () => {
      const eventListener = jest.fn();
      service.on('category_created', eventListener);

      const category = await service.createCategory({
        name: 'Test Category',
        description: 'Test description',
        color: '#000000',
        parent_id: null,
      });

      expect(eventListener).toHaveBeenCalledWith({
        type: 'category_created',
        category: expect.objectContaining({
          name: 'Test Category',
        }),
        timestamp: expect.any(Date),
      });
    });

    it('should emit category_moved event when category is moved', async () => {
      const eventListener = jest.fn();
      service.on('category_moved', eventListener);

      const parent1 = await service.createCategory({
        name: 'Parent 1',
        description: 'First parent',
        color: '#000000',
        parent_id: null,
      });

      const parent2 = await service.createCategory({
        name: 'Parent 2',
        description: 'Second parent',
        color: '#111111',
        parent_id: null,
      });

      const child = await service.createCategory({
        name: 'Child',
        description: 'Child category',
        color: '#ffffff',
        parent_id: parent1.id,
      });

      const moveOperation: CategoryMoveOperation = {
        category_id: child.id,
        new_parent_id: parent2.id,
        validate_dependencies: true,
      };

      await service.moveCategory(moveOperation);

      expect(eventListener).toHaveBeenCalledWith({
        type: 'category_moved',
        operation: moveOperation,
        timestamp: expect.any(Date),
      });
    });
  });

  describe('validation', () => {
    it('should validate category name format', async () => {
      await expect(service.createCategory({
        name: '', // Empty name
        description: 'Test description',
        color: '#000000',
        parent_id: null,
      })).rejects.toThrow('Category name cannot be empty');

      await expect(service.createCategory({
        name: 'a'.repeat(101), // Too long
        description: 'Test description',
        color: '#000000',
        parent_id: null,
      })).rejects.toThrow('Category name cannot exceed 100 characters');
    });

    it('should validate color format', async () => {
      await expect(service.createCategory({
        name: 'Test Category',
        description: 'Test description',
        color: 'invalid-color',
        parent_id: null,
      })).rejects.toThrow('Invalid color format');
    });

    it('should prevent duplicate category names at same level', async () => {
      const parent = await service.createCategory({
        name: 'Parent',
        description: 'Parent category',
        color: '#000000',
        parent_id: null,
      });

      await service.createCategory({
        name: 'Child',
        description: 'First child',
        color: '#111111',
        parent_id: parent.id,
      });

      await expect(service.createCategory({
        name: 'Child', // Same name at same level
        description: 'Second child',
        color: '#222222',
        parent_id: parent.id,
      })).rejects.toThrow('Category name already exists at this level');
    });
  });
});