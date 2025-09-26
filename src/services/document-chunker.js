/**
 * Document Chunker Service
 * Splits large documents into smaller chunks for embedding generation
 */

class DocumentChunker {
  constructor(maxChunkSize = 30000, overlapSize = 500) {
    this.maxChunkSize = maxChunkSize; // Max size per chunk in characters
    this.overlapSize = overlapSize;   // Overlap between chunks for context
  }

  /**
   * Split text into chunks with overlap
   * @param {string} text - The text to split
   * @param {object} metadata - Additional metadata for each chunk
   * @returns {Array} Array of chunks with metadata
   */
  chunkText(text, metadata = {}) {
    if (!text || text.length <= this.maxChunkSize) {
      // If text is small enough, return as single chunk
      return [{
        text: text,
        chunk_index: 0,
        total_chunks: 1,
        start_position: 0,
        end_position: text.length,
        ...metadata
      }];
    }

    const chunks = [];
    let currentPosition = 0;
    let chunkIndex = 0;

    while (currentPosition < text.length) {
      let endPosition = currentPosition + this.maxChunkSize;

      // If this is not the last chunk, try to find a good break point
      if (endPosition < text.length) {
        // Look for sentence boundaries (. ! ?)
        const chunkText = text.substring(currentPosition, endPosition);
        const lastSentence = Math.max(
          chunkText.lastIndexOf('. '),
          chunkText.lastIndexOf('! '),
          chunkText.lastIndexOf('? '),
          chunkText.lastIndexOf('\n\n')
        );

        // If we found a sentence boundary in the last 20% of the chunk, use it
        if (lastSentence > this.maxChunkSize * 0.8) {
          endPosition = currentPosition + lastSentence + 2; // Include the punctuation
        }
      } else {
        endPosition = text.length;
      }

      // Extract the chunk
      const chunkText = text.substring(currentPosition, endPosition);

      chunks.push({
        text: chunkText,
        chunk_index: chunkIndex,
        start_position: currentPosition,
        end_position: endPosition,
        ...metadata
      });

      // Move to next chunk with overlap (except for the last chunk)
      if (endPosition < text.length) {
        currentPosition = endPosition - this.overlapSize;
        // Ensure we're making progress
        if (currentPosition <= chunks[chunks.length - 1].start_position) {
          currentPosition = endPosition;
        }
      } else {
        currentPosition = endPosition;
      }

      chunkIndex++;
    }

    // Add total_chunks to all chunks
    chunks.forEach(chunk => {
      chunk.total_chunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Smart chunking that preserves document structure
   * @param {string} text - The text to split
   * @param {string} documentType - Type of document (markdown, code, etc.)
   * @returns {Array} Array of structured chunks
   */
  smartChunk(text, documentType = 'text') {
    const chunks = [];

    if (documentType === 'markdown') {
      // Split by major sections (## headers)
      const sections = text.split(/(?=^## )/gm);

      sections.forEach((section, sectionIndex) => {
        if (section.trim().length === 0) return;

        // If section is small enough, keep it as one chunk
        if (section.length <= this.maxChunkSize) {
          chunks.push({
            text: section,
            chunk_index: chunks.length,
            section_index: sectionIndex,
            type: 'section'
          });
        } else {
          // Section is too large, need to split further
          const subChunks = this.chunkText(section, {
            section_index: sectionIndex,
            type: 'section_part'
          });
          chunks.push(...subChunks.map((chunk, idx) => ({
            ...chunk,
            chunk_index: chunks.length + idx
          })));
        }
      });
    } else if (documentType === 'code') {
      // Split by functions/classes for code files
      const functionBoundaries = text.split(/(?=^(?:function|class|def|public|private|protected)\s+)/gm);

      functionBoundaries.forEach((func, funcIndex) => {
        if (func.trim().length === 0) return;

        if (func.length <= this.maxChunkSize) {
          chunks.push({
            text: func,
            chunk_index: chunks.length,
            function_index: funcIndex,
            type: 'function'
          });
        } else {
          // Function is too large, split it
          const subChunks = this.chunkText(func, {
            function_index: funcIndex,
            type: 'function_part'
          });
          chunks.push(...subChunks.map((chunk, idx) => ({
            ...chunk,
            chunk_index: chunks.length + idx
          })));
        }
      });
    } else {
      // Default text chunking
      return this.chunkText(text);
    }

    // Add total_chunks to all chunks
    chunks.forEach(chunk => {
      chunk.total_chunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Create a summary for aggregating multiple chunk embeddings
   * @param {Array} chunks - Array of text chunks
   * @returns {string} Summary text for creating document-level embedding
   */
  createSummaryFromChunks(chunks) {
    if (chunks.length === 0) return '';
    if (chunks.length === 1) return chunks[0].text;

    // Take first and last parts of the document
    const firstChunk = chunks[0].text.substring(0, 1000);
    const lastChunk = chunks[chunks.length - 1].text.substring(
      Math.max(0, chunks[chunks.length - 1].text.length - 1000)
    );

    // Extract key sentences from middle chunks
    const middleExcerpts = [];
    for (let i = 1; i < chunks.length - 1 && i < 5; i++) {
      const excerpt = chunks[i].text.substring(0, 200);
      middleExcerpts.push(excerpt);
    }

    return `${firstChunk}\n\n[...]\n\n${middleExcerpts.join('\n\n[...]\n\n')}\n\n[...]\n\n${lastChunk}`;
  }
}

module.exports = DocumentChunker;