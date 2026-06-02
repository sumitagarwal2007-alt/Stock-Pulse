/* ============================================
   MarketOracle — AI Predictive Forecasting Engine
   Generates historical prediction overlays and 30-day future models
   ============================================ */

const PredictionData = {
  
  /**
   * Generates dual-phase predictive data (historical overlay + future forecast)
   * @param {Object} stock - The stock object containing historical prices
   * @param {Array} mentions - Global mentions array
   * @param {Array} alerts - Global alerts array
   * @returns {Array} Array of predicted price objects
   */
  generatePredictionData(stock, mentions, alerts) {
    if (!stock || !stock.prices || stock.prices.length === 0) return [];
    
    const predictions = [];
    
    // 1. HISTORICAL PHASE
    // Start the AI's "past prediction" at the exact same baseline as the first actual price
    let currentPred = stock.prices[0].close;
    
    for (let i = 0; i < stock.prices.length; i++) {
      const actual = stock.prices[i];
      
      // Filter catalysts for this specific day
      const dayMentions = mentions.filter(m => m.date === actual.date);
      const dayAlerts = alerts.filter(a => a.date === actual.date);
      
      // Calculate net sentiment gravity for the day
      let dailyNet = 0;
      dayMentions.forEach(m => {
        if (m.sentiment === 'positive') dailyNet += 1.2;
        if (m.sentiment === 'negative') dailyNet -= 1.2;
      });
      dayAlerts.forEach(a => {
        // High impact backend alerts weigh heavily on the prediction
        if (a.prediction.toLowerCase().includes('positive')) dailyNet += 3.5; 
        if (a.prediction.toLowerCase().includes('negative')) dailyNet -= 3.5;
      });
      
      // The Algorithmic Walk:
      // - 15% gravity pull towards reality (so the prediction doesn't fly off the chart infinitely)
      // - Sentiment impact scales based on the stock's price to remain mathematically proportional
      const gravityDrift = (actual.close - currentPred) * 0.15; 
      const sentimentDrift = dailyNet * (currentPred * 0.008); 
      
      currentPred = currentPred + gravityDrift + sentimentDrift;
      
      predictions.push({
        date: actual.date,
        close: currentPred,
        isFuture: false
      });
    }
    
    // 2. FORECASTING PHASE (30 Days into the future)
    // Evaluate the macro momentum over the entire timeframe slice
    let macroMomentum = 0;
    mentions.forEach(m => {
      if (m.sentiment === 'positive') macroMomentum += 1;
      if (m.sentiment === 'negative') macroMomentum -= 1;
    });
    alerts.forEach(a => {
      if (a.prediction.toLowerCase().includes('positive')) macroMomentum += 3;
      if (a.prediction.toLowerCase().includes('negative')) macroMomentum -= 3;
    });
    
    // Set forecasting baseline to the EXACT live price to prevent a jarring visual jump
    const lastActualPrice = stock.prices[stock.prices.length - 1].close;
    currentPred = lastActualPrice;
    
    const lastDate = new Date(stock.prices[stock.prices.length - 1].date);
    const volatility = currentPred * 0.015; // 1.5% daily volatility base
    
    for (let i = 1; i <= 30; i++) {
      const futureDate = new Date(lastDate);
      futureDate.setDate(lastDate.getDate() + i);
      
      // Random walk noise
      const noise = (Math.random() - 0.5) * volatility;
      
      // Momentum trend pushes the stock (decaying slightly over the 30 days)
      const trend = (macroMomentum * 0.15) * (1 - (i / 45)); 
      
      currentPred = currentPred + noise + trend;
      
      predictions.push({
        date: futureDate.toISOString().split('T')[0],
        close: currentPred,
        isFuture: true
      });
    }
    
    return predictions;
  }
};

// Export
if (typeof window !== 'undefined') {
  window.PredictionData = PredictionData;
}
