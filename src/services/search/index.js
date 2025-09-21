"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTIMIZATION_LEVELS = exports.PERFORMANCE_TARGETS = exports.FTS5Integration = exports.FTS5Engine = exports.SearchBenchmark = exports.SearchCache = exports.RankingEngine = exports.FuzzyMatcher = exports.QueryParser = exports.TextProcessor = exports.InvertedIndex = exports.AdvancedSearchEngine = void 0;
exports.createSearchEngine = createSearchEngine;
exports.createBenchmark = createBenchmark;
exports.createFTS5Engine = createFTS5Engine;
exports.createFTS5Integration = createFTS5Integration;
exports.validatePerformance = validatePerformance;
const tslib_1 = require("tslib");
const AdvancedSearchEngine_1 = require("./AdvancedSearchEngine");
Object.defineProperty(exports, "AdvancedSearchEngine", { enumerable: true, get () { return tslib_1.__importDefault(AdvancedSearchEngine_1).default; } });
const InvertedIndex_1 = require("./InvertedIndex");
Object.defineProperty(exports, "InvertedIndex", { enumerable: true, get () { return tslib_1.__importDefault(InvertedIndex_1).default; } });
const TextProcessor_1 = require("./TextProcessor");
Object.defineProperty(exports, "TextProcessor", { enumerable: true, get () { return tslib_1.__importDefault(TextProcessor_1).default; } });
const QueryParser_1 = require("./QueryParser");
Object.defineProperty(exports, "QueryParser", { enumerable: true, get () { return tslib_1.__importDefault(QueryParser_1).default; } });
const FuzzyMatcher_1 = require("./FuzzyMatcher");
Object.defineProperty(exports, "FuzzyMatcher", { enumerable: true, get () { return tslib_1.__importDefault(FuzzyMatcher_1).default; } });
const RankingEngine_1 = require("./RankingEngine");
Object.defineProperty(exports, "RankingEngine", { enumerable: true, get () { return tslib_1.__importDefault(RankingEngine_1).default; } });
const SearchCache_1 = require("./SearchCache");
Object.defineProperty(exports, "SearchCache", { enumerable: true, get () { return tslib_1.__importDefault(SearchCache_1).default; } });
const SearchBenchmark_1 = require("./SearchBenchmark");
Object.defineProperty(exports, "SearchBenchmark", { enumerable: true, get () { return tslib_1.__importDefault(SearchBenchmark_1).default; } });
const FTS5Engine_1 = require("./FTS5Engine");
Object.defineProperty(exports, "FTS5Engine", { enumerable: true, get () { return tslib_1.__importDefault(FTS5Engine_1).default; } });
const FTS5Integration_1 = require("./FTS5Integration");
Object.defineProperty(exports, "FTS5Integration", { enumerable: true, get () { return tslib_1.__importDefault(FTS5Integration_1).default; } });
function createSearchEngine(config) {
    return new AdvancedSearchEngine(config);
}
function createBenchmark(engine) {
    return new SearchBenchmark(engine);
}
function createFTS5Engine(db, config) {
    const FTS5Engine = require('./FTS5Engine').default;
    return new FTS5Engine(db, config);
}
function createFTS5Integration(db, legacyEngine, fts5Config, integrationConfig) {
    const FTS5Integration = require('./FTS5Integration').default;
    return new FTS5Integration(db, legacyEngine, fts5Config, integrationConfig);
}
async function validatePerformance(engine, quickTest = true) {
    const benchmark = new SearchBenchmark(engine);
    if (quickTest) {
        const result = await benchmark.quickValidation();
        return {
            passed: result.passed,
            details: result.metrics
        };
    }
    else {
        const result = await benchmark.runBenchmark();
        return {
            passed: result.summary.passed,
            details: result
        };
    }
}
exports.PERFORMANCE_TARGETS = {
    RESPONSE_TIME_MS: 1000,
    CACHE_HIT_RATE: 0.8,
    ERROR_RATE: 0.01,
    MEMORY_LIMIT_MB: 512,
    THROUGHPUT_QPS: 10
};
exports.OPTIMIZATION_LEVELS = {
    FAST: {
        indexing: 'minimal',
        caching: 'aggressive',
        ranking: 'simple'
    },
    BALANCED: {
        indexing: 'standard',
        caching: 'moderate',
        ranking: 'bm25'
    },
    ACCURATE: {
        indexing: 'comprehensive',
        caching: 'conservative',
        ranking: 'combined'
    }
};
//# sourceMappingURL=index.js.map