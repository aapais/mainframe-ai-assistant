"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvertedIndex = void 0;
class InvertedIndex {
    index = new Map();
    documents = new Map();
    stats;
    fieldBoosts = {
        title: 3.0,
        problem: 2.0,
        solution: 1.8,
        tags: 1.5,
        category: 1.2
    };
    maxTermLength = 50;
    minTermLength = 2;
    maxPositions = 100;
    constructor() {
        this.stats = {
            totalDocuments: 0,
            totalTerms: 0,
            uniqueTerms: 0,
            averageDocumentLength: 0,
            indexSize: 0,
            buildTime: 0,
            lastUpdated: Date.now()
        };
    }
    async buildIndex(entries) {
        const startTime = Date.now();
        console.log(`Building inverted index for ${entries.length} documents...`);
        this.clear();
        const batchSize = 100;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = entries.slice(i, i + batchSize);
            await this.processBatch(batch);
            if (i % 500 === 0) {
                console.log(`Processed ${i + batch.length}/${entries.length} documents`);
            }
        }
        this.updateStats();
        this.stats.buildTime = Date.now() - startTime;
        console.log(`Index built in ${this.stats.buildTime}ms`);
        console.log(`- Documents: ${this.stats.totalDocuments}`);
        console.log(`- Unique terms: ${this.stats.uniqueTerms}`);
        console.log(`- Total terms: ${this.stats.totalTerms}`);
        console.log(`- Average doc length: ${this.stats.averageDocumentLength.toFixed(1)}`);
    }
    async addDocument(entry) {
        if (this.documents.has(entry.id)) {
            await this.removeDocument(entry.id);
        }
        const indexedDoc = this.createIndexedDocument(entry);
        this.documents.set(entry.id, indexedDoc);
        for (const [term, frequency] of indexedDoc.termFrequencies.entries()) {
            this.addTermToIndex(term, entry.id, frequency, indexedDoc);
        }
        this.stats.lastUpdated = Date.now();
    }
    async removeDocument(docId) {
        const doc = this.documents.get(docId);
        if (!doc)
            return false;
        for (const term of doc.termFrequencies.keys()) {
            const postingList = this.index.get(term);
            if (postingList) {
                postingList.documents.delete(docId);
                postingList.frequency -= doc.termFrequencies.get(term) || 0;
                if (postingList.documents.size === 0) {
                    this.index.delete(term);
                }
            }
        }
        this.documents.delete(docId);
        this.stats.lastUpdated = Date.now();
        return true;
    }
    search(terms) {
        const results = new Map();
        for (const term of terms) {
            const postingList = this.index.get(term);
            if (postingList) {
                results.set(term, postingList);
            }
        }
        return results;
    }
    getPostingList(term) {
        return this.index.get(term) || null;
    }
    getDocument(docId) {
        return this.documents.get(docId) || null;
    }
    findTermsWithPrefix(prefix, limit = 20) {
        const results = [];
        const lowerPrefix = prefix.toLowerCase();
        for (const term of this.index.keys()) {
            if (term.startsWith(lowerPrefix)) {
                results.push(term);
                if (results.length >= limit)
                    break;
            }
        }
        return results.sort((a, b) => {
            const aPosting = this.index.get(a);
            const bPosting = this.index.get(b);
            return bPosting.frequency - aPosting.frequency;
        });
    }
    getStats() {
        return { ...this.stats };
    }
    clear() {
        this.index.clear();
        this.documents.clear();
        this.stats = {
            totalDocuments: 0,
            totalTerms: 0,
            uniqueTerms: 0,
            averageDocumentLength: 0,
            indexSize: 0,
            buildTime: 0,
            lastUpdated: Date.now()
        };
    }
    export() {
        const exportData = {
            version: '1.0',
            timestamp: Date.now(),
            stats: this.stats,
            index: Array.from(this.index.entries()).map(([term, postingList]) => ({
                term,
                frequency: postingList.frequency,
                documents: Array.from(postingList.documents.entries()).map(([docId, entry]) => ({
                    docId,
                    termFrequency: entry.termFrequency,
                    positions: entry.positions.slice(0, 10),
                    fields: Array.from(entry.fields),
                    boost: entry.boost
                }))
            })),
            documents: Array.from(this.documents.entries()).map(([id, doc]) => ({
                id,
                fieldBoosts: doc.fieldBoosts,
                termFrequencies: Array.from(doc.termFrequencies.entries()),
                fieldLengths: doc.fieldLengths,
                totalTerms: doc.totalTerms,
                lastModified: doc.lastModified
            }))
        };
        return exportData;
    }
    import(data) {
        this.clear();
        if (data.version !== '1.0') {
            throw new Error(`Unsupported index version: ${data.version}`);
        }
        this.stats = { ...data.stats };
        for (const docData of data.documents) {
            const doc = {
                id: docData.id,
                fieldBoosts: docData.fieldBoosts,
                termFrequencies: new Map(docData.termFrequencies),
                fieldLengths: docData.fieldLengths,
                totalTerms: docData.totalTerms,
                lastModified: docData.lastModified
            };
            this.documents.set(doc.id, doc);
        }
        for (const termData of data.index) {
            const postingList = {
                term: termData.term,
                frequency: termData.frequency,
                documents: new Map()
            };
            for (const docEntry of termData.documents) {
                postingList.documents.set(docEntry.docId, {
                    docId: docEntry.docId,
                    termFrequency: docEntry.termFrequency,
                    positions: docEntry.positions,
                    fields: new Set(docEntry.fields),
                    boost: docEntry.boost
                });
            }
            this.index.set(termData.term, postingList);
        }
        console.log(`Index imported: ${this.stats.totalDocuments} documents, ${this.stats.uniqueTerms} terms`);
    }
    async processBatch(entries) {
        for (const entry of entries) {
            const indexedDoc = this.createIndexedDocument(entry);
            this.documents.set(entry.id, indexedDoc);
            for (const [term, frequency] of indexedDoc.termFrequencies.entries()) {
                this.addTermToIndex(term, entry.id, frequency, indexedDoc);
            }
        }
    }
    createIndexedDocument(entry) {
        const termFrequencies = new Map();
        const fieldLengths = {};
        let totalTerms = 0;
        const fields = {
            title: entry.title || '',
            problem: entry.problem || '',
            solution: entry.solution || '',
            tags: (entry.tags || []).join(' '),
            category: entry.category || ''
        };
        for (const [fieldName, fieldValue] of Object.entries(fields)) {
            const terms = this.tokenizeText(fieldValue);
            fieldLengths[fieldName] = terms.length;
            totalTerms += terms.length;
            terms.forEach((term, position) => {
                const currentFreq = termFrequencies.get(term) || 0;
                termFrequencies.set(term, currentFreq + 1);
            });
        }
        return {
            id: entry.id,
            fieldBoosts: { ...this.fieldBoosts },
            termFrequencies,
            fieldLengths,
            totalTerms,
            lastModified: entry.updated_at?.getTime() || Date.now()
        };
    }
    addTermToIndex(term, docId, frequency, indexedDoc) {
        let postingList = this.index.get(term);
        if (!postingList) {
            postingList = {
                term,
                frequency: 0,
                documents: new Map()
            };
            this.index.set(term, postingList);
        }
        let boost = 1.0;
        const fields = new Set();
        for (const [fieldName] of Object.entries(this.fieldBoosts)) {
            if (indexedDoc.fieldLengths[fieldName] > 0) {
                fields.add(fieldName);
                boost = Math.max(boost, this.fieldBoosts[fieldName]);
            }
        }
        const postingEntry = {
            docId,
            termFrequency: frequency,
            positions: [],
            fields,
            boost
        };
        postingList.documents.set(docId, postingEntry);
        postingList.frequency += frequency;
    }
    tokenizeText(text) {
        if (!text)
            return [];
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(term => term.length >= this.minTermLength &&
            term.length <= this.maxTermLength)
            .slice(0, 1000);
    }
    updateStats() {
        this.stats.totalDocuments = this.documents.size;
        this.stats.uniqueTerms = this.index.size;
        this.stats.totalTerms = Array.from(this.documents.values())
            .reduce((sum, doc) => sum + doc.totalTerms, 0);
        this.stats.averageDocumentLength = this.stats.totalDocuments > 0
            ? this.stats.totalTerms / this.stats.totalDocuments
            : 0;
        let indexSize = 0;
        for (const postingList of this.index.values()) {
            indexSize += postingList.term.length * 2;
            indexSize += postingList.documents.size * 64;
        }
        this.stats.indexSize = indexSize;
    }
}
exports.InvertedIndex = InvertedIndex;
exports.default = InvertedIndex;
//# sourceMappingURL=InvertedIndex.js.map