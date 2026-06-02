/* ============================================
   StockPulse — Main Application (Live Data)
   ============================================ */

class App {
  constructor() {
    this.sidebarStocks = document.getElementById('sidebar-stocks');
    
    // State
    this.selectedTicker = 'TSLA'; // Default
    this.currentTimeframe = 15; // Default 15 days
    this.filterState = {
      category: 'all',
      sentiment: 'all'
    };
    
    this.stockChart = null;
    this.sentimentGauge = null;
    this.dashboard = null;
    this.allAlerts = [];

    // UI Elements
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsBtn = document.getElementById('settings-btn');
    this.closeModalBtn = document.getElementById('close-modal-btn');
    this.saveKeyBtn = document.getElementById('save-key-btn');
    this.apiKeyInput = document.getElementById('api-key-input');
    this.alpacaKeyInput = document.getElementById('alpaca-key-input');
    this.alpacaSecretInput = document.getElementById('alpaca-secret-input');
    this.searchInput = document.getElementById('ticker-search-input');
    
    // Alerts UI
    this.alertsBtn = document.getElementById('alerts-btn');
    this.alertsModal = document.getElementById('alerts-modal');
    this.closeAlertsBtn = document.getElementById('close-alerts-btn');
    this.alertsContainer = document.getElementById('alerts-container');
  }

  async init() {
    console.log("🚀 Initializing MarketOracle Live...");
    
    // Setup Header Date
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
      dateEl.innerText = window.Formatters.formatDate(new Date().toISOString(), false);
    }

    // Initialize Chart instances
    if (document.getElementById('mainChart')) {
      this.stockChart = new window.StockChart('mainChart');
    }
    if (document.getElementById('sentimentGauge')) {
      this.sentimentGauge = new window.SentimentGauge('sentimentGauge');
    }
    
    this.dashboard = new window.Dashboard();

    // Attach Event Listeners
    this.attachEvents();

    // Setup WebSockets
    window.finnhubApi.connectWebSocket(this.onLiveTrade.bind(this));

