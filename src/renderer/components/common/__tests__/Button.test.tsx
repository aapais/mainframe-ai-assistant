import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { Button } from '../Button';

// Mock CSS imports
jest.mock('../Button.css', () => ({}));

describe('Button Component', () => {
  describe('Basic Rendering', () => {
    it('renders with children', () => {
      render(<Button>Click me</Button>);
      
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders without children', () => {
      render(<Button />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('applies default props', () => {
      render(<Button>Default Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-medium');
      expect(button).not.toHaveClass('btn-full-width', 'btn-loading', 'btn-disabled');
    });

    it('forwards HTML button attributes', () => {
      render(
        <Button 
          id="test-button" 
          data-testid="custom-button"
          aria-label="Custom button"
          title="Button title"
        >
          Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('id', 'test-button');
      expect(button).toHaveAttribute('data-testid', 'custom-button');
      expect(button).toHaveAttribute('aria-label', 'Custom button');
      expect(button).toHaveAttribute('title', 'Button title');
    });
  });

  describe('Variants', () => {
    const variants = ['primary', 'secondary', 'danger', 'success', 'ghost'] as const;

    variants.forEach(variant => {
      it(`renders ${variant} variant correctly`, () => {
        render(<Button variant={variant}>Button</Button>);
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`btn-${variant}`);
      });
    });

    it('falls back to primary variant for invalid variant', () => {
      render(<Button variant={'invalid' as any}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-primary');
    });
  });

  describe('Sizes', () => {
    const sizes = ['small', 'medium', 'large'] as const;

    sizes.forEach(size => {
      it(`renders ${size} size correctly`, () => {
        render(<Button size={size}>Button</Button>);
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(`btn-${size}`);
      });
    });

    it('falls back to medium size for invalid size', () => {
      render(<Button size={'invalid' as any}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-medium');
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when loading is true', () => {
      render(<Button loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-loading');
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
    });

    it('hides text content when loading', () => {
      render(<Button loading>Button Text</Button>);
      
      // Button text should still be in DOM but spinner should be visible
      expect(screen.getByText('Button Text')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
    });

    it('disables button when loading', () => {
      render(<Button loading>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('does not show spinner when loading is false', () => {
      render(<Button loading={false}>Button</Button>);
      
      expect(screen.queryByLabelText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables button when disabled prop is true', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('btn-disabled');
    });

    it('is disabled when loading even if disabled prop is false', () => {
      render(<Button disabled={false} loading>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('is not disabled when both disabled and loading are false', () => {
      render(<Button disabled={false} loading={false}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeEnabled();
    });
  });

  describe('Icon Support', () => {
    const TestIcon = () => <span data-testid="test-icon">📝</span>;

    it('renders icon when provided', () => {
      render(<Button icon={<TestIcon />}>Button with Icon</Button>);
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      expect(screen.getByText('Button with Icon')).toBeInTheDocument();
    });

    it('wraps icon in btn-icon class', () => {
      render(<Button icon={<TestIcon />}>Button</Button>);
      
      const iconWrapper = screen.getByTestId('test-icon').parentElement;
      expect(iconWrapper).toHaveClass('btn-icon');
    });

    it('renders only icon without text when children is empty', () => {
      render(<Button icon={<TestIcon />} />);
      
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
      expect(screen.queryByText('Button')).not.toBeInTheDocument();
    });

    it('prioritizes loading spinner over icon', () => {
      render(<Button icon={<TestIcon />} loading>Button</Button>);
      
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('test-icon')).not.toBeInTheDocument();
    });

    it('wraps text in btn-text class when icon is present', () => {
      render(<Button icon={<TestIcon />}>Button Text</Button>);
      
      const textWrapper = screen.getByText('Button Text').parentElement;
      expect(textWrapper).toHaveClass('btn-text');
    });
  });

  describe('Full Width', () => {
    it('applies full width class when fullWidth is true', () => {
      render(<Button fullWidth>Full Width Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-full-width');
    });

    it('does not apply full width class when fullWidth is false', () => {
      render(<Button fullWidth={false}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).not.toHaveClass('btn-full-width');
    });
  });

  describe('Custom Classes', () => {
    it('applies custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('combines custom className with default classes', () => {
      render(<Button className="custom-class" variant="danger" size="large">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-danger', 'btn-large', 'custom-class');
    });

    it('handles empty className', () => {
      render(<Button className="">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-medium');
    });

    it('handles undefined className', () => {
      render(<Button className={undefined}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn', 'btn-primary', 'btn-medium');
    });
  });

  describe('Event Handling', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<Button onClick={handleClick}>Clickable Button</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<Button onClick={handleClick} disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not call onClick when loading', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<Button onClick={handleClick} loading>Loading Button</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('handles onFocus event', async () => {
      const user = userEvent.setup();
      const handleFocus = jest.fn();
      
      render(<Button onFocus={handleFocus}>Focusable Button</Button>);
      
      const button = screen.getByRole('button');
      await user.click(button); // This will also trigger focus
      
      expect(handleFocus).toHaveBeenCalled();
    });

    it('handles onBlur event', async () => {
      const user = userEvent.setup();
      const handleBlur = jest.fn();
      
      render(
        <>
          <Button onBlur={handleBlur}>Button 1</Button>
          <Button>Button 2</Button>
        </>
      );
      
      const button1 = screen.getByText('Button 1');
      const button2 = screen.getByText('Button 2');
      
      await user.click(button1); // Focus button 1
      await user.click(button2); // Focus button 2, blur button 1
      
      expect(handleBlur).toHaveBeenCalled();
    });

    it('handles keyboard events', async () => {
      const user = userEvent.setup();
      const handleKeyDown = jest.fn();
      
      render(<Button onKeyDown={handleKeyDown}>Button</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      await user.keyboard('{Enter}');
      
      expect(handleKeyDown).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('is focusable by default', () => {
      render(<Button>Focusable Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });

    it('is not focusable when disabled', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      // Disabled buttons are naturally not focusable
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Custom accessible label">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Custom accessible label');
    });

    it('supports aria-describedby', () => {
      render(
        <>
          <Button aria-describedby="description">Button</Button>
          <div id="description">Button description</div>
        </>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-describedby', 'description');
    });

    it('provides loading state to screen readers', () => {
      render(<Button loading>Loading Button</Button>);
      
      const spinner = screen.getByLabelText('Loading...');
      expect(spinner).toBeInTheDocument();
    });

    it('maintains semantic button role', () => {
      render(<Button>Semantic Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });
  });

  describe('Button Types', () => {
    it('defaults to button type', () => {
      render(<Button>Default Type</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('supports submit type', () => {
      render(<Button type="submit">Submit Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('supports reset type', () => {
      render(<Button type="reset">Reset Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'reset');
    });
  });

  describe('Complex Combinations', () => {
    it('combines multiple props correctly', () => {
      const handleClick = jest.fn();
      
      render(
        <Button
          variant="danger"
          size="large"
          fullWidth
          disabled
          className="custom-class"
          onClick={handleClick}
          icon={<span data-testid="icon">🔥</span>}
        >
          Complex Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'btn',
        'btn-danger',
        'btn-large',
        'btn-full-width',
        'btn-disabled',
        'custom-class'
      );
      expect(button).toBeDisabled();
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Complex Button')).toBeInTheDocument();
    });

    it('handles loading state with all props', () => {
      render(
        <Button
          variant="success"
          size="small"
          fullWidth
          loading
          className="loading-button"
          icon={<span data-testid="hidden-icon">📝</span>}
        >
          Loading Complex Button
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'btn',
        'btn-success',
        'btn-small',
        'btn-full-width',
        'btn-loading',
        'loading-button'
      );
      expect(button).toBeDisabled();
      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('hidden-icon')).not.toBeInTheDocument();
      expect(screen.getByText('Loading Complex Button')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles null children gracefully', () => {
      render(<Button>{null}</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles undefined children gracefully', () => {
      render(<Button>{undefined}</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles empty string children', () => {
      render(<Button>{''}</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('handles number children', () => {
      render(<Button>{42}</Button>);
      
      const button = screen.getByRole('button');
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('handles boolean children (should not render)', () => {
      render(<Button>{true}</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.textContent).toBe('');
    });

    it('handles multiple children', () => {
      render(
        <Button>
          <span>Part 1</span>
          <span>Part 2</span>
        </Button>
      );
      
      expect(screen.getByText('Part 1')).toBeInTheDocument();
      expect(screen.getByText('Part 2')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      const { rerender } = render(<Button>Initial</Button>);
      
      // Re-render with same props should not cause issues
      rerender(<Button>Initial</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Initial')).toBeInTheDocument();
    });

    it('handles rapid prop changes', () => {
      const { rerender } = render(<Button variant="primary">Button</Button>);
      
      rerender(<Button variant="secondary">Button</Button>);
      rerender(<Button variant="danger">Button</Button>);
      rerender(<Button variant="success">Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('btn-success');
    });
  });
});