/**
 * Language Detection Service
 * Detects language from text and provides translation capabilities
 */

class LanguageDetectionService {
  constructor() {
    // Common words/patterns for language detection
    this.languagePatterns = {
      'pt': {
        articles: ['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas'],
        prepositions: ['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'por', 'para', 'com'],
        common: ['que', 'e', 'é', 'não', 'sim', 'como', 'quando', 'onde', 'porque', 'qual'],
        question: ['como', 'quando', 'onde', 'porque', 'qual', 'quem', 'quanto'],
        mainframe: ['sistema', 'programa', 'arquivo', 'dados', 'processamento']
      },
      'en': {
        articles: ['the', 'a', 'an'],
        prepositions: ['of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'to'],
        common: ['and', 'is', 'are', 'was', 'were', 'what', 'how', 'when', 'where', 'why'],
        question: ['what', 'how', 'when', 'where', 'why', 'who', 'which'],
        mainframe: ['system', 'program', 'file', 'data', 'processing']
      },
      'es': {
        articles: ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'],
        prepositions: ['de', 'del', 'en', 'por', 'para', 'con', 'desde'],
        common: ['que', 'y', 'es', 'no', 'sí', 'cómo', 'cuándo', 'dónde', 'por qué'],
        question: ['cómo', 'cuándo', 'dónde', 'por qué', 'cuál', 'quién', 'cuánto'],
        mainframe: ['sistema', 'programa', 'archivo', 'datos', 'procesamiento']
      },
      'fr': {
        articles: ['le', 'la', 'les', 'un', 'une', 'des'],
        prepositions: ['de', 'du', 'dans', 'sur', 'pour', 'avec', 'par'],
        common: ['et', 'est', 'sont', 'que', 'qui', 'ne', 'pas', 'oui', 'non'],
        question: ['comment', 'quand', 'où', 'pourquoi', 'quel', 'qui', 'combien'],
        mainframe: ['système', 'programme', 'fichier', 'données', 'traitement']
      },
      'de': {
        articles: ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'einen', 'einem'],
        prepositions: ['von', 'in', 'an', 'auf', 'für', 'mit', 'bei', 'zu'],
        common: ['und', 'ist', 'sind', 'was', 'wie', 'wann', 'wo', 'warum'],
        question: ['was', 'wie', 'wann', 'wo', 'warum', 'wer', 'welche'],
        mainframe: ['System', 'Programm', 'Datei', 'Daten', 'Verarbeitung']
      }
    };

    // Character-based indicators
    this.characterIndicators = {
      'pt': ['ç', 'ã', 'õ', 'á', 'é', 'í', 'ó', 'ú', 'â', 'ê', 'ô'],
      'es': ['ñ', 'á', 'é', 'í', 'ó', 'ú', '¿', '¡'],
      'fr': ['ç', 'é', 'è', 'ê', 'ë', 'à', 'â', 'ù', 'û', 'î', 'ï', 'ô', 'œ'],
      'de': ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']
    };
  }

  /**
   * Detect language from text
   * @param {string} text - Text to analyze
   * @returns {string} - Detected language code (pt, en, es, fr, de)
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return 'pt'; // Default to Portuguese
    }

    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/);
    const scores = {};

    // Initialize scores
    Object.keys(this.languagePatterns).forEach(lang => {
      scores[lang] = 0;
    });

    // Score based on word patterns
    for (const [lang, patterns] of Object.entries(this.languagePatterns)) {
      // Check articles
      patterns.articles.forEach(article => {
        if (words.includes(article)) {
          scores[lang] += 3;
        }
      });

      // Check prepositions
      patterns.prepositions.forEach(prep => {
        if (words.includes(prep)) {
          scores[lang] += 2;
        }
      });

      // Check common words
      patterns.common.forEach(common => {
        if (words.includes(common)) {
          scores[lang] += 1;
        }
      });

      // Check question words (higher weight)
      patterns.question.forEach(q => {
        if (lowerText.includes(q)) {
          scores[lang] += 4;
        }
      });

      // Check mainframe terms
      patterns.mainframe.forEach(term => {
        if (lowerText.includes(term)) {
          scores[lang] += 2;
        }
      });
    }

    // Score based on character indicators
    for (const [lang, chars] of Object.entries(this.characterIndicators)) {
      chars.forEach(char => {
        if (text.includes(char)) {
          scores[lang] = (scores[lang] || 0) + 2;
        }
      });
    }

    // Special patterns
    if (lowerText.includes('what is') || lowerText.includes('how to') || lowerText.includes('can you')) {
      scores['en'] += 5;
    }
    if (lowerText.includes('o que') || lowerText.includes('como fazer') || lowerText.includes('você pode')) {
      scores['pt'] += 5;
    }
    if (lowerText.includes('qué es') || lowerText.includes('cómo hacer') || lowerText.includes('puedes')) {
      scores['es'] += 5;
    }
    if (lowerText.includes('qu\'est-ce') || lowerText.includes('comment faire') || lowerText.includes('pouvez-vous')) {
      scores['fr'] += 5;
    }
    if (lowerText.includes('was ist') || lowerText.includes('wie macht') || lowerText.includes('können sie')) {
      scores['de'] += 5;
    }

    // Find language with highest score
    let detectedLang = 'pt'; // Default to Portuguese
    let maxScore = 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        detectedLang = lang;
      }
    }

    // If score is too low, default to Portuguese
    if (maxScore < 3) {
      return 'pt';
    }

    console.log(`🌐 Language detected: ${detectedLang} (score: ${maxScore})`);
    return detectedLang;
  }

  /**
   * Get language name from code
   */
  getLanguageName(code) {
    const names = {
      'pt': 'Portuguese',
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German'
    };
    return names[code] || 'Portuguese';
  }

  /**
   * Check if translation is needed
   */
  needsTranslation(detectedLang) {
    return detectedLang !== 'pt';
  }

  /**
   * Get translation instructions for LLM
   */
  getTranslationPrompt(fromLang, toLang) {
    const langNames = {
      'pt': 'Portuguese',
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German'
    };

    if (fromLang === 'pt' && toLang !== 'pt') {
      return `Translate the Portuguese context to ${langNames[toLang]} while maintaining technical accuracy.`;
    } else if (fromLang !== 'pt' && toLang === 'pt') {
      return `Translate the query from ${langNames[fromLang]} to Portuguese for knowledge base search.`;
    }
    return null;
  }

  /**
   * Get response language prompt
   */
  getResponseLanguagePrompt(lang) {
    const langNames = {
      'pt': 'português de Portugal',
      'en': 'English',
      'es': 'español',
      'fr': 'français',
      'de': 'Deutsch'
    };

    return `IMPORTANT: You MUST respond in ${langNames[lang]} regardless of the language of the context or knowledge base.`;
  }
}

module.exports = LanguageDetectionService;