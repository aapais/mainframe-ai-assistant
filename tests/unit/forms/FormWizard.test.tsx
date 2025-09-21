import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FormWizard, WizardStep, WizardStepProps } from '../../../src/renderer/components/forms/wizard/FormWizard';

// Mock step components
const MockStep1: React.FC<WizardStepProps> = ({ data, onChange, onNext, isFirst, isLast }) => (
  <div data-testid="step-1">
    <h3>Step 1</h3>
    <input
      data-testid="step1-input"
      value={data.field1 || ''}
      onChange={(e) => onChange({ ...data, field1: e.target.value })}
    />
    <button onClick={onNext} disabled={!data.field1}>
      {isLast ? 'Complete' : 'Next'}
    </button>
    <div>Is First: {isFirst.toString()}</div>
    <div>Is Last: {isLast.toString()}</div>
  </div>
);

const MockStep2: React.FC<WizardStepProps> = ({ data, onChange, onNext, onPrevious, isFirst, isLast }) => (
  <div data-testid="step-2">
    <h3>Step 2</h3>
    <input
      data-testid="step2-input"
      value={data.field2 || ''}
      onChange={(e) => onChange({ ...data, field2: e.target.value })}
    />
    <button onClick={onPrevious}>Previous</button>
    <button onClick={onNext} disabled={!data.field2}>
      {isLast ? 'Complete' : 'Next'}
    </button>
    <div>Is First: {isFirst.toString()}</div>
    <div>Is Last: {isLast.toString()}</div>
  </div>
);

const MockStep3: React.FC<WizardStepProps> = ({ data, onChange, onNext, onPrevious, isFirst, isLast }) => (
  <div data-testid="step-3">
    <h3>Step 3</h3>
    <input
      data-testid="step3-input"
      value={data.field3 || ''}
      onChange={(e) => onChange({ ...data, field3: e.target.value })}
    />
    <button onClick={onPrevious}>Previous</button>
    <button onClick={onNext}>Complete</button>
    <div>Is First: {isFirst.toString()}</div>
    <div>Is Last: {isLast.toString()}</div>
  </div>
);

const mockSteps: WizardStep[] = [
  {
    id: 'step1',
    title: 'Step 1',
    description: 'First step',
    component: MockStep1,
    validation: async (data) => Boolean(data.field1),
    required: true
  },
  {
    id: 'step2',
    title: 'Step 2',
    description: 'Second step',
    component: MockStep2,
    validation: async (data) => Boolean(data.field2),
    required: true
  },
  {
    id: 'step3',
    title: 'Step 3',
    description: 'Final step',
    component: MockStep3,
    validation: async (data) => Boolean(data.field3),
    required: false
  }
];

