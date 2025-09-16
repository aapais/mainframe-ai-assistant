/**
 * Example Component Type Tests
 * Demonstrates real-world usage of the TypeScript Testing Framework
 */

import React from 'react';
import { TypeChecker } from '../core/TypeChecker';
import { PropValidator, ComponentPropsSchema } from '../core/PropValidator';
import { GenericTypeTestRunner } from '../core/GenericTypeTestRunner';
import { InterfaceValidator, InterfaceDefinition } from '../core/InterfaceValidator';
import '../config/jest.setup';

// Example component interfaces for testing
interface ButtonProps {
  text: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

interface FormFieldProps<T> {
  name: keyof T;
  value: T[keyof T];
  onChange: (name: keyof T, value: T[keyof T]) => void;
  onBlur?: (name: keyof T) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  validation?: (value: T[keyof T]) => string | null;
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: Array<{
    key: keyof T;
    header: string;
    render?: (value: T[keyof T], record: T, index: number) => React.ReactNode;
    sortable?: boolean;
    width?: string | number;
    align?: 'left' | 'center' | 'right';
  }>;
  onRowClick?: (record: T, index: number) => void;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    showSizeChanger?: boolean;
    onChange: (page: number, pageSize: number) => void;
  };
  selection?: {
    selectedKeys: Array<T[keyof T]>;
    onSelect: (keys: Array<T[keyof T]>) => void;
    getRowKey: (record: T) => T[keyof T];
  };
}

