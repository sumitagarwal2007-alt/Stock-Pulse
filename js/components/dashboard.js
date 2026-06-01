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
    
    // Initialize components
    this.filters = new window.Filters(this.onFilterChange.bind(this));
    this.filters.render();
  }

  /**
   * Render the sidebar stock list
   */
  renderSidebar(stocks, selectedTicker) {
    if (!this.sidebarContainer) return;
    
    const html = stocks.map(stock => {
      const latest = window.StockData.getLatestPrice(stock.ticker);
      const sentiment = window.MentionData.getAggregateSentiment(stock.ticker);
      return window.StockCard.render(stock, latest, sentiment, stock.ticker === selectedTicker);
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