    // Check API Key & Load Data
    await this.checkAndLoadData();
  }

  onLiveTrade(tradeData) {
    // tradeData = {p: price, s: symbol, t: timestamp, v: volume}
    if (tradeData.s !== this.selectedTicker) return; // ignore if not current stock
    
    const stock = window.StockData.getStockByTicker(this.selectedTicker);
    if (!stock || !stock.prices || stock.prices.length === 0) return;
    
    // The "last close" is the open price of today, or the close of yesterday if today hasn't happened.
    // For our hybrid logic, we can just grab the open price of the most recent candle.
    const lastCandle = stock.prices[stock.prices.length - 1];
    const previousClose = stock.prices.length > 1 ? stock.prices[stock.prices.length - 2].close : lastCandle.open;
    
    this.dashboard.updateLivePrice(previousClose, tradeData);
  }

  attachEvents() {
    this.settingsBtn.addEventListener('click', () => {
      this.apiKeyInput.value = window.finnhubApi.apiKey;
      if (window.alpacaApi) {
        this.alpacaKeyInput.value = window.alpacaApi.keyId;
        this.alpacaSecretInput.value = window.alpacaApi.secretKey;
      }
      this.settingsModal.style.display = 'flex';
    });

    this.closeModalBtn.addEventListener('click', () => {
      this.settingsModal.style.display = 'none';
    });

    this.saveKeyBtn.addEventListener('click', async () => {
      const finnhubKey = this.apiKeyInput.value.trim();
      const alpacaKey = this.alpacaKeyInput.value.trim();
      const alpacaSecret = this.alpacaSecretInput.value.trim();
      
      if (finnhubKey) {
        window.finnhubApi.setApiKey(finnhubKey);
        
        if (window.alpacaApi && alpacaKey && alpacaSecret) {
          window.alpacaApi.setKeys(alpacaKey, alpacaSecret);
        }
        
        this.settingsModal.style.display = 'none';
        await this.checkAndLoadData();
      } else {
        alert('Please enter a valid Finnhub API key.');
      }
    });

    if (this.searchInput) {
      this.searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
          const ticker = this.searchInput.value.trim().toUpperCase();
          if (ticker) {
            this.searchInput.value = ''; // clear input
            await this.handleSearch(ticker);
          }
        }
      });
    }

    // Alerts Modal
    if (this.alertsBtn) {
      this.alertsBtn.addEventListener('click', () => {
        this.fetchAndRenderAlerts();
        this.alertsModal.style.display = 'flex';
      });
    }
    
    if (this.closeAlertsBtn) {
      this.closeAlertsBtn.addEventListener('click', () => {
        this.alertsModal.style.display = 'none';
      });
    }

    // Timeframe selector
    const timeframeBtns = document.querySelectorAll('.timeframe-btn');
    timeframeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Update active class
        timeframeBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update state and re-render
        this.currentTimeframe = parseInt(e.target.dataset.days);
        this.render();
      });
    });
  }

  async fetchAndRenderAlerts() {
    this.alertsContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">Loading alerts from background monitor...</div>';
    
    try {
      // Try to fetch the local alerts.json generated by the background monitor
      const response = await fetch('/backend/alerts.json');
      if (!response.ok) throw new Error('Alerts file not found. Ensure monitor.js is running.');
      
      const alerts = await response.json();
      
      if (alerts.length === 0) {
        this.alertsContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">No catalytic alerts found yet. The monitor is running quietly in the background!</div>';
        return;
      }
      
      // We only process the top 10 recent alerts for the UI to prevent rate limits
      const topAlerts = alerts.slice(0, 10);
      let html = '';
      
      for (const alert of topAlerts) {
        let currentPrice = 0;
        
        // Try to get cached price, else fetch it
        const stockData = window.StockData.getStockByTicker(alert.ticker);
        if (stockData && stockData.liveData) {
          currentPrice = stockData.liveData.close;
        } else {
          try {
            const q = await window.finnhubApi.getQuote(alert.ticker);
            currentPrice = q.c;
          } catch (e) {
            currentPrice = alert.alert_price || 0;
          }
        }
        
        let validationHtml = '';
        if (alert.alert_price && currentPrice) {
          const delta = currentPrice - alert.alert_price;
          const isBullishPred = alert.prediction.toLowerCase().includes('positive');
          const isTrue = (isBullishPred && delta > 0) || (!isBullishPred && delta < 0);
          
          validationHtml = `
            <div style="margin-top: 8px; font-size: 13px; display: flex; align-items: center; gap: 8px;">
              <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Alert: $${alert.alert_price.toFixed(2)}</span>
              <span>→</span>
              <span style="background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;">Now: $${currentPrice.toFixed(2)}</span>
              <span style="font-weight: bold; margin-left: auto; color: ${isTrue ? 'var(--semantic-success)' : 'var(--semantic-danger)'}">
                ${isTrue ? '✅ PREDICTION TRUE' : '❌ PREDICTION FALSE'}
              </span>
            </div>
          `;
        }

        html += `
        <div style="background: rgba(255,255,255,0.05); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); border-left: 4px solid var(--semantic-${alert.impact === 'High' ? 'danger' : 'warning'});">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: var(--text-primary); font-size: 16px;">${alert.ticker} • <span style="text-transform: uppercase;">${alert.keyword}</span></strong>
            <span style="font-size: 12px; color: var(--text-tertiary);">${new Date(alert.timestamp).toLocaleString()}</span>
          </div>
          <div style="font-size: 14px; margin-bottom: 8px; color: var(--text-secondary);">
            ${alert.headline}
          </div>
          <div style="font-size: 13px; color: var(--accent-primary); font-weight: 500;">
            🤖 AI Prediction: ${alert.prediction}
          </div>
          ${validationHtml}
        </div>
      `;
      }
      
      this.alertsContainer.innerHTML = html;
      
    } catch (e) {
      this.alertsContainer.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--semantic-danger);">${e.message}</div>`;
    }
  }

  async handleSearch(ticker) {
    this.loadingOverlay.style.display = 'flex';
    this.loadingOverlay.querySelector('div:nth-child(2)').innerText = `Searching for ${ticker}...`;
    
    try {
      // 1. Try to add the stock dynamically
      const success = await window.StockData.addStock(ticker);
      
      if (!success) {
        alert(`Could not find data for ticker: ${ticker}`);
        return;
      }
      
      // 2. Fetch news
      await window.MentionData.fetchNewsForStock(ticker);
      
      // 3. Select it and render
      this.selectStock(ticker);
      
    } catch (e) {
      console.error(e);
      alert(`Error searching for ${ticker}`);
    } finally {
      this.loadingOverlay.querySelector('div:nth-child(2)').innerText = `Loading live data...`;
      this.loadingOverlay.style.display = 'none';
    }
  }

  async checkAndLoadData() {
    if (!window.finnhubApi.hasApiKey()) {
      this.loadingOverlay.style.display = 'none';
      this.settingsModal.style.display = 'flex';
      return;
    }

    // Show loading
    this.loadingOverlay.style.display = 'flex';

    try {
      console.log('Fetching stock prices...');
      await window.StockData.loadAllStockPrices();
      
      console.log('Fetching company news...');
      await window.MentionData.loadAllMentions();
      
      try {
        const resp = await fetch('/backend/alerts.json');
        if (resp.ok) {
          this.allAlerts = await resp.json();
        }
      } catch (e) { }
      
      const testStock = window.StockData.getStockByTicker('TSLA');
      // We check the browser console flag to see if we fell back
      // If we did fallback, prices.length won't be 0, but we can notify the user that we are using fallback.
      if (!window.finnhubApi.hasApiKey()) {
         // handled above
      } else {
        // If an API key is provided but data failed, the console.warns in stocks.js fired.
        // We can just render the fallback data without annoying the user with an alert every time.
      }
      
      this.render();
      
      // Initially subscribe to the default stock
      window.finnhubApi.subscribe(this.selectedTicker);
      
    } catch (e) {
      console.error('Error loading data', e);
      alert('Failed to load data. Please check your API key or try again later.');
    } finally {
      this.loadingOverlay.style.display = 'none';
    }
  }

  render() {
    const allStocks = window.StockData.getAllStocks();
    const stock = window.StockData.getStockByTicker(this.selectedTicker);
    
    if (!stock) {
      console.error("Stock not found:", this.selectedTicker);
      return;
    }

    const latestPrice = window.StockData.getLatestPrice(this.selectedTicker);
    const sentiment = window.MentionData.getAggregateSentiment(this.selectedTicker);
    const mentions = window.MentionData.getMentionsByTicker(this.selectedTicker);

    // 1. Render Sidebar
    this.dashboard.renderSidebar(allStocks, this.selectedTicker, this.currentTimeframe);

    // 2. Update Header & Stats
    this.dashboard.updateMainView(stock, latestPrice, sentiment);

    // 3. Render Charts
    // Render charts using the selected timeframe slice
    const slicedPrices = stock.prices.slice(-this.currentTimeframe);
    const chartStockObj = { ...stock, prices: slicedPrices };
    const stockAlerts = this.allAlerts.filter(a => a.ticker === this.selectedTicker);
    
    // Generate AI Prediction Data for the chart overlay (Historical + Future)
    let predictions = [];
    if (window.PredictionData) {
      predictions = window.PredictionData.generatePredictionData(chartStockObj, mentions, stockAlerts);
    }
    
    if (this.stockChart) {
      this.stockChart.render(chartStockObj, mentions, stockAlerts, latestPrice.close, predictions);
    }
    
    if (this.sentimentGauge) {
      this.sentimentGauge.render(sentiment);
    }

    // 4. Render Feed
    this.dashboard.renderFeed(mentions, this.filterState);
  }

  selectStock(ticker) {
    if (this.selectedTicker !== ticker) {
      // Unsubscribe from old
      window.finnhubApi.unsubscribe(this.selectedTicker);
      
      this.selectedTicker = ticker;
      this.render();
      
      // Subscribe to new
      window.finnhubApi.subscribe(this.selectedTicker);
      
      if (window.innerWidth <= 768) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  applyFilters(filterState) {
    this.filterState = filterState;
    const mentions = window.MentionData.getMentionsByTicker(this.selectedTicker);
    this.dashboard.renderFeed(mentions, this.filterState);
  }
  
  focusMention(mentionId) {
    // If it's a real URL (from news), open it
    const mention = window.MentionData.getAllMentions().find(m => m.id === mentionId);
    if (mention && mention.url) {
      window.open(mention.url, '_blank');
      return;
    }

    const chartWrap = document.querySelector('.chart-container');
    if (chartWrap) {
      chartWrap.classList.add('glass-card--active');
      setTimeout(() => chartWrap.classList.remove('glass-card--active'), 800);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});
