/**
 * Dashboard JavaScript - Frontend do Sistema de Auditoria
 * Gerencia interface, comunicação WebSocket e visualizações
 */

class AuditDashboard {
  constructor() {
    this.socket = null;
    this.charts = {};
    this.currentSection = 'overview';
    this.data = {
      metrics: {},
      logs: [],
      alerts: [],
      compliance: {},
      analytics: {},
    };

    this.init();
  }

  /**
   * Inicializa o dashboard
   */
  init() {
    this.setupSocketConnection();
    this.setupNavigation();
    this.setupEventHandlers();
    this.setupCharts();
    this.setupModals();

    // Carrega dados iniciais
    this.loadInitialData();
  }

  /**
   * Configura conexão WebSocket
   */
  setupSocketConnection() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to audit server');
      this.updateConnectionStatus(true);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from audit server');
      this.updateConnectionStatus(false);
    });

    this.socket.on('initialData', data => {
      this.data = { ...this.data, ...data };
      this.updateDashboard();
    });

    this.socket.on('newAuditEntry', entry => {
      this.data.logs.unshift(entry.data);
      if (this.data.logs.length > 100) {
        this.data.logs.pop();
      }
      this.updateLogsTable();
      this.updateMetrics();
    });

    this.socket.on('newAlerts', alerts => {
      this.data.alerts.unshift(...alerts.data);
      this.updateAlertsSection();
      this.showNotification('Novos alertas recebidos', 'warning');
    });

    this.socket.on('metricsUpdate', metrics => {
      this.data.metrics = metrics.data;
      this.updateMetrics();
    });

    this.socket.on('dataUpdate', update => {
      this.data[update.type] = update.data;
      this.updateSection(update.type);
    });

    this.socket.on('error', error => {
      this.showNotification(error.message, 'error');
    });
  }

  /**
   * Configura navegação entre seções
   */
  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();

        const section = link.dataset.section;
        this.switchSection(section);

        // Atualiza estado ativo dos links
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      });
    });
  }

  /**
   * Configura event handlers
   */
  setupEventHandlers() {
    // Refresh buttons
    document.getElementById('refreshOverview')?.addEventListener('click', () => {
      this.refreshData();
    });

    // Log filters
    document.getElementById('filterLogs')?.addEventListener('click', () => {
      this.applyLogFilters();
    });

    document.getElementById('logSearch')?.addEventListener('input', e => {
      this.searchLogs(e.target.value);
    });

    // Export buttons
    document.getElementById('exportLogs')?.addEventListener('click', () => {
      this.showExportModal();
    });

    // Report generation
    document.getElementById('generateReport')?.addEventListener('click', () => {
      this.generateComplianceReport();
    });

    // Analytics timeframe
    document.getElementById('analyticsTimeframe')?.addEventListener('change', e => {
      this.updateAnalyticsTimeframe(e.target.value);
    });
  }

  /**
   * Configura gráficos Chart.js
   */
  setupCharts() {
    // Gráfico de eventos por hora
    const eventsCtx = document.getElementById('eventsChart');
    if (eventsCtx) {
      this.charts.events = new Chart(eventsCtx, {
        type: 'line',
        data: {
          labels: this.generateHourLabels(),
          datasets: [
            {
              label: 'Eventos',
              data: new Array(24).fill(0),
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }

    // Gráfico de performance
    const performanceCtx = document.getElementById('performanceChart');
    if (performanceCtx) {
      this.charts.performance = new Chart(performanceCtx, {
        type: 'doughnut',
        data: {
          labels: ['Dentro do SLA', 'Fora do SLA'],
          datasets: [
            {
              data: [85, 15],
              backgroundColor: ['#10b981', '#ef4444'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }

    // Gráfico de tendências
    const trendCtx = document.getElementById('trendChart');
    if (trendCtx) {
      this.charts.trend = new Chart(trendCtx, {
        type: 'bar',
        data: {
          labels: this.generateDayLabels(),
          datasets: [
            {
              label: 'Incidentes',
              data: new Array(7).fill(0),
              backgroundColor: '#8b5cf6',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
            },
          },
        },
      });
    }
  }

  /**
   * Configura modais
   */
  setupModals() {
    const modals = document.querySelectorAll('.modal');

    modals.forEach(modal => {
      const closeButtons = modal.querySelectorAll('.modal-close');

      closeButtons.forEach(button => {
        button.addEventListener('click', () => {
          this.closeModal(modal);
        });
      });

      // Fecha modal clicando fora
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    // Form de exportação
    const exportForm = document.getElementById('exportForm');
    if (exportForm) {
      exportForm.addEventListener('submit', e => {
        e.preventDefault();
        this.handleExport();
      });
    }
  }

  /**
   * Carrega dados iniciais
   */
  async loadInitialData() {
    try {
      // Solicita dados iniciais via Socket.IO
      this.socket.emit('requestData', 'metrics');
      this.socket.emit('requestData', 'analytics');
      this.socket.emit('requestData', 'compliance');

      // Carrega logs recentes via API REST
      const response = await fetch('/api/logs/recent?limit=50');
      if (response.ok) {
        this.data.logs = await response.json();
        this.updateLogsTable();
      }

      // Carrega alertas
      const alertsResponse = await fetch('/api/alerts');
      if (alertsResponse.ok) {
        this.data.alerts = await alertsResponse.json();
        this.updateAlertsSection();
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showNotification('Erro ao carregar dados iniciais', 'error');
    }
  }

  /**
   * Atualiza dashboard completo
   */
  updateDashboard() {
    this.updateMetrics();
    this.updateCharts();
    this.updateLogsTable();
    this.updateAlertsSection();
    this.updateComplianceSection();
    this.updateLastUpdateTime();
  }

  /**
   * Atualiza métricas principais
   */
  updateMetrics() {
    const metrics = this.data.metrics;

    if (metrics.audit) {
      this.updateElement('totalEvents', metrics.audit.totalEvents || 0);
      this.updateElement('criticalAlerts', metrics.audit.criticalEvents || 0);
    }

    if (metrics.analytics) {
      this.updateElement('slaCompliance', this.formatPercentage(metrics.analytics.slaCompliance));
      this.updateElement('llmSuccessRate', this.formatPercentage(metrics.analytics.llmSuccessRate));
    }

    // Atualiza gráficos se houver dados
    if (this.charts.events && metrics.analytics) {
      this.updateEventsChart(metrics.analytics);
    }
  }

  /**
   * Atualiza gráficos
   */
  updateCharts() {
    // Atualiza gráfico de eventos se houver dados
    if (this.data.analytics && this.charts.events) {
      const hourlyData = this.generateHourlyData();
      this.charts.events.data.datasets[0].data = hourlyData;
      this.charts.events.update();
    }

    // Atualiza gráfico de performance
    if (this.data.metrics && this.charts.performance) {
      const slaCompliance = this.data.metrics.analytics?.slaCompliance || 0;
      this.charts.performance.data.datasets[0].data = [
        slaCompliance * 100,
        (1 - slaCompliance) * 100,
      ];
      this.charts.performance.update();
    }
  }

  /**
   * Atualiza tabela de logs
   */
  updateLogsTable() {
    const tbody = document.querySelector('#logsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    this.data.logs.slice(0, 50).forEach(log => {
      const row = this.createLogRow(log);
      tbody.appendChild(row);
    });
  }

  /**
   * Cria linha da tabela de logs
   */
  createLogRow(log) {
    const row = document.createElement('tr');

    const timestamp = new Date(log.timestamp).toLocaleString('pt-BR');
    const severity = log.impact?.severity || log.severity || 'LOW';
    const severityClass = severity.toLowerCase();

    row.innerHTML = `
            <td>${timestamp}</td>
            <td><span class="log-type">${log.eventType}</span></td>
            <td><code>${log.incidentId?.substring(0, 8)}...</code></td>
            <td>${log.operatorId || 'SYSTEM'}</td>
            <td>${this.truncateText(log.description || log.action || 'N/A', 50)}</td>
            <td><span class="severity-badge ${severityClass}">${severity}</span></td>
            <td>
                <button class="btn btn-small" onclick="dashboard.showLogDetail('${log.incidentId}')">
                    Ver Detalhes
                </button>
            </td>
        `;

    return row;
  }

  /**
   * Atualiza seção de alertas
   */
  updateAlertsSection() {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;

    alertsList.innerHTML = '';

    this.data.alerts.slice(0, 20).forEach(alert => {
      const alertElement = this.createAlertElement(alert);
      alertsList.appendChild(alertElement);
    });
  }

  /**
   * Cria elemento de alerta
   */
  createAlertElement(alert) {
    const div = document.createElement('div');
    div.className = `alert-item ${alert.severity?.toLowerCase() || 'medium'}`;

    const time = new Date(alert.timestamp).toLocaleString('pt-BR');

    div.innerHTML = `
            <div class="alert-header">
                <span class="alert-title">${alert.type || 'Alerta'}</span>
                <span class="alert-time">${time}</span>
            </div>
            <div class="alert-description">
                ${alert.description || alert.message || 'Descrição não disponível'}
            </div>
            <div class="alert-actions">
                <button class="btn btn-small">Investigar</button>
                <button class="btn btn-small btn-secondary">Marcar como Lido</button>
            </div>
        `;

    return div;
  }

  /**
   * Atualiza seção de compliance
   */
  updateComplianceSection() {
    // Implementa atualização dos cards de compliance
    // baseado nos dados recebidos
  }

  /**
   * Troca seção ativa
   */
  switchSection(sectionId) {
    // Esconde todas as seções
    document.querySelectorAll('.dashboard-section').forEach(section => {
      section.classList.remove('active');
    });

    // Mostra seção selecionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.add('active');
      this.currentSection = sectionId;

      // Solicita dados específicos da seção se necessário
      if (sectionId === 'analytics') {
        this.socket.emit('requestData', 'analytics');
      } else if (sectionId === 'compliance') {
        this.socket.emit('requestData', 'compliance');
      }
    }
  }

  /**
   * Aplica filtros nos logs
   */
  applyLogFilters() {
    const eventType = document.getElementById('eventTypeFilter')?.value;
    const severity = document.getElementById('severityFilter')?.value;
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;

    const filter = {};
    if (eventType) filter.eventType = eventType;
    if (severity) filter.severity = severity;
    if (startDate) filter.startDate = startDate;
    if (endDate) filter.endDate = endDate;

    this.socket.emit('applyLogFilter', filter);
  }

  /**
   * Busca logs por texto
   */
  searchLogs(searchTerm) {
    if (!searchTerm.trim()) {
      this.updateLogsTable();
      return;
    }

    const filteredLogs = this.data.logs.filter(log => {
      const searchableText = [
        log.description,
        log.action,
        log.operatorId,
        log.incidentId,
        log.eventType,
      ]
        .join(' ')
        .toLowerCase();

      return searchableText.includes(searchTerm.toLowerCase());
    });

    this.renderFilteredLogs(filteredLogs);
  }

  /**
   * Renderiza logs filtrados
   */
  renderFilteredLogs(logs) {
    const tbody = document.querySelector('#logsTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    logs.forEach(log => {
      const row = this.createLogRow(log);
      tbody.appendChild(row);
    });
  }

  /**
   * Mostra detalhes do log
   */
  showLogDetail(incidentId) {
    const log = this.data.logs.find(l => l.incidentId === incidentId);
    if (!log) return;

    const modal = document.getElementById('logDetailModal');
    const content = document.getElementById('logDetailContent');

    content.textContent = JSON.stringify(log, null, 2);
    this.showModal(modal);
  }

  /**
   * Mostra modal de exportação
   */
  showExportModal() {
    const modal = document.getElementById('exportModal');
    this.showModal(modal);
  }

  /**
   * Processa exportação
   */
  handleExport() {
    const type = document.getElementById('exportType').value;
    const format = document.getElementById('exportFormat').value;
    const startDate = document.getElementById('exportStartDate').value;
    const endDate = document.getElementById('exportEndDate').value;

    const exportConfig = {
      type,
      format,
      period: { startDate, endDate },
    };

    this.socket.emit('exportData', exportConfig);
    this.showNotification('Exportação iniciada...', 'info');
    this.closeModal(document.getElementById('exportModal'));
  }

  /**
   * Gera relatório de compliance
   */
  async generateComplianceReport() {
    try {
      this.showNotification('Gerando relatório...', 'info');

      const response = await fetch('/api/reports/sox');
      if (response.ok) {
        const report = await response.json();
        this.showNotification('Relatório gerado com sucesso!', 'success');
        // Implementar download ou visualização do relatório
      } else {
        throw new Error('Falha ao gerar relatório');
      }
    } catch (error) {
      this.showNotification('Erro ao gerar relatório', 'error');
    }
  }

  /**
   * Atualiza timeframe do analytics
   */
  updateAnalyticsTimeframe(timeframe) {
    // Solicita novos dados baseados no timeframe
    this.socket.emit('requestData', 'analytics', { timeframe });
  }

  /**
   * Atualiza dados
   */
  refreshData() {
    this.socket.emit('requestData', 'metrics');
    this.socket.emit('requestData', 'analytics');
    this.showNotification('Dados atualizados', 'success');
  }

  /**
   * Atualiza status da conexão
   */
  updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
      statusElement.innerHTML = connected
        ? '<i class="icon-circle"></i> Conectado'
        : '<i class="icon-circle"></i> Desconectado';
      statusElement.className = `status-indicator ${connected ? '' : 'disconnected'}`;
    }
  }

  /**
   * Atualiza hora da última atualização
   */
  updateLastUpdateTime() {
    const updateElement = document.getElementById('lastUpdate');
    if (updateElement) {
      const now = new Date().toLocaleTimeString('pt-BR');
      updateElement.textContent = `Última atualização: ${now}`;
    }
  }

  /**
   * Mostra modal
   */
  showModal(modal) {
    modal.classList.add('active');
  }

  /**
   * Fecha modal
   */
  closeModal(modal) {
    modal.classList.remove('active');
  }

  /**
   * Mostra notificação
   */
  showNotification(message, type = 'info') {
    // Implementação simples de notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  /**
   * Métodos auxiliares
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  formatPercentage(value) {
    return value ? `${(value * 100).toFixed(1)}%` : '0%';
  }

  truncateText(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  generateHourLabels() {
    return Array.from({ length: 24 }, (_, i) => `${i}:00`);
  }

  generateDayLabels() {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days;
  }

  generateHourlyData() {
    // Simula dados por hora baseado nos logs
    const hourlyCount = new Array(24).fill(0);

    this.data.logs.forEach(log => {
      const hour = new Date(log.timestamp).getHours();
      hourlyCount[hour]++;
    });

    return hourlyCount;
  }
}

// Inicializa dashboard quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new AuditDashboard();
});

// Adiciona estilos de notificação
const notificationStyles = `
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 0.375rem;
    color: white;
    font-weight: 500;
    z-index: 3000;
    animation: slideIn 0.3s ease-out;
}
.notification.info { background-color: #2563eb; }
.notification.success { background-color: #10b981; }
.notification.warning { background-color: #f59e0b; }
.notification.error { background-color: #ef4444; }

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

.severity-badge {
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}
.severity-badge.low { background-color: #dcfce7; color: #166534; }
.severity-badge.medium { background-color: #fef3c7; color: #92400e; }
.severity-badge.high { background-color: #fed7aa; color: #9a3412; }
.severity-badge.critical { background-color: #fee2e2; color: #991b1b; }

.log-type {
    font-family: monospace;
    font-size: 0.75rem;
    background-color: #f1f5f9;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
}
`;

// Adiciona estilos ao documento
const styleSheet = document.createElement('style');
styleSheet.textContent = notificationStyles;
document.head.appendChild(styleSheet);
