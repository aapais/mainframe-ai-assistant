'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.SemanticSearchEnhancer = void 0;
class SemanticSearchEnhancer {
  constructor() {}
  async enhance(query) {
    return query;
  }
  async processQuery(query) {
    return {
      original: query,
      enhanced: query,
      confidence: 1.0,
    };
  }
}
exports.SemanticSearchEnhancer = SemanticSearchEnhancer;
//# sourceMappingURL=SemanticSearchEnhancer.js.map
