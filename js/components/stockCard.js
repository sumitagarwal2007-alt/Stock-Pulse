/* ============================================
   StockPulse — Stock Card Component
   Renders a stock summary item in the sidebar
   ============================================ */

class StockCard {
  /**
   * Create the HTML string for a stock card
   * @param {Object} stock - The stock data
   * @param {Object} latestPrice - The latest price data with change info
   * @param {Object} sentiment - The aggregate sentiment for the stock
   * @param {boolean} isSelected - Whether this card is currently selected
   * @param {number} timeframe - The number of days to slice the sparkline data for
   * @returns {string} HTML string
   */
  static render(stock, latestPrice, sentiment, isSelected = false, timeframe = 15) {
    const changeClass = latestPrice.isUp ? 'stock-card__change--up' : 'stock-card__change--down';
    const changeIcon = latestPrice.isUp ? '↑' : '↓';
    const selectedClass = isSelected ? 'stock-card--selected' : '';
    
    // Convert array of prices to simple path string for SVG sparkline
    const slicedPrices = stock.prices.slice(-timeframe);
    const prices = slicedPrices.map(p => p.close);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min;
    
    const svgWidth = 60;
    const svgHeight = 32;
    
    let pathData = '';
    prices.forEach((p, i) => {
      const x = (i / (prices.length - 1)) * svgWidth;
      const y = svgHeight - (((p - min) / range) * svgHeight);
      pathData += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    });
    
    const strokeColor = latestPrice.isUp ? 'var(--bullish)' : 'var(--bearish)';

    return `
      <div class="stock-card ${selectedClass}" data-ticker="${stock.ticker}" onclick="window.app.selectStock('${stock.ticker}')">
        <div class="stock-card__ticker-wrap">
          <div class="stock-card__ticker">
            ${stock.ticker}
            ${stock._hits > 0 ? `<span style="font-size: 12px; margin-left: 4px;" title="${stock._hits} AI Catalyst Hits">🔥${stock._hits}</span>` : ''}
          </div>
          <div class="stock-card__name">${stock.name}</div>
        </div>
        
        <div class="stock-card__sparkline">
          <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
            <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        
        <div class="stock-card__price-wrap">
          <div class="stock-card__price">${window.Formatters.formatCurrency(latestPrice.close)}</div>
          <div class="stock-card__change ${changeClass}">
            ${changeIcon} ${window.Formatters.formatPercent(latestPrice.changePercent, false)}
          </div>
        </div>
        
        ${sentiment.totalMentions > 0 ? `
          <div class="stock-card__mentions" title="${sentiment.totalMentions} recent mentions">
            <span class="stock-card__mentions-icon">💬</span>
            <span>${sentiment.totalMentions}</span>
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Export
if (typeof window !== 'undefined') {
  window.StockCard = StockCard;
}
