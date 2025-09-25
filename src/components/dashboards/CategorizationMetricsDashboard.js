/**
 * Dashboard de Métricas de Classificação
 *
 * Componente React para visualização em tempo real das métricas
 * do sistema de categorização automática de incidentes.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import { Line, Pie, Bar, Doughnut } from 'react-chartjs-2';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Alert,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  Button,
  Tabs,
  Tab,
  Divider,
  IconButton,
  Tooltip as MuiTooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Assessment,
  Speed,
  Psychology,
  Router,
  Feedback,
  Warning,
  CheckCircle,
  Error,
  Refresh,
  Download,
  Settings,
} from '@mui/icons-material';

// Registra componentes Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const CategorizationMetricsDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [routingMetrics, setRoutingMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [timeRange, setTimeRange] = useState('24h');

  // Simula carregamento de métricas (substituir por API real)
  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);

      // Simula dados de métricas
      const mockMetrics = {
        totalClassifications: 1247,
        successfulClassifications: 1156,
        averageConfidence: 0.84,
        accuracyScore: 0.89,
        precisionScore: 0.87,
        recallScore: 0.85,
        f1Score: 0.86,
        averageProcessingTime: 245,
        feedbackCount: 89,
        modelVersions: ['1.0.0', '1.0.1', '1.0.2'],
        cacheHitRate: 0.73,
        modelAccuracy: 0.89,
        lastUpdate: new Date().toISOString(),

        // Dados históricos para gráficos
        confidenceHistory: generateHistoricalData(24, 0.75, 0.95),
        processingTimeHistory: generateHistoricalData(24, 180, 350),
        classificationVolume: generateVolumeData(24),
        categoryDistribution: {
          mainframe: 342,
          'mobile-banking': 298,
          'payment-systems': 234,
          'internet-banking': 189,
          infrastructure: 156,
          'core-banking': 123,
          'atm-network': 89,
          'data-platforms': 67,
        },
        methodPerformance: {
          ml: { accuracy: 0.91, usage: 0.85 },
          nlp: { accuracy: 0.83, usage: 0.78 },
          keywords: { accuracy: 0.76, usage: 0.92 },
          patterns: { accuracy: 0.81, usage: 0.69 },
        },
      };

      const mockRoutingMetrics = {
        totalRoutings: 1156,
        successfulRoutings: 1134,
        activeIncidents: 23,
        escalations: 15,
        averageResolutionTime: 42,
        slaBreachRate: 0.06,
        teamUtilizationRates: {
          'mainframe-support': 0.78,
          'mobile-team': 0.65,
          'payments-team': 0.89,
          'web-team': 0.71,
          'infrastructure-team': 0.82,
          'dba-team': 0.56,
        },
        routingsByPriority: {
          critical: 45,
          high: 234,
          medium: 567,
          low: 310,
        },
      };

      setMetrics(mockMetrics);
      setRoutingMetrics(mockRoutingMetrics);
      setError(null);
    } catch (err) {
      setError(`Erro ao carregar métricas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadMetrics, 30000); // 30 segundos
      return () => clearInterval(interval);
    }
  }, [autoRefresh, loadMetrics]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const exportMetrics = () => {
    const data = {
      classification: metrics,
      routing: routingMetrics,
      exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `categorization-metrics-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  if (loading) {
    return (
      <Box p={3}>
        <Typography variant='h4' gutterBottom>
          Métricas de Categorização
        </Typography>
        <LinearProgress />
        <Typography variant='body2' sx={{ mt: 2 }}>
          Carregando métricas...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert
          severity='error'
          action={
            <Button color='inherit' size='small' onClick={loadMetrics}>
              Tentar Novamente
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      {/* Header */}
      <Box display='flex' justifyContent='space-between' alignItems='center' mb={3}>
        <Typography variant='h4' gutterBottom>
          Dashboard de Categorização
        </Typography>
        <Box display='flex' gap={1} alignItems='center'>
          <FormControlLabel
            control={
              <Switch checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
            }
            label='Auto-refresh'
          />
          <MuiTooltip title='Atualizar métricas'>
            <IconButton onClick={loadMetrics}>
              <Refresh />
            </IconButton>
          </MuiTooltip>
          <MuiTooltip title='Exportar dados'>
            <IconButton onClick={exportMetrics}>
              <Download />
            </IconButton>
          </MuiTooltip>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab label='Visão Geral' />
        <Tab label='Performance ML' />
        <Tab label='Roteamento' />
        <Tab label='Análise Temporal' />
      </Tabs>

      {/* Tab Content */}
      {activeTab === 0 && <OverviewTab metrics={metrics} routingMetrics={routingMetrics} />}
      {activeTab === 1 && <MLPerformanceTab metrics={metrics} />}
      {activeTab === 2 && <RoutingTab routingMetrics={routingMetrics} />}
      {activeTab === 3 && <TemporalAnalysisTab metrics={metrics} />}
    </Box>
  );
};

