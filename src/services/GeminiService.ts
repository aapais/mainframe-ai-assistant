import axios, { AxiosInstance } from 'axios';
import type { KBEntry, SearchResult } from '../database/KnowledgeDB';

/**
 * Configuration options for Google Gemini AI service
 *
 * @interface GeminiConfig
 */
export interface GeminiConfig {
  /** Google AI API key (required) */
  apiKey: string;
  /** AI model to use (default: 'gemini-pro') */
  model?: string;
  /** Response creativity/randomness 0-1 (default: 0.3 for consistent results) */
  temperature?: number;
  /** Maximum tokens in response (default: 1024) */
  maxTokens?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * AI-powered match result with confidence scoring
 *
 * @interface MatchResult
 */
export interface MatchResult {
  /** The matched knowledge base entry */
  entry: KBEntry;
  /** AI confidence score 0-100 */
  confidence: number;
  /** AI reasoning for the match (optional) */
  reasoning?: string;
}

/**
 * Google Gemini AI Service for enhanced knowledge base operations
 *
 * Provides AI-powered features for the knowledge base including:
 * - Semantic similarity search for finding relevant entries
 * - Error code explanation and analysis
 * - Knowledge entry quality assessment
 * - Automatic tag generation
 * - Problem categorization
 *
 * All methods include fallback mechanisms for when AI services are unavailable.
 *
 * @class GeminiService
 * @example
 * ```typescript
 * import { GeminiService } from './services/GeminiService';
 *
 * const gemini = new GeminiService({
 *   apiKey: process.env.GOOGLE_AI_API_KEY,
 *   temperature: 0.3,
 *   timeout: 30000
 * });
 *
 * // Find similar entries using AI
 * const matches = await gemini.findSimilar('VSAM error', kbEntries, 5);
 *
 * // Explain an error code
 * const explanation = await gemini.explainError('S0C7');
 *
 * // Generate tags for an entry
 * const tags = await gemini.generateTags(entry);
 * ```
 */
export class GeminiService {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxTokens: number;
  private client: AxiosInstance;
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-pro';
    this.temperature = config.temperature || 0.3;
    this.maxTokens = config.maxTokens || 1024;

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Find similar knowledge base entries using AI semantic matching
   *
   * Uses Google Gemini to understand the semantic meaning of the query and match it
   * against knowledge base entries. Considers context, synonyms, and related concepts
   * beyond simple keyword matching.
   *
   * @param query - Search query describing the problem or error
   * @param entries - Array of knowledge base entries to search through
   * @param limit - Maximum number of results to return (default: 10)
   *
   * @returns Promise resolving to array of search results with AI confidence scores
   *
   * @example
   * ```typescript
   * const results = await gemini.findSimilar(
   *   'program crashes with arithmetic error',
   *   allKBEntries,
   *   5
   * );
   *
   * results.forEach(result => {
   *   console.log(`${result.entry.title}: ${result.score}% confidence`);
   *   if (result.highlights) {
   *     console.log(`Reasoning: ${result.highlights[0]}`);
   *   }
   * });
   * ```
   *
   * @throws Falls back to local fuzzy search if AI service fails
   */
  async findSimilar(
    query: string,
    entries: KBEntry[],
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      if (!entries || entries.length === 0) {
        return [];
      }

      const prompt = this.buildSimilarityPrompt(query, entries.slice(0, 30)); // Limit for API constraints
      const response = await this.generateContent(prompt);

      return this.parseSimilarityResponse(response, entries, limit);
    } catch (error) {
      console.error('Gemini findSimilar error:', error);

      // Fallback to local fuzzy search
      return this.fallbackLocalSearch(query, entries, limit);
    }
  }

  /**
   * Explain a mainframe error code in simple terms
   */
  async explainError(errorCode: string): Promise<string> {
    try {
      const prompt = this.buildErrorExplanationPrompt(errorCode);
      const response = await this.generateContent(prompt);

      return this.extractTextResponse(response);
    } catch (error) {
      console.error('Gemini explainError error:', error);
      return this.getFallbackErrorExplanation(errorCode);
    }
  }