describe('Component Type Tests', () => {
  let typeChecker: TypeChecker;
  let propValidator: PropValidator;
  let genericRunner: GenericTypeTestRunner;
  let interfaceValidator: InterfaceValidator;

  beforeEach(() => {
    typeChecker = new TypeChecker({ strictMode: true });
    propValidator = new PropValidator(typeChecker, { strict: true });
    genericRunner = new GenericTypeTestRunner(typeChecker);
    interfaceValidator = new InterfaceValidator(typeChecker);
  });

  describe('Button Component Type Tests', () => {
    const buttonSchema: ComponentPropsSchema = {
      componentName: 'Button',
      props: [
        { name: 'text', type: 'string', required: true },
        { name: 'onClick', type: 'Function', required: true },
        { name: 'variant', type: 'string', required: false, enum: ['primary', 'secondary', 'danger'] },
        { name: 'size', type: 'string', required: false, enum: ['small', 'medium', 'large'] },
        { name: 'disabled', type: 'boolean', required: false },
        { name: 'loading', type: 'boolean', required: false },
        { name: 'icon', type: 'ReactNode', required: false },
        { name: 'fullWidth', type: 'boolean', required: false },
        { name: 'className', type: 'string', required: false },
        { name: 'style', type: 'Object', required: false },
        { name: 'data-testid', type: 'string', required: false }
      ]
    };

    test('should validate valid button props', () => {
      const validButtonProps: ButtonProps = {
        text: 'Click me',
        onClick: (event) => console.log('Button clicked', event.target),
        variant: 'primary',
        size: 'medium',
        disabled: false,
        loading: false,
        fullWidth: true,
        className: 'my-button',
        'data-testid': 'submit-button'
      };

      const results = propValidator.validateComponentProps(validButtonProps, buttonSchema);

      expect(results.every(r => r.passed)).toBe(true);

      // Test individual props
      expect(validButtonProps.text).toBeValidProp({
        name: 'text',
        type: 'string',
        required: true
      });

      expect(validButtonProps.onClick).toBeValidProp({
        name: 'onClick',
        type: 'Function',
        required: true
      });

      expect(validButtonProps.variant).toBeValidProp({
        name: 'variant',
        type: 'string',
        required: false,
        enum: ['primary', 'secondary', 'danger']
      });
    });

    test('should detect invalid button props', () => {
      const invalidButtonProps = {
        text: 123, // Should be string
        onClick: 'not-a-function', // Should be function
        variant: 'invalid', // Not in enum
        size: null, // Invalid size
        disabled: 'false' // Should be boolean
      };

      const results = propValidator.validateComponentProps(invalidButtonProps, buttonSchema);
      const failedResults = results.filter(r => !r.passed);

      expect(failedResults.length).toBeGreaterThan(0);

      // Check specific validation errors
      const textResult = results.find(r => r.propName === 'text');
      expect(textResult?.passed).toBe(false);

      const onClickResult = results.find(r => r.propName === 'onClick');
      expect(onClickResult?.passed).toBe(false);
    });

    test('should validate required props', () => {
      const incompleteButtonProps = {
        text: 'Click me'
        // Missing required onClick prop
      };

      expect(incompleteButtonProps).not.toHaveRequiredProps(['text', 'onClick']);

      const results = propValidator.validateComponentProps(incompleteButtonProps, buttonSchema);
      const onClickResult = results.find(r => r.propName === 'onClick');

      expect(onClickResult?.passed).toBe(false);
      expect(onClickResult?.errors).toContain('Required prop "onClick" is missing');
    });

    test('should validate event handler signatures', () => {
      const correctHandler = (event: React.MouseEvent<HTMLButtonElement>) => {
        console.log('Button clicked', event.currentTarget);
      };

      const incorrectHandler = (wrongParam: string) => {
        console.log('Wrong handler', wrongParam);
      };

      const correctResult = propValidator.validateEventHandler(
        'onClick',
        correctHandler,
        '(event: React.MouseEvent<HTMLButtonElement>) => void'
      );

      const incorrectResult = propValidator.validateEventHandler(
        'onClick',
        incorrectHandler,
        '(event: React.MouseEvent<HTMLButtonElement>) => void'
      );

      expect(correctResult.passed).toBe(true);
      expect(incorrectResult.passed).toBe(false);
    });
  });

  describe('Generic Form Field Component Type Tests', () => {
    interface UserForm {
      username: string;
      email: string;
      age: number;
      isActive: boolean;
      preferences: {
        theme: 'light' | 'dark';
        notifications: boolean;
      };
    }

    test('should validate generic form field with string value', () => {
      const usernameField: FormFieldProps<UserForm> = {
        name: 'username',
        value: 'john_doe',
        onChange: (name, value) => console.log(`${String(name)} changed to:`, value),
        label: 'Username',
        required: true,
        validation: (value) => {
          if (typeof value === 'string' && value.length < 3) {
            return 'Username must be at least 3 characters';
          }
          return null;
        }
      };

      expect(usernameField).toSatisfyConstraints({
        T: 'UserForm'
      });

      // Test that the name is a valid key of UserForm
      const validKeys: Array<keyof UserForm> = ['username', 'email', 'age', 'isActive', 'preferences'];
      expect(validKeys).toContain(usernameField.name);

      // Test that value type matches the field type
      expect(typeof usernameField.value).toBe('string');
    });

    test('should validate generic form field with number value', () => {
      const ageField: FormFieldProps<UserForm> = {
        name: 'age',
        value: 25,
        onChange: (name, value) => console.log(`${String(name)} changed to:`, value),
        label: 'Age',
        validation: (value) => {
          if (typeof value === 'number' && (value < 0 || value > 120)) {
            return 'Age must be between 0 and 120';
          }
          return null;
        }
      };

      expect(ageField).toSatisfyConstraints({
        T: 'UserForm'
      });

      expect(typeof ageField.value).toBe('number');
    });

    test('should validate generic form field with nested object value', () => {
      const preferencesField: FormFieldProps<UserForm> = {
        name: 'preferences',
        value: { theme: 'dark', notifications: true },
        onChange: (name, value) => console.log(`${String(name)} changed to:`, value)
      };

      expect(preferencesField).toSatisfyConstraints({
        T: 'UserForm'
      });

      expect(typeof preferencesField.value).toBe('object');
      expect(preferencesField.value).toHaveProperty('theme');
      expect(preferencesField.value).toHaveProperty('notifications');
    });

    test('should validate generic constraints', () => {
      // Test that T must extend Record<string, any>
      const testCase = {
        name: 'FormField constraint validation',
        description: 'T must extend Record<string, any>',
        typeParameters: { T: 'UserForm' },
        constraints: { T: 'Record<string, any>' },
        expectedResult: true
      };

      const constraintResult = genericRunner.testGenericConstraints(
        { T: 'UserForm' },
        { T: 'Record<string, any>' }
      );

      expect(constraintResult.passed).toBe(true);
    });
  });

  describe('Data Table Component Type Tests', () => {
    interface User {
      id: number;
      name: string;
      email: string;
      status: 'active' | 'inactive';
      lastLogin: Date;
      roles: string[];
    }

    test('should validate data table props with user data', () => {
      const users: User[] = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
          lastLogin: new Date('2023-12-01'),
          roles: ['user', 'admin']
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane@example.com',
          status: 'inactive',
          lastLogin: new Date('2023-11-15'),
          roles: ['user']
        }
      ];

      const columns: DataTableProps<User>['columns'] = [
        { key: 'id', header: 'ID', sortable: true, width: 80 },
        { key: 'name', header: 'Name', sortable: true },
        { key: 'email', header: 'Email' },
        {
          key: 'status',
          header: 'Status',
          render: (status) => React.createElement('span', {
            className: status === 'active' ? 'text-green' : 'text-red'
          }, status)
        },
        {
          key: 'lastLogin',
          header: 'Last Login',
          render: (date) => date instanceof Date ? date.toLocaleDateString() : 'Never'
        }
      ];

      const tableProps: DataTableProps<User> = {
        data: users,
        columns,
        onRowClick: (user, index) => console.log('Clicked user:', user.name, 'at index:', index),
        onSort: (key, direction) => console.log('Sort by:', key, direction),
        loading: false,
        pagination: {
          current: 1,
          pageSize: 10,
          total: users.length,
          onChange: (page, pageSize) => console.log('Pagination:', { page, pageSize })
        },
        selection: {
          selectedKeys: [1],
          onSelect: (keys) => console.log('Selected:', keys),
          getRowKey: (record) => record.id
        }
      };

      // Validate the component props structure
      expect(tableProps).toHaveCorrectTypeSignature();
      expect(tableProps.data).toBeValidType();
      expect(tableProps.columns).toBeValidType();

      // Validate generic constraint
      expect(tableProps).toSatisfyConstraints({
        T: 'Record<string, any>'
      });

      // Test column configuration
      columns.forEach(column => {
        expect(users[0]).toHaveProperty(column.key as string);
      });
    });

    test('should validate column render function types', () => {
      const statusColumn: DataTableProps<User>['columns'][0] = {
        key: 'status',
        header: 'Status',
        render: (status, record, index) => {
          // Validate render function parameters
          expect(typeof status).toBe('string');
          expect(typeof record).toBe('object');
          expect(typeof index).toBe('number');
          expect(record).toHaveProperty('id');
          expect(record).toHaveProperty('name');
          expect(record).toHaveProperty('email');

          return React.createElement('span', null, status);
        }
      };

      expect(statusColumn.render).toHaveCorrectTypeSignature();
    });

    test('should validate pagination configuration', () => {
      const pagination: DataTableProps<User>['pagination'] = {
        current: 1,
        pageSize: 10,
        total: 100,
        showSizeChanger: true,
        onChange: (page, pageSize) => {
          expect(typeof page).toBe('number');
          expect(typeof pageSize).toBe('number');
          expect(page).toBeGreaterThan(0);
          expect(pageSize).toBeGreaterThan(0);
        }
      };

      expect(pagination).toHaveCorrectTypeSignature();
      expect(pagination.onChange).toHaveCorrectTypeSignature();
    });

    test('should validate selection configuration', () => {
      const selection: DataTableProps<User>['selection'] = {
        selectedKeys: [1, 2],
        onSelect: (keys) => {
          expect(Array.isArray(keys)).toBe(true);
          keys.forEach(key => {
            expect(typeof key).toBe('number');
          });
        },
        getRowKey: (record) => {
          expect(record).toHaveProperty('id');
          return record.id;
        }
      };

      expect(selection).toHaveCorrectTypeSignature();
      expect(selection.getRowKey).toHaveCorrectTypeSignature();
    });
  });

  describe('Interface Validation Tests', () => {
    test('should validate component interface implementation', () => {
      const clickableInterface: InterfaceDefinition = {
        name: 'IClickable',
        properties: [
          { name: 'onClick', type: 'Function', required: true }
        ]
      };

      const styleableInterface: InterfaceDefinition = {
        name: 'IStyleable',
        properties: [
          { name: 'className', type: 'string', required: false },
          { name: 'style', type: 'Object', required: false }
        ]
      };

      const buttonInterface: InterfaceDefinition = {
        name: 'IButton',
        properties: [
          { name: 'text', type: 'string', required: true },
          { name: 'disabled', type: 'boolean', required: false }
        ],
        extends: ['IClickable', 'IStyleable']
      };

      interfaceValidator.registerInterface(clickableInterface);
      interfaceValidator.registerInterface(styleableInterface);
      interfaceValidator.registerInterface(buttonInterface);

      const buttonComponent = {
        text: 'Click me',
        onClick: () => console.log('clicked'),
        disabled: false,
        className: 'btn btn-primary',
        style: { backgroundColor: 'blue' }
      };

      expect(buttonComponent).toImplementInterface('IButton');

      // Test interface inheritance
      const inheritanceResult = interfaceValidator.validateInheritance('IButton', 'IClickable');
      expect(inheritanceResult.passed).toBe(true);
    });

    test('should validate structural typing', () => {
      const point = { x: 10, y: 20 };
      const pointWithExtra = { x: 15, y: 25, z: 5, label: 'Point A' };

      const pointShape = {
        properties: [
          { name: 'x', type: 'number', required: true },
          { name: 'y', type: 'number', required: true }
        ]
      };

      const pointResult = interfaceValidator.validateStructural(point, pointShape);
      const pointWithExtraResult = interfaceValidator.validateStructural(pointWithExtra, pointShape);

      expect(pointResult.passed).toBe(true);
      expect(pointWithExtraResult.passed).toBe(true); // Structural typing allows extra properties
    });
  });

  describe('Union and Intersection Type Tests', () => {
    test('should validate discriminated unions', () => {
      type LoadingState =
        | { status: 'idle' }
        | { status: 'loading' }
        | { status: 'success'; data: any }
        | { status: 'error'; error: string };

      const idleState: LoadingState = { status: 'idle' };
      const loadingState: LoadingState = { status: 'loading' };
      const successState: LoadingState = { status: 'success', data: { users: [] } };
      const errorState: LoadingState = { status: 'error', error: 'Failed to fetch' };

      const unionTypes = [
        { status: 'idle' },
        { status: 'loading' },
        { status: 'success', data: {} },
        { status: 'error', error: '' }
      ];

      [idleState, loadingState, successState, errorState].forEach(state => {
        const result = typeChecker.validateUnion(state, unionTypes);
        expect(result.passed).toBe(true);
      });
    });

    test('should validate intersection types', () => {
      interface Clickable {
        onClick: () => void;
      }

      interface Focusable {
        onFocus: () => void;
        onBlur: () => void;
      }

      interface Accessible {
        'aria-label'?: string;
        'aria-describedby'?: string;
      }

      type InteractiveElement = Clickable & Focusable & Accessible;

      const interactiveButton: InteractiveElement = {
        onClick: () => console.log('clicked'),
        onFocus: () => console.log('focused'),
        onBlur: () => console.log('blurred'),
        'aria-label': 'Interactive button',
        'aria-describedby': 'button-description'
      };

      const intersectionTypes = [
        { onClick: () => {} },
        { onFocus: () => {}, onBlur: () => {} },
        { 'aria-label': '', 'aria-describedby': '' }
      ];

      const result = typeChecker.validateIntersection(interactiveButton, intersectionTypes);
      expect(result.passed).toBe(true);
    });
  });

  describe('Advanced Type Tests', () => {
    test('should validate mapped types', () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      type PartialUser = Partial<User>;
      type RequiredUser = Required<User>;
      type UserKeys = keyof User;
      type UserValues = User[keyof User];

      const partialUser: PartialUser = { name: 'John' };
      const requiredUser: RequiredUser = { id: 1, name: 'John', email: 'john@example.com' };

      expect(partialUser).toBePartialOf({} as User);
      expect(requiredUser).toHaveRequiredProps(['id', 'name', 'email']);

      // Test Pick utility type
      type UserProfile = Pick<User, 'name' | 'email'>;
      const userProfile: UserProfile = { name: 'John', email: 'john@example.com' };
      expect(userProfile).toBePickOf({} as User, ['name', 'email']);

      // Test Omit utility type
      type UserWithoutId = Omit<User, 'id'>;
      const userWithoutId: UserWithoutId = { name: 'John', email: 'john@example.com' };
      expect(userWithoutId).toBeOmitOf({} as User, ['id']);
    });

    test('should validate conditional types', () => {
      type ApiResponse<T> = T extends string
        ? { message: T }
        : T extends number
          ? { count: T }
          : { data: T };

      type StringResponse = ApiResponse<string>;
      type NumberResponse = ApiResponse<number>;
      type ObjectResponse = ApiResponse<{ id: number }>;

      const stringResponse: StringResponse = { message: 'Success' };
      const numberResponse: NumberResponse = { count: 42 };
      const objectResponse: ObjectResponse = { data: { id: 1 } };

      expect(stringResponse).toHaveCorrectTypeSignature();
      expect(numberResponse).toHaveCorrectTypeSignature();
      expect(objectResponse).toHaveCorrectTypeSignature();
    });

    test('should validate template literal types', () => {
      type EventName<T extends string> = `on${Capitalize<T>}`;
      type CSSVariable = `--${string}`;

      const clickEvent: EventName<'click'> = 'onClick';
      const hoverEvent: EventName<'hover'> = 'onHover';
      const primaryColor: CSSVariable = '--primary-color';

      const eventPattern = 'on${string}';
      const cssPattern = '--${string}';

      expect(typeChecker.validateTemplateLiteral(clickEvent, eventPattern).passed).toBe(true);
      expect(typeChecker.validateTemplateLiteral(hoverEvent, eventPattern).passed).toBe(true);
      expect(typeChecker.validateTemplateLiteral(primaryColor, cssPattern).passed).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle null and undefined values', () => {
      const nullValue = null;
      const undefinedValue = undefined;

      expect(nullValue).toBeValidType();
      expect(undefinedValue).toBeValidType();

      // Test in component props
      const propsWithNulls = {
        text: 'Click me',
        onClick: () => {},
        disabled: null, // Should be boolean or undefined
        className: undefined // Should be valid for optional prop
      };

      const result = propValidator.validateProp('disabled', null, {
        name: 'disabled',
        type: 'boolean',
        required: false
      });

      expect(result.passed).toBe(false); // null is not boolean
    });

    test('should handle circular references', () => {
      interface Node {
        value: string;
        parent?: Node;
        children: Node[];
      }

      const root: Node = {
        value: 'root',
        children: []
      };

      const child: Node = {
        value: 'child',
        parent: root,
        children: []
      };

      root.children.push(child);

      // Should handle circular structure without infinite recursion
      expect(root).toBeValidType();
      expect(child).toBeValidType();
    });

    test('should handle complex nested generics', () => {
      interface Container<T> {
        items: T[];
        metadata: {
          count: number;
          lastUpdated: Date;
        };
      }

      interface ApiResult<T> {
        data: Container<T>;
        status: 'success' | 'error';
        message?: string;
      }

      const userResult: ApiResult<User> = {
        data: {
          items: [
            { id: 1, name: 'John', email: 'john@example.com', status: 'active', lastLogin: new Date(), roles: [] }
          ],
          metadata: {
            count: 1,
            lastUpdated: new Date()
          }
        },
        status: 'success'
      };

      expect(userResult).toSatisfyConstraints({
        T: 'User'
      });
    });
  });
});