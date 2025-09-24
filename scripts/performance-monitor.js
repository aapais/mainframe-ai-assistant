
/**
 * Performance Monitor - Métricas em tempo real
 */

class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.observers = [];
    }

    startTimer(operation) {
        this.metrics.set(operation, { start: performance.now() });
    }

    endTimer(operation) {
        const metric = this.metrics.get(operation);
        if (metric) {
            metric.duration = performance.now() - metric.start;
            console.log(`⏱️  ${operation}: ${metric.duration.toFixed(2)}ms`);
            return metric.duration;
        }
    }

    trackAPICall(url, method = 'GET') {
        const key = `API_${method}_${url}`;
        this.startTimer(key);
        return () => this.endTimer(key);
    }

    getMetrics() {
        const results = {};
        this.metrics.forEach((value, key) => {
            if (value.duration) {
                results[key] = value.duration;
            }
        });
        return results;
    }

    generateReport() {
        console.log('📊 RELATÓRIO DE PERFORMANCE:');
        const metrics = this.getMetrics();
        Object.entries(metrics).forEach(([operation, duration]) => {
            const status = duration < 100 ? '🟢' : duration < 500 ? '🟡' : '🔴';
            console.log(`   ${status} ${operation}: ${duration.toFixed(2)}ms`);
        });
    }
}

// Instância global
window.perfMonitor = new PerformanceMonitor();

// Interceptar fetch para monitoramento automático
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const endTimer = window.perfMonitor.trackAPICall(args[0]);
    return originalFetch.apply(this, args).finally(endTimer);
};

console.log('📈 Performance Monitor ativo');
