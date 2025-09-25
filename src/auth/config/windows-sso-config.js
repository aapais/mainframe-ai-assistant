/**
 * Windows Integrated Authentication SSO Configuration
 * Funciona com qualquer empresa que use Microsoft/Azure AD
 */

const os = require('os');

// Configuração dinâmica baseada no ambiente
const getWindowsConfig = () => {
  // Detecta o domínio do Windows automaticamente
  const userInfo = os.userInfo();
  const hostname = os.hostname();

  // Extrai o domínio do hostname (ex: USER.ACCENTURE.COM -> ACCENTURE)
  const domain = process.env.USERDOMAIN || hostname.split('.')[1] || 'WORKGROUP';

  return {
    // Configuração Azure AD genérica para qualquer tenant
    azure: {
      // Tenant ID será detectado automaticamente ou configurado por empresa
      tenantId: process.env.AZURE_TENANT_ID || 'organizations', // 'organizations' permite multi-tenant
      clientId: process.env.AZURE_CLIENT_ID || '{client-id-será-gerado}',
      clientSecret: process.env.AZURE_CLIENT_SECRET || '',

      // URLs padrão da Microsoft que funcionam para qualquer organização
      authorizationURL: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'organizations'}/oauth2/v2.0/authorize`,
      tokenURL: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'organizations'}/oauth2/v2.0/token`,
      userInfoURL: 'https://graph.microsoft.com/v1.0/me',

      // Scopes necessários
      scopes: [
        'openid',
        'profile',
        'email',
        'User.Read',
        'offline_access' // Para refresh tokens
      ],

      // Configurações de autenticação
      responseType: 'code',
      responseMode: 'query',
      prompt: 'select_account', // Permite escolher conta se houver múltiplas

      // Permite login com Windows Integrated Auth
      allowIntegratedAuth: true,

      // Callback URL dinâmico
      redirectUri: process.env.AZURE_REDIRECT_URI || `http://localhost:3001/api/auth/sso/microsoft/callback`
    },

    // Informações do Windows local
    windows: {
      username: userInfo.username,
      domain: domain,
      computerName: hostname,

      // Detecta se está em domínio corporativo
      isInDomain: domain !== 'WORKGROUP' && domain !== hostname,

      // User Principal Name (UPN) - formato: usuario@empresa.com
      upn: process.env.USERNAME ?
        `${process.env.USERNAME}@${domain.toLowerCase()}.com` :
        `${userInfo.username}@${domain.toLowerCase()}.com`
    },

    // Configuração de Single Sign-On
    sso: {
      // Auto-login se já autenticado no Windows
      autoLogin: true,

      // Usar Kerberos/NTLM para autenticação integrada
      integratedAuth: true,

      // Permitir fallback para login manual
      allowManualLogin: true,

      // Cache de credenciais (em segundos)
      sessionTimeout: 28800, // 8 horas

      // Renovação automática de token
      autoRenewToken: true
    }
  };
};

// Função para obter token usando credenciais do Windows
async function getWindowsAuthToken() {
  const config = getWindowsConfig();

  if (!config.windows.isInDomain) {
    console.log('⚠️ Computador não está em domínio. Usando login manual.');
    return null;
  }

  // Em produção, isso usaria node-sspi ou similar para autenticação Windows
  // Por agora, retorna as informações disponíveis
  return {
    method: 'windows_integrated',
    user: config.windows.upn,
    domain: config.windows.domain,
    authenticated: true
  };
}

// Função para registrar app no Azure AD (executar uma vez por empresa)
function getAzureADSetupInstructions(companyName) {
  return `
=================================================================
CONFIGURAÇÃO AZURE AD PARA ${companyName.toUpperCase()}
=================================================================

1. REGISTRAR APLICAÇÃO NO AZURE AD:
   - Acesse: https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps
   - Clique em "New registration"
   - Nome: "Mainframe AI Assistant - ${companyName}"
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: http://localhost:3001/api/auth/sso/microsoft/callback

2. CONFIGURAR AUTENTICAÇÃO:
   - Em "Authentication", adicione:
     * Platform: Web
     * Redirect URIs:
       - http://localhost:3001/api/auth/sso/microsoft/callback
       - https://seu-servidor.com/api/auth/sso/microsoft/callback
     * Implicit grant: Marque "ID tokens" e "Access tokens"
     * Supported account types: "Single tenant" ou "Multitenant"

3. CRIAR CLIENT SECRET:
   - Em "Certificates & secrets"
   - New client secret
   - Copie o valor (só aparece uma vez!)

4. PERMISSÕES API:
   - Em "API permissions"
   - Add permission > Microsoft Graph:
     * User.Read (Delegated)
     * Profile (Delegated)
     * Email (Delegated)
     * OpenId (Delegated)
   - Grant admin consent

5. CONFIGURAR .env:
   AZURE_TENANT_ID=<seu-tenant-id>
   AZURE_CLIENT_ID=<application-id>
   AZURE_CLIENT_SECRET=<secret-value>

6. PARA WINDOWS INTEGRATED AUTH:
   - Em "Authentication" > "Advanced settings"
   - Enable "Integrated Windows Authentication"
   - Add your domain to "Trusted domains"

=================================================================
`;
}

// Middleware para autenticação Windows integrada
function windowsAuthMiddleware(req, res, next) {
  const config = getWindowsConfig();

  // Se está em domínio e tem header de autenticação Windows
  if (config.windows.isInDomain && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];

    // NTLM/Kerberos authentication
    if (authHeader.startsWith('NTLM ') || authHeader.startsWith('Negotiate ')) {
      // Em produção, validaria o token NTLM/Kerberos
      req.windowsUser = {
        authenticated: true,
        username: config.windows.username,
        domain: config.windows.domain,
        upn: config.windows.upn
      };
    }
  }

  next();
}

// Exporta configurações e funções
module.exports = {
  getWindowsConfig,
  getWindowsAuthToken,
  getAzureADSetupInstructions,
  windowsAuthMiddleware,

  // Configuração pronta para uso
  config: getWindowsConfig()
};