  /**
   * Analyze and suggest improvements for a knowledge base entry
   */
  async analyzeEntry(entry: KBEntry): Promise<{
    suggestions: string[];
    clarity: number;
    completeness: number;
  }> {
    try {
      const prompt = this.buildEntryAnalysisPrompt(entry);
      const response = await this.generateContent(prompt);

      return this.parseAnalysisResponse(response);
    } catch (error) {
      console.error('Gemini analyzeEntry error:', error);
      return {
        suggestions: ['Unable to analyze entry - AI service unavailable'],
        clarity: 50,
        completeness: 50,
      };
    }
  }

  /**
   * Generate tags for a knowledge base entry
   */
  async generateTags(entry: KBEntry): Promise<string[]> {
    try {
      const prompt = this.buildTagGenerationPrompt(entry);
      const response = await this.generateContent(prompt);

      return this.parseTagsResponse(response);
    } catch (error) {
      console.error('Gemini generateTags error:', error);
      return this.fallbackTagGeneration(entry);
    }
  }

  /**
   * Categorize a problem description
   */
  async categorizeproblem(problemDescription: string): Promise<{
    category: string;
    confidence: number;
  }> {
    try {
      const prompt = this.buildCategorizationPrompt(problemDescription);
      const response = await this.generateContent(prompt);

      return this.parseCategorizationResponse(response);
    } catch (error) {
      console.error('Gemini categorizeError error:', error);
      return this.fallbackCategorization(problemDescription);
    }
  }

  // Private methods

  private async generateContent(prompt: string): Promise<any> {
    const response = await this.client.post(`/models/${this.model}:generateContent`, {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: this.temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: this.maxTokens,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });

    return response.data;
  }

  private buildSimilarityPrompt(query: string, entries: KBEntry[]): string {
    const entriesText = entries
      .slice(0, 20)
      .map(
        (entry, index) =>
          `[${index}] Category: ${entry.category}\n` +
          `Title: ${entry.title}\n` +
          `Problem: ${entry.problem.substring(0, 200)}${entry.problem.length > 200 ? '...' : ''}\n` +
          `Success Rate: ${this.calculateSuccessRate(entry)}%\n`
      )
      .join('\n---\n');

    return `You are a mainframe systems expert helping to find the most relevant knowledge base entries for a user's query.

Query: "${query}"

Available Knowledge Base Entries:
${entriesText}

Instructions:
1. Identify entries that could help solve the user's query
2. Consider semantic similarity, not just keyword matching  
3. Prioritize entries with higher success rates
4. Look for patterns in error codes, system components, and problem types
5. Consider synonyms and related concepts (e.g., "S0C7" relates to "data exception", "VSAM" relates to "file access")

Return the top 5 most relevant entries in this exact format:
index:confidence_score:brief_reasoning

Example:
0:95:Direct match for S0C7 data exception error
3:85:Similar VSAM file access issue with proven solution
7:75:Related JCL allocation problem

Only return the formatted results, nothing else.`;
  }

  private buildErrorExplanationPrompt(errorCode: string): string {
    return `You are a mainframe systems expert. Explain this error code in clear, practical terms:

Error Code: ${errorCode}

Provide:
1. What this error means in simple language
2. The most common causes (top 3-4)  
3. Typical resolution steps
4. Prevention tips

Keep the explanation practical and actionable for support teams. Use clear language and avoid overly technical jargon.`;
  }

  private buildEntryAnalysisPrompt(entry: KBEntry): string {
    return `Analyze this knowledge base entry for clarity and completeness:

Title: ${entry.title}
Problem: ${entry.problem}
Solution: ${entry.solution}
Category: ${entry.category}

Evaluate:
1. Is the problem description clear and specific?
2. Are the solution steps actionable and complete?
3. Are there missing details that could help troubleshooting?
4. How could this entry be improved?

Return your analysis in this JSON format:
{
  "clarity": 85,
  "completeness": 90,
  "suggestions": [
    "Add specific error messages to problem description",
    "Include validation steps for the solution"
  ]
}`;
  }

