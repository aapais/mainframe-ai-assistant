const EventEmitter = require('events');
const WebSocket = require('ws');
const { Logger } = require('../../utils/Logger');

/**
 * Serviço de notificações em tempo real
 */
class NotificationService extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      port: 8080,
      enableEmail: true,
      enableSMS: false,
      enableSlack: false,
      enableWebhooks: true,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config,
    };

    this.logger = new Logger('NotificationService');
    this.clients = new Map(); // WebSocket clients
    this.subscriptions = new Map(); // User subscriptions
    this.webhooks = new Map(); // Registered webhooks
    this.wss = null;
    this.isInitialized = false;
  }

  /**
   * Inicializar serviço
   */
  async initialize() {
    try {
      this.logger.info('Inicializando NotificationService...');

      // Inicializar WebSocket server
      await this.initializeWebSocketServer();

      // Configurar handlers de eventos
      this.setupEventHandlers();

      this.isInitialized = true;
      this.logger.info('NotificationService inicializado com sucesso');
    } catch (error) {
      this.logger.error('Erro ao inicializar NotificationService:', error);
      throw error;
    }
  }

  /**
   * Inicializar servidor WebSocket
   */
  async initializeWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocket.Server({
          port: this.config.port,
          path: '/notifications',
        });

        this.wss.on('connection', (ws, req) => {
          this.handleNewConnection(ws, req);
        });

        this.wss.on('error', error => {
          this.logger.error('Erro no WebSocket server:', error);
          reject(error);
        });

        this.wss.on('listening', () => {
          this.logger.info(`WebSocket server rodando na porta ${this.config.port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Manipular nova conexão WebSocket
   */
  handleNewConnection(ws, req) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date().toISOString(),
      userId: null,
      subscriptions: new Set(),
    };

    this.clients.set(clientId, clientInfo);
    this.logger.info(`Nova conexão WebSocket: ${clientId} de ${clientInfo.ip}`);

    // Configurar handlers da conexão
    ws.on('message', message => {
      this.handleMessage(clientId, message);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', error => {
      this.logger.error(`Erro na conexão ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    // Enviar mensagem de boas-vindas
    this.sendToClient(clientId, {
      type: 'connection',
      message: 'Conectado ao serviço de notificações',
      clientId,
    });
  }

  /**
   * Manipular mensagens recebidas
   */
  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message.toString());
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (data.type) {
        case 'auth':
          this.authenticateClient(clientId, data.token);
          break;

        case 'subscribe':
          this.subscribeClient(clientId, data.channels);
          break;

        case 'unsubscribe':
          this.unsubscribeClient(clientId, data.channels);
          break;

        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: Date.now() });
          break;

        default:
          this.logger.warn(`Tipo de mensagem desconhecido de ${clientId}: ${data.type}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao processar mensagem de ${clientId}:`, error);
    }
  }

  /**
   * Autenticar cliente
   */
  async authenticateClient(clientId, token) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Verificar token (integrar com sistema de auth)
      const user = await this.verifyToken(token);

      if (user) {
        client.userId = user.id;
        client.userRole = user.role;

        // Subscrever a canais padrão baseado no role
        const defaultChannels = this.getDefaultChannels(user.role);
        client.subscriptions = new Set(defaultChannels);

        this.sendToClient(clientId, {
          type: 'auth_success',
          user: {
            id: user.id,
            name: user.name,
            role: user.role,
          },
          subscriptions: Array.from(client.subscriptions),
        });

        this.logger.info(`Cliente ${clientId} autenticado como usuário ${user.id}`);
      } else {
        this.sendToClient(clientId, {
          type: 'auth_error',
          message: 'Token inválido',
        });
      }
    } catch (error) {
      this.logger.error(`Erro na autenticação do cliente ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'auth_error',
        message: 'Erro interno na autenticação',
      });
    }
  }

  /**
   * Subscrever cliente a canais
   */
  subscribeClient(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = this.validateChannels(channels, client.userRole);

    validChannels.forEach(channel => {
      client.subscriptions.add(channel);
    });

    this.sendToClient(clientId, {
      type: 'subscription_updated',
      subscriptions: Array.from(client.subscriptions),
    });

    this.logger.info(`Cliente ${clientId} subscrito a: ${validChannels.join(', ')}`);
  }

  /**
   * Desinscrever cliente de canais
   */
  unsubscribeClient(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    channels.forEach(channel => {
      client.subscriptions.delete(channel);
    });

    this.sendToClient(clientId, {
      type: 'subscription_updated',
      subscriptions: Array.from(client.subscriptions),
    });

    this.logger.info(`Cliente ${clientId} desinscrito de: ${channels.join(', ')}`);
  }

  /**
   * Manipular desconexão
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      this.logger.info(
        `Cliente ${clientId} desconectado (usuário: ${client.userId || 'não autenticado'})`
      );
      this.clients.delete(clientId);
    }
  }

  /**
   * Notificar processamento de incidente
   */
  async notifyIncidentProcessed(incidentResult) {
    try {
      const notification = {
        type: 'incident_processed',
        data: {
          incidentId: incidentResult.incidentId,
          status: incidentResult.status,
          category: incidentResult.category,
          processingTime: incidentResult.processingTime,
          timestamp: incidentResult.timestamp,
        },
        timestamp: new Date().toISOString(),
      };

      // Notificar via WebSocket
      await this.broadcastToChannel('incidents', notification);

      // Notificar via email se configurado
      if (this.config.enableEmail) {
        await this.sendEmailNotification(notification);
      }

      // Notificar via webhooks
      if (this.config.enableWebhooks) {
        await this.triggerWebhooks('incident_processed', notification);
      }

      this.logger.info(`Notificação enviada para incidente ${incidentResult.incidentId}`);
    } catch (error) {
      this.logger.error('Erro ao notificar processamento de incidente:', error);
    }
  }

  /**
   * Notificar feedback recebido
   */
  async notifyFeedbackReceived(feedbackData) {
    try {
      const notification = {
        type: 'feedback_received',
        data: feedbackData,
        timestamp: new Date().toISOString(),
      };

      await this.broadcastToChannel('feedback', notification);

      this.logger.info(`Notificação de feedback enviada para incidente ${feedbackData.incidentId}`);
    } catch (error) {
      this.logger.error('Erro ao notificar feedback:', error);
    }
  }

  /**
   * Notificar alertas do sistema
   */
  async notifySystemAlert(alertData) {
    try {
      const notification = {
        type: 'system_alert',
        data: alertData,
        timestamp: new Date().toISOString(),
        priority: alertData.priority || 'medium',
      };

      // Admins recebem todos os alertas
      await this.broadcastToRole('admin', notification);

      // Alertas críticos vão para todos
      if (alertData.priority === 'critical') {
        await this.broadcastToChannel('alerts', notification);
      }

      this.logger.warn(`Alerta do sistema enviado: ${alertData.message}`);
    } catch (error) {
      this.logger.error('Erro ao notificar alerta:', error);
    }
  }

  /**
   * Broadcast para canal específico
   */
  async broadcastToChannel(channel, notification) {
    const message = JSON.stringify(notification);
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          this.logger.error(`Erro ao enviar para cliente ${clientId}:`, error);
        }
      }
    }

    this.logger.info(`Broadcast para canal '${channel}': ${sentCount} clientes`);
  }

  /**
   * Broadcast para role específico
   */
  async broadcastToRole(role, notification) {
    const message = JSON.stringify(notification);
    let sentCount = 0;

    for (const [clientId, client] of this.clients) {
      if (client.userRole === role && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
          sentCount++;
        } catch (error) {
          this.logger.error(`Erro ao enviar para cliente ${clientId}:`, error);
        }
      }
    }

    this.logger.info(`Broadcast para role '${role}': ${sentCount} clientes`);
  }

  /**
   * Enviar para cliente específico
   */
  sendToClient(clientId, notification) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(notification));
      } catch (error) {
        this.logger.error(`Erro ao enviar para cliente ${clientId}:`, error);
      }
    }
  }

  /**
   * Registrar webhook
   */
  registerWebhook(id, config) {
    this.webhooks.set(id, {
      ...config,
      registeredAt: new Date().toISOString(),
    });

    this.logger.info(`Webhook registrado: ${id} -> ${config.url}`);
  }

  /**
   * Disparar webhooks
   */
  async triggerWebhooks(event, data) {
    const promises = [];

    for (const [id, webhook] of this.webhooks) {
      if (!webhook.events || webhook.events.includes(event)) {
        promises.push(this.callWebhook(id, webhook, data));
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Chamar webhook específico
   */
  async callWebhook(id, webhook, data) {
    try {
      const fetch = require('node-fetch'); // Ou usar axios

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Id': id,
          ...webhook.headers,
        },
        body: JSON.stringify(data),
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.logger.info(`Webhook ${id} chamado com sucesso`);
    } catch (error) {
      this.logger.error(`Erro no webhook ${id}:`, error);
    }
  }

  /**
   * Enviar notificação por email
   */
  async sendEmailNotification(notification) {
    // Implementar integração com serviço de email (SendGrid, SES, etc.)
    this.logger.info('Notificação por email enviada (mock)');
  }

  /**
   * Verificar token de autenticação
   */
  async verifyToken(token) {
    // Implementar verificação real de token
    // Por ora, simulação
    if (token === 'admin_token') {
      return { id: '1', name: 'Admin', role: 'admin' };
    }
    return null;
  }

  /**
   * Obter canais padrão por role
   */
  getDefaultChannels(role) {
    const channelsByRole = {
      admin: ['incidents', 'alerts', 'feedback', 'system'],
      analyst: ['incidents', 'feedback'],
      user: ['incidents'],
    };

    return channelsByRole[role] || ['incidents'];
  }

  /**
   * Validar canais permitidos
   */
  validateChannels(channels, userRole) {
    const allowedChannels = this.getDefaultChannels(userRole);
    return channels.filter(channel => allowedChannels.includes(channel));
  }

  /**
   * Gerar ID de cliente
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Configurar handlers de eventos
   */
  setupEventHandlers() {
    // Cleanup de conexões mortas a cada 30 segundos
    setInterval(() => {
      this.cleanupDeadConnections();
    }, 30000);
  }

  /**
   * Limpar conexões mortas
   */
  cleanupDeadConnections() {
    let cleaned = 0;

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState !== WebSocket.OPEN) {
        this.clients.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.info(`${cleaned} conexões mortas removidas`);
    }
  }

  /**
   * Obter estatísticas do serviço
   */
  getStats() {
    const stats = {
      totalClients: this.clients.size,
      authenticatedClients: 0,
      connectionsByRole: {},
      subscriptionsByChannel: {},
      totalWebhooks: this.webhooks.size,
    };

    for (const client of this.clients.values()) {
      if (client.userId) {
        stats.authenticatedClients++;

        const role = client.userRole || 'unknown';
        stats.connectionsByRole[role] = (stats.connectionsByRole[role] || 0) + 1;

        for (const channel of client.subscriptions) {
          stats.subscriptionsByChannel[channel] = (stats.subscriptionsByChannel[channel] || 0) + 1;
        }
      }
    }

    return stats;
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const stats = this.getStats();

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        stats,
        wsServerRunning: this.wss && this.wss.readyState === WebSocket.OPEN,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Shutdown graceful
   */
  async shutdown() {
    try {
      this.logger.info('Iniciando shutdown do NotificationService...');

      // Fechar todas as conexões
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1000, 'Server shutdown');
        }
      }

      // Fechar servidor WebSocket
      if (this.wss) {
        this.wss.close();
      }

      this.clients.clear();
      this.webhooks.clear();

      this.logger.info('NotificationService finalizado');
    } catch (error) {
      this.logger.error('Erro no shutdown:', error);
      throw error;
    }
  }
}

module.exports = { NotificationService };
