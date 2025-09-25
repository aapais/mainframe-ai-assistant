/**
 * Windows Auth Preload for Electron
 * Expõe APIs de autenticação Windows para o renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// Expõe APIs de autenticação Windows
contextBridge.exposeInMainWorld('windowsAuth', {
  // Obtém informações do usuário Windows
  getCurrentUser: () => {
    const userInfo = os.userInfo();
    const hostname = os.hostname();
    const domain = process.env.USERDOMAIN || hostname.split('.')[0] || 'LOCAL';

    return {
      username: userInfo.username,
      domain: domain,
      computer: hostname,
      isInDomain: domain !== 'WORKGROUP' && domain !== hostname,
      upn: `${userInfo.username}@${domain.toLowerCase()}.local`,
      home: userInfo.homedir
    };
  },

  // Login automático com Windows
  login: async () => {
    return await ipcRenderer.invoke('windows-auth:login');
  },

  // Verifica status de autenticação
  checkStatus: async () => {
    return await ipcRenderer.invoke('windows-auth:status');
  },

  // Logout
  logout: async () => {
    return await ipcRenderer.invoke('windows-auth:logout');
  },

  // Obtém token salvo
  getToken: async () => {
    return await ipcRenderer.invoke('windows-auth:get-token');
  },

  // Salva token
  saveToken: async (token) => {
    return await ipcRenderer.invoke('windows-auth:save-token', token);
  },

  // Listeners para eventos de autenticação
  onAuthStateChanged: (callback) => {
    ipcRenderer.on('auth-state-changed', (event, data) => callback(data));
  },

  onSessionExpired: (callback) => {
    ipcRenderer.on('session-expired', (event) => callback());
  },

  // Remove listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('auth-state-changed');
    ipcRenderer.removeAllListeners('session-expired');
  }
});

// Expõe informações do ambiente
contextBridge.exposeInMainWorld('appInfo', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  nodeVersion: process.versions.node,
  chromeVersion: process.versions.chrome
});

// Auto-login ao carregar (opcional)
window.addEventListener('DOMContentLoaded', async () => {
  console.log('🔐 Windows Auth Preload carregado');

  // Verifica se deve fazer auto-login
  const autoLogin = localStorage.getItem('auto_login') !== 'false';

  if (autoLogin) {
    try {
      const token = await ipcRenderer.invoke('windows-auth:get-token');

      if (!token) {
        console.log('🔑 Tentando login automático com Windows...');
        const result = await ipcRenderer.invoke('windows-auth:login');

        if (result.success) {
          console.log('✅ Login automático realizado:', result.user.username);

          // Dispara evento para a aplicação
          window.dispatchEvent(new CustomEvent('windows-auth-success', {
            detail: result
          }));
        }
      } else {
        console.log('✅ Já autenticado com token existente');
      }
    } catch (error) {
      console.error('❌ Erro no auto-login:', error);
    }
  }
});