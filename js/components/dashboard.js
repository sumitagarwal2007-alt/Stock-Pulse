/* ============================================
   StockPulse — Dashboard Component
   Main layout logic
   ============================================ */

class Dashboard {
  constructor() {
    this.sidebarContainer = document.getElementById('sidebar-stocks');
    this.feedContainer = document.getElementById('feed-container');
    
    // UI Elements for main chart area
    this.headerTicker = document.getElementById('header-ticker');
    this.headerCompany = document.getElementById('header-company');
    this.headerPrice = document.getElementById('header-price');
    this.headerChange = document.getElementById('header-change');
    
    this.statMentions = document.getElementById('stat-mentions');
    this.statReach = document.getElementById('stat-reach');
    this.statImpact = document.getElementById('stat-impact');
    this.statRSI = document.getElementById('stat-rsi');
    
    // Initialize components
    this.filters = new window.Filters(this.onFilterChange.bind(this));
    this.filters.render();
  }

  /**
   * Render the sidebar stock list
   */
  renderSidebar(stocks, selectedTicker, timeframe = 15) {
    if (!this.sidebarContainer) return;
    
    const html = stocks.map(stock => {
      const latest = window.StockData.getLatestPrice(stock.ticker);
      const sentiment = window.MentionData.getAggregateSentiment(stock.ticker);
      return window.StockCard.render(stock, latest, sentiment, stock.ticker === selectedTicker, timeframe);
    }).join('');
    
    this.sidebarContainer.innerHTML = html;
  }

  /**
   * Update the main view header with selected stock data
   */
  updateMainView(stock, latestPrice, sentiment) {
    if (!this.headerTicker) return;

    this.headerTicker.innerHTML = `<span style="font-size: 20px;">${stock.logo}</span> ${stock.ticker}`;
    this.headerCompany.innerText = `${stock.name} • ${stock.sector}`;
    this.headerPrice.innerText = window.Formatters.formatCurrency(latestPrice.close);
    
    const changeClass = latestPrice.isUp ? 'stock-card__change--up' : 'stock-card__change--down';
    const changeIcon = latestPrice.isUp ? '↑' : '↓';
    
    this.headerChange.className = `chart-header__change ${changeClass}`;
    this.headerChange.innerHTML = `${changeIcon} ${window.Formatters.formatCurrency(Math.abs(latestPrice.change))} (${window.Formatters.formatPercent(latestPrice.changePercent, false)})`;
    
    // Update stats
    if (this.statMentions) {
      this.statMentions.innerText = sentiment.totalMentions;
      
      // Calculate mock reach based on mentions (just for demo)
      let reach = sentiment.totalMentions * 1.2;
      this.statReach.innerText = `${reach.toFixed(1)}M`;
      
      // Impact score
      let impactScore = Math.min(100, 40 + (sentiment.totalMentions * 5));
      this.statImpact.innerText = `${Math.round(impactScore)}/100`;
    }
    
    // Compute 14-Day RSI
    if (this.statRSI && stock.prices && stock.prices.length > 14) {
      let gains = 0;
      let losses = 0;
      // Look at the last 14 days
      const last14 = stock.prices.slice(-15); // Need 15 to get 14 days of changes
      
      for (let i = 1; i < last14.length; i++) {
        const change = last14[i].close - last14[i-1].close;
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      
      let rsi = 50;
      if (avgLoss === 0) rsi = 100;
      else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
      
      this.statRSI.innerText = rsi.toFixed(1);
      if (rsi >= 70) this.statRSI.style.color = 'var(--semantic-danger)'; // Overbought (Red)
      else if (rsi <= 30) this.statRSI.style.color = 'var(--semantic-success)'; // Oversold (Green)
      else this.statRSI.style.color = 'var(--text-primary)';
    }
  }

  /**
   * Instantly flash and update the live price from WebSocket
   */
  updateLivePrice(lastClose, liveTrade) {
    if (!this.headerPrice || !this.headerChange) return;

    const currentStr = this.headerPrice.innerText;
    const currentPrice = parseFloat(currentStr.replace(/[^0-9.-]+/g, ''));
    
    // Ignore if price hasn't changed to prevent unnecessary flashes
    if (Math.abs(currentPrice - liveTrade.p) < 0.001) return;

    const newPrice = liveTrade.p;
    const change = newPrice - lastClose;
    const changePercent = (change / lastClose) * 100;
    const isUp = change >= 0;

    // Update DOM
    this.headerPrice.innerText = window.Formatters.formatCurrency(newPrice);
    
    const changeClass = isUp ? 'stock-card__change--up' : 'stock-card__change--down';
    const changeIcon = isUp ? '↑' : '↓';
    
    this.headerChange.className = `chart-header__change ${changeClass}`;
    this.headerChange.innerHTML = `${changeIcon} ${window.Formatters.formatCurrency(Math.abs(change))} (${window.Formatters.formatPercent(changePercent, false)})`;

    // Apply flash animation
    const flashClass = newPrice > currentPrice ? 'flash-green' : 'flash-red';
    
    // Remove class, trigger reflow, add class again to restart animation
    this.headerPrice.classList.remove('flash-green', 'flash-red');
    this.headerChange.classList.remove('flash-green', 'flash-red');
    
    void this.headerPrice.offsetWidth; // trigger reflow
    
    this.headerPrice.classList.add(flashClass);
    this.headerChange.classList.add(flashClass);
  }

  /**
   * Render feed based on current filters and selected stock
   */
  renderFeed(mentions, filterState) {
    if (!this.feedContainer) return;
    
    let filteredMentions = mentions;
    
    if (filterState && filterState.category !== 'all') {
      filteredMentions = filteredMentions.filter(m => {
        const inf = window.InfluencerData.getInfluencerById(m.influencerId);
        return inf && inf.category === filterState.category;
      });
    }
    
    window.Feed.renderList(filteredMentions, this.feedContainer);
  }

  onFilterChange(newState) {
    // Tell app to refresh feed
    if (window.app) {
      window.app.applyFilters(newState);
    }
  }
}

// Export
if (typeof window !== 'undefined') {
  window.Dashboard = Dashboard;
}
