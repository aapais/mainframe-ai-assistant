const WebSocket = require('ws');
const { EventEmitter } = require('events');
const { Logger } = require('../../utils/Logger');
const { authMiddleware } = require('../middleware/auth');

const logger = new Logger('WebSocketNotifier');

/**
 * Sistema de notificações em tempo real via WebSocket
 * Gerencia conexões e broadcasting de eventos para usuários conectados
 */
class WebSocketNotifier extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      port: options.port || 8080,
      maxConnections: options.maxConnections || 1000,
      heartbeatInterval: options.heartbeatInterval || 30000,
      ...options,
    };

    this.server = null;
    this.connections = new Map(); // userId -> Set of WebSocket connections
    this.connectionMetadata = new Map(); // connectionId -> metadata
    this.rooms = new Map(); // roomId -> Set of userIds
    this.heartbeatInterval = null;
    this.isShuttingDown = false;
    this.connectionCount = 0;
  }

  /**
   * Inicializar servidor WebSocket
   * @param {Object} httpServer - Servidor HTTP para upgrade
   */
  async initialize(httpServer = null) {
    try {
      const serverOptions = {
        port: httpServer ? undefined : this.options.port,
        server: httpServer,
        perMessageDeflate: {
          zlibDeflateOptions: {
            threshold: 1024,
            concurrencyLimit: 10,
          },
        },
        maxPayload: 64 * 1024, // 64KB
      };

      this.server = new WebSocket.Server(serverOptions);

      this.server.on('connection', (ws, request) => this.handleConnection(ws, request));
      this.server.on('error', error => this.handleServerError(error));
      this.server.on('close', () => logger.info('WebSocket server fechado'));

      // Iniciar heartbeat
      this.startHeartbeat();

      logger.info(
        `WebSocket server inicializado ${httpServer ? 'com HTTP server' : `na porta ${this.options.port}`}`
      );
    } catch (error) {
      logger.error('Erro ao inicializar WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Manipular nova conexão WebSocket
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {Object} request - Request HTTP
   */
  async handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    const clientIp = this.getClientIp(request);

    logger.info(`Nova conexão WebSocket: ${connectionId} de ${clientIp}`);

    try {
      // Verificar limite de conexões
      if (this.connectionCount >= this.options.maxConnections) {
        logger.warn(`Limite de conexões atingido: ${this.options.maxConnections}`);
        ws.close(1013, 'Servidor sobrecarregado');
        return;
      }

      // Configurar conexão
      ws.connectionId = connectionId;
      ws.connectedAt = new Date();
      ws.lastPing = new Date();
      ws.isAlive = true;
      ws.user = null;

      // Configurar handlers
      ws.on('message', data => this.handleMessage(ws, data));
      ws.on('close', (code, reason) => this.handleDisconnection(ws, code, reason));
      ws.on('error', error => this.handleConnectionError(ws, error));
      ws.on('pong', () => this.handlePong(ws));

      // Aguardar autenticação
      this.sendMessage(ws, {
        type: 'connection_established',
        connectionId,
        message: 'Conexão estabelecida. Aguardando autenticação.',
        timestamp: new Date().toISOString(),
      });

      // Timeout para autenticação
      setTimeout(() => {
        if (!ws.user && ws.readyState === WebSocket.OPEN) {
          logger.warn(`Timeout de autenticação para conexão ${connectionId}`);
          ws.close(1008, 'Timeout de autenticação');
        }
      }, 30000); // 30 segundos para autenticar

      this.connectionCount++;
      this.emit('connection', { connectionId, clientIp });
    } catch (error) {
      logger.error('Erro ao processar nova conexão:', error);
      ws.close(1011, 'Erro interno do servidor');
    }
  }

  /**
   * Manipular mensagem recebida
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {Buffer} data - Dados recebidos
   */
  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      logger.debug(`Mensagem recebida de ${ws.connectionId}:`, message.type);

      switch (message.type) {
        case 'authenticate':
          await this.handleAuthentication(ws, message);
          break;

        case 'subscribe':
          await this.handleSubscription(ws, message);
          break;

        case 'unsubscribe':
          await this.handleUnsubscription(ws, message);
          break;

        case 'ping':
          this.handlePing(ws, message);
          break;

        case 'join_room':
          await this.handleJoinRoom(ws, message);
          break;

        case 'leave_room':
          await this.handleLeaveRoom(ws, message);
          break;

        default:
          logger.warn(`Tipo de mensagem desconhecido: ${message.type}`);
          this.sendError(ws, 'Tipo de mensagem não suportado', 'UNKNOWN_MESSAGE_TYPE');
      }
    } catch (error) {
      logger.error('Erro ao processar mensagem:', error);
      this.sendError(ws, 'Erro ao processar mensagem', 'MESSAGE_PROCESSING_ERROR');
    }
  }

  /**
   * Manipular autenticação
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {Object} message - Mensagem de autenticação
   */
  async handleAuthentication(ws, message) {
    try {
      const { token } = message;

      if (!token) {
        this.sendError(ws, 'Token de autenticação obrigatório', 'MISSING_TOKEN');
        return;
      }

      // Verificar token (usar middleware de auth existente)
      const user = await this.verifyToken(token);

      if (!user) {
        this.sendError(ws, 'Token inválido ou expirado', 'INVALID_TOKEN');
        return;
      }

      // Configurar usuário na conexão
      ws.user = user;

      // Adicionar à lista de conexões do usuário
      if (!this.connections.has(user.id)) {
        this.connections.set(user.id, new Set());
      }
      this.connections.get(user.id).add(ws);

      // Salvar metadata da conexão
      this.connectionMetadata.set(ws.connectionId, {
        userId: user.id,
        connectedAt: ws.connectedAt,
        lastActivity: new Date(),
        subscriptions: new Set(),
        rooms: new Set(),
      });

      this.sendMessage(ws, {
        type: 'authentication_success',
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        message: 'Autenticação realizada com sucesso',
        timestamp: new Date().toISOString(),
      });

      logger.info(`Usuário ${user.id} autenticado na conexão ${ws.connectionId}`);
      this.emit('user_connected', { userId: user.id, connectionId: ws.connectionId });
    } catch (error) {
      logger.error('Erro na autenticação:', error);
      this.sendError(ws, 'Erro na autenticação', 'AUTHENTICATION_ERROR');
    }
  }

  /**
   * Manipular inscrição em eventos
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {Object} message - Mensagem de inscrição
   */
  async handleSubscription(ws, message) {
    try {
      if (!ws.user) {
        this.sendError(ws, 'Autenticação necessária', 'AUTHENTICATION_REQUIRED');
        return;
      }

      const { events } = message;

      if (!Array.isArray(events)) {
        this.sendError(ws, 'Lista de eventos deve ser um array', 'INVALID_EVENTS_FORMAT');
        return;
      }

      const metadata = this.connectionMetadata.get(ws.connectionId);
      if (!metadata) {
        this.sendError(ws, 'Metadata da conexão não encontrada', 'METADATA_NOT_FOUND');
        return;
      }

      // Validar e adicionar inscrições
      const validEvents = this.validateEventSubscriptions(events, ws.user);
      validEvents.forEach(event => metadata.subscriptions.add(event));

      this.sendMessage(ws, {
        type: 'subscription_success',
        events: validEvents,
        message: `Inscrito em ${validEvents.length} eventos`,
        timestamp: new Date().toISOString(),
      });

      logger.info(`Usuário ${ws.user.id} inscrito em eventos:`, validEvents);
    } catch (error) {
      logger.error('Erro na inscrição:', error);
      this.sendError(ws, 'Erro na inscrição', 'SUBSCRIPTION_ERROR');
    }
  }

  /**
   * Notificar sobre novo incidente
   * @param {Object} incident - Dados do incidente
   */
  notifyNewIncident(incident) {
    const notification = {
      type: 'new_incident',
      data: incident,
      timestamp: new Date().toISOString(),
    };

    // Notificar usuários interessados
    this.broadcastToSubscribers('incidents.new', notification);

    // Notificar administradores
    this.broadcastToRole('admin', {
      ...notification,
      type: 'admin_new_incident',
    });

    logger.info(`Notificação de novo incidente enviada: ${incident.id}`);
  }

  /**
   * Notificar sobre atualização de status
   * @param {Object} incident - Dados do incidente atualizado
   * @param {string} previousStatus - Status anterior
   */
  notifyStatusUpdate(incident, previousStatus) {
    const notification = {
      type: 'incident_status_updated',
      data: {
        id: incident.id,
        newStatus: incident.status,
        previousStatus,
        updatedAt: incident.updatedAt,
        updatedBy: incident.updatedBy,
      },
      timestamp: new Date().toISOString(),
    };

    // Notificar watchers do incidente
    this.notifyIncidentWatchers(incident.id, notification);

    // Notificar responsável
    if (incident.assignedTo) {
      this.notifyUser(incident.assignedTo, {
        ...notification,
        type: 'assigned_incident_updated',
      });
    }

    logger.info(`Notificação de atualização enviada para incidente ${incident.id}`);
  }

  /**
   * Notificar sobre nova mensagem/comentário
   * @param {Object} message - Dados da mensagem
   */
  notifyNewMessage(message) {
    const notification = {
      type: 'new_message',
      data: message,
      timestamp: new Date().toISOString(),
    };

    // Notificar watchers do incidente
    this.notifyIncidentWatchers(message.incidentId, notification);

    logger.info(`Notificação de nova mensagem enviada para incidente ${message.incidentId}`);
  }

  /**
   * Notificar usuário específico
   * @param {string} userId - ID do usuário
   * @param {Object} notification - Dados da notificação
   */
  notifyUser(userId, notification) {
    const userConnections = this.connections.get(userId);

    if (userConnections && userConnections.size > 0) {
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendMessage(ws, notification);
        }
      });

      logger.debug(`Notificação enviada para usuário ${userId}`);
    }
  }

  /**
   * Broadcast para usuários com papel específico
   * @param {string} role - Papel do usuário
   * @param {Object} notification - Dados da notificação
   */
  broadcastToRole(role, notification) {
    let count = 0;

    this.connectionMetadata.forEach((metadata, connectionId) => {
      const userConnections = this.connections.get(metadata.userId);

      if (userConnections) {
        userConnections.forEach(ws => {
          if (ws.user && ws.user.role === role && ws.readyState === WebSocket.OPEN) {
            this.sendMessage(ws, notification);
            count++;
          }
        });
      }
    });

    logger.debug(`Broadcast para papel ${role} enviado para ${count} conexões`);
  }

  /**
   * Broadcast para inscritos em evento específico
   * @param {string} eventType - Tipo do evento
   * @param {Object} notification - Dados da notificação
   */
  broadcastToSubscribers(eventType, notification) {
    let count = 0;

    this.connectionMetadata.forEach((metadata, connectionId) => {
      if (metadata.subscriptions.has(eventType)) {
        const userConnections = this.connections.get(metadata.userId);

        if (userConnections) {
          userConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              this.sendMessage(ws, notification);
              count++;
            }
          });
        }
      }
    });

    logger.debug(`Broadcast para evento ${eventType} enviado para ${count} conexões`);
  }

  /**
   * Notificar watchers de um incidente
   * @param {string} incidentId - ID do incidente
   * @param {Object} notification - Dados da notificação
   */
  notifyIncidentWatchers(incidentId, notification) {
    // TODO: Implementar busca de watchers do incidente
    // Por enquanto, broadcast geral para incidentes
    this.broadcastToSubscribers('incidents.updates', notification);
  }

  /**
   * Enviar mensagem para conexão específica
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {Object} data - Dados da mensagem
   */
  sendMessage(ws, data) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify(data);
        ws.send(message);
      }
    } catch (error) {
      logger.error('Erro ao enviar mensagem:', error);
    }
  }

  /**
   * Enviar erro para conexão específica
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {string} message - Mensagem de erro
   * @param {string} code - Código do erro
   */
  sendError(ws, message, code) {
    this.sendMessage(ws, {
      type: 'error',
      error: {
        message,
        code,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Iniciar heartbeat para manter conexões ativas
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      this.server.clients.forEach(ws => {
        if (!ws.isAlive) {
          logger.info(`Terminando conexão inativa: ${ws.connectionId}`);
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, this.options.heartbeatInterval);

    logger.info(`Heartbeat iniciado com intervalo de ${this.options.heartbeatInterval}ms`);
  }

  /**
   * Manipular pong de heartbeat
   * @param {WebSocket} ws - Conexão WebSocket
   */
  handlePong(ws) {
    ws.isAlive = true;
    ws.lastPing = new Date();
  }

  /**
   * Manipular desconexão
   * @param {WebSocket} ws - Conexão WebSocket
   * @param {number} code - Código de fechamento
   * @param {string} reason - Razão do fechamento
   */
  handleDisconnection(ws, code, reason) {
    logger.info(`Conexão ${ws.connectionId} fechada: ${code} - ${reason}`);

    try {
      // Remover das conexões do usuário
      if (ws.user) {
        const userConnections = this.connections.get(ws.user.id);
        if (userConnections) {
          userConnections.delete(ws);
          if (userConnections.size === 0) {
            this.connections.delete(ws.user.id);
          }
        }

        this.emit('user_disconnected', {
          userId: ws.user.id,
          connectionId: ws.connectionId,
        });
      }

      // Remover metadata
      this.connectionMetadata.delete(ws.connectionId);
      this.connectionCount--;

      this.emit('disconnection', {
        connectionId: ws.connectionId,
        code,
        reason: reason.toString(),
      });
    } catch (error) {
      logger.error('Erro ao processar desconexão:', error);
    }
  }

  /**
   * Parar servidor WebSocket gracefully
   */
  async shutdown() {
    try {
      this.isShuttingDown = true;

      // Parar heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
      }

      // Fechar todas as conexões
      if (this.server) {
        this.server.clients.forEach(ws => {
          ws.close(1001, 'Servidor sendo desligado');
        });

        // Fechar servidor
        await new Promise((resolve, reject) => {
          this.server.close(error => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      }

      // Limpar dados
      this.connections.clear();
      this.connectionMetadata.clear();
      this.rooms.clear();

      logger.info('WebSocket server encerrado com sucesso');
    } catch (error) {
      logger.error('Erro ao encerrar WebSocket server:', error);
      throw error;
    }
  }

  /**
   * Obter estatísticas do servidor
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      totalConnections: this.connectionCount,
      authenticatedUsers: this.connections.size,
      rooms: this.rooms.size,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  // ==================== MÉTODOS AUXILIARES ====================

  generateConnectionId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  getClientIp(request) {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      'unknown'
    );
  }

  async verifyToken(token) {
    // TODO: Implementar verificação de token real
    // Por enquanto, simular verificação
    try {
      // Usar middleware de auth existente
      const decoded = await this.decodeJWT(token);
      return decoded;
    } catch (error) {
      logger.error('Erro ao verificar token:', error);
      return null;
    }
  }

  async decodeJWT(token) {
    // TODO: Implementar decodificação JWT real
    // Placeholder - usar biblioteca JWT existente
    return null;
  }

  validateEventSubscriptions(events, user) {
    const allowedEvents = {
      'incidents.new': true,
      'incidents.updates': true,
      'incidents.assigned': user.role !== 'user',
      'system.alerts': user.isAdmin || user.role === 'admin',
      'admin.notifications': user.isAdmin || user.role === 'admin',
    };

    return events.filter(event => allowedEvents[event] === true);
  }

  handlePing(ws, message) {
    this.sendMessage(ws, {
      type: 'pong',
      timestamp: new Date().toISOString(),
    });
  }

  async handleJoinRoom(ws, message) {
    // TODO: Implementar sistema de rooms
    logger.info(`Usuário ${ws.user?.id} tentando entrar na sala ${message.room}`);
  }

  async handleLeaveRoom(ws, message) {
    // TODO: Implementar sistema de rooms
    logger.info(`Usuário ${ws.user?.id} tentando sair da sala ${message.room}`);
  }

  handleConnectionError(ws, error) {
    logger.error(`Erro na conexão ${ws.connectionId}:`, error);
    this.emit('connection_error', { connectionId: ws.connectionId, error });
  }

  handleServerError(error) {
    logger.error('Erro no servidor WebSocket:', error);
    this.emit('server_error', { error });
  }
}

module.exports = { WebSocketNotifier };
