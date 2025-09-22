/**
 * Accenture Mainframe AI Assistant - Complete Application
 * Comprehensive React application with full navigation and component integration
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  BookOpen,
  Settings as SettingsIcon,
  Home,
  Menu,
  X,
  Search,
  Plus,
  Bell,
  User,
  HelpCircle
} from 'lucide-react';

// Views and Pages
import IncidentDashboard from './views/IncidentDashboard';
import Incidents from './views/Incidents';

// Components
import SettingsDropdown from './components/settings/SettingsDropdown';
import ReportIncidentModal from './components/modals/ReportIncidentModal';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Modal } from './components/ui/Modal';

// Contexts
import { SettingsProvider } from './contexts/SettingsContext';

// Services
import IncidentService from './services/IncidentService';

// Types
import { CreateIncident } from '../backend/core/interfaces/ServiceInterfaces';

// Styles
import './styles/global.css';
import './styles/components.css';

// Navigation tabs configuration
interface NavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  description: string;
  badge?: string;
}

// Accenture brand colors
const accentureColors = {
  primary: '#A100FF',
  secondary: '#7F39FB',
  accent: '#E8D5FF',
  gray: '#666666',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  dark: '#333333'
};

function App() {
  // Main navigation state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);


  // Modal states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReportingIncident, setIsReportingIncident] = useState(false);

  // Application state
  const [notifications, setNotifications] = useState(0);
  const [user, setUser] = useState({ name: 'Usuário', email: 'user@accenture.com' });

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Simulate app initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Handle incident reporting
  const handleReportIncident = async (incidentData: CreateIncident) => {
    setIsReportingIncident(true);
    try {
      // Call incident service
      await IncidentService.createIncident(incidentData);
      setIsReportModalOpen(false);
      // Show success notification
      console.log('Incident reported successfully:', incidentData);
    } catch (error) {
      console.error('Error reporting incident:', error);
      throw error;
    } finally {
      setIsReportingIncident(false);
    }
  };


  // Navigation tabs - INTEGRATED APPROACH: Knowledge Base is now part of Incidents
  const navTabs: NavTab[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <BarChart3 className="w-5 h-5" />,
      component: <IncidentDashboard />,
      description: 'Visão geral de métricas e incidentes'
    },
    {
      id: 'incidents',
      label: 'Incidentes e Conhecimento',
      icon: <AlertTriangle className="w-5 h-5" />,
      component: <Incidents />,
      description: 'Gestão completa de incidentes e base de conhecimento integrada',
      badge: notifications > 0 ? notifications.toString() : undefined
    }
  ];

  const currentTab = navTabs.find(tab => tab.id === activeTab) || navTabs[0];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900">Accenture Mainframe AI Assistant</h2>
          <p className="mt-2 text-gray-600">Carregando aplicação...</p>
        </div>
      </div>
    );
  }

  return (
    <SettingsProvider>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo and Title */}
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  {/* Accenture Logo Placeholder */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accentureColors.primary }}>
                    <span className="text-white font-bold text-sm">A</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Mainframe AI Assistant</h1>
                    <p className="text-xs text-gray-500">Accenture Technology - Integrated Incident & Knowledge Management</p>
                  </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                >
                  {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>

              {/* Desktop Navigation */}
              <nav className="hidden md:flex space-x-1">
                {navTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    style={{
                      backgroundColor: activeTab === tab.id ? accentureColors.primary : 'transparent'
                    }}
                    title={tab.description}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <Badge className="ml-1 bg-red-500 text-white text-xs">
                        {tab.badge}
                      </Badge>
                    )}
                  </button>
                ))}
              </nav>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                {/* Quick Search */}
                <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md">
                  <Search className="w-5 h-5" />
                </button>

                {/* Notifications */}
                <button className="relative p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md">
                  <Bell className="w-5 h-5" />
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                      {notifications}
                    </span>
                  )}
                </button>

                {/* Settings Dropdown */}
                <SettingsDropdown user={user} />

                {/* Report Incident Button */}
                <Button
                  onClick={() => setIsReportModalOpen(true)}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Reportar</span>
                </Button>

                {/* User Avatar */}
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="hidden sm:block text-sm">
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 bg-white">
              <div className="px-4 py-2 space-y-1">
                {navTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'text-white'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                    style={{
                      backgroundColor: activeTab === tab.id ? accentureColors.primary : 'transparent'
                    }}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.badge && (
                      <Badge className="ml-auto bg-red-500 text-white">
                        {tab.badge}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {/* Tab Content */}
          <div className="h-full">
            {currentTab.component}
          </div>
        </main>

        {/* Report Incident Modal */}
        <ReportIncidentModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          onSubmit={handleReportIncident}
          loading={isReportingIncident}
          onError={(error) => {
            console.error('Incident reporting error:', error);
          }}
        />

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <span>© 2024 Accenture Technology</span>
              <span>•</span>
              <span>Mainframe AI Assistant v2.0 - Integrated Incident & Knowledge Platform</span>
            </div>
            <div className="flex items-center space-x-3">
              <button className="hover:text-gray-700 flex items-center space-x-1">
                <HelpCircle className="w-4 h-4" />
                <span>Ajuda</span>
              </button>
              <span>•</span>
              <span>Status: Online</span>
            </div>
          </div>
        </footer>
      </div>
    </SettingsProvider>
  );
}

export default App;