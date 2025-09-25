/**
 * Windows Auth IPC Handlers
 * Gerencia autenticação Windows no main process do Electron
 */

const { ipcMain, safeStorage } = require('electron');
const { WindowsAuthService } = require('../../auth/WindowsAuthService');
const Store = require('electron-store');

// Inicializa store seguro para tokens
const secureStore = new Store({
  name: 'auth-secure',
  encryptionKey: 'windows-auth-encryption-key',
});

// Inicializa serviço de autenticação
const windowsAuth = new WindowsAuthService();

/**
 * Configura handlers IPC para autenticação
 */
function setupAuthHandlers() {
  // Handler para login
  ipcMain.handle('windows-auth:login', async event => {
    try {
      console.log('📱 Requisição de login recebida');

      const result = await windowsAuth.loginWithWindows();

      if (result.success) {
        // Salva token de forma segura
        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(result.token);
          secureStore.set('auth_token', encrypted.toString('base64'));
        } else {
          // Fallback para store normal
          secureStore.set('auth_token', result.token);
        }

        // Salva dados do usuário
        secureStore.set('user_data', result.user);

        // Notifica todas as janelas
        event.sender.send('auth-state-changed', {
          authenticated: true,
          user: result.user,
        });
      }

      return result;
    } catch (error) {
      console.error('❌ Erro no login:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Handler para verificar status
  ipcMain.handle('windows-auth:status', async event => {
    try {
      const token = getStoredToken();

      if (!token) {
        return {
          authenticated: false,
          message: 'Sem token armazenado',
        };
      }

      const result = await windowsAuth.checkAuthentication(token);
      return result;
    } catch (error) {
      return {
        authenticated: false,
        error: error.message,
      };
    }
  });

  // Handler para logout
  ipcMain.handle('windows-auth:logout', async event => {
    try {
      const token = getStoredToken();

      if (token) {
        await windowsAuth.logout(token);
      }

      // Limpa dados armazenados
      secureStore.delete('auth_token');
      secureStore.delete('user_data');

      // Notifica todas as janelas
      event.sender.send('auth-state-changed', {
        authenticated: false,
        user: null,
      });

      return {
        success: true,
        message: 'Logout realizado',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // Handler para obter token
  ipcMain.handle('windows-auth:get-token', async event => {
    return getStoredToken();
  });

  // Handler para salvar token
  ipcMain.handle('windows-auth:save-token', async (event, token) => {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(token);
        secureStore.set('auth_token', encrypted.toString('base64'));
      } else {
        secureStore.set('auth_token', token);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handler para obter dados do usuário
  ipcMain.handle('windows-auth:get-user', async event => {
    return secureStore.get('user_data', null);
  });

  // Handler para renovar token
  ipcMain.handle('windows-auth:refresh', async event => {
    try {
      const currentToken = getStoredToken();

      if (!currentToken) {
        // Se não tem token, faz login novo
        return await windowsAuth.loginWithWindows();
      }

      // Verifica se token ainda é válido
      const status = await windowsAuth.checkAuthentication(currentToken);

      if (!status.authenticated) {
        // Token expirado, faz login novo
        return await windowsAuth.loginWithWindows();
      }

      return {
        success: true,
        message: 'Token ainda válido',
        user: status.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  console.log('✅ Windows Auth IPC handlers configurados');
}

/**
 * Obtém token armazenado e descriptografa se necessário
 */
function getStoredToken() {
  try {
    const storedToken = secureStore.get('auth_token');

    if (!storedToken) {
      return null;
    }

    // Tenta descriptografar se estiver criptografado
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const buffer = Buffer.from(storedToken, 'base64');
        return safeStorage.decryptString(buffer);
      } catch {
        // Se falhar, assume que não está criptografado
        return storedToken;
      }
    }

    return storedToken;
  } catch (error) {
    console.error('Erro ao obter token:', error);
    return null;
  }
}

/**
 * Verifica periodicamente a validade do token
 */
function startTokenMonitor(mainWindow) {
  setInterval(async () => {
    const token = getStoredToken();

    if (token) {
      const status = await windowsAuth.checkAuthentication(token);

      if (!status.authenticated) {
        // Token expirou
        console.log('⏰ Token expirou, notificando janela...');

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('session-expired');
        }

        // Limpa dados
        secureStore.delete('auth_token');
        secureStore.delete('user_data');
      }
    }
  }, 60000); // Verifica a cada minuto
}

/**
 * Limpa dados de autenticação ao fechar aplicação
 */
function cleanupOnExit() {
  // Opcional: limpar tokens ao sair
  // secureStore.clear();
  console.log('🧹 Limpeza de autenticação realizada');
}

module.exports = {
  setupAuthHandlers,
  startTokenMonitor,
  cleanupOnExit,
  getStoredToken,
};
