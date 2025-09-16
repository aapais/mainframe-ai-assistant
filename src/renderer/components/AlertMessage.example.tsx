/**
 * AlertMessage Component Examples
 * Demonstrates various usage patterns for the AlertMessage component
 */

import React, { useState, useRef } from 'react';
import AlertMessage, {
  AlertMessageRef,
  AlertAction,
  InfoAlert,
  SuccessAlert,
  WarningAlert,
  ErrorAlert,
  showToast
} from './AlertMessage';

// =========================
// BASIC EXAMPLES
// =========================

export const BasicExamples: React.FC = () => {
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Basic Alert Examples</h2>

      {/* Simple info alert */}
      <InfoAlert message="This is a simple informational message." />

      {/* Success alert with title */}
      <SuccessAlert
        title="Operation Successful"
        message="Your changes have been saved successfully."
      />

      {/* Warning alert with custom styling */}
      <WarningAlert
        message="Please review your input before proceeding."
        className="border-2"
      />

      {/* Error alert with JSX content */}
      <ErrorAlert
        title="Validation Error"
        message={
          <div>
            The following fields are required:
            <ul className="list-disc list-inside mt-2">
              <li>Email address</li>
              <li>Password</li>
              <li>Confirmation password</li>
            </ul>
          </div>
        }
      />
    </div>
  );
};

// =========================
// DISMISSIBLE EXAMPLES
// =========================

export const DismissibleExamples: React.FC = () => {
  const [showAlert1, setShowAlert1] = useState(true);
  const [showAlert2, setShowAlert2] = useState(true);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Dismissible Alert Examples</h2>

      {/* Manual dismiss */}
      {showAlert1 && (
        <InfoAlert
          message="You can manually dismiss this alert."
          dismissible
          onDismiss={() => setShowAlert1(false)}
        />
      )}

      {/* Auto-dismiss */}
      {showAlert2 && (
        <SuccessAlert
          message="This alert will auto-dismiss in 5 seconds."
          dismissible
          autoDismiss={5000}
          onDismiss={() => setShowAlert2(false)}
        />
      )}

      {/* Restore buttons */}
      <div className="space-x-2">
        <button
          onClick={() => setShowAlert1(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Show Manual Dismiss Alert
        </button>
        <button
          onClick={() => setShowAlert2(true)}
          className="px-3 py-1 bg-green-500 text-white rounded"
        >
          Show Auto-Dismiss Alert
        </button>
      </div>
    </div>
  );
};

// =========================
// ACTION EXAMPLES
// =========================

export const ActionExamples: React.FC = () => {
  const [result, setResult] = useState<string>('');

  const handleConfirm = () => {
    setResult('Confirmed!');
  };

  const handleCancel = () => {
    setResult('Cancelled!');
  };

  const handleDelete = () => {
    setResult('Deleted!');
  };

  const confirmActions: AlertAction[] = [
    {
      id: 'confirm',
      label: 'Confirm',
      onClick: handleConfirm,
      variant: 'primary',
      autoFocus: true
    },
    {
      id: 'cancel',
      label: 'Cancel',
      onClick: handleCancel,
      variant: 'secondary'
    }
  ];

  const deleteActions: AlertAction[] = [
    {
      id: 'delete',
      label: 'Delete',
      onClick: handleDelete,
      variant: 'primary',
      shortcut: 'Ctrl+D'
    },
    {
      id: 'keep',
      label: 'Keep',
      onClick: handleCancel,
      variant: 'ghost'
    }
  ];

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Alert with Actions</h2>

      {/* Confirmation dialog */}
      <AlertMessage
        title="Confirm Action"
        message="Are you sure you want to proceed with this action?"
        severity="warning"
        actions={confirmActions}
        alertStyle="modal"
      />

      {/* Delete confirmation */}
      <ErrorAlert
        title="Delete File"
        message="This action cannot be undone. Are you sure?"
        actions={deleteActions}
      />

      {/* Result display */}
      {result && (
        <div className="p-3 bg-gray-100 rounded">
          Result: {result}
        </div>
      )}
    </div>
  );
};