  private buildTagGenerationPrompt(entry: KBEntry): string {
    return `Generate relevant tags for this knowledge base entry:

Title: ${entry.title}
Problem: ${entry.problem}
Solution: ${entry.solution}
Category: ${entry.category}

Generate 5-8 specific, useful tags that would help users find this entry. Focus on:
- Technical terms and error codes
- System components  
- Problem types
- Solution methods

Return only the tags as a comma-separated list, no explanations.`;
  }

  private buildCategorizationPrompt(problemDescription: string): string {
    return `Categorize this mainframe problem into one of these categories:

Categories: JCL, VSAM, DB2, Batch, CICS, IMS, System, Network, Security, Other

Problem: ${problemDescription}

Return your response in this exact format:
category:confidence_score

Where confidence_score is 0-100. Example: JCL:95`;
  }

  private parseSimilarityResponse(
    response: any,
    entries: KBEntry[],
    limit: number
  ): SearchResult[] {
    try {
      const text = this.extractTextResponse(response);
      const lines = text
        .trim()
        .split('\n')
        .filter(line => line.trim());

      const results: SearchResult[] = [];

      for (const line of lines) {
        const match = line.match(/^(\d+):(\d+):(.*)$/);
        if (match) {
          const [, indexStr, confidenceStr, reasoning] = match;
          const index = parseInt(indexStr);
          const confidence = parseInt(confidenceStr);

          if (index < entries.length && confidence >= 50) {
            results.push({
              entry: entries[index],
              score: confidence,
              matchType: 'ai',
              highlights: [reasoning.trim()],
            });
          }
        }
      }

      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error('Error parsing similarity response:', error);
      return this.fallbackLocalSearch('', entries, limit);
    }
  }

