const { EventEmitter } = require('events');
const { Logger } = require('../../utils/Logger');

const logger = new Logger('CircuitBreaker');

/**
 * Circuit Breaker Pattern Implementation
 * Previne cascatas de falhas fornecendo fallback quando serviços estão indisponíveis
 */
class CircuitBreaker extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            failureThreshold: options.failureThreshold || 5,
            timeout: options.timeout || 30000, // 30 segundos
            resetTimeout: options.resetTimeout || 60000, // 1 minuto
            monitoringPeriod: options.monitoringPeriod || 10000, // 10 segundos
            expectedErrorTypes: options.expectedErrorTypes || [],
            fallbackFunction: options.fallbackFunction || null,
            name: options.name || 'CircuitBreaker',
            ...options
        };

        // Estados do circuit breaker
        this.states = {
            CLOSED: 'CLOSED',     // Funcionamento normal
            OPEN: 'OPEN',         // Bloqueando requisições
            HALF_OPEN: 'HALF_OPEN' // Testando se serviço voltou
        };

        this.state = this.states.CLOSED;
        this.failureCount = 0;
        this.nextAttempt = null;
        this.successCount = 0;
        this.totalRequests = 0;
        this.failedRequests = 0;
        this.lastFailureTime = null;

        // Histórico de falhas
        this.failures = [];
        this.successes = [];

        // Timers
        this.resetTimer = null;
        this.monitoringTimer = null;

        this.startMonitoring();
    }

    /**
     * Executar função com circuit breaker
     * @param {Function} fn - Função para executar
     * @param {...any} args - Argumentos da função
     * @returns {Promise} Resultado da execução
     */
    async call(fn, ...args) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();

        try {
            // Verificar estado atual
            if (this.state === this.states.OPEN) {
                const error = new Error('Circuit breaker is OPEN');
                error.code = 'CIRCUIT_BREAKER_OPEN';
                error.circuitBreakerState = this.state;

                await this.recordFailure(requestId, error, startTime);

                // Tentar fallback se disponível
                if (this.options.fallbackFunction) {
                    logger.warn(`Circuit breaker OPEN, executando fallback para ${this.options.name}`);
                    return await this.options.fallbackFunction(...args);
                }

                throw error;
            }

            this.totalRequests++;

            // Executar função com timeout
            const result = await this.executeWithTimeout(fn, args);

            // Registrar sucesso
            await this.recordSuccess(requestId, startTime);

            return result;

        } catch (error) {
            // Registrar falha
            await this.recordFailure(requestId, error, startTime);
            throw error;
        }
    }

    /**
     * Executar função com timeout
     * @param {Function} fn - Função para executar
     * @param {Array} args - Argumentos
     * @returns {Promise} Resultado
     */
    async executeWithTimeout(fn, args) {
        return new Promise(async (resolve, reject) => {
            let timeoutId;
            let completed = false;

            // Configurar timeout
            if (this.options.timeout > 0) {
                timeoutId = setTimeout(() => {
                    if (!completed) {
                        completed = true;
                        const error = new Error(`Operation timed out after ${this.options.timeout}ms`);
                        error.code = 'CIRCUIT_BREAKER_TIMEOUT';
                        reject(error);
                    }
                }, this.options.timeout);
            }

            try {
                const result = await fn(...args);

                if (!completed) {
                    completed = true;
                    if (timeoutId) clearTimeout(timeoutId);
                    resolve(result);
                }
            } catch (error) {
                if (!completed) {
                    completed = true;
                    if (timeoutId) clearTimeout(timeoutId);
                    reject(error);
                }
            }
        });
    }

    /**
     * Registrar sucesso
     * @param {string} requestId - ID da requisição
     * @param {number} startTime - Tempo de início
     */
    async recordSuccess(requestId, startTime) {
        const duration = Date.now() - startTime;

        this.successCount++;
        this.successes.push({
            requestId,
            timestamp: new Date().toISOString(),
            duration
        });

        // Manter apenas últimos 100 sucessos
        if (this.successes.length > 100) {
            this.successes.shift();
        }

        // Se estava HALF_OPEN e teve sucesso, fechar circuit breaker
        if (this.state === this.states.HALF_OPEN) {
            this.close();
        }

        // Reset failure count em caso de sucesso
        if (this.state === this.states.CLOSED) {
            this.failureCount = Math.max(0, this.failureCount - 1);
        }

        this.emit('success', {
            requestId,
            duration,
            state: this.state
        });

        logger.debug(`Circuit breaker success: ${this.options.name} - ${requestId} (${duration}ms)`);
    }

    /**
     * Registrar falha
     * @param {string} requestId - ID da requisição
     * @param {Error} error - Erro ocorrido
     * @param {number} startTime - Tempo de início
     */
    async recordFailure(requestId, error, startTime) {
        const duration = Date.now() - startTime;

        // Verificar se é um erro esperado (não conta como falha)
        if (this.isExpectedError(error)) {
            logger.debug(`Expected error ignored: ${error.message}`);
            return;
        }

        this.failureCount++;
        this.failedRequests++;
        this.lastFailureTime = new Date();

        this.failures.push({
            requestId,
            timestamp: this.lastFailureTime.toISOString(),
            duration,
            error: {
                message: error.message,
                code: error.code,
                name: error.name
            }
        });

        // Manter apenas últimas 100 falhas
        if (this.failures.length > 100) {
            this.failures.shift();
        }

        // Verificar se deve abrir circuit breaker
        if (this.state === this.states.CLOSED && this.failureCount >= this.options.failureThreshold) {
            this.open();
        } else if (this.state === this.states.HALF_OPEN) {
            // Se falhou em HALF_OPEN, voltar para OPEN
            this.open();
        }

        this.emit('failure', {
            requestId,
            duration,
            error: error.message,
            state: this.state,
            failureCount: this.failureCount
        });

        logger.warn(`Circuit breaker failure: ${this.options.name} - ${error.message} (${this.failureCount}/${this.options.failureThreshold})`);
    }

    /**
     * Verificar se é um erro esperado
     * @param {Error} error - Erro para verificar
     * @returns {boolean} Se é esperado
     */
    isExpectedError(error) {
        if (!this.options.expectedErrorTypes.length) {
            return false;
        }

        return this.options.expectedErrorTypes.some(expectedType => {
            if (typeof expectedType === 'string') {
                return error.name === expectedType || error.code === expectedType;
            }
            if (expectedType instanceof RegExp) {
                return expectedType.test(error.message);
            }
            if (typeof expectedType === 'function') {
                return error instanceof expectedType;
            }
            return false;
        });
    }

    /**
     * Abrir circuit breaker
     */
    open() {
        if (this.state === this.states.OPEN) {
            return;
        }

        this.state = this.states.OPEN;
        this.nextAttempt = Date.now() + this.options.resetTimeout;

        // Agendar tentativa de reset
        this.scheduleReset();

        this.emit('open', {
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold,
            resetTimeout: this.options.resetTimeout
        });

        logger.warn(`Circuit breaker OPENED: ${this.options.name} (failures: ${this.failureCount})`);
    }

    /**
     * Colocar em half-open (teste)
     */
    halfOpen() {
        if (this.state === this.states.HALF_OPEN) {
            return;
        }

        this.state = this.states.HALF_OPEN;
        this.nextAttempt = null;

        this.emit('halfOpen', {
            failureCount: this.failureCount
        });

        logger.info(`Circuit breaker HALF-OPEN: ${this.options.name}`);
    }

    /**
     * Fechar circuit breaker
     */
    close() {
        if (this.state === this.states.CLOSED) {
            return;
        }

        this.state = this.states.CLOSED;
        this.failureCount = 0;
        this.nextAttempt = null;

        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }

        this.emit('close', {
            successCount: this.successCount
        });

        logger.info(`Circuit breaker CLOSED: ${this.options.name}`);
    }

    /**
     * Agendar reset do circuit breaker
     */
    scheduleReset() {
        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
        }

        this.resetTimer = setTimeout(() => {
            if (this.state === this.states.OPEN) {
                this.halfOpen();
            }
        }, this.options.resetTimeout);
    }

    /**
     * Iniciar monitoramento
     */
    startMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
        }

        this.monitoringTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.options.monitoringPeriod);
    }

    /**
     * Verificação de saúde periódica
     */
    performHealthCheck() {
        try {
            const now = Date.now();
            const metrics = this.getMetrics();

            // Limpar histórico antigo (mais de 1 hora)
            const oneHourAgo = now - (60 * 60 * 1000);

            this.failures = this.failures.filter(f =>
                new Date(f.timestamp).getTime() > oneHourAgo
            );

            this.successes = this.successes.filter(s =>
                new Date(s.timestamp).getTime() > oneHourAgo
            );

            // Emitir métricas
            this.emit('metrics', metrics);

            // Auto-recovery se não houver falhas recentes
            if (this.state === this.states.OPEN &&
                this.failures.length === 0 &&
                this.lastFailureTime &&
                (now - this.lastFailureTime.getTime()) > (this.options.resetTimeout * 2)) {

                logger.info(`Auto-recovery triggered for ${this.options.name}`);
                this.halfOpen();
            }

        } catch (error) {
            logger.error('Erro no health check do circuit breaker:', error);
        }
    }

    /**
     * Obter métricas do circuit breaker
     * @returns {Object} Métricas
     */
    getMetrics() {
        const now = Date.now();
        const lastHour = now - (60 * 60 * 1000);

        const recentFailures = this.failures.filter(f =>
            new Date(f.timestamp).getTime() > lastHour
        );

        const recentSuccesses = this.successes.filter(s =>
            new Date(s.timestamp).getTime() > lastHour
        );

        const totalRecent = recentFailures.length + recentSuccesses.length;
        const errorRate = totalRecent > 0 ? (recentFailures.length / totalRecent) : 0;

        const avgResponseTime = recentSuccesses.length > 0
            ? recentSuccesses.reduce((sum, s) => sum + s.duration, 0) / recentSuccesses.length
            : 0;

        return {
            name: this.options.name,
            state: this.state,
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold,
            totalRequests: this.totalRequests,
            failedRequests: this.failedRequests,
            successCount: this.successCount,
            nextAttempt: this.nextAttempt,
            lastFailureTime: this.lastFailureTime,
            metrics: {
                errorRate,
                avgResponseTime,
                recentFailures: recentFailures.length,
                recentSuccesses: recentSuccesses.length,
                totalRecent
            },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Obter status do circuit breaker
     * @returns {Object} Status
     */
    getStatus() {
        return {
            name: this.options.name,
            state: this.state,
            isHealthy: this.state === this.states.CLOSED,
            failureCount: this.failureCount,
            threshold: this.options.failureThreshold,
            nextAttempt: this.nextAttempt
        };
    }

    /**
     * Reset manual do circuit breaker
     */
    reset() {
        logger.info(`Manual reset of circuit breaker: ${this.options.name}`);

        this.failureCount = 0;
        this.totalRequests = 0;
        this.failedRequests = 0;
        this.successCount = 0;
        this.failures = [];
        this.successes = [];
        this.lastFailureTime = null;

        this.close();

        this.emit('reset');
    }

    /**
     * Parar circuit breaker
     */
    async shutdown() {
        logger.info(`Shutting down circuit breaker: ${this.options.name}`);

        if (this.resetTimer) {
            clearTimeout(this.resetTimer);
            this.resetTimer = null;
        }

        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }

        this.removeAllListeners();

        this.emit('shutdown');
    }

    /**
     * Gerar ID único para requisição
     * @returns {string} ID da requisição
     */
    generateRequestId() {
        return `cb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * Configurar fallback
     * @param {Function} fallbackFn - Função de fallback
     */
    setFallback(fallbackFn) {
        this.options.fallbackFunction = fallbackFn;
    }

    /**
     * Executar teste do circuit breaker
     * @returns {Object} Resultado do teste
     */
    async test() {
        const testFn = async () => {
            // Simular operação
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true, timestamp: new Date().toISOString() };
        };

        try {
            const result = await this.call(testFn);
            return {
                success: true,
                result,
                state: this.state,
                metrics: this.getMetrics()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                state: this.state,
                metrics: this.getMetrics()
            };
        }
    }
}

module.exports = { CircuitBreaker };