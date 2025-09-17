/**
 * Settings Navigation Example
 * Example implementation showing how to use the SettingsNavigation component
 */

import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { SettingsNavigation } from './SettingsNavigation';
import { useResponsiveNavigation } from './SettingsNavigationHooks';

// Example settings pages (placeholders)
const ProfilePage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Profile Settings</h1>
    <p>Configure your profile information and preferences.</p>
  </div>
);

const APIKeysPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">API Keys</h1>
    <p>Manage your API keys for various AI providers.</p>
  </div>
);

const BudgetPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Budget Settings</h1>
    <p>Configure spending limits and cost controls.</p>
  </div>
);

const DashboardPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Dashboard Configuration</h1>
    <p>Customize your dashboard widgets and layout.</p>
  </div>
);

const PerformancePage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Performance Settings</h1>
    <p>Configure application performance and optimization settings.</p>
  </div>
);

const SecurityPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Security Settings</h1>
    <p>Manage security settings and access controls.</p>
  </div>
);

const DeveloperPage = () => (
  <div className="p-6">
    <h1 className="text-2xl font-bold mb-4">Developer Tools</h1>
    <p>Access developer tools and debugging options.</p>
  </div>
);

const NotFoundPage = () => (
  <div className="p-6 text-center">
    <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
    <p>The requested settings page could not be found.</p>
  </div>
);

/**
 * Settings Layout Component
 * Demonstrates responsive layout with navigation sidebar
 */
const SettingsLayout: React.FC = () => {
  const location = useLocation();
  const { isMobile } = useResponsiveNavigation();
  const [isNavigationVisible, setIsNavigationVisible] = useState(!isMobile);

  const handleNavigate = (path: string) => {
    // In a real implementation, you would use react-router's navigate
    window.history.pushState({}, '', path);

    // Hide navigation on mobile after navigation
    if (isMobile) {
      setIsNavigationVisible(false);
    }
  };

  const toggleNavigation = () => {
    setIsNavigationVisible(!isNavigationVisible);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Navigation Sidebar */}
      <div className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'}
        ${isNavigationVisible ? 'block' : 'hidden'}
        w-80 bg-white shadow-lg
      `}>
        <SettingsNavigation
          currentPath={location.pathname}
          onNavigate={handleNavigate}
          isMobile={isMobile}
        />
      </div>

      {/* Mobile Overlay */}
      {isMobile && isNavigationVisible && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsNavigationVisible(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar (Mobile) */}
        {isMobile && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
            <button
              onClick={toggleNavigation}
              className="p-2 rounded-md hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="ml-4 text-lg font-semibold">Settings</h1>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <Routes>
            <Route path="/settings" element={<ProfilePage />} />
            <Route path="/settings/general/profile" element={<ProfilePage />} />
            <Route path="/settings/general/profile/*" element={<ProfilePage />} />
            <Route path="/settings/api/keys" element={<APIKeysPage />} />
            <Route path="/settings/api/providers/*" element={<APIKeysPage />} />
            <Route path="/settings/cost/budget" element={<BudgetPage />} />
            <Route path="/settings/cost/*" element={<BudgetPage />} />
            <Route path="/settings/dashboard/*" element={<DashboardPage />} />
            <Route path="/settings/advanced/performance" element={<PerformancePage />} />
            <Route path="/settings/advanced/performance/*" element={<PerformancePage />} />
            <Route path="/settings/advanced/security" element={<SecurityPage />} />
            <Route path="/settings/advanced/security/*" element={<SecurityPage />} />
            <Route path="/settings/advanced/developer" element={<DeveloperPage />} />
            <Route path="/settings/advanced/developer/*" element={<DeveloperPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

/**
 * Example App Component
 * Complete example with routing
 */
export const SettingsNavigationExample: React.FC = () => {
  return (
    <Router>
      <div className="app">
        <SettingsLayout />
      </div>
    </Router>
  );
};

/**
 * Standalone Navigation Example
 * For testing the navigation component in isolation
 */
export const StandaloneNavigationExample: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/settings/general/profile');

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    console.log('Navigate to:', path);
  };

  return (
    <div className="w-80 h-screen border border-gray-300">
      <SettingsNavigation
        currentPath={currentPath}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

/**
 * Mobile Navigation Example
 * Demonstrates mobile responsive behavior
 */
export const MobileNavigationExample: React.FC = () => {
  const [currentPath, setCurrentPath] = useState('/settings/api/keys');
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setIsOpen(false);
    console.log('Navigate to:', path);
  };

  return (
    <div className="relative w-full h-screen bg-gray-100">
      {/* Mobile trigger button */}
      <div className="p-4">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-purple-600 text-white px-4 py-2 rounded-md"
        >
          Open Settings Menu
        </button>
        <div className="mt-4 p-4 bg-white rounded-md">
          <p>Current path: <code>{currentPath}</code></p>
        </div>
      </div>

      {/* Navigation overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-80">
            <SettingsNavigation
              currentPath={currentPath}
              onNavigate={handleNavigate}
              isMobile={true}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default SettingsNavigationExample;