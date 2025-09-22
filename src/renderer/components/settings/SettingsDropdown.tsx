/**
 * SettingsDropdown - Dropdown component for accessing all settings functionality
 * Replaces the settings tab with a dropdown accessible from the gear icon in header
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  ChevronDown,
  User,
  Bell,
  Palette,
  Shield,
  Database,
  Wifi,
  HelpCircle,
  LogOut,
  X
} from 'lucide-react';
import { SettingsNavigation } from './SettingsNavigation';
import Settings from '../../pages/Settings';

interface SettingsDropdownProps {
  user: {
    name: string;
    email: string;
  };
  className?: string;
}

export const SettingsDropdown: React.FC<SettingsDropdownProps> = ({ user, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [settingsPath, setSettingsPath] = useState('/settings/general/profile');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle settings navigation
  const handleSettingsNavigate = (path: string) => {
    setSettingsPath(path);
  };

  // Quick settings options
  const quickSettings = [
    {
      id: 'profile',
      label: 'Perfil do Usuário',
      icon: User,
      description: 'Editar informações pessoais',
      action: () => {
        setSettingsPath('/settings/general/profile');
        setShowFullSettings(true);
      }
    },
    {
      id: 'notifications',
      label: 'Notificações',
      icon: Bell,
      description: 'Configurar alertas e notificações',
      action: () => {
        setSettingsPath('/settings/general/notifications');
        setShowFullSettings(true);
      }
    },
    {
      id: 'theme',
      label: 'Aparência',
      icon: Palette,
      description: 'Tema e preferências visuais',
      action: () => {
        setSettingsPath('/settings/general/appearance');
        setShowFullSettings(true);
      }
    },
    {
      id: 'security',
      label: 'Segurança',
      icon: Shield,
      description: 'Senhas e autenticação',
      action: () => {
        setSettingsPath('/settings/security/authentication');
        setShowFullSettings(true);
      }
    },
    {
      id: 'integrations',
      label: 'Integrações',
      icon: Wifi,
      description: 'APIs e conexões externas',
      action: () => {
        setSettingsPath('/settings/integrations/apis');
        setShowFullSettings(true);
      }
    },
    {
      id: 'data',
      label: 'Dados',
      icon: Database,
      description: 'Backup e importação',
      action: () => {
        setSettingsPath('/settings/data/backup');
        setShowFullSettings(true);
      }
    }
  ];

  // Close full settings modal
  const closeFullSettings = () => {
    setShowFullSettings(false);
    setIsOpen(false);
  };

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Settings Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Configurações"
          aria-label="Abrir configurações"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Configurações</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Acesso rápido às configurações da aplicação
              </p>
            </div>

            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user.name}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Quick Settings */}
            <div className="py-2">
              {quickSettings.map((setting) => {
                const Icon = setting.icon;
                return (
                  <button
                    key={setting.id}
                    onClick={setting.action}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
                  >
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{setting.label}</p>
                      <p className="text-sm text-gray-500">{setting.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="border-t border-gray-200 py-2">
              <button
                onClick={() => {
                  setShowFullSettings(true);
                  setSettingsPath('/settings/general/profile');
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 text-blue-600"
              >
                <SettingsIcon className="w-4 h-4" />
                <span className="font-medium">Todas as Configurações</span>
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  // Handle logout
                  console.log('Logout action');
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 text-red-600"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sair</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Full Settings Modal */}
      {showFullSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] m-4 flex overflow-hidden">
            {/* Settings Navigation */}
            <div className="w-80 border-r border-gray-200 bg-white">
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Configurações</h2>
                  <button
                    onClick={closeFullSettings}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
                <SettingsNavigation
                  currentPath={settingsPath}
                  onNavigate={handleSettingsNavigate}
                  isMobile={false}
                />
              </div>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto">
              <Settings currentPath={settingsPath} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsDropdown;