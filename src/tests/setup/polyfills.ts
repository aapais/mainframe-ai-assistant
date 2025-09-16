/**
 * Polyfills for Integration Tests
 *
 * Provides necessary polyfills for APIs not available in the test environment
 */

// TextEncoder/TextDecoder polyfills for Node.js environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Crypto polyfill for Node.js environment
if (typeof global.crypto === 'undefined') {
  const crypto = require('crypto');

  Object.defineProperty(global, 'crypto', {
    value: {
      getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
      randomUUID: () => crypto.randomUUID(),
      subtle: {
        digest: async (algorithm: string, data: BufferSource) => {
          const hash = crypto.createHash(algorithm.toLowerCase().replace('-', ''));
          hash.update(data);
          return hash.digest();
        }
      }
    }
  });
}

// Web Streams API polyfill
if (typeof global.ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
  global.TransformStream = TransformStream;
}

// AbortController polyfill
if (typeof global.AbortController === 'undefined') {
  const { AbortController, AbortSignal } = require('abortcontroller-polyfill/dist/cjs-ponyfill');
  global.AbortController = AbortController;
  global.AbortSignal = AbortSignal;
}

// Fetch polyfill
if (typeof global.fetch === 'undefined') {
  const fetch = require('node-fetch');
  global.fetch = fetch;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
  global.Headers = fetch.Headers;
}

// Performance polyfill enhancements
if (typeof global.performance.mark === 'undefined') {
  const marks = new Map();
  const measures = new Map();

  global.performance.mark = (name: string) => {
    marks.set(name, performance.now());
  };

  global.performance.measure = (name: string, startMark?: string, endMark?: string) => {
    const startTime = startMark ? marks.get(startMark) : 0;
    const endTime = endMark ? marks.get(endMark) : performance.now();
    const duration = endTime - startTime;
    measures.set(name, duration);
  };

  global.performance.clearMarks = (name?: string) => {
    if (name) {
      marks.delete(name);
    } else {
      marks.clear();
    }
  };

  global.performance.clearMeasures = (name?: string) => {
    if (name) {
      measures.delete(name);
    } else {
      measures.clear();
    }
  };

  global.performance.getEntriesByType = (type: string) => {
    if (type === 'mark') {
      return Array.from(marks.entries()).map(([name, time]) => ({
        name,
        entryType: 'mark',
        startTime: time,
        duration: 0
      }));
    }
    if (type === 'measure') {
      return Array.from(measures.entries()).map(([name, duration]) => ({
        name,
        entryType: 'measure',
        startTime: 0,
        duration
      }));
    }
    return [];
  };
}

// MessageChannel polyfill
if (typeof global.MessageChannel === 'undefined') {
  class MessageChannel {
    port1: MessagePort;
    port2: MessagePort;

    constructor() {
      const { port1, port2 } = new (require('worker_threads')).MessageChannel();
      this.port1 = port1;
      this.port2 = port2;
    }
  }

  global.MessageChannel = MessageChannel as any;
}

// Structured clone polyfill
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

export {};