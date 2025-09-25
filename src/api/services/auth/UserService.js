const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { DatabaseManager } = require('../../../database/DatabaseManager');
const { SecureKeyManager } = require('../../../auth/services/SecureKeyManager');
const { Logger } = require('../../../utils/Logger');

const logger = new Logger('UserService');

class UserService {
  constructor() {
    this.db = DatabaseManager.getInstance();
    this.keyManager = SecureKeyManager.getInstance();
  }

  // User CRUD operations
  async createUser(userData) {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        role,
        department,
        phoneNumber,
        timezone,
        language,
      } = userData;

      // Check if user already exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser) {
        throw new Error('Usuário com este email já existe');
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Generate user ID
      const userId = uuidv4();

      // Create user object
      const newUser = {
        id: userId,
        email,
        passwordHash,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        role,
        department,
        phoneNumber,
        timezone: timezone || 'America/Sao_Paulo',
        language: language || 'pt-BR',
        isActive: true,
        emailVerified: false,
        mfaEnabled: false,
        loginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLogin: null,
        lastPasswordChange: new Date(),
        permissions: this.getDefaultPermissions(role),
      };

      // Store in database (implement actual DB logic)
      await this.storeUser(newUser);

      logger.info(`Usuário criado: ${email} (${role})`);

      // Return user without password hash
      const { passwordHash: _, ...userResponse } = newUser;
      return userResponse;
    } catch (error) {
      logger.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  async getUserById(userId) {
    try {
      // Implement database query
      const user = await this.queryUser('id', userId);
      if (!user) return null;

      // Remove sensitive data
      const { passwordHash, ...userResponse } = user;
      return userResponse;
    } catch (error) {
      logger.error(`Erro ao buscar usuário ${userId}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email) {
    try {
      return await this.queryUser('email', email);
    } catch (error) {
      logger.error(`Erro ao buscar usuário por email ${email}:`, error);
      throw error;
    }
  }

  async updateUser(userId, updateData) {
    try {
      const existingUser = await this.queryUser('id', userId);
      if (!existingUser) {
        throw new Error('Usuário não encontrado');
      }

      const updatedUser = {
        ...existingUser,
        ...updateData,
        fullName:
          updateData.firstName || updateData.lastName
            ? `${updateData.firstName || existingUser.firstName} ${updateData.lastName || existingUser.lastName}`
            : existingUser.fullName,
        updatedAt: new Date(),
      };

      await this.updateUserInDB(userId, updatedUser);

      logger.info(`Usuário atualizado: ${userId}`);

      const { passwordHash, ...userResponse } = updatedUser;
      return userResponse;
    } catch (error) {
      logger.error(`Erro ao atualizar usuário ${userId}:`, error);
      throw error;
    }
  }

  async deleteUser(userId) {
    try {
      const user = await this.queryUser('id', userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Soft delete - mark as inactive instead of hard delete
      await this.updateUserInDB(userId, {
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      });

      // Invalidate all user sessions
      await this.invalidateAllUserSessions(userId);

      // Deactivate API keys
      await this.deactivateUserApiKeys(userId);

      logger.info(`Usuário deletado (soft delete): ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao deletar usuário ${userId}:`, error);
      throw error;
    }
  }

  async getUsers(query = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        role,
        isActive,
        department,
        createdAfter,
        createdBefore,
        lastLoginAfter,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = query;

      const offset = (page - 1) * limit;

      // Build query conditions
      const conditions = [];
      const params = [];

      if (search) {
        conditions.push('(firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (role) {
        conditions.push('role = ?');
        params.push(role);
      }

      if (typeof isActive === 'boolean') {
        conditions.push('isActive = ?');
        params.push(isActive);
      }

      if (department) {
        conditions.push('department = ?');
        params.push(department);
      }

      if (createdAfter) {
        conditions.push('createdAt >= ?');
        params.push(createdAfter);
      }

      if (createdBefore) {
        conditions.push('createdAt <= ?');
        params.push(createdBefore);
      }

      if (lastLoginAfter) {
        conditions.push('lastLogin >= ?');
        params.push(lastLoginAfter);
      }

      // Execute query (implement actual DB logic)
      const users = await this.queryUsers(conditions, params, {
        offset,
        limit,
        sortBy,
        sortOrder,
      });

      const total = await this.countUsers(conditions, params);

      // Remove sensitive data
      const sanitizedUsers = users.map(user => {
        const { passwordHash, ...userResponse } = user;
        return userResponse;
      });

      return {
        users: sanitizedUsers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Erro ao buscar usuários:', error);
      throw error;
    }
  }

  // Password management
  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.queryUser('id', userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Senha atual incorreta');
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      await this.updateUserInDB(userId, {
        passwordHash: newPasswordHash,
        lastPasswordChange: new Date(),
        updatedAt: new Date(),
      });

      // Invalidate all sessions except current (if session management is implemented)
      await this.invalidateOtherUserSessions(userId);

      logger.info(`Senha alterada para usuário: ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Erro ao alterar senha do usuário ${userId}:`, error);
      throw error;
    }
  }

  async resetPasswordRequest(email) {
    try {
      const user = await this.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists - security best practice
        logger.warn(`Tentativa de reset de senha para email inexistente: ${email}`);
        return true; // Return success anyway
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token
      await this.storePasswordResetToken(user.id, resetToken, resetTokenExpiry);

      // Send reset email (implement email service)
      await this.sendPasswordResetEmail(email, resetToken);

      logger.info(`Token de reset de senha gerado para: ${email}`);
      return true;
    } catch (error) {
      logger.error('Erro na solicitação de reset de senha:', error);
      throw error;
    }
  }

  async resetPasswordComplete(token, newPassword) {
    try {
      const resetData = await this.getPasswordResetToken(token);
      if (!resetData || resetData.expiresAt < new Date()) {
        throw new Error('Token inválido ou expirado');
      }

      // Hash new password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update user password
      await this.updateUserInDB(resetData.userId, {
        passwordHash,
        lastPasswordChange: new Date(),
        updatedAt: new Date(),
      });

      // Remove reset token
      await this.removePasswordResetToken(token);

      // Invalidate all user sessions
      await this.invalidateAllUserSessions(resetData.userId);

      logger.info(`Password reset completado para usuário: ${resetData.userId}`);
      return true;
    } catch (error) {
      logger.error('Erro ao completar reset de senha:', error);
      throw error;
    }
  }

  // Bulk operations
  async bulkUserOperation(operation, userIds, parameters = {}) {
    try {
      const results = {
        success: [],
        failed: [],
      };

      for (const userId of userIds) {
        try {
          switch (operation) {
            case 'activate':
              await this.updateUserInDB(userId, { isActive: true, updatedAt: new Date() });
              results.success.push(userId);
              break;

            case 'deactivate':
              await this.updateUserInDB(userId, { isActive: false, updatedAt: new Date() });
              await this.invalidateAllUserSessions(userId);
              results.success.push(userId);
              break;

            case 'delete':
              await this.deleteUser(userId);
              results.success.push(userId);
              break;

            case 'updateRole':
              if (!parameters.role) throw new Error('Role não especificado');
              await this.updateUserInDB(userId, {
                role: parameters.role,
                permissions: this.getDefaultPermissions(parameters.role),
                updatedAt: new Date(),
              });
              results.success.push(userId);
              break;

            case 'resetPassword':
              const user = await this.queryUser('id', userId);
              if (user) {
                await this.resetPasswordRequest(user.email);
                results.success.push(userId);
              }
              break;

            default:
              throw new Error(`Operação não suportada: ${operation}`);
          }
        } catch (error) {
          results.failed.push({ userId, error: error.message });
        }
      }

      logger.info(
        `Operação bulk ${operation} executada: ${results.success.length} sucessos, ${results.failed.length} falhas`
      );
      return results;
    } catch (error) {
      logger.error('Erro na operação bulk:', error);
      throw error;
    }
  }

  // Helper methods
  getDefaultPermissions(role) {
    const permissionsByRole = {
      admin: ['read', 'write', 'admin', 'user_management', 'system_config'],
      analyst: ['read', 'write', 'incident_analysis', 'report_generation'],
      user: ['read', 'basic_search'],
    };

    return permissionsByRole[role] || ['read'];
  }

  // Database helper methods (implement with actual DB)
  async storeUser(user) {
    // Implement database storage
    logger.info('Storing user in database (implementation needed)');
  }

  async queryUser(field, value) {
    // Implement database query
    logger.info(`Querying user by ${field} (implementation needed)`);

    // Mock data for development
    if (field === 'email' && value === 'admin@banco.com') {
      return {
        id: '1',
        email: 'admin@banco.com',
        passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj0gPi.F4VZi',
        firstName: 'Admin',
        lastName: 'Sistema',
        fullName: 'Admin Sistema',
        role: 'admin',
        isActive: true,
        permissions: ['read', 'write', 'admin'],
      };
    }
    return null;
  }

  async queryUsers(conditions, params, options) {
    // Implement database query
    logger.info('Querying users with conditions (implementation needed)');
    return [];
  }

  async countUsers(conditions, params) {
    // Implement count query
    return 0;
  }

  async updateUserInDB(userId, data) {
    // Implement database update
    logger.info(`Updating user ${userId} in database (implementation needed)`);
  }

  async invalidateAllUserSessions(userId) {
    // Implement session invalidation
    logger.info(`Invalidating all sessions for user ${userId} (implementation needed)`);
  }

  async invalidateOtherUserSessions(userId) {
    // Implement session invalidation except current
    logger.info(`Invalidating other sessions for user ${userId} (implementation needed)`);
  }

  async deactivateUserApiKeys(userId) {
    // Implement API key deactivation
    logger.info(`Deactivating API keys for user ${userId} (implementation needed)`);
  }

  async storePasswordResetToken(userId, token, expiresAt) {
    // Implement token storage
    logger.info(`Storing password reset token for user ${userId} (implementation needed)`);
  }

  async getPasswordResetToken(token) {
    // Implement token retrieval
    logger.info(`Retrieving password reset token (implementation needed)`);
    return null;
  }

  async removePasswordResetToken(token) {
    // Implement token removal
    logger.info(`Removing password reset token (implementation needed)`);
  }

  async sendPasswordResetEmail(email, token) {
    // Implement email sending
    logger.info(`Sending password reset email to ${email} (implementation needed)`);
  }
}

module.exports = { UserService };
