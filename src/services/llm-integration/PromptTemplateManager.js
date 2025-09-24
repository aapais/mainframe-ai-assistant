/**
 * Prompt Template Manager - Specialized Banking Domain Templates
 * Manages prompt templates for different banking use cases with context injection
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../core/logging/Logger');

class PromptTemplate {
    constructor(name, content, variables = [], metadata = {}) {
        this.name = name;
        this.content = content;
        this.variables = variables;
        this.metadata = {
            domain: metadata.domain || 'banking',
            category: metadata.category || 'general',
            complexity: metadata.complexity || 'medium',
            compliance: metadata.compliance || 'standard',
            version: metadata.version || '1.0',
            lastUpdated: metadata.lastUpdated || new Date().toISOString(),
            ...metadata
        };
    }

    format(variables = {}) {
        let formatted = this.content;

        // Replace template variables
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            formatted = formatted.replace(regex, String(value || ''));
        }

        // Check for missing variables
        const missingVars = this.variables.filter(varName =>
            !(varName in variables) && formatted.includes(`{{${varName}}}`)
        );

        if (missingVars.length > 0) {
            logger.warn(`Missing template variables: ${missingVars.join(', ')} in template ${this.name}`);
        }

        return formatted;
    }

    validate() {
        const errors = [];

        if (!this.name || this.name.trim() === '') {
            errors.push('Template name is required');
        }

        if (!this.content || this.content.trim() === '') {
            errors.push('Template content is required');
        }

        // Check for undefined template variables
        const templateVarPattern = /\{\{(\w+)\}\}/g;
        const usedVars = [...this.content.matchAll(templateVarPattern)].map(match => match[1]);
        const undeclaredVars = usedVars.filter(varName => !this.variables.includes(varName));

        if (undeclaredVars.length > 0) {
            errors.push(`Undeclared variables: ${undeclaredVars.join(', ')}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

class PromptTemplateManager {
    constructor(config = {}) {
        this.config = {
            templatesDir: config.templatesDir || path.join(__dirname, 'templates'),
            cacheEnabled: config.cacheEnabled ?? true,
            cacheTTL: config.cacheTTL || 3600000, // 1 hour
            autoReload: config.autoReload ?? false,
            validationEnabled: config.validationEnabled ?? true
        };

        this.templates = new Map();
        this.cache = new Map();
        this.watchers = new Map();

        this.initialize();
    }

    async initialize() {
        try {
            await this.loadBankingTemplates();

            if (this.config.autoReload) {
                await this.setupFileWatchers();
            }

            logger.info('PromptTemplateManager initialized with banking domain templates');
        } catch (error) {
            logger.error('Failed to initialize PromptTemplateManager:', error);
            throw error;
        }
    }

    /**
     * Load predefined banking templates
     */
    async loadBankingTemplates() {
        const bankingTemplates = this.getBankingTemplates();

        for (const [name, templateData] of Object.entries(bankingTemplates)) {
            const template = new PromptTemplate(
                name,
                templateData.content,
                templateData.variables,
                templateData.metadata
            );

            if (this.config.validationEnabled) {
                const validation = template.validate();
                if (!validation.isValid) {
                    logger.warn(`Template ${name} validation failed:`, validation.errors);
                    continue;
                }
            }

            this.templates.set(name, template);
            logger.debug(`Loaded banking template: ${name}`);
        }
    }

    /**
     * Predefined banking domain templates
     */
    getBankingTemplates() {
        return {
            fraud_detection: {
                content: `You are an expert fraud detection analyst for a banking institution. Analyze the following transaction data for potential fraud indicators.

Transaction Details:
{{transaction}}

Analysis Context:
{{context}}

Please provide a comprehensive fraud risk assessment including:

1. **Risk Score** (0-100): Overall fraud probability
2. **Risk Factors**: Specific indicators that suggest fraudulent activity
3. **Behavioral Patterns**: Unusual patterns compared to customer's normal behavior
4. **Geographic Analysis**: Location-based risk factors
5. **Temporal Analysis**: Time-based anomalies
6. **Recommendations**: Immediate actions recommended

Use the following risk categories:
- **Low Risk (0-30)**: Standard transaction processing
- **Medium Risk (31-70)**: Additional verification recommended
- **High Risk (71-100)**: Immediate investigation required

Format your response as a structured analysis with clear risk levels and actionable recommendations.`,
                variables: ['transaction', 'context'],
                metadata: {
                    category: 'fraud_detection',
                    complexity: 'high',
                    compliance: 'strict',
                    requiredClearance: 'confidential'
                }
            },

            compliance_check: {
                content: `You are a banking compliance expert specializing in regulatory analysis. Review the following document for compliance with banking regulations.

Document to Review:
{{document}}

Applicable Regulations:
{{regulations}}

Compliance Severity Level: {{severity}}

Please provide a detailed compliance assessment including:

1. **Compliance Status**: Overall compliance rating (Compliant/Minor Issues/Major Issues/Non-Compliant)
2. **Regulatory Violations**: Specific violations identified with regulation references
3. **Risk Assessment**: Potential regulatory risks and their severity
4. **Corrective Actions**: Required actions to achieve compliance
5. **Timeline**: Recommended timeline for implementing corrections
6. **Documentation**: Additional documentation requirements

Key Areas to Analyze:
- Anti-Money Laundering (AML) requirements
- Know Your Customer (KYC) protocols
- Data protection and privacy regulations
- Capital adequacy requirements
- Consumer protection laws
- Risk management frameworks

Provide specific regulation citations and actionable recommendations.`,
                variables: ['document', 'regulations', 'severity'],
                metadata: {
                    category: 'compliance',
                    complexity: 'high',
                    compliance: 'strict',
                    requiredClearance: 'confidential'
                }
            },

            risk_analysis: {
                content: `You are a senior risk analyst in a banking institution. Perform a comprehensive risk analysis on the provided data.

Risk Analysis Data:
{{data}}

Risk Type: {{riskType}}
Analysis Criteria: {{criteria}}

Please provide a thorough risk assessment including:

1. **Executive Summary**: High-level risk overview and key findings
2. **Risk Categories**:
   - Credit Risk: Default probability and loss given default
   - Market Risk: Market volatility and exposure analysis
   - Operational Risk: Process and system vulnerabilities
   - Liquidity Risk: Cash flow and funding adequacy
   - Regulatory Risk: Compliance and regulatory change impact

3. **Quantitative Analysis**:
   - Risk metrics and key performance indicators
   - Statistical analysis and probability distributions
   - Stress testing scenarios and results
   - Value at Risk (VaR) calculations where applicable

4. **Qualitative Assessment**:
   - Risk drivers and root cause analysis
   - Industry and economic factors
   - Competitive landscape impact
   - Management quality assessment

5. **Risk Mitigation**:
   - Current risk controls effectiveness
   - Recommended risk mitigation strategies
   - Implementation roadmap and resource requirements

6. **Monitoring and Reporting**:
   - Key risk indicators (KRIs) to monitor
   - Reporting frequency and escalation procedures
   - Risk tolerance and appetite alignment

Provide data-driven insights with specific recommendations and implementation timelines.`,
                variables: ['data', 'riskType', 'criteria'],
                metadata: {
                    category: 'risk_management',
                    complexity: 'high',
                    compliance: 'standard'
                }
            },

            customer_service: {
                content: `You are a knowledgeable banking customer service specialist. Provide helpful, accurate, and compliant assistance to the customer.

Customer Inquiry:
{{inquiry}}

Customer Context:
{{customerContext}}

Account Information:
{{accountInfo}}

Please provide customer service assistance following these guidelines:

1. **Professional Response**: Maintain a helpful, professional, and empathetic tone
2. **Accurate Information**: Provide only verified and accurate banking information
3. **Compliance**: Ensure all responses comply with banking regulations and privacy laws
4. **Security**: Never reveal sensitive information without proper authentication
5. **Problem Resolution**: Offer clear solutions and next steps

Response Structure:
1. **Acknowledgment**: Acknowledge the customer's concern
2. **Solution**: Provide clear solution or explanation
3. **Next Steps**: Outline any required actions
4. **Additional Resources**: Suggest relevant resources or contacts
5. **Follow-up**: Mention follow-up procedures if applicable

Important Notes:
- Always verify customer identity before discussing account details
- Escalate complex issues to specialized departments
- Document all customer interactions
- Offer alternative solutions when primary solution isn't available
- Maintain confidentiality and data protection standards`,
                variables: ['inquiry', 'customerContext', 'accountInfo'],
                metadata: {
                    category: 'customer_service',
                    complexity: 'medium',
                    compliance: 'standard'
                }
            },

            transaction_analysis: {
                content: `You are a banking transaction analyst specializing in payment flow analysis and anomaly detection.

Transaction Data:
{{transactionData}}

Analysis Period: {{period}}
Focus Areas: {{focusAreas}}

Please provide a comprehensive transaction analysis including:

1. **Transaction Summary**:
   - Total volume and value processed
   - Transaction types breakdown
   - Geographic distribution
   - Temporal patterns

2. **Pattern Analysis**:
   - Normal vs. abnormal transaction patterns
   - Frequency analysis and trends
   - Seasonal variations and cyclical patterns
   - Customer behavior segmentation

3. **Anomaly Detection**:
   - Unusual transaction amounts or frequencies
   - Geographic anomalies
   - Time-based irregularities
   - Cross-account pattern analysis

4. **Risk Indicators**:
   - Suspicious activity indicators
   - Money laundering red flags
   - Fraud probability scores
   - Regulatory reporting requirements

5. **Performance Metrics**:
   - Processing times and efficiency
   - Success rates and failure analysis
   - System performance indicators
   - Cost analysis and optimization opportunities

6. **Recommendations**:
   - Process improvements
   - Risk mitigation measures
   - System enhancements
   - Monitoring adjustments

Provide actionable insights with supporting data and clear recommendations.`,
                variables: ['transactionData', 'period', 'focusAreas'],
                metadata: {
                    category: 'transaction_analysis',
                    complexity: 'high',
                    compliance: 'standard'
                }
            },

            regulatory_report: {
                content: `You are a regulatory reporting specialist preparing compliance reports for banking authorities.

Report Data:
{{reportData}}

Regulatory Framework: {{framework}}
Reporting Period: {{period}}
Jurisdiction: {{jurisdiction}}

Please prepare a comprehensive regulatory report including:

1. **Executive Summary**:
   - Key findings and compliance status
   - Material changes from previous period
   - Critical issues requiring attention

2. **Regulatory Framework Compliance**:
   - Basel III compliance metrics
   - Capital adequacy ratios
   - Liquidity coverage requirements
   - Leverage ratio calculations

3. **Risk Management**:
   - Risk appetite and tolerance levels
   - Risk assessment methodology
   - Stress testing results
   - Risk mitigation effectiveness

4. **Financial Performance**:
   - Profitability analysis
   - Asset quality metrics
   - Provisioning adequacy
   - Market risk exposure

5. **Operational Metrics**:
   - Operational risk events
   - Business continuity effectiveness
   - Cybersecurity posture
   - Third-party risk management

6. **Forward-Looking Statements**:
   - Projected compliance trajectory
   - Planned remediation activities
   - Strategic initiatives impact
   - Regulatory change preparation

7. **Supporting Documentation**:
   - Data sources and methodology
   - Assumptions and limitations
   - Quality assurance procedures
   - Independent validation results

Ensure all reporting follows regulatory guidelines and includes required disclosures.`,
                variables: ['reportData', 'framework', 'period', 'jurisdiction'],
                metadata: {
                    category: 'regulatory_reporting',
                    complexity: 'high',
                    compliance: 'strict',
                    requiredClearance: 'confidential'
                }
            },

            credit_assessment: {
                content: `You are a credit risk analyst conducting a comprehensive creditworthiness assessment.

Applicant Information:
{{applicantData}}

Credit History:
{{creditHistory}}

Financial Statements:
{{financialData}}

Assessment Type: {{assessmentType}}

Please provide a detailed credit assessment including:

1. **Credit Score Analysis**:
   - Overall credit score and rating
   - Score components breakdown
   - Historical score trends
   - Comparative industry analysis

2. **Financial Health Assessment**:
   - Income stability and adequacy
   - Debt-to-income ratios
   - Cash flow analysis
   - Asset and liability evaluation

3. **Risk Factors**:
   - Payment history analysis
   - Credit utilization patterns
   - Recent credit inquiries
   - Account diversity and management

4. **Behavioral Indicators**:
   - Banking relationship history
   - Transaction patterns
   - Financial management behaviors
   - Economic stress indicators

5. **Credit Decision Recommendation**:
   - Approval/denial recommendation
   - Suggested credit limit or loan amount
   - Interest rate and terms recommendation
   - Required conditions or monitoring

6. **Risk Mitigation**:
   - Collateral requirements
   - Guarantor recommendations
   - Monitoring requirements
   - Review schedule

Provide a data-driven assessment with clear rationale for all recommendations.`,
                variables: ['applicantData', 'creditHistory', 'financialData', 'assessmentType'],
                metadata: {
                    category: 'credit_assessment',
                    complexity: 'high',
                    compliance: 'strict'
                }
            },

            market_analysis: {
                content: `You are a banking market analyst providing strategic market intelligence and analysis.

Market Data:
{{marketData}}

Analysis Scope: {{scope}}
Time Horizon: {{timeHorizon}}
Focus Sectors: {{sectors}}

Please provide a comprehensive market analysis including:

1. **Market Overview**:
   - Current market conditions and trends
   - Key economic indicators
   - Industry performance metrics
   - Competitive landscape analysis

2. **Economic Environment**:
   - Macroeconomic factors impact
   - Interest rate environment
   - Inflation and currency effects
   - Regulatory environment changes

3. **Sector Analysis**:
   - Industry-specific trends and drivers
   - Growth opportunities and challenges
   - Risk factors and mitigation strategies
   - Technology disruption impact

4. **Competitive Intelligence**:
   - Market share analysis
   - Competitor positioning and strategies
   - Pricing trends and pressures
   - Innovation and technology adoption

5. **Customer Behavior**:
   - Demographics and segmentation
   - Changing customer preferences
   - Digital adoption trends
   - Service expectations evolution

6. **Strategic Recommendations**:
   - Market entry/exit strategies
   - Product development opportunities
   - Partnership and acquisition targets
   - Risk management considerations

7. **Financial Projections**:
   - Revenue and growth forecasts
   - Profitability analysis
   - Capital requirements
   - Return on investment projections

Provide actionable insights with supporting data and strategic recommendations.`,
                variables: ['marketData', 'scope', 'timeHorizon', 'sectors'],
                metadata: {
                    category: 'market_analysis',
                    complexity: 'high',
                    compliance: 'standard'
                }
            }
        };
    }

    /**
     * Get template by name
     */
    async getTemplate(name) {
        // Check cache first
        if (this.config.cacheEnabled && this.cache.has(name)) {
            const cached = this.cache.get(name);
            if (Date.now() - cached.timestamp < this.config.cacheTTL) {
                return cached.template;
            }
            this.cache.delete(name);
        }

        // Get from templates
        const template = this.templates.get(name);
        if (!template) {
            throw new Error(`Template '${name}' not found`);
        }

        // Cache the template
        if (this.config.cacheEnabled) {
            this.cache.set(name, {
                template,
                timestamp: Date.now()
            });
        }

        return template;
    }

    /**
     * Add or update template
     */
    async setTemplate(name, content, variables = [], metadata = {}) {
        const template = new PromptTemplate(name, content, variables, metadata);

        if (this.config.validationEnabled) {
            const validation = template.validate();
            if (!validation.isValid) {
                throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
            }
        }

        this.templates.set(name, template);

        // Clear cache
        if (this.cache.has(name)) {
            this.cache.delete(name);
        }

        logger.info(`Template '${name}' added/updated`);
        return template;
    }

    /**
     * List all available templates
     */
    listTemplates(category = null) {
        const templates = Array.from(this.templates.values());

        if (category) {
            return templates.filter(template =>
                template.metadata.category === category
            );
        }

        return templates;
    }

    /**
     * Get templates by metadata criteria
     */
    findTemplates(criteria = {}) {
        return Array.from(this.templates.values()).filter(template => {
            return Object.entries(criteria).every(([key, value]) => {
                return template.metadata[key] === value;
            });
        });
    }

    /**
     * Validate template format
     */
    validateTemplate(name, variables = {}) {
        const template = this.templates.get(name);
        if (!template) {
            return {
                isValid: false,
                errors: [`Template '${name}' not found`]
            };
        }

        const errors = [];
        const missingVars = template.variables.filter(varName =>
            !(varName in variables)
        );

        if (missingVars.length > 0) {
            errors.push(`Missing required variables: ${missingVars.join(', ')}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            template
        };
    }

    /**
     * Get template statistics
     */
    getTemplateStats() {
        const templates = Array.from(this.templates.values());
        const stats = {
            total: templates.length,
            byCategory: {},
            byComplexity: {},
            byCompliance: {},
            averageVariables: 0
        };

        let totalVariables = 0;

        templates.forEach(template => {
            // Category stats
            const category = template.metadata.category || 'unknown';
            stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;

            // Complexity stats
            const complexity = template.metadata.complexity || 'unknown';
            stats.byComplexity[complexity] = (stats.byComplexity[complexity] || 0) + 1;

            // Compliance stats
            const compliance = template.metadata.compliance || 'unknown';
            stats.byCompliance[compliance] = (stats.byCompliance[compliance] || 0) + 1;

            totalVariables += template.variables.length;
        });

        stats.averageVariables = templates.length > 0 ?
            Math.round(totalVariables / templates.length * 100) / 100 : 0;

        return stats;
    }

    /**
     * Clear template cache
     */
    clearCache() {
        this.cache.clear();
        logger.info('Template cache cleared');
    }

    /**
     * Setup file watchers for auto-reload
     */
    async setupFileWatchers() {
        // Implementation for file watching if templates are stored in files
        // This would monitor the templates directory for changes
        logger.info('File watchers set up for template auto-reload');
    }

    /**
     * Export templates to file
     */
    async exportTemplates(filePath) {
        const templates = {};

        for (const [name, template] of this.templates.entries()) {
            templates[name] = {
                content: template.content,
                variables: template.variables,
                metadata: template.metadata
            };
        }

        await fs.writeFile(filePath, JSON.stringify(templates, null, 2));
        logger.info(`Templates exported to ${filePath}`);
    }

    /**
     * Import templates from file
     */
    async importTemplates(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const templates = JSON.parse(data);

            let importedCount = 0;
            for (const [name, templateData] of Object.entries(templates)) {
                await this.setTemplate(
                    name,
                    templateData.content,
                    templateData.variables,
                    templateData.metadata
                );
                importedCount++;
            }

            logger.info(`Imported ${importedCount} templates from ${filePath}`);
            return importedCount;
        } catch (error) {
            logger.error(`Failed to import templates from ${filePath}:`, error);
            throw error;
        }
    }
}

module.exports = { PromptTemplateManager, PromptTemplate };