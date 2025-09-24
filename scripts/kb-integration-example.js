/**
 * Knowledge Base Integration Example
 * Demonstrates how to use the KnowledgeBaseService with incident resolution
 */

const KnowledgeBaseService = require('./knowledge-base-service');

// Example usage demonstration
async function demonstrateKnowledgeBase() {
    const kb = new KnowledgeBaseService('./data/knowledge-base');

    console.log('=== Knowledge Base Service Demo ===\n');

    try {
        // Initialize the service
        await kb.initialize();

        // Add sample solutions
        console.log('1. Adding sample solutions...');

        const solution1 = await kb.addSolution({
            type: 'solution',
            technical_area: 'database',
            business_area: 'customer_management',
            title: 'Connection Pool Exhaustion Fix',
            content: 'Increase connection pool size and implement connection timeout handling. Monitor connection usage patterns.',
            tags: ['database', 'performance', 'connections', 'postgresql'],
            created_by: 'dba-team',
            success_rate: 85
        });

        const solution2 = await kb.addSolution({
            type: 'root_cause',
            technical_area: 'authentication',
            business_area: 'user_management',
            title: 'JWT Token Expiration Issues',
            content: 'Root cause: JWT tokens configured with too short expiration. Implement refresh token mechanism.',
            tags: ['authentication', 'jwt', 'security', 'tokens'],
            created_by: 'security-team',
            success_rate: 92
        });

        const solution3 = await kb.addSolution({
            type: 'best_practice',
            technical_area: 'monitoring',
            business_area: 'system_operations',
            title: 'Proactive Alert Configuration',
            content: 'Set up cascading alerts: Warning at 70% capacity, Critical at 90%. Include runbook links in all alerts.',
            tags: ['monitoring', 'alerts', 'best-practice', 'operations'],
            created_by: 'ops-team',
            success_rate: 78
        });

        console.log(`Added solutions: ${solution1.id}, ${solution2.id}, ${solution3.id}\n`);

        // Simulate incident and search for solutions
        console.log('2. Simulating incident resolution...');

        const mockIncident = {
            id: 'INC-001',
            title: 'Database connection timeout errors',
            description: 'Users experiencing slow response times and connection errors',
            technical_area: 'database',
            business_area: 'customer_management',
            tags: ['database', 'performance', 'timeout']
        };

        console.log(`Incident: ${mockIncident.title}`);
        console.log(`Technical Area: ${mockIncident.technical_area}`);
        console.log(`Business Area: ${mockIncident.business_area}\n`);

        // Find relevant solutions
        const recommendations = await kb.findSolutionsForIncident(mockIncident);

        console.log('3. Found relevant solutions:');
        recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec.solution.title}`);
            console.log(`   Type: ${rec.solution.type}`);
            console.log(`   Relevance: ${rec.relevance} (${(rec.score * 100).toFixed(1)}%)`);
            console.log(`   Success Rate: ${rec.solution.metadata.success_rate}%`);
            console.log(`   Content: ${rec.solution.content.substring(0, 80)}...`);
            console.log('');
        });

        // Update success rate based on resolution outcome
        if (recommendations.length > 0) {
            const usedSolution = recommendations[0].solution;
            console.log('4. Updating success rate after resolution...');
            console.log(`Using solution: ${usedSolution.title}`);

            // Simulate successful resolution
            await kb.updateSuccessRate(usedSolution.id, true);
            console.log('Success rate updated based on positive outcome\n');
        }

        // Demonstrate search functionality
        console.log('5. Demonstrating search capabilities...');

        const searchResults = await kb.searchSolutions('authentication token', {
            technical_area: 'authentication',
            min_success_rate: 80
        });

        console.log('Search results for "authentication token":');
        searchResults.forEach((result, index) => {
            console.log(`${index + 1}. ${result.solution.title} (${(result.score * 100).toFixed(1)}% match)`);
        });
        console.log('');

        // Show analytics
        console.log('6. Knowledge Base Analytics:');
        const analytics = await kb.getAnalytics();
        console.log(`Total Solutions: ${analytics.total_solutions}`);
        console.log(`Average Success Rate: ${analytics.average_success_rate}%`);
        console.log(`Total Usage: ${analytics.total_usage}`);
        console.log('Solutions by Type:');
        Object.entries(analytics.by_type).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        console.log('');

        // Show top technical areas
        console.log('Top Technical Areas:');
        analytics.top_technical_areas.forEach((area, index) => {
            console.log(`${index + 1}. ${area.category}: ${area.count} solutions`);
        });

    } catch (error) {
        console.error('Demo failed:', error);
    }
}

// Integration with incident management
class IncidentKBIntegration {
    constructor(knowledgeBase) {
        this.kb = knowledgeBase;
    }

    async enhanceIncidentWithSolutions(incident) {
        // Find relevant solutions
        const solutions = await this.kb.findSolutionsForIncident(incident);

        // Enhance incident with solution recommendations
        const enhanced = {
            ...incident,
            recommended_solutions: solutions.map(s => ({
                id: s.solution.id,
                title: s.solution.title,
                type: s.solution.type,
                relevance_score: s.score,
                success_rate: s.solution.metadata.success_rate,
                content_preview: s.solution.content.substring(0, 200) + '...'
            })),
            kb_metadata: {
                search_timestamp: new Date().toISOString(),
                total_matches: solutions.length,
                highest_relevance: solutions.length > 0 ? solutions[0].score : 0
            }
        };

        return enhanced;
    }

    async recordSolutionOutcome(solutionId, wasSuccessful, feedbackNotes = '') {
        await this.kb.updateSuccessRate(solutionId, wasSuccessful);

        // Could also log detailed feedback for future analysis
        console.log(`Recorded outcome for solution ${solutionId}: ${wasSuccessful ? 'SUCCESS' : 'FAILURE'}`);
        if (feedbackNotes) {
            console.log(`Feedback: ${feedbackNotes}`);
        }
    }
}

// Export for use in other modules
module.exports = {
    KnowledgeBaseService,
    IncidentKBIntegration,
    demonstrateKnowledgeBase
};

// Run demo if file is executed directly
if (require.main === module) {
    demonstrateKnowledgeBase().catch(console.error);
}