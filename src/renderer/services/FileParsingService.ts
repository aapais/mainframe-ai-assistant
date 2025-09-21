/**
 * File Parsing Service
 * Handles parsing of various file formats for bulk incident import
 */

import { IncidentKBEntry } from '../../types/incident';

export class FileParsingService {
  /**
   * Parse uploaded file and extract incident data
   */
  async parseFile(file: File): Promise<IncidentKBEntry[]> {
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
      if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        return await this.parseTxtFile(file);
      } else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
        return await this.parseCsvFile(file);
      } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        return await this.parsePdfFile(file);
      } else if (
        fileType === 'application/msword' ||
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.doc') ||
        fileName.endsWith('.docx')
      ) {
        return await this.parseWordFile(file);
      } else if (
        fileType === 'application/vnd.ms-excel' ||
        fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        fileName.endsWith('.xls') ||
        fileName.endsWith('.xlsx')
      ) {
        return await this.parseExcelFile(file);
      } else {
        throw new Error(`Tipo de arquivo não suportado: ${file.name}`);
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      throw new Error(`Erro ao processar arquivo ${file.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Parse plain text files
   * Expects format: Title|Problem|Solution|Category|Priority
   */
  private async parseTxtFile(file: File): Promise<IncidentKBEntry[]> {
    const content = await file.text();
    const lines = content.split('\n').filter(line => line.trim());
    const incidents: IncidentKBEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Try pipe-delimited format first
        if (line.includes('|')) {
          const parts = line.split('|').map(p => p.trim());
          if (parts.length >= 3) {
            incidents.push(this.createIncidentFromParts({
              title: parts[0],
              problem: parts[1],
              solution: parts[2] || parts[1], // Use problem as solution if not provided
              category: parts[3] || 'General',
              priority: this.validatePriority(parts[4]) || 'P3'
            }));
            continue;
          }
        }

        // Try structured text format
        const incident = this.parseStructuredText(line, lines.slice(i + 1, i + 10));
        if (incident) {
          incidents.push(incident);
        }
      } catch (error) {
        console.warn(`Error parsing line ${i + 1}: ${error}`);
        // Continue with next line
      }
    }

    if (incidents.length === 0) {
      // Fallback: Create one incident from entire content
      incidents.push(this.createIncidentFromContent(file.name, content));
    }

    return incidents;
  }

  /**
   * Parse CSV files
   * Expects headers: title,problem,solution,category,priority
   */
  private async parseCsvFile(file: File): Promise<IncidentKBEntry[]> {
    const content = await file.text();
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('Arquivo CSV vazio');
    }

    const incidents: IncidentKBEntry[] = [];
    const headers = this.parseCsvLine(lines[0]).map(h => h.toLowerCase().trim());

    // Find column indices
    const titleIndex = this.findColumnIndex(headers, ['title', 'titulo', 'incidente', 'incident']);
    const problemIndex = this.findColumnIndex(headers, ['problem', 'problema', 'description', 'descricao']);
    const solutionIndex = this.findColumnIndex(headers, ['solution', 'solucao', 'resolution', 'resolucao']);
    const categoryIndex = this.findColumnIndex(headers, ['category', 'categoria', 'type', 'tipo']);
    const priorityIndex = this.findColumnIndex(headers, ['priority', 'prioridade', 'pri']);

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCsvLine(line);

        if (titleIndex >= 0 && values[titleIndex]) {
          incidents.push(this.createIncidentFromParts({
            title: values[titleIndex] || `Incident from ${file.name} line ${i + 1}`,
            problem: values[problemIndex] || values[titleIndex] || 'No problem description',
            solution: values[solutionIndex] || values[problemIndex] || values[titleIndex] || 'Solution to be determined',
            category: values[categoryIndex] || 'General',
            priority: this.validatePriority(values[priorityIndex]) || 'P3'
          }));
        }
      } catch (error) {
        console.warn(`Error parsing CSV line ${i + 1}: ${error}`);
      }
    }

    if (incidents.length === 0) {
      throw new Error('Nenhum incidente válido encontrado no arquivo CSV');
    }

    return incidents;
  }

  /**
   * Parse PDF files (mock implementation)
   * In a real implementation, you would use a PDF parsing library
   */
  private async parsePdfFile(file: File): Promise<IncidentKBEntry[]> {
    // Mock implementation - in real scenario, use libraries like pdf-parse or PDF.js
    console.log('PDF parsing - mock implementation for', file.name);

    // Create a placeholder incident for PDF
    return [this.createIncidentFromContent(
      `PDF Import: ${file.name}`,
      `Incident imported from PDF file: ${file.name}. ` +
      `File size: ${(file.size / 1024).toFixed(1)}KB. ` +
      `Please review and update the content with actual incident details.`
    )];
  }

  /**
   * Parse Word documents (mock implementation)
   * In a real implementation, you would use a library like mammoth.js
   */
  private async parseWordFile(file: File): Promise<IncidentKBEntry[]> {
    // Mock implementation - in real scenario, use libraries like mammoth.js
    console.log('Word document parsing - mock implementation for', file.name);

    // Create a placeholder incident for Word document
    return [this.createIncidentFromContent(
      `Word Import: ${file.name}`,
      `Incident imported from Word document: ${file.name}. ` +
      `File size: ${(file.size / 1024).toFixed(1)}KB. ` +
      `Please review and update the content with actual incident details.`
    )];
  }

  /**
   * Parse Excel files (mock implementation)
   * In a real implementation, you would use a library like xlsx or exceljs
   */
  private async parseExcelFile(file: File): Promise<IncidentKBEntry[]> {
    // Mock implementation - in real scenario, use libraries like xlsx
    console.log('Excel parsing - mock implementation for', file.name);

    // Create a placeholder incident for Excel
    return [this.createIncidentFromContent(
      `Excel Import: ${file.name}`,
      `Incident imported from Excel file: ${file.name}. ` +
      `File size: ${(file.size / 1024).toFixed(1)}KB. ` +
      `Please review and update the content with actual incident details. ` +
      `Expected format: Title | Problem | Solution | Category | Priority in columns.`
    )];
  }

  /**
   * Parse structured text format
   */
  private parseStructuredText(firstLine: string, nextLines: string[]): IncidentKBEntry | null {
    const title = firstLine;
    let problem = '';
    let solution = '';
    let category = 'General';
    let priority = 'P3';

    // Look for structured patterns in next lines
    for (const line of nextLines) {
      const lowerLine = line.toLowerCase().trim();
      if (lowerLine.startsWith('problem:') || lowerLine.startsWith('problema:')) {
        problem = line.substring(line.indexOf(':') + 1).trim();
      } else if (lowerLine.startsWith('solution:') || lowerLine.startsWith('solução:') || lowerLine.startsWith('solucao:')) {
        solution = line.substring(line.indexOf(':') + 1).trim();
      } else if (lowerLine.startsWith('category:') || lowerLine.startsWith('categoria:')) {
        category = line.substring(line.indexOf(':') + 1).trim();
      } else if (lowerLine.startsWith('priority:') || lowerLine.startsWith('prioridade:')) {
        priority = this.validatePriority(line.substring(line.indexOf(':') + 1).trim()) || 'P3';
      }
    }

    if (title && (problem || solution)) {
      return this.createIncidentFromParts({
        title,
        problem: problem || title,
        solution: solution || problem || title,
        category,
        priority
      });
    }

    return null;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Find column index by possible header names
   */
  private findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
      const index = headers.findIndex(h => h.includes(name));
      if (index >= 0) return index;
    }
    return -1;
  }

  /**
   * Validate and normalize priority
   */
  private validatePriority(priority?: string): 'P1' | 'P2' | 'P3' | 'P4' | null {
    if (!priority) return null;

    const normalizedPriority = priority.toUpperCase().trim();

    if (['P1', 'P2', 'P3', 'P4'].includes(normalizedPriority)) {
      return normalizedPriority as 'P1' | 'P2' | 'P3' | 'P4';
    }

    // Try to map other priority formats
    if (['HIGH', 'ALTO', 'CRITICAL', 'CRITICO', '1'].includes(normalizedPriority)) {
      return 'P1';
    }
    if (['MEDIUM', 'MEDIO', '2'].includes(normalizedPriority)) {
      return 'P2';
    }
    if (['LOW', 'BAIXO', '3', '4'].includes(normalizedPriority)) {
      return 'P3';
    }

    return null;
  }

  /**
   * Create incident from structured parts
   */
  private createIncidentFromParts(parts: {
    title: string;
    problem: string;
    solution: string;
    category: string;
    priority: string;
  }): IncidentKBEntry {
    const now = new Date();
    const incidentNumber = `INC-BULK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    return {
      id: `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: parts.title,
      problem: parts.problem,
      solution: parts.solution,
      category: parts.category,
      tags: this.generateTags(parts.title, parts.problem, parts.category),
      created_at: now,
      updated_at: now,
      created_by: 'bulk_import',
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      version: 1,
      status: 'em_revisao',
      priority: parts.priority as 'P1' | 'P2' | 'P3' | 'P4',
      escalation_level: 'none',
      business_impact: this.determinBusinessImpact(parts.priority as 'P1' | 'P2' | 'P3' | 'P4'),
      customer_impact: false,
      incident_number: incidentNumber,
      reporter: 'bulk_import'
    };
  }

  /**
   * Create incident from general content
   */
  private createIncidentFromContent(title: string, content: string): IncidentKBEntry {
    const now = new Date();
    const incidentNumber = `INC-BULK-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    return {
      id: `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title,
      problem: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      solution: 'To be determined - imported from file',
      category: 'General',
      tags: ['bulk_import', 'review_needed'],
      created_at: now,
      updated_at: now,
      created_by: 'bulk_import',
      usage_count: 0,
      success_count: 0,
      failure_count: 0,
      version: 1,
      status: 'em_revisao',
      priority: 'P3',
      escalation_level: 'none',
      business_impact: 'medium',
      customer_impact: false,
      incident_number: incidentNumber,
      reporter: 'bulk_import'
    };
  }

  /**
   * Generate tags from content
   */
  private generateTags(title: string, problem: string, category: string): string[] {
    const tags = ['bulk_import'];

    // Add category as tag
    if (category && category !== 'General') {
      tags.push(category.toLowerCase().replace(/\s+/g, '_'));
    }

    // Extract potential tags from title and problem
    const content = `${title} ${problem}`.toLowerCase();
    const commonTerms = [
      'jcl', 'db2', 'vsam', 'cobol', 'cics', 'ims', 'mainframe',
      'sql', 'database', 'connection', 'performance', 'error',
      'timeout', 'memory', 'cpu', 'disk', 'network'
    ];

    commonTerms.forEach(term => {
      if (content.includes(term)) {
        tags.push(term);
      }
    });

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Determine business impact from priority
   */
  private determinBusinessImpact(priority: 'P1' | 'P2' | 'P3' | 'P4'): 'low' | 'medium' | 'high' | 'critical' {
    switch (priority) {
      case 'P1': return 'critical';
      case 'P2': return 'high';
      case 'P3': return 'medium';
      case 'P4': return 'low';
      default: return 'medium';
    }
  }
}

export default FileParsingService;