// Tab Visão Geral
const OverviewTab = ({ metrics, routingMetrics }) => {
  const successRate = (metrics.successfulClassifications / metrics.totalClassifications) * 100;
  const routingSuccessRate =
    (routingMetrics.successfulRoutings / routingMetrics.totalRoutings) * 100;

  return (
    <Grid container spacing={3}>
      {/* KPIs Principais */}
      <Grid item xs={12} md={3}>
        <MetricCard
          title='Classificações'
          value={metrics.totalClassifications.toLocaleString()}
          subtitle={`${metrics.successfulClassifications} bem-sucedidas`}
          icon={<Assessment />}
          color='primary'
          trend={successRate >= 90 ? 'up' : 'down'}
          trendValue={`${successRate.toFixed(1)}%`}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <MetricCard
          title='Confiança Média'
          value={`${(metrics.averageConfidence * 100).toFixed(1)}%`}
          subtitle='Últimas 24h'
          icon={<Psychology />}
          color='success'
          trend={metrics.averageConfidence >= 0.8 ? 'up' : 'down'}
          trendValue={metrics.averageConfidence >= 0.8 ? 'Excelente' : 'Bom'}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <MetricCard
          title='Tempo Médio'
          value={`${metrics.averageProcessingTime}ms`}
          subtitle='Processamento'
          icon={<Speed />}
          color='info'
          trend={metrics.averageProcessingTime <= 300 ? 'up' : 'down'}
          trendValue={metrics.averageProcessingTime <= 300 ? 'Rápido' : 'Lento'}
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <MetricCard
          title='Acurácia'
          value={`${(metrics.accuracyScore * 100).toFixed(1)}%`}
          subtitle='Modelo atual'
          icon={<CheckCircle />}
          color='success'
          trend={metrics.accuracyScore >= 0.85 ? 'up' : 'down'}
          trendValue={`F1: ${(metrics.f1Score * 100).toFixed(1)}%`}
        />
      </Grid>

      {/* Distribuição por Categoria */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Distribuição por Categoria
            </Typography>
            <Box height={300}>
              <Pie
                data={createCategoryDistributionChart(metrics.categoryDistribution)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                    },
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Performance dos Métodos */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Performance dos Métodos
            </Typography>
            <Box height={300}>
              <Bar
                data={createMethodPerformanceChart(metrics.methodPerformance)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 1,
                    },
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Alertas e Status */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Status do Sistema
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Alert
                  severity={metrics.averageConfidence >= 0.8 ? 'success' : 'warning'}
                  icon={metrics.averageConfidence >= 0.8 ? <CheckCircle /> : <Warning />}
                >
                  <Typography variant='subtitle2'>
                    Confiança: {metrics.averageConfidence >= 0.8 ? 'Ótima' : 'Necessita atenção'}
                  </Typography>
                  <Typography variant='body2'>
                    {(metrics.averageConfidence * 100).toFixed(1)}% de confiança média
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12} md={4}>
                <Alert
                  severity={routingMetrics.slaBreachRate <= 0.1 ? 'success' : 'error'}
                  icon={routingMetrics.slaBreachRate <= 0.1 ? <CheckCircle /> : <Error />}
                >
                  <Typography variant='subtitle2'>
                    SLA:{' '}
                    {routingMetrics.slaBreachRate <= 0.1
                      ? 'Dentro do esperado'
                      : 'Violações detectadas'}
                  </Typography>
                  <Typography variant='body2'>
                    {(routingMetrics.slaBreachRate * 100).toFixed(1)}% de violações
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12} md={4}>
                <Alert severity={metrics.cacheHitRate >= 0.7 ? 'success' : 'info'} icon={<Speed />}>
                  <Typography variant='subtitle2'>
                    Cache: {metrics.cacheHitRate >= 0.7 ? 'Eficiente' : 'Pode melhorar'}
                  </Typography>
                  <Typography variant='body2'>
                    {(metrics.cacheHitRate * 100).toFixed(1)}% de hits
                  </Typography>
                </Alert>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Tab Performance ML
const MLPerformanceTab = ({ metrics }) => {
  return (
    <Grid container spacing={3}>
      {/* Métricas de Modelo */}
      <Grid item xs={12} md={8}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Histórico de Confiança
            </Typography>
            <Box height={300}>
              <Line
                data={createConfidenceHistoryChart(metrics.confidenceHistory)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 1,
                    },
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Métricas do Modelo
            </Typography>
            <Box display='flex' flexDirection='column' gap={2}>
              <MetricRow
                label='Acurácia'
                value={`${(metrics.accuracyScore * 100).toFixed(1)}%`}
                progress={metrics.accuracyScore}
              />
              <MetricRow
                label='Precisão'
                value={`${(metrics.precisionScore * 100).toFixed(1)}%`}
                progress={metrics.precisionScore}
              />
              <MetricRow
                label='Recall'
                value={`${(metrics.recallScore * 100).toFixed(1)}%`}
                progress={metrics.recallScore}
              />
              <MetricRow
                label='F1-Score'
                value={`${(metrics.f1Score * 100).toFixed(1)}%`}
                progress={metrics.f1Score}
              />
              <Divider />
              <Box>
                <Typography variant='body2' color='textSecondary'>
                  Feedback Recebido
                </Typography>
                <Typography variant='h6'>{metrics.feedbackCount}</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Comparação de Métodos */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Comparação Detalhada dos Métodos
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Método</TableCell>
                    <TableCell align='right'>Acurácia</TableCell>
                    <TableCell align='right'>Uso</TableCell>
                    <TableCell align='right'>Performance</TableCell>
                    <TableCell align='right'>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(metrics.methodPerformance).map(([method, data]) => (
                    <TableRow key={method}>
                      <TableCell component='th' scope='row'>
                        <Box display='flex' alignItems='center' gap={1}>
                          <Chip
                            label={method.toUpperCase()}
                            size='small'
                            color={getMethodColor(method)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align='right'>{(data.accuracy * 100).toFixed(1)}%</TableCell>
                      <TableCell align='right'>{(data.usage * 100).toFixed(1)}%</TableCell>
                      <TableCell align='right'>
                        <LinearProgress
                          variant='determinate'
                          value={data.accuracy * 100}
                          sx={{ width: 60 }}
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Chip
                          label={
                            data.accuracy >= 0.8 ? 'Ótimo' : data.accuracy >= 0.6 ? 'Bom' : 'Baixo'
                          }
                          size='small'
                          color={
                            data.accuracy >= 0.8
                              ? 'success'
                              : data.accuracy >= 0.6
                                ? 'warning'
                                : 'error'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Tab Roteamento
const RoutingTab = ({ routingMetrics }) => {
  return (
    <Grid container spacing={3}>
      {/* KPIs de Roteamento */}
      <Grid item xs={12} md={3}>
        <MetricCard
          title='Roteamentos'
          value={routingMetrics.totalRoutings.toLocaleString()}
          subtitle={`${routingMetrics.activeIncidents} ativos`}
          icon={<Router />}
          color='primary'
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <MetricCard
          title='Escalações'
          value={routingMetrics.escalations}
          subtitle='Últimas 24h'
          icon={<TrendingUp />}
          color='warning'
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <MetricCard
          title='Resolução Média'
          value={`${routingMetrics.averageResolutionTime}min`}
          subtitle='Tempo médio'
          icon={<Speed />}
          color='info'
        />
      </Grid>

      <Grid item xs={12} md={3}>
        <MetricCard
          title='SLA'
          value={`${((1 - routingMetrics.slaBreachRate) * 100).toFixed(1)}%`}
          subtitle='Cumprimento'
          icon={<CheckCircle />}
          color={routingMetrics.slaBreachRate <= 0.1 ? 'success' : 'error'}
        />
      </Grid>

      {/* Utilização das Equipes */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Utilização das Equipes
            </Typography>
            <Box height={300}>
              <Bar
                data={createTeamUtilizationChart(routingMetrics.teamUtilizationRates)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 1,
                      ticks: {
                        callback: function (value) {
                          return `${(value * 100).toFixed(0)}%`;
                        },
                      },
                    },
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Distribuição por Prioridade */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Roteamentos por Prioridade
            </Typography>
            <Box height={300}>
              <Doughnut
                data={createPriorityDistributionChart(routingMetrics.routingsByPriority)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Detalhes das Equipes */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Status Detalhado das Equipes
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Equipe</TableCell>
                    <TableCell align='right'>Utilização</TableCell>
                    <TableCell align='right'>Capacidade</TableCell>
                    <TableCell align='right'>Status</TableCell>
                    <TableCell align='right'>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(routingMetrics.teamUtilizationRates).map(
                    ([team, utilization]) => (
                      <TableRow key={team}>
                        <TableCell component='th' scope='row'>
                          {team.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </TableCell>
                        <TableCell align='right'>
                          <Box display='flex' alignItems='center' gap={1}>
                            <LinearProgress
                              variant='determinate'
                              value={utilization * 100}
                              sx={{ width: 100 }}
                              color={getUtilizationColor(utilization)}
                            />
                            {(utilization * 100).toFixed(0)}%
                          </Box>
                        </TableCell>
                        <TableCell align='right'>{getTeamCapacity(team)}</TableCell>
                        <TableCell align='right'>
                          <Chip
                            label={getUtilizationStatus(utilization)}
                            size='small'
                            color={getUtilizationColor(utilization)}
                          />
                        </TableCell>
                        <TableCell align='right'>
                          <IconButton size='small'>
                            <Settings />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Tab Análise Temporal
const TemporalAnalysisTab = ({ metrics }) => {
  return (
    <Grid container spacing={3}>
      {/* Volume de Classificações */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Volume de Classificações (24h)
            </Typography>
            <Box height={300}>
              <Line
                data={createVolumeChart(metrics.classificationVolume)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Tempo de Processamento */}
      <Grid item xs={12} md={6}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Tempo de Processamento (24h)
            </Typography>
            <Box height={300}>
              <Line
                data={createProcessingTimeChart(metrics.processingTimeHistory)}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Tendências */}
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant='h6' gutterBottom>
              Análise de Tendências
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Box textAlign='center'>
                  <Typography variant='h4' color='success.main'>
                    <TrendingUp />
                  </Typography>
                  <Typography variant='h6'>+12%</Typography>
                  <Typography variant='body2' color='textSecondary'>
                    Acurácia (7 dias)
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign='center'>
                  <Typography variant='h4' color='info.main'>
                    <Speed />
                  </Typography>
                  <Typography variant='h6'>-8%</Typography>
                  <Typography variant='body2' color='textSecondary'>
                    Tempo processamento
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign='center'>
                  <Typography variant='h4' color='warning.main'>
                    <Feedback />
                  </Typography>
                  <Typography variant='h6'>+25%</Typography>
                  <Typography variant='body2' color='textSecondary'>
                    Feedback recebido
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box textAlign='center'>
                  <Typography variant='h4' color='success.main'>
                    <Psychology />
                  </Typography>
                  <Typography variant='h6'>+5%</Typography>
                  <Typography variant='body2' color='textSecondary'>
                    Confiança média
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

// Componentes auxiliares
const MetricCard = ({ title, value, subtitle, icon, color, trend, trendValue }) => (
  <Card>
    <CardContent>
      <Box display='flex' alignItems='center' justifyContent='space-between'>
        <Box>
          <Typography color='textSecondary' gutterBottom variant='body2'>
            {title}
          </Typography>
          <Typography variant='h4'>{value}</Typography>
          <Typography color='textSecondary' variant='body2'>
            {subtitle}
          </Typography>
          {trend && (
            <Box display='flex' alignItems='center' mt={1}>
              {trend === 'up' ? (
                <TrendingUp color='success' fontSize='small' />
              ) : (
                <TrendingDown color='error' fontSize='small' />
              )}
              <Typography
                variant='body2'
                color={trend === 'up' ? 'success.main' : 'error.main'}
                sx={{ ml: 0.5 }}
              >
                {trendValue}
              </Typography>
            </Box>
          )}
        </Box>
        <Box color={`${color}.main`}>{icon}</Box>
      </Box>
    </CardContent>
  </Card>
);

const MetricRow = ({ label, value, progress }) => (
  <Box>
    <Box display='flex' justifyContent='space-between' alignItems='center' mb={1}>
      <Typography variant='body2' color='textSecondary'>
        {label}
      </Typography>
      <Typography variant='body2' fontWeight='bold'>
        {value}
      </Typography>
    </Box>
    <LinearProgress
      variant='determinate'
      value={progress * 100}
      color={progress >= 0.8 ? 'success' : progress >= 0.6 ? 'warning' : 'error'}
    />
  </Box>
);

// Funções auxiliares
function generateHistoricalData(points, min, max) {
  return Array.from({ length: points }, (_, i) => ({
    time: new Date(Date.now() - (points - i) * 60 * 60 * 1000).toISOString(),
    value: min + Math.random() * (max - min),
  }));
}

function generateVolumeData(points) {
  return Array.from({ length: points }, (_, i) => ({
    time: new Date(Date.now() - (points - i) * 60 * 60 * 1000).toISOString(),
    value: Math.floor(Math.random() * 100) + 20,
  }));
}

function createCategoryDistributionChart(distribution) {
  return {
    labels: Object.keys(distribution).map(key =>
      key.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
    ),
    datasets: [
      {
        data: Object.values(distribution),
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
          '#FF9F40',
          '#FF6384',
          '#C9CBCF',
        ],
      },
    ],
  };
}

function createMethodPerformanceChart(performance) {
  return {
    labels: Object.keys(performance).map(key => key.toUpperCase()),
    datasets: [
      {
        label: 'Acurácia',
        data: Object.values(performance).map(p => p.accuracy),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
      },
      {
        label: 'Uso',
        data: Object.values(performance).map(p => p.usage),
        backgroundColor: 'rgba(255, 99, 132, 0.8)',
      },
    ],
  };
}

function createConfidenceHistoryChart(history) {
  return {
    labels: history.map(h => new Date(h.time).toLocaleTimeString()),
    datasets: [
      {
        label: 'Confiança',
        data: history.map(h => h.value),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };
}

function createTeamUtilizationChart(utilization) {
  return {
    labels: Object.keys(utilization).map(key =>
      key.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
    ),
    datasets: [
      {
        label: 'Utilização',
        data: Object.values(utilization),
        backgroundColor: Object.values(utilization).map(value =>
          value > 0.8
            ? 'rgba(255, 99, 132, 0.8)'
            : value > 0.6
              ? 'rgba(255, 206, 86, 0.8)'
              : 'rgba(75, 192, 192, 0.8)'
        ),
      },
    ],
  };
}

function createPriorityDistributionChart(distribution) {
  return {
    labels: Object.keys(distribution).map(key => key.toUpperCase()),
    datasets: [
      {
        data: Object.values(distribution),
        backgroundColor: ['#FF6384', '#FF9F40', '#FFCE56', '#4BC0C0'],
      },
    ],
  };
}

function createVolumeChart(volume) {
  return {
    labels: volume.map(v => new Date(v.time).toLocaleTimeString()),
    datasets: [
      {
        label: 'Classificações',
        data: volume.map(v => v.value),
        borderColor: 'rgb(99, 102, 241)',
        tension: 0.1,
      },
    ],
  };
}

function createProcessingTimeChart(times) {
  return {
    labels: times.map(t => new Date(t.time).toLocaleTimeString()),
    datasets: [
      {
        label: 'Tempo (ms)',
        data: times.map(t => t.value),
        borderColor: 'rgb(239, 68, 68)',
        tension: 0.1,
      },
    ],
  };
}

function getMethodColor(method) {
  const colors = {
    ml: 'primary',
    nlp: 'secondary',
    keywords: 'success',
    patterns: 'warning',
  };
  return colors[method] || 'default';
}

function getUtilizationColor(utilization) {
  if (utilization > 0.8) return 'error';
  if (utilization > 0.6) return 'warning';
  return 'success';
}

function getUtilizationStatus(utilization) {
  if (utilization > 0.8) return 'Sobrecarregado';
  if (utilization > 0.6) return 'Ocupado';
  return 'Normal';
}

function getTeamCapacity(team) {
  const capacities = {
    'mainframe-support': 8,
    'mobile-team': 10,
    'payments-team': 6,
    'web-team': 12,
    'infrastructure-team': 15,
    'dba-team': 5,
  };
  return capacities[team] || 'N/A';
}

export default CategorizationMetricsDashboard;
