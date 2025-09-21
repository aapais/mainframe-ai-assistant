/**
 * UI Components Validation Test
 * Comprehensive validation test for all UI components required by SettingsModal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// UI Component imports - testing all exports
import {
  // Modal components
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  ModalClose,
  Overlay,
  ConfirmModal,
  AlertModal,
  // Input components
  Input,
  SearchInput,
  Textarea,
  // Button components
  Button,
  IconButton,
  ButtonGroup,
  FAB,
  ToggleButton,
  CopyButton,
  // Navigation components
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  // Layout components
  Container,
  Grid,
  GridItem,
  Flex,
  Stack,
  HStack,
  Center,
  Spacer,
  Box,
  Divider,
  // Typography components
  Typography,
  H1,
  H2,
  H3,
  H4,
  H5,
  H6,
  Text,
  Small,
  Lead,
  Muted,
  Code,
  Kbd,
  Label,
  Caption,
  Link,
  Blockquote,
  // Other components
  Badge,
  LoadingSpinner,
  Card,
  CardHeader,
  CardContent,
  CardFooter
} from '../src/renderer/components/ui';

// SettingsNavigation component
import { SettingsNavigation } from '../src/renderer/components/settings/SettingsNavigation';

// KeyboardContext
import { KeyboardProvider, useKeyboard } from '../src/renderer/contexts/KeyboardContext';

// Lucide React icons used in components
import {
  Settings,
  User,
  Search,
  X,
  Eye,
  EyeOff,
  ChevronRight,
  ChevronDown,
  Menu,
  Plus,
  Check,
  AlertCircle
} from 'lucide-react';

// Types
import type {
  ModalProps,
  InputProps,
  ButtonProps,
  SettingsNavigationProps
} from '../src/renderer/components/ui';

describe('UI Components Validation', () => {
  beforeEach(() => {
    // Clear any existing DOM elements
    document.body.innerHTML = '';
  });

  describe('Modal Components', () => {
    it('should export and render Modal with all sub-components', () => {
      const { container } = render(
        <Modal open={true} onOpenChange={() => {}}>
          <ModalContent open={true}>
            <ModalHeader>
              <ModalTitle>Test Modal</ModalTitle>
              <ModalDescription>Test Description</ModalDescription>
            </ModalHeader>
            <ModalBody>
              <p>Modal body content</p>
            </ModalBody>
            <ModalFooter>
              <Button>Cancel</Button>
              <Button variant="default">Save</Button>
            </ModalFooter>
            <ModalClose />
          </ModalContent>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
      expect(screen.getByText('Modal body content')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('should render ConfirmModal correctly', () => {
      const mockOnConfirm = jest.fn();
      render(
        <ConfirmModal
          open={true}
          onOpenChange={() => {}}
          title="Confirm Action"
          description="Are you sure you want to continue?"
          onConfirm={mockOnConfirm}
        />
      );

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to continue?')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should render AlertModal correctly', () => {
      render(
        <AlertModal
          open={true}
          onOpenChange={() => {}}
          title="Alert"
          description="This is an alert message"
          variant="warning"
        />
      );

      expect(screen.getByText('Alert')).toBeInTheDocument();
      expect(screen.getByText('This is an alert message')).toBeInTheDocument();
      expect(screen.getByText('OK')).toBeInTheDocument();
    });
  });

  describe('Input Components', () => {
    it('should export and render Input component with all variants', () => {
      const { container } = render(
        <div>
          <Input placeholder="Default input" />
          <Input variant="outline" placeholder="Outline input" />
          <Input variant="ghost" placeholder="Ghost input" />
          <Input variant="search" placeholder="Search input" />
          <Input size="sm" placeholder="Small input" />
          <Input size="lg" placeholder="Large input" />
          <Input type="password" placeholder="Password input" />
          <Input clearable placeholder="Clearable input" />
          <Input error="Error message" placeholder="Error input" />
          <Input success="Success message" placeholder="Success input" />
          <Input warning="Warning message" placeholder="Warning input" />
        </div>
      );

      expect(screen.getByPlaceholderText('Default input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Outline input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Ghost input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Small input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Large input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Clearable input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Error input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Success input')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Warning input')).toBeInTheDocument();
    });

    it('should render SearchInput with search functionality', () => {
      const mockOnSearch = jest.fn();
      render(
        <SearchInput
          placeholder="Search here..."
          onSearch={mockOnSearch}
          searchDelay={100}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search here...');
      expect(searchInput).toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'test search' } });
      expect(searchInput).toHaveValue('test search');
    });

    it('should render Textarea component', () => {
      render(
        <Textarea
          placeholder="Enter text here..."
          label="Text Area"
          helper="Helper text"
        />
      );

      expect(screen.getByPlaceholderText('Enter text here...')).toBeInTheDocument();
      expect(screen.getByText('Text Area')).toBeInTheDocument();
      expect(screen.getByText('Helper text')).toBeInTheDocument();
    });
  });

  describe('Button Components', () => {
    it('should export and render Button with all variants', () => {
      render(
        <div>
          <Button>Default Button</Button>
          <Button variant="destructive">Destructive Button</Button>
          <Button variant="outline">Outline Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Button variant="ghost">Ghost Button</Button>
          <Button variant="link">Link Button</Button>
          <Button variant="success">Success Button</Button>
          <Button variant="warning">Warning Button</Button>
          <Button size="sm">Small Button</Button>
          <Button size="lg">Large Button</Button>
          <Button loading>Loading Button</Button>
          <Button disabled>Disabled Button</Button>
          <Button leftIcon={<Plus className="w-4 h-4" />}>With Left Icon</Button>
          <Button rightIcon={<ChevronRight className="w-4 h-4" />}>With Right Icon</Button>
        </div>
      );

      expect(screen.getByText('Default Button')).toBeInTheDocument();
      expect(screen.getByText('Destructive Button')).toBeInTheDocument();
      expect(screen.getByText('Outline Button')).toBeInTheDocument();
      expect(screen.getByText('Secondary Button')).toBeInTheDocument();
      expect(screen.getByText('Ghost Button')).toBeInTheDocument();
      expect(screen.getByText('Link Button')).toBeInTheDocument();
      expect(screen.getByText('Success Button')).toBeInTheDocument();
      expect(screen.getByText('Warning Button')).toBeInTheDocument();
      expect(screen.getByText('Small Button')).toBeInTheDocument();
      expect(screen.getByText('Large Button')).toBeInTheDocument();
      expect(screen.getByText('Loading Button')).toBeInTheDocument();
      expect(screen.getByText('Disabled Button')).toBeInTheDocument();
      expect(screen.getByText('With Left Icon')).toBeInTheDocument();
      expect(screen.getByText('With Right Icon')).toBeInTheDocument();
    });

    it('should render IconButton correctly', () => {
      render(
        <IconButton
          icon={<Settings className="w-4 h-4" />}
          aria-label="Settings"
        />
      );

      const iconButton = screen.getByLabelText('Settings');
      expect(iconButton).toBeInTheDocument();
    });

    it('should render ButtonGroup correctly', () => {
      render(
        <ButtonGroup>
          <Button>First</Button>
          <Button>Second</Button>
          <Button>Third</Button>
        </ButtonGroup>
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('should render ToggleButton correctly', () => {
      const mockOnPressedChange = jest.fn();
      render(
        <ToggleButton
          pressed={false}
          onPressedChange={mockOnPressedChange}
          aria-label="Toggle"
        >
          Toggle Me
        </ToggleButton>
      );

      const toggleButton = screen.getByText('Toggle Me');
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    });

    it('should render CopyButton correctly', () => {
      const mockOnCopy = jest.fn();

      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });

      render(
        <CopyButton
          textToCopy="Hello World"
          onCopy={mockOnCopy}
        >
          Copy Text
        </CopyButton>
      );

      const copyButton = screen.getByText('Copy Text');
      expect(copyButton).toBeInTheDocument();
    });
  });

  describe('SettingsNavigation Component', () => {
    const mockSections = [
      {
        id: 'general',
        title: 'General',
        description: 'General settings',
        icon: <Settings className="w-5 h-5" />,
        path: '/settings/general',
        category: {
          id: 'main',
          title: 'Main',
          description: 'Main category',
          icon: <Settings className="w-5 h-5" />,
          color: '#000000',
          order: 1
        },
        keywords: ['general', 'settings']
      }
    ];

    const mockCategories = [
      {
        id: 'main',
        title: 'Main',
        description: 'Main category',
        icon: <Settings className="w-5 h-5" />,
        color: '#000000',
        order: 1
      }
    ];

    it('should render SettingsNavigation correctly', () => {
      const mockOnNavigate = jest.fn();

      render(
        <SettingsNavigation
          sections={mockSections}
          categories={mockCategories}
          onNavigate={mockOnNavigate}
        />
      );

      expect(screen.getByPlaceholderText('Search settings...')).toBeInTheDocument();
    });
  });

  describe('KeyboardContext Integration', () => {
    it('should provide KeyboardContext correctly', () => {
      const TestComponent = () => {
        const keyboard = useKeyboard();
        return <div>Keyboard context loaded: {keyboard ? 'Yes' : 'No'}</div>;
      };

      render(
        <KeyboardProvider>
          <TestComponent />
        </KeyboardProvider>
      );

      expect(screen.getByText('Keyboard context loaded: Yes')).toBeInTheDocument();
    });
  });

  describe('Lucide React Icons', () => {
    it('should render all commonly used icons', () => {
      render(
        <div>
          <Settings data-testid="settings-icon" />
          <User data-testid="user-icon" />
          <Search data-testid="search-icon" />
          <X data-testid="x-icon" />
          <Eye data-testid="eye-icon" />
          <EyeOff data-testid="eye-off-icon" />
          <ChevronRight data-testid="chevron-right-icon" />
          <ChevronDown data-testid="chevron-down-icon" />
          <Menu data-testid="menu-icon" />
          <Plus data-testid="plus-icon" />
          <Check data-testid="check-icon" />
          <AlertCircle data-testid="alert-circle-icon" />
        </div>
      );

      expect(screen.getByTestId('settings-icon')).toBeInTheDocument();
      expect(screen.getByTestId('user-icon')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
      expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument();
      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument();
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
      expect(screen.getByTestId('menu-icon')).toBeInTheDocument();
      expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });
  });

  describe('Component Props Type Validation', () => {
    it('should accept correct props for Modal components', () => {
      const modalProps: ModalProps = {
        open: true,
        onOpenChange: () => {},
        children: <div>Test</div>
      };

      expect(() => {
        render(<Modal {...modalProps} />);
      }).not.toThrow();
    });

    it('should accept correct props for Input components', () => {
      const inputProps: InputProps = {
        placeholder: 'Test input',
        variant: 'default',
        size: 'default',
        clearable: true
      };

      expect(() => {
        render(<Input {...inputProps} />);
      }).not.toThrow();
    });

    it('should accept correct props for Button components', () => {
      const buttonProps: ButtonProps = {
        variant: 'default',
        size: 'default',
        loading: false,
        disabled: false,
        children: 'Test Button'
      };

      expect(() => {
        render(<Button {...buttonProps} />);
      }).not.toThrow();
    });
  });

  describe('Component Accessibility', () => {
    it('should have proper ARIA attributes for Modal', () => {
      render(
        <Modal open={true} onOpenChange={() => {}}>
          <ModalContent open={true}>
            <ModalTitle>Accessible Modal</ModalTitle>
          </ModalContent>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have proper labels for form controls', () => {
      render(
        <Input
          label="Email Address"
          placeholder="Enter your email"
          required
        />
      );

      expect(screen.getByLabelText(/Email Address/)).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument(); // Required indicator
    });

    it('should have proper button accessibility', () => {
      render(
        <IconButton
          icon={<Settings className="w-4 h-4" />}
          aria-label="Open Settings"
        />
      );

      const button = screen.getByLabelText('Open Settings');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Open Settings');
    });
  });

  describe('Component Interactions', () => {
    it('should handle Modal open/close', async () => {
      const mockOnOpenChange = jest.fn();

      render(
        <Modal open={true} onOpenChange={mockOnOpenChange}>
          <ModalContent open={true}>
            <ModalTitle>Test Modal</ModalTitle>
            <ModalClose />
          </ModalContent>
        </Modal>
      );

      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should handle Input changes', () => {
      const mockOnChange = jest.fn();

      render(
        <Input
          placeholder="Test input"
          onChange={mockOnChange}
        />
      );

      const input = screen.getByPlaceholderText('Test input');
      fireEvent.change(input, { target: { value: 'test value' } });

      expect(mockOnChange).toHaveBeenCalled();
    });

    it('should handle Button clicks', () => {
      const mockOnClick = jest.fn();

      render(
        <Button onClick={mockOnClick}>
          Click Me
        </Button>
      );

      const button = screen.getByText('Click Me');
      fireEvent.click(button);

      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should handle SearchInput with debounced search', async () => {
      const mockOnSearch = jest.fn();

      render(
        <SearchInput
          onSearch={mockOnSearch}
          searchDelay={100}
        />
      );

      const searchInput = screen.getByRole('searchbox');
      fireEvent.change(searchInput, { target: { value: 'test search' } });

      await waitFor(() => {
        expect(mockOnSearch).toHaveBeenCalledWith('test search');
      }, { timeout: 200 });
    });
  });

  describe('Component Styling and Variants', () => {
    it('should apply correct CSS classes for Button variants', () => {
      const { container } = render(
        <div>
          <Button variant="default" data-testid="default-btn">Default</Button>
          <Button variant="destructive" data-testid="destructive-btn">Destructive</Button>
          <Button variant="outline" data-testid="outline-btn">Outline</Button>
        </div>
      );

      const defaultBtn = screen.getByTestId('default-btn');
      const destructiveBtn = screen.getByTestId('destructive-btn');
      const outlineBtn = screen.getByTestId('outline-btn');

      expect(defaultBtn).toHaveClass('bg-primary');
      expect(destructiveBtn).toHaveClass('bg-destructive');
      expect(outlineBtn).toHaveClass('border-input');
    });

    it('should apply correct CSS classes for Input variants', () => {
      render(
        <div>
          <Input variant="default" data-testid="default-input" />
          <Input variant="outline" data-testid="outline-input" />
          <Input variant="ghost" data-testid="ghost-input" />
        </div>
      );

      const defaultInput = screen.getByTestId('default-input');
      const outlineInput = screen.getByTestId('outline-input');
      const ghostInput = screen.getByTestId('ghost-input');

      expect(defaultInput).toHaveClass('border-gray-300');
      expect(outlineInput).toHaveClass('bg-transparent');
      expect(ghostInput).toHaveClass('border-transparent');
    });
  });
});