describe('FormWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnStepChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
  });

  it('renders first step initially', () => {
    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('step-1')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Is First: true')).toBeInTheDocument();
    expect(screen.getByText('Is Last: false')).toBeInTheDocument();
  });

  it('shows progress indicators for all steps', () => {
    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        showProgress={true}
      />
    );

    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('navigates to next step when validation passes', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Fill first step
    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test value');

    // Click next
    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Should now be on step 2
    await waitFor(() => {
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });

    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('Is First: false')).toBeInTheDocument();
    expect(screen.getByText('Is Last: false')).toBeInTheDocument();
  });

  it('prevents navigation when validation fails', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Try to navigate without filling required field
    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    // Should still be on step 1
    expect(screen.getByTestId('step-1')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('navigates backward correctly', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Navigate to step 2
    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test value');
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });

    // Navigate back
    const previousButton = screen.getByText('Previous');
    await user.click(previousButton);

    await waitFor(() => {
      expect(screen.getByTestId('step-1')).toBeInTheDocument();
    });
  });

  it('completes wizard when on last step', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Navigate through all steps
    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test value 1');
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });

    const step2Input = screen.getByTestId('step2-input');
    await user.type(step2Input, 'test value 2');
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
    });

    expect(screen.getByText('Is Last: true')).toBeInTheDocument();

    // Complete wizard
    await user.click(screen.getByText('Complete'));

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        field1: 'test value 1',
        field2: 'test value 2',
        field3: ''
      });
    });
  });

  it('calls onStepChange when data changes', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        onStepChange={mockOnStepChange}
      />
    );

    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test');

    await waitFor(() => {
      expect(mockOnStepChange).toHaveBeenCalledWith(0, { field1: 'test' });
    });
  });

  it('handles cancel with unsaved changes', async () => {
    const user = userEvent.setup();
    // Mock window.confirm
    window.confirm = jest.fn(() => true);

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Add some data
    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test value');

    // Click cancel
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to cancel? Any unsaved changes will be lost.'
    );
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('handles cancel without unsaved changes', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Click cancel without any data
    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('supports step clicking when allowSkipSteps is true', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        allowSkipSteps={true}
      />
    );

    // Click on step 3 directly
    const step3Button = screen.getByText('Step 3');
    await user.click(step3Button);

    await waitFor(() => {
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
    });
  });

  it('auto-saves data when enabled', async () => {
    const user = userEvent.setup();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        autoSave={true}
        autoSaveKey="test-auto-save"
      />
    );

    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test value');

    // Wait for auto-save (debounced)
    await waitFor(() => {
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'test-auto-save',
        expect.stringContaining('field1')
      );
    }, { timeout: 2000 });
  });

  it('loads auto-saved data on mount', () => {
    const savedData = JSON.stringify({
      formData: { field1: 'saved value' },
      currentStepIndex: 1,
      timestamp: Date.now()
    });

    (localStorage.getItem as jest.Mock).mockReturnValue(savedData);
    window.confirm = jest.fn(() => true);

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        autoSave={true}
        autoSaveKey="test-auto-save"
      />
    );

    expect(window.confirm).toHaveBeenCalledWith(
      'A previous draft was found. Would you like to continue where you left off?'
    );
  });

  it('displays auto-save indicator', () => {
    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        autoSave={true}
      />
    );

    expect(screen.getByText('Draft automatically saved')).toBeInTheDocument();
  });

  it('handles validation errors during completion', async () => {
    const user = userEvent.setup();
    const failingSteps = [
      {
        ...mockSteps[0],
        validation: async () => false
      },
      ...mockSteps.slice(1)
    ];

    render(
      <FormWizard
        steps={failingSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
      />
    );

    // Navigate to last step
    const step1Input = screen.getByTestId('step1-input');
    await user.type(step1Input, 'test value 1');
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });

    const step2Input = screen.getByTestId('step2-input');
    await user.type(step2Input, 'test value 2');
    await user.click(screen.getByText('Next'));

    await waitFor(() => {
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
    });

    // Try to complete - should fail validation and return to step 1
    await user.click(screen.getByText('Complete'));

    await waitFor(() => {
      expect(screen.getByTestId('step-1')).toBeInTheDocument();
    });

    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});

// Integration test for the whole form wizard flow
describe('FormWizard Integration', () => {
  it('completes full wizard flow with all features', async () => {
    const user = userEvent.setup();
    const mockOnComplete = jest.fn();
    const mockOnCancel = jest.fn();

    render(
      <FormWizard
        steps={mockSteps}
        onComplete={mockOnComplete}
        onCancel={mockOnCancel}
        showProgress={true}
        autoSave={true}
        autoSaveKey="integration-test"
      />
    );

    // Verify initial state
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByTestId('step-1')).toBeInTheDocument();

    // Fill and complete step 1
    await user.type(screen.getByTestId('step1-input'), 'step 1 data');
    await user.click(screen.getByText('Next'));

    // Verify step 2
    await waitFor(() => {
      expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
      expect(screen.getByTestId('step-2')).toBeInTheDocument();
    });

    // Fill and complete step 2
    await user.type(screen.getByTestId('step2-input'), 'step 2 data');
    await user.click(screen.getByText('Next'));

    // Verify step 3
    await waitFor(() => {
      expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
      expect(screen.getByTestId('step-3')).toBeInTheDocument();
    });

    // Fill and complete step 3
    await user.type(screen.getByTestId('step3-input'), 'step 3 data');
    await user.click(screen.getByText('Complete'));

    // Verify completion
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        field1: 'step 1 data',
        field2: 'step 2 data',
        field3: 'step 3 data'
      });
    });
  });
});