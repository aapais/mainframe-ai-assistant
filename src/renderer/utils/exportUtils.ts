import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
  DashboardData,
  CostData,
  Decision,
  TimelineOperation,
  UsageData,
  DateRange,
  ExportOptions,
  ExportData
} from '../types/dashboard';

// Extend jsPDF types
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

export class DashboardExporter {
  private static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    }).format(amount);
  }

  private static formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private static formatDate(date: string | Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Export dashboard data to CSV format
   */
  public static async exportToCSV(
    exportData: ExportData,
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    const { format = 'csv', dateRange, sections = ['overview'] } = options;

    const csvData: string[] = [];

    // Add header information
    csvData.push('AI Transparency Dashboard Export');
    csvData.push(`Generated: ${this.formatDate(new Date())}`);
    csvData.push(`Date Range: ${this.formatDate(dateRange?.start || '')} - ${this.formatDate(dateRange?.end || '')}`);
    csvData.push('');

    // Overview section
    if (sections.includes('overview')) {
      csvData.push('OVERVIEW');
      csvData.push('Metric,Value');
      csvData.push(`Total Operations,${exportData.summary.operations}`);
      csvData.push(`Total Cost,${this.formatCurrency(exportData.summary.totalCost)}`);
      csvData.push(`Success Rate,${exportData.summary.successRate.toFixed(1)}%`);
      csvData.push(`Average Response Time,${this.formatDuration(exportData.summary.avgResponseTime)}`);
      csvData.push(`Tokens Used,${exportData.summary.tokensUsed.toLocaleString()}`);
      csvData.push(`Cost per Operation,${this.formatCurrency(exportData.summary.costPerOperation)}`);
      csvData.push('');
    }

    // Cost data section
    if (sections.includes('costs') && exportData.costData) {
      csvData.push('COST DATA');
      csvData.push('Date,Cost,Operations,Tokens,Prediction');
      exportData.costData.forEach(item => {
        csvData.push(
          `${item.date},${item.cost},${item.operations},${item.tokens},${item.prediction || ''}`
        );
      });
      csvData.push('');
    }

    // Decisions section
    if (sections.includes('decisions') && exportData.decisions) {
      csvData.push('DECISION HISTORY');
      csvData.push('Timestamp,Operation,Type,Decision,Cost,Duration,Reason,Tokens');
      exportData.decisions.forEach(decision => {
        csvData.push(
          `${this.formatDate(decision.timestamp)},` +
          `"${decision.operation}",` +
          `${decision.operationType},` +
          `${decision.decision},` +
          `${decision.cost},` +
          `${decision.duration},` +
          `"${decision.reason || ''}",` +
          `${decision.tokens?.total || ''}`
        );
      });
      csvData.push('');
    }

    // Operations timeline section
    if (sections.includes('operations') && exportData.operations) {
      csvData.push('OPERATION TIMELINE');
      csvData.push('Timestamp,Operation,Type,Status,Duration,Cost,Tokens,Details');
      exportData.operations.forEach(operation => {
        csvData.push(
          `${this.formatDate(operation.timestamp)},` +
          `"${operation.operation}",` +
          `${operation.operationType},` +
          `${operation.status},` +
          `${operation.duration},` +
          `${operation.cost},` +
          `${operation.tokens || ''},` +
          `"${operation.details || ''}"`
        );
      });
      csvData.push('');
    }

    // Usage breakdown section
    if (sections.includes('breakdown') && exportData.usageBreakdown) {
      csvData.push('USAGE BREAKDOWN');
      csvData.push('Operation Type,Count,Cost,Tokens,Avg Duration,Success Rate');
      exportData.usageBreakdown.forEach(usage => {
        csvData.push(
          `${usage.operationType},` +
          `${usage.count},` +
          `${usage.cost},` +
          `${usage.tokens},` +
          `${usage.avgDuration},` +
          `${usage.successRate.toFixed(1)}%`
        );
      });
    }

    // Create and download CSV file
    const csvContent = csvData.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fileName = `dashboard-export-${new Date().toISOString().split('T')[0]}.csv`;
    saveAs(blob, fileName);
  }

  /**
   * Export dashboard data to Excel format
   */
  public static async exportToExcel(
    exportData: ExportData,
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    const { dateRange, sections = ['overview'] } = options;

    const workbook = XLSX.utils.book_new();

    // Overview worksheet
    if (sections.includes('overview')) {
      const overviewData = [
        ['AI Transparency Dashboard Export'],
        [`Generated: ${this.formatDate(new Date())}`],
        [`Date Range: ${this.formatDate(dateRange?.start || '')} - ${this.formatDate(dateRange?.end || '')}`],
        [],
        ['Metric', 'Value'],
        ['Total Operations', exportData.summary.operations],
        ['Total Cost', this.formatCurrency(exportData.summary.totalCost)],
        ['Success Rate', `${exportData.summary.successRate.toFixed(1)}%`],
        ['Average Response Time', this.formatDuration(exportData.summary.avgResponseTime)],
        ['Tokens Used', exportData.summary.tokensUsed.toLocaleString()],
        ['Cost per Operation', this.formatCurrency(exportData.summary.costPerOperation)]
      ];

      const overviewWS = XLSX.utils.aoa_to_sheet(overviewData);
      XLSX.utils.book_append_sheet(workbook, overviewWS, 'Overview');
    }

    // Cost data worksheet
    if (sections.includes('costs') && exportData.costData) {
      const costData = [
        ['Date', 'Cost', 'Operations', 'Tokens', 'Prediction'],
        ...exportData.costData.map(item => [
          item.date,
          item.cost,
          item.operations,
          item.tokens,
          item.prediction || ''
        ])
      ];

      const costWS = XLSX.utils.aoa_to_sheet(costData);
      XLSX.utils.book_append_sheet(workbook, costWS, 'Cost Data');
    }

    // Decisions worksheet
    if (sections.includes('decisions') && exportData.decisions) {
      const decisionsData = [
        ['Timestamp', 'Operation', 'Type', 'Decision', 'Cost', 'Duration', 'Reason', 'Tokens'],
        ...exportData.decisions.map(decision => [
          this.formatDate(decision.timestamp),
          decision.operation,
          decision.operationType,
          decision.decision,
          decision.cost,
          decision.duration,
          decision.reason || '',
          decision.tokens?.total || ''
        ])
      ];

      const decisionsWS = XLSX.utils.aoa_to_sheet(decisionsData);
      XLSX.utils.book_append_sheet(workbook, decisionsWS, 'Decisions');
    }

    // Operations worksheet
    if (sections.includes('operations') && exportData.operations) {
      const operationsData = [
        ['Timestamp', 'Operation', 'Type', 'Status', 'Duration', 'Cost', 'Tokens', 'Details'],
        ...exportData.operations.map(operation => [
          this.formatDate(operation.timestamp),
          operation.operation,
          operation.operationType,
          operation.status,
          operation.duration,
          operation.cost,
          operation.tokens || '',
          operation.details || ''
        ])
      ];

      const operationsWS = XLSX.utils.aoa_to_sheet(operationsData);
      XLSX.utils.book_append_sheet(workbook, operationsWS, 'Operations');
    }

    // Usage breakdown worksheet
    if (sections.includes('breakdown') && exportData.usageBreakdown) {
      const breakdownData = [
        ['Operation Type', 'Count', 'Cost', 'Tokens', 'Avg Duration', 'Success Rate'],
        ...exportData.usageBreakdown.map(usage => [
          usage.operationType,
          usage.count,
          usage.cost,
          usage.tokens,
          usage.avgDuration,
          `${usage.successRate.toFixed(1)}%`
        ])
      ];

      const breakdownWS = XLSX.utils.aoa_to_sheet(breakdownData);
      XLSX.utils.book_append_sheet(workbook, breakdownWS, 'Usage Breakdown');
    }

    // Generate and download Excel file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `dashboard-export-${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(blob, fileName);
  }

  /**
   * Export dashboard data to PDF format
   */
  public static async exportToPDF(
    exportData: ExportData,
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    const { dateRange, sections = ['overview'], includeCharts = false } = options;

    const doc = new jsPDF();
    let yPosition = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(160, 32, 240); // Purple color
    doc.text('AI Transparency Dashboard', 20, yPosition);
    yPosition += 10;

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Generated: ${this.formatDate(new Date())}`, 20, yPosition);
    yPosition += 5;

    if (dateRange) {
      doc.text(`Date Range: ${this.formatDate(dateRange.start)} - ${this.formatDate(dateRange.end)}`, 20, yPosition);
      yPosition += 15;
    }

    // Overview section
    if (sections.includes('overview')) {
      doc.setFontSize(16);
      doc.setTextColor(160, 32, 240);
      doc.text('Overview', 20, yPosition);
      yPosition += 10;

      const overviewData = [
        ['Metric', 'Value'],
        ['Total Operations', exportData.summary.operations.toLocaleString()],
        ['Total Cost', this.formatCurrency(exportData.summary.totalCost)],
        ['Success Rate', `${exportData.summary.successRate.toFixed(1)}%`],
        ['Average Response Time', this.formatDuration(exportData.summary.avgResponseTime)],
        ['Tokens Used', exportData.summary.tokensUsed.toLocaleString()],
        ['Cost per Operation', this.formatCurrency(exportData.summary.costPerOperation)]
      ];

      doc.autoTable({
        startY: yPosition,
        head: [overviewData[0]],
        body: overviewData.slice(1),
        theme: 'striped',
        headStyles: { fillColor: [160, 32, 240] },
        margin: { left: 20, right: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Cost data section
    if (sections.includes('costs') && exportData.costData && exportData.costData.length > 0) {
      // Check if new page is needed
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(160, 32, 240);
      doc.text('Cost Analysis', 20, yPosition);
      yPosition += 10;

      const costTableData = exportData.costData.slice(0, 20).map(item => [
        item.date,
        this.formatCurrency(item.cost),
        item.operations.toString(),
        item.tokens.toLocaleString(),
        item.prediction ? this.formatCurrency(item.prediction) : '-'
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Date', 'Cost', 'Operations', 'Tokens', 'Prediction']],
        body: costTableData,
        theme: 'striped',
        headStyles: { fillColor: [160, 32, 240] },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 8 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Decisions section
    if (sections.includes('decisions') && exportData.decisions && exportData.decisions.length > 0) {
      // Check if new page is needed
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(160, 32, 240);
      doc.text('Recent Decisions', 20, yPosition);
      yPosition += 10;

      const decisionsTableData = exportData.decisions.slice(0, 15).map(decision => [
        this.formatDate(decision.timestamp).split(',')[0], // Date only
        decision.operation.length > 30 ? decision.operation.substring(0, 27) + '...' : decision.operation,
        decision.decision.toUpperCase(),
        this.formatCurrency(decision.cost),
        this.formatDuration(decision.duration)
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Date', 'Operation', 'Decision', 'Cost', 'Duration']],
        body: decisionsTableData,
        theme: 'striped',
        headStyles: { fillColor: [160, 32, 240] },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 8 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Usage breakdown section
    if (sections.includes('breakdown') && exportData.usageBreakdown && exportData.usageBreakdown.length > 0) {
      // Check if new page is needed
      if (yPosition > 200) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setTextColor(160, 32, 240);
      doc.text('Usage Breakdown', 20, yPosition);
      yPosition += 10;

      const breakdownTableData = exportData.usageBreakdown.map(usage => [
        usage.operationType.replace('_', ' ').toUpperCase(),
        usage.count.toLocaleString(),
        this.formatCurrency(usage.cost),
        usage.tokens.toLocaleString(),
        `${usage.successRate.toFixed(1)}%`
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [['Operation Type', 'Count', 'Cost', 'Tokens', 'Success Rate']],
        body: breakdownTableData,
        theme: 'striped',
        headStyles: { fillColor: [160, 32, 240] },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 20;
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | Generated by MVP1 v8 AI Transparency Dashboard`,
        20,
        doc.internal.pageSize.height - 10
      );
    }

    // Download PDF
    const fileName = `dashboard-export-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  /**
   * Export dashboard data to JSON format
   */
  public static async exportToJSON(
    exportData: ExportData,
    options: Partial<ExportOptions> = {}
  ): Promise<void> {
    const jsonData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: 'MVP1-v8',
        format: 'json',
        ...exportData.metadata
      },
      data: exportData
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const fileName = `dashboard-export-${new Date().toISOString().split('T')[0]}.json`;
    saveAs(blob, fileName);
  }

  /**
   * Main export function that delegates to specific format handlers
   */
  public static async exportDashboard(
    exportData: ExportData,
    options: ExportOptions
  ): Promise<void> {
    try {
      switch (options.format) {
        case 'csv':
          await this.exportToCSV(exportData, options);
          break;
        case 'pdf':
          await this.exportToPDF(exportData, options);
          break;
        case 'xlsx':
          await this.exportToExcel(exportData, options);
          break;
        case 'json':
          await this.exportToJSON(exportData, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  /**
   * Generate export data from dashboard components
   */
  public static prepareExportData(
    summary: DashboardData,
    costData: CostData[],
    decisions: Decision[],
    operations: TimelineOperation[],
    usageBreakdown: UsageData[],
    dateRange: DateRange
  ): ExportData {
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        dateRange,
        totalOperations: summary.operations,
        totalCost: summary.totalCost
      },
      summary,
      costData,
      decisions,
      operations,
      usageBreakdown
    };
  }
}

// Utility functions for data formatting and validation
export const exportUtils = {
  validateExportOptions: (options: Partial<ExportOptions>): boolean => {
    if (!options.format || !['csv', 'pdf', 'xlsx', 'json'].includes(options.format)) {
      return false;
    }

    if (!options.dateRange || !options.dateRange.start || !options.dateRange.end) {
      return false;
    }

    return true;
  },

  getDefaultExportOptions: (): ExportOptions => ({
    format: 'csv',
    dateRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    },
    includeCharts: false,
    includeDetailedData: true,
    sections: ['overview', 'costs', 'decisions', 'breakdown']
  }),

  estimateFileSize: (exportData: ExportData, format: string): number => {
    // Rough estimation in KB
    const baseSize = JSON.stringify(exportData).length / 1024;

    switch (format) {
      case 'csv': return Math.round(baseSize * 0.5);
      case 'xlsx': return Math.round(baseSize * 0.8);
      case 'pdf': return Math.round(baseSize * 1.5);
      case 'json': return Math.round(baseSize);
      default: return Math.round(baseSize);
    }
  }
};