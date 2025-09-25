import React, { useState, useEffect } from 'react';
import './WindowsLogin.css';

/**
 * Componente de Login Windows Local
 * Funciona em Electron e Browser
 * Sem dependência de Azure AD
 */
const WindowsLogin = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isElectron, setIsElectron] = useState(false);

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    // Detecta se está rodando no Electron
    const electron = window.electron || window.require?.('electron');
    setIsElectron(!!electron);

    // Tenta login automático
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      if (token) {
        const response = await fetch(`${API_BASE}/api/auth/status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (data.authenticated) {
          setUser(data.user);
        } else {
          // Token expirado, tenta login automático
          await performWindowsLogin();
        }
      } else {
        // Sem token, tenta login automático
        await performWindowsLogin();
      }
    } catch (err) {
      setError('Erro ao verificar autenticação');
    } finally {
      setLoading(false);
    }
  };

  const performWindowsLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/auth/windows/login`);
      const data = await response.json();

      if (data.success) {
        // Salva token
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.user));

        setUser(data.user);

        // Dispara evento para outros componentes
        window.dispatchEvent(new CustomEvent('auth-success', {
          detail: { user: data.user, token: data.token }
        }));

        // Redireciona se necessário
        if (window.location.pathname === '/login') {
          window.location.href = '/';
        }
      } else {
        setError(data.error || 'Falha no login Windows');
      }
    } catch (err) {
      setError(`Erro de conexão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      // Limpa dados locais
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');

      setUser(null);

      // Dispara evento
      window.dispatchEvent(new CustomEvent('auth-logout'));

      // Redireciona para login
      window.location.href = '/login';
    } catch (err) {
      console.error('Erro ao fazer logout:', err);
    }
  };

  // Se está carregando
  if (loading) {
    return (
      <div className="windows-login-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Autenticando com Windows...</p>
        </div>
      </div>
    );
  }

  // Se tem erro
  if (error) {
    return (
      <div className="windows-login-container">
        <div className="login-card error">
          <h2>❌ Erro de Autenticação</h2>
          <p>{error}</p>
          <button onClick={performWindowsLogin} className="retry-button">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  // Se não está autenticado
  if (!user) {
    return (
      <div className="windows-login-container">
        <div className="login-card">
          <div className="logo">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="#0078d4">
              <path d="M0 3.45L9.75 2.1v9.4H0m10.95-9.55L24 0v11.4H10.95m-10.95 1.2h9.75v9.4L0 20.55m10.95 1.35L24 24V12.65H10.95"/>
            </svg>
          </div>

          <h1>Login Windows Local</h1>
          <p className="subtitle">Autenticação sem Azure AD</p>

          <div className="feature-list">
            <div className="feature">
              <span className="icon">✅</span>
              <span>Não precisa de Azure AD</span>
            </div>
            <div className="feature">
              <span className="icon">🔐</span>
              <span>Usa credenciais Windows</span>
            </div>
            <div className="feature">
              <span className="icon">⚡</span>
              <span>Login automático</span>
            </div>
            <div className="feature">
              <span className="icon">🌐</span>
              <span>Funciona offline</span>
            </div>
          </div>

          <button onClick={performWindowsLogin} className="login-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{marginRight: '10px'}}>
              <path d="M0 3.45L9.75 2.1v9.4H0m10.95-9.55L24 0v11.4H10.95m-10.95 1.2h9.75v9.4L0 20.55m10.95 1.35L24 24V12.65H10.95"/>
            </svg>
            Entrar com Windows
          </button>

          <p className="info-text">
            {isElectron ? 'Aplicação Desktop' : 'Versão Browser'}
          </p>
        </div>
      </div>
    );
  }

  // Se está autenticado
  return (
    <div className="windows-login-container authenticated">
      <div className="user-card">
        <div className="user-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>

        <div className="user-info">
          <h2>{user.displayName || user.username}</h2>
          <p className="user-email">{user.email}</p>
          <p className="user-domain">
            <span className="label">Domínio:</span> {user.domain}
          </p>
          <p className="user-computer">
            <span className="label">Computador:</span> {user.computer}
          </p>
        </div>

        <div className="auth-status">
          <span className="status-badge success">✅ Autenticado</span>
          <span className="auth-method">Windows Local</span>
        </div>

        <button onClick={handleLogout} className="logout-button">
          Sair
        </button>
      </div>
    </div>
  );
};

export default WindowsLogin;