  private parseAnalysisResponse(response: any): {
    suggestions: string[];
    clarity: number;
    completeness: number;
  } {
    try {
      const text = this.extractTextResponse(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestions: parsed.suggestions || [],
          clarity: parsed.clarity || 50,
          completeness: parsed.completeness || 50,
        };
      }

      throw new Error('Could not parse JSON response');
    } catch (error) {
      return {
        suggestions: ['Unable to analyze entry format'],
        clarity: 50,
        completeness: 50,
      };
    }
  }

  private parseTagsResponse(response: any): string[] {
    try {
      const text = this.extractTextResponse(response);
      return text
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0 && tag.length < 20)
        .slice(0, 8);
    } catch (error) {
      return [];
    }
  }

  private parseCategorizationResponse(response: any): {
    category: string;
    confidence: number;
  } {
    try {
      const text = this.extractTextResponse(response);
      const match = text.match(/^(\w+):(\d+)$/);

      if (match) {
        return {
          category: match[1],
          confidence: parseInt(match[2]),
        };
      }

      throw new Error('Could not parse categorization response');
    } catch (error) {
      return { category: 'Other', confidence: 50 };
    }
  }

  private extractTextResponse(response: any): string {
    if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid response format from Gemini API');
  }

  private fallbackLocalSearch(query: string, entries: KBEntry[], limit: number): SearchResult[] {
    const queryLower = query.toLowerCase();
    const keywords = queryLower.split(/\s+/).filter(k => k.length > 2);

    const scored = entries.map(entry => {
      const text = `${entry.title} ${entry.problem} ${entry.solution}`.toLowerCase();
      let score = 0;

      // Exact phrase match
      if (text.includes(queryLower)) {
        score += 50;
      }

      // Keyword matches
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          if (entry.title.toLowerCase().includes(keyword)) score += 15;
          if (entry.problem.toLowerCase().includes(keyword)) score += 10;
          if (entry.solution.toLowerCase().includes(keyword)) score += 5;
        }
      });

      // Category boost
      if (entry.category && queryLower.includes(entry.category.toLowerCase())) {
        score += 20;
      }

      // Success rate boost
      const successRate = this.calculateSuccessRate(entry);
      score += successRate * 0.2;

      return { entry, score, matchType: 'fuzzy' as const };
    });

    return scored
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private getFallbackErrorExplanation(errorCode: string): string {
    // Common mainframe error explanations as fallback
    const commonErrors: Record<string, string> = {
      S0C7: 'Data Exception - Invalid numeric data encountered during arithmetic operation. Check for uninitialized COMP-3 fields, invalid packed decimal data, or incorrect MOVE statements.',
      S0C4: 'Protection Exception - Program attempted to access storage outside its allocated area. Check for array bounds, uninitialized pointers, or corrupted control blocks.',
      S0C1: 'Operation Exception - Invalid operation code or operand. Check for corrupted program load or storage overlay issues.',
      S806: 'Program Not Found - The specified program could not be located. Verify STEPLIB, JOBLIB, or system libraries contain the program.',
      S813: 'Open Error - Dataset could not be opened. Check dataset existence, disposition conflicts, or allocation issues.',
      S822: 'Invalid Region Size - Insufficient storage allocated for the job step. Increase REGION parameter or check memory usage.',
      IEF212I: 'Dataset Not Found - Specified dataset does not exist or is not cataloged properly.',
      IEF344I:
        'Dataset Busy - Resource is allocated to another job. Wait for completion or use DISP=SHR if appropriate.',
    };

    return (
      commonErrors[errorCode] ||
      `Error code ${errorCode} - Please check mainframe documentation for detailed information. Common troubleshooting steps: 1) Check system logs, 2) Verify resource availability, 3) Review recent changes, 4) Contact system administrator if issue persists.`
    );
  }

  private fallbackTagGeneration(entry: KBEntry): string[] {
    const tags: string[] = [];

    // Add category as tag
    if (entry.category) {
      tags.push(entry.category.toLowerCase());
    }

    // Extract error codes
    const text = `${entry.title} ${entry.problem} ${entry.solution}`;
    const errorCodes = text.match(/[SA-Z]\d{3,4}[A-Z]?/g);
    if (errorCodes) {
      tags.push(...errorCodes.map(code => code.toLowerCase()));
    }

    // Extract common mainframe terms
    const mainframeTerms = [
      'jcl',
      'vsam',
      'db2',
      'cics',
      'ims',
      'cobol',
      'pli',
      'assembler',
      'dataset',
      'catalog',
      'sysout',
      'abend',
      'allocation',
      'storage',
    ];

    mainframeTerms.forEach(term => {
      if (text.toLowerCase().includes(term)) {
        tags.push(term);
      }
    });

    return [...new Set(tags)].slice(0, 8); // Remove duplicates and limit
  }

  private fallbackCategorization(problemDescription: string): {
    category: string;
    confidence: number;
  } {
    const text = problemDescription.toLowerCase();

    if (text.includes('jcl') || text.includes('job') || text.includes('step')) {
      return { category: 'JCL', confidence: 70 };
    }
    if (text.includes('vsam') || text.includes('file') || text.includes('dataset')) {
      return { category: 'VSAM', confidence: 70 };
    }
    if (text.includes('db2') || text.includes('sql') || text.includes('database')) {
      return { category: 'DB2', confidence: 70 };
    }
    if (text.includes('cics') || text.includes('transaction')) {
      return { category: 'CICS', confidence: 70 };
    }
    if (text.includes('batch') || text.includes('program') || text.includes('cobol')) {
      return { category: 'Batch', confidence: 70 };
    }

    return { category: 'Other', confidence: 50 };
  }

  private calculateSuccessRate(entry: KBEntry): number {
    const total = (entry.success_count || 0) + (entry.failure_count || 0);
    if (total === 0) return 50; // Default for new entries

    return Math.round(((entry.success_count || 0) / total) * 100);
  }
}
