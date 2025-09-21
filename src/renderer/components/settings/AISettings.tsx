import React, { useState, useEffect } from 'react';
import { Settings, Key, CheckCircle, XCircle, Loader2, AlertCircle, DollarSign, Brain, Shield } from 'lucide-react';

interface AISettingsProps {
  onClose?: () => void;
}

const AISettings: React.FC<AISettingsProps> = ({ onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [savedApiKey, setSavedApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [aiStatus, setAiStatus] = useState<'checking' | 'active' | 'inactive' | 'error'>('checking');

  // Budget settings
  const [autoApproveLimit, setAutoApproveLimit] = useState('0.01');
  const [dailyBudget, setDailyBudget] = useState('5.00');
  const [monthlyBudget, setMonthlyBudget] = useState('100.00');
  const [requireAuth, setRequireAuth] = useState(true);

  useEffect(() => {
    loadSettings();
    checkAIStatus();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settings = await window.api.invoke('settings:get-ai');
      if (settings) {
        setSavedApiKey(settings.apiKey ? '••••••••' + settings.apiKey.slice(-4) : '');
        setApiKey('');
        setAutoApproveLimit(settings.autoApproveLimit || '0.01');
        setDailyBudget(settings.dailyBudget || '5.00');
        setMonthlyBudget(settings.monthlyBudget || '100.00');
        setRequireAuth(settings.requireAuth !== false);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAIStatus = async () => {
    try {
      const result = await window.api.invoke('ai:check-status');
      setAiStatus(result.available ? 'active' : 'inactive');
    } catch (error) {
      setAiStatus('error');
    }
  };

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      setTestMessage('Por favor, insira uma API key');
      setTestStatus('error');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.api.invoke('settings:save-ai-key', apiKey.trim());
      if (result.success) {
        setSavedApiKey('••••••••' + apiKey.slice(-4));
        setApiKey('');
        setTestStatus('success');
        setTestMessage('API key guardada com sucesso');
        await checkAIStatus();
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Erro ao guardar API key');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage('Erro ao guardar API key');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus('idle');
    try {
      const result = await window.api.invoke('ai:test-connection');
      if (result.success) {
        setTestStatus('success');
        setTestMessage('Conexão com Gemini estabelecida com sucesso!');
        setAiStatus('active');
      } else {
        setTestStatus('error');
        setTestMessage(result.error || 'Não foi possível conectar ao Gemini');
        setAiStatus('error');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage('Erro ao testar conexão');
      setAiStatus('error');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveBudgets = async () => {
    setIsLoading(true);
    try {
      const result = await window.api.invoke('settings:save-ai-budgets', {
        autoApproveLimit: parseFloat(autoApproveLimit),
        dailyBudget: parseFloat(dailyBudget),
        monthlyBudget: parseFloat(monthlyBudget),
        requireAuth
      });

      if (result.success) {
        setTestStatus('success');
        setTestMessage('Configurações de orçamento guardadas');
      }
    } catch (error) {
      setTestStatus('error');
      setTestMessage('Erro ao guardar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (aiStatus) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'inactive':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Loader2 className="w-5 h-5 animate-spin text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (aiStatus) {
      case 'active':
        return 'IA Ativa e Funcional';
      case 'inactive':
        return 'IA Inativa - Configure a API Key';
      case 'error':
        return 'Erro na Conexão com IA';
      default:
        return 'Verificando status...';
    }
  };

  if (isLoading && !savedApiKey) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Brain className="w-8 h-8 text-purple-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Configurações de Inteligência Artificial
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium text-gray-700">
              {getStatusText()}
            </span>
          </div>
        </div>
        <p className="text-gray-600">
          Configure a integração com Google Gemini para análise inteligente de incidentes
        </p>
      </div>

      {/* API Key Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-4">
          <Key className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">API Key do Google Gemini</h3>
        </div>

        <div className="space-y-4">
          {savedApiKey && (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-sm text-green-800">
                API Key configurada: {savedApiKey}
              </span>
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isTesting ? (
                  <span className="flex items-center">
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Testando...
                  </span>
                ) : (
                  'Testar Conexão'
                )}
              </button>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {savedApiKey ? 'Atualizar API Key' : 'Inserir API Key'}
            </label>
            <div className="flex space-x-2">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Insira sua API key do Gemini"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {showApiKey ? '🙈' : '👁️'}
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={isLoading || !apiKey.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Obtenha sua API key gratuita em{' '}
              <a
                href="https://makersuite.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {testStatus !== 'idle' && (
            <div className={`p-3 rounded-lg ${
              testStatus === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {testMessage}
            </div>
          )}
        </div>
      </div>

      {/* Budget Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-4">
          <DollarSign className="w-5 h-5 text-gray-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Controlo de Custos</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Aprovação Automática (USD)
            </label>
            <input
              type="number"
              value={autoApproveLimit}
              onChange={(e) => setAutoApproveLimit(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Operações abaixo deste valor são aprovadas automaticamente
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limite Diário (USD)
            </label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              step="1"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Limite Mensal (USD)
            </label>
            <input
              type="number"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              step="10"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="requireAuth"
              checked={requireAuth}
              onChange={(e) => setRequireAuth(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="requireAuth" className="text-sm text-gray-700">
              Requerer autorização para todas as operações de IA
            </label>
          </div>
        </div>

        <button
          onClick={handleSaveBudgets}
          disabled={isLoading}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          Guardar Configurações de Orçamento
        </button>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              Privacidade e Segurança
            </h4>
            <p className="text-sm text-blue-800">
              • A API key é armazenada localmente de forma segura<br />
              • Os dados são enviados para o Google Gemini apenas com sua autorização<br />
              • Você pode revisar todos os dados antes do envio<br />
              • A aplicação funciona completamente sem IA (modo offline)
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Info */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">
          Preços Aproximados (Gemini Pro)
        </h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Input: $0.00025 por 1K tokens (~750 palavras)</p>
          <p>• Output: $0.00125 por 1K tokens (~750 palavras)</p>
          <p>• Análise típica: $0.01 - $0.03</p>
          <p>• Primeiros 60 pedidos/minuto: Gratuito</p>
        </div>
      </div>
    </div>
  );
};

export default AISettings;