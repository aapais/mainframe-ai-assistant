const express = require('express');
const { SecureKeyManager } = require('../../auth/services/SecureKeyManager');

const router = express.Router();
const keyManager = SecureKeyManager.getInstance();

// Get user profile
router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilizador não encontrado'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        displayName: user.display_name,
        role: user.role,
        permissions: JSON.parse(user.permissions || '[]'),
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter perfil do utilizador'
    });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, displayName } = req.body;

    // Update user profile (implement actual database update)
    const updated = await updateUserProfile(userId, {
      firstName,
      lastName,
      displayName
    });

    if (updated) {
      res.json({
        success: true,
        message: 'Perfil actualizado com sucesso'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Erro ao actualizar perfil'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
});

// Get user preferences
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.userId;

    const preferences = await keyManager.retrieveUserPreferences(userId);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter preferências'
    });
  }
});

// Update user preferences
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.userId;
    const preferences = req.body;

    await keyManager.storeUserPreferences(userId, preferences);

    res.json({
      success: true,
      message: 'Preferências guardadas com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao guardar preferências'
    });
  }
});

// Get user API keys
router.get('/api-keys', async (req, res) => {
  try {
    const userId = req.user.userId;

    const keys = await keyManager.getUserAPIKeys(userId);

    res.json({
      success: true,
      keys
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter chaves API'
    });
  }
});

// Create new API key
router.post('/api-keys', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { keyName, apiKey, provider, permissions } = req.body;

    const keyId = await keyManager.storeAPIKey(
      userId,
      keyName,
      apiKey,
      provider,
      permissions || []
    );

    res.json({
      success: true,
      message: 'Chave API criada com sucesso',
      keyId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete API key
router.delete('/api-keys/:keyId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { keyId } = req.params;

    await keyManager.deleteAPIKey(userId, keyId);

    res.json({
      success: true,
      message: 'Chave API eliminada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user sessions
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Implement session retrieval from database
    const sessions = await getUserSessions(userId);

    res.json({
      success: true,
      sessions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter sessões'
    });
  }
});

// Revoke session
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { sessionId } = req.params;

    await revokeUserSession(userId, sessionId);

    res.json({
      success: true,
      message: 'Sessão revogada com sucesso'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao revogar sessão'
    });
  }
});

// Helper functions (implement these with actual database operations)
async function getUserById(userId) {
  // Implement actual database query
  return null;
}

async function updateUserProfile(userId, data) {
  // Implement actual database update
  return true;
}

async function getUserSessions(userId) {
  // Implement actual database query
  return [];
}

async function revokeUserSession(userId, sessionId) {
  // Implement actual database update
  return true;
}

module.exports = router;