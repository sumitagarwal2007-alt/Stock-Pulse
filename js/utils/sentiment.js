/* ============================================
   StockPulse — Sentiment Analyzer (Mock)
   Rule-based sentiment engine for demo purposes
   ============================================ */

/**
 * A basic rule-based sentiment analyzer.
 * In a real application, this would call an LLM or NLP API (e.g., Gemini, OpenAI, AWS Comprehend).
 */
const SentimentAnalyzer = {
  
  // Lexicons
  positiveWords: [
    'bullish', 'growth', 'invest', 'opportunity', 'strong', 'buy', 
    'breakthrough', 'exceeding', 'expectations', 'massive', 'improving',
    'expanding', 'accelerating', 'adoption', 'exploding', 'traction'
  ],
  
  negativeWords: [
    'bearish', 'risk', 'sell', 'overvalued', 'bubble', 'crash',
    'pressure', 'cooling', 'competition', 'careful', 'downside',
    'unacceptable', 'struggling', 'penalty', 'penalties'
  ],
  
  intensifiers: [
    'very', 'extremely', 'massive', 'profound', 'tremendous', 'fundamentally'
  ],
  
  diminishers: [
    'slightly', 'maybe', 'somewhat', 'little'
  ],

  /**
   * Analyze text and return a sentiment object
   * @param {string} text - The text to analyze
   * @returns {Object} Sentiment result { sentiment: 'positive'|'negative'|'neutral', score: number, confidence: number }
   */
  analyze(text) {
    if (!text) return { sentiment: 'neutral', score: 50, confidence: 0 };
    
    const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
    
    let posScore = 0;
    let negScore = 0;
    let modifier = 1;
    
    words.forEach(word => {
      // Check modifiers
      if (this.intensifiers.includes(word)) {
        modifier = 1.5;
        return; // skip to next word
      }
      if (this.diminishers.includes(word)) {
        modifier = 0.5;
        return; // skip to next word
      }
      
      // Check sentiment words
      if (this.positiveWords.includes(word)) {
        posScore += (10 * modifier);
        modifier = 1; // reset modifier
      }
      else if (this.negativeWords.includes(word)) {
        negScore += (10 * modifier);
        modifier = 1; // reset modifier
      }
    });
    
    // Calculate final results
    const totalSentimentWords = posScore/10 + negScore/10;
    
    // Default neutral
    if (posScore === 0 && negScore === 0) {
      return { 
        sentiment: 'neutral', 
        score: 50, 
        confidence: 0.8 
      };
    }
    
    // Determine polarity
    let sentiment = 'neutral';
    let score = 50;
    let confidence = Math.min(0.5 + (totalSentimentWords * 0.1), 0.95); // More sentiment words = higher confidence
    
    if (posScore > negScore * 1.5) {
      sentiment = 'positive';
      score = 60 + Math.min((posScore - negScore), 35);
    } 
    else if (negScore > posScore * 1.5) {
      sentiment = 'negative';
      score = 40 - Math.min((negScore - posScore), 35);
    }
    
    return {
      sentiment,
      score: Math.round(score),
      confidence: parseFloat(confidence.toFixed(2))
    };
  }
};

// Export for module usage
if (typeof window !== 'undefined') {
  window.SentimentAnalyzer = SentimentAnalyzer;
}