// =========================
// STYLE VARIANTS
// =========================

export const StyleExamples: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <h2 className="text-xl font-bold">Alert Style Variants</h2>

      {/* Inline style (default) */}
      <div>
        <h3 className="font-semibold mb-2">Inline Style</h3>
        <InfoAlert
          message="This is an inline alert that fits naturally in the content flow."
          alertStyle="inline"
        />
      </div>

      {/* Banner style */}
      <div>
        <h3 className="font-semibold mb-2">Banner Style</h3>
        <WarningAlert
          message="This is a banner alert that spans the full width."
          alertStyle="banner"
        />
      </div>

      {/* Toast style */}
      <div>
        <h3 className="font-semibold mb-2">Toast Style</h3>
        <SuccessAlert
          message="This is a toast-style alert with elevated appearance."
          alertStyle="toast"
          className="max-w-sm"
        />
      </div>

      {/* Modal style */}
      <div>
        <h3 className="font-semibold mb-2">Modal Style</h3>
        <ErrorAlert
          title="Critical Error"
          message="This is a modal-style alert for important notifications."
          alertStyle="modal"
          className="max-w-md"
        />
      </div>
    </div>
  );
};

// =========================
// CUSTOM ICONS
// =========================

export const CustomIconExamples: React.FC = () => {
  const customIcon = (
    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const iconFunction = (severity: string) => {
    const icons = {
      info: '💡',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return <span style={{ fontSize: '18px' }}>{icons[severity as keyof typeof icons]}</span>;
  };

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Custom Icon Examples</h2>

      {/* No icon */}
      <InfoAlert
        message="Alert without an icon."
        showIcon={false}
      />

      {/* Custom static icon */}
      <SuccessAlert
        message="Alert with custom SVG icon."
        icon={customIcon}
      />

      {/* Dynamic icon function */}
      <WarningAlert
        message="Alert with emoji icon from function."
        icon={iconFunction}
      />

      {/* Custom icon with different severities */}
      <div className="grid grid-cols-2 gap-4">
        {(['info', 'success', 'warning', 'error'] as const).map(severity => (
          <AlertMessage
            key={severity}
            message={`${severity} with emoji`}
            severity={severity}
            icon={iconFunction}
          />
        ))}
      </div>
    </div>
  );
};

// =========================
// IMPERATIVE API EXAMPLES
// =========================

export const ImperativeApiExamples: React.FC = () => {
  const alertRef = useRef<AlertMessageRef>(null);
  const [isVisible, setIsVisible] = useState(true);

  const handleFocus = () => {
    alertRef.current?.focus();
  };

  const handleShow = () => {
    alertRef.current?.show();
    setIsVisible(true);
  };

  const handleDismiss = () => {
    alertRef.current?.dismiss();
  };

  const handleGetElement = () => {
    const element = alertRef.current?.getElement();
    if (element) {
      console.log('Alert element:', element);
      alert(`Alert element tag: ${element.tagName}, ID: ${element.id}`);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Imperative API Examples</h2>

      {/* Controlled alert with ref */}
      <InfoAlert
        ref={alertRef}
        message="This alert can be controlled via imperative API."
        open={isVisible}
        onDismiss={() => setIsVisible(false)}
        onShow={() => setIsVisible(true)}
        id="controlled-alert"
      />

      {/* Control buttons */}
      <div className="space-x-2">
        <button
          onClick={handleFocus}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Focus Alert
        </button>
        <button
          onClick={handleShow}
          className="px-3 py-1 bg-green-500 text-white rounded"
        >
          Show Alert
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-1 bg-red-500 text-white rounded"
        >
          Dismiss Alert
        </button>
        <button
          onClick={handleGetElement}
          className="px-3 py-1 bg-gray-500 text-white rounded"
        >
          Get Element
        </button>
      </div>
    </div>
  );
};

// =========================
// TOAST EXAMPLES
// =========================

export const ToastExamples: React.FC = () => {
  const showToastExample = (position: any) => {
    showToast({
      message: `Toast from ${position}`,
      severity: 'info',
      position,
      autoDismiss: 3000,
      dismissible: true
    });
  };

  const showActionToast = () => {
    showToast({
      title: 'File Upload',
      message: 'Your file has been uploaded successfully.',
      severity: 'success',
      actions: [
        {
          id: 'view',
          label: 'View',
          onClick: () => alert('Viewing file...'),
          variant: 'primary'
        },
        {
          id: 'share',
          label: 'Share',
          onClick: () => alert('Sharing file...'),
          variant: 'secondary'
        }
      ],
      autoDismiss: 10000
    });
  };

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Toast Examples</h2>

      <div className="grid grid-cols-3 gap-2">
        {[
          'top-left', 'top-center', 'top-right',
          'bottom-left', 'bottom-center', 'bottom-right'
        ].map(position => (
          <button
            key={position}
            onClick={() => showToastExample(position)}
            className="px-3 py-2 bg-blue-500 text-white rounded text-sm"
          >
            {position}
          </button>
        ))}
      </div>

      <button
        onClick={showActionToast}
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        Show Toast with Actions
      </button>
    </div>
  );
};

// =========================
// ACCESSIBILITY EXAMPLES
// =========================

export const AccessibilityExamples: React.FC = () => {
  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Accessibility Examples</h2>

      {/* Live region alert */}
      <AlertMessage
        message="This is announced to screen readers immediately."
        severity="info"
        role="alert"
      />

      {/* Status alert */}
      <AlertMessage
        message="This is announced politely to screen readers."
        severity="success"
        role="status"
      />

      {/* Alert dialog */}
      <AlertMessage
        title="Important Decision"
        message="This requires user interaction and traps focus."
        severity="warning"
        role="alertdialog"
        actions={[
          {
            id: 'ok',
            label: 'OK',
            onClick: () => console.log('OK clicked'),
            autoFocus: true
          }
        ]}
      />

      {/* Custom ARIA labels */}
      <AlertMessage
        message="This alert has custom ARIA labeling."
        aria-label="Custom notification"
        aria-describedby="custom-description"
      />
      <div id="custom-description" className="sr-only">
        Additional context for screen readers
      </div>
    </div>
  );
};

// =========================
// ANIMATION EXAMPLES
// =========================

export const AnimationExamples: React.FC = () => {
  const [showAnimated, setShowAnimated] = useState(false);
  const [showReduced, setShowReduced] = useState(false);

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-bold">Animation Examples</h2>

      {/* Animated alert */}
      {showAnimated && (
        <SuccessAlert
          message="This alert animates in and out."
          animate={true}
          dismissible
          onDismiss={() => setShowAnimated(false)}
        />
      )}

      {/* Reduced motion alert */}
      {showReduced && (
        <InfoAlert
          message="This alert respects reduced motion preferences."
          animate={true}
          respectMotion={true}
          dismissible
          onDismiss={() => setShowReduced(false)}
        />
      )}

      {/* Control buttons */}
      <div className="space-x-2">
        <button
          onClick={() => setShowAnimated(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Show Animated Alert
        </button>
        <button
          onClick={() => setShowReduced(true)}
          className="px-3 py-1 bg-green-500 text-white rounded"
        >
          Show Reduced Motion Alert
        </button>
      </div>
    </div>
  );
};

// =========================
// COMPLETE DEMO
// =========================

export const AlertMessageDemo: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center py-6">
        <h1 className="text-3xl font-bold text-gray-900">
          AlertMessage Component Demo
        </h1>
        <p className="text-gray-600 mt-2">
          A comprehensive, accessible alert component for React applications
        </p>
      </div>

      <BasicExamples />
      <DismissibleExamples />
      <ActionExamples />
      <StyleExamples />
      <CustomIconExamples />
      <ImperativeApiExamples />
      <ToastExamples />
      <AccessibilityExamples />
      <AnimationExamples />
    </div>
  );
};

export default AlertMessageDemo;