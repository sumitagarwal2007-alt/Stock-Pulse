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
    this.rankings = {};

    // UI Elements
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsBtn = document.getElementById('settings-btn');
    this.closeModalBtn = document.getElementById('close-modal-btn');
    this.saveKeyBtn = document.getElementById('save-key-btn');
    this.apiKeyInput = document.getElementById('api-key-input');
    this.alpacaKeyInput = document.getElementById('alpaca-key-input');
    this.alpacaSecretInput = document.getElementById('alpaca-secret-input');
    this.geminiKeyInput = document.getElementById('gemini-key-input');
    this.searchInput = document.getElementById('ticker-search-input');
    
    // Watchlist UI
    this.manageWatchlistBtn = document.getElementById('manage-watchlist-btn');
    this.watchlistModal = document.getElementById('watchlist-modal');
    this.closeWatchlistBtn = document.getElementById('close-watchlist-btn');
    this.addTickerBtn = document.getElementById('add-ticker-btn');
    this.newTickerInput = document.getElementById('new-ticker-input');
    this.watchlistItemsContainer = document.getElementById('watchlist-items');
    
    // Alerts UI
    this.alertsBtn = document.getElementById('alerts-btn');
    this.alertsModal = document.getElementById('alerts-modal');
    this.closeAlertsBtn = document.getElementById('close-alerts-btn');
    this.alertsContainer = document.getElementById('alerts-container');
    
    // Tabs
    this.tabDashboard = document.getElementById('tab-dashboard');
    this.tabHeatmap = document.getElementById('tab-heatmap');
    this.tabPortfolio = document.getElementById('tab-portfolio');
    this.viewDashboard = document.querySelector('.app-content:not(#heatmap-view):not(#portfolio-view)');
    this.viewHeatmap = document.getElementById('heatmap-view');
    this.viewPortfolio = document.getElementById('portfolio-view');
    this.viewHeatmap = document.getElementById('heatmap-view');
    this.heatmap = null;
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
    
    if (document.getElementById('heatmap-grid')) {
      this.heatmap = new window.SectorHeatmap('heatmap-grid');
    }

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
      
      // Fetch Gemini key from backend config
      fetch('/api/settings').then(res => res.json()).then(data => {
        if (data.gemini_api_key) {
          this.geminiKeyInput.value = data.gemini_api_key;
        }
      }).catch(e => console.log('Could not load backend settings'));
      
      this.settingsModal.style.display = 'flex';
    });

    this.closeModalBtn.addEventListener('click', () => {
      this.settingsModal.style.display = 'none';
    });

    this.saveKeyBtn.addEventListener('click', async () => {
      const finnhubKey = this.apiKeyInput.value.trim();
      const alpacaKey = this.alpacaKeyInput.value.trim();
      const alpacaSecret = this.alpacaSecretInput.value.trim();
      const geminiKey = this.geminiKeyInput.value.trim();
      
      if (finnhubKey) {
        window.finnhubApi.setApiKey(finnhubKey);
        
        if (window.alpacaApi && alpacaKey && alpacaSecret) {
          window.alpacaApi.setKeys(alpacaKey, alpacaSecret);
        }
        
        // Save to Python Backend
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              finnhub_api_key: finnhubKey,
              gemini_api_key: geminiKey
            })
          });
        } catch(e) {
          console.error("Failed to save backend config", e);
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

    // Watchlist Management
    if (this.manageWatchlistBtn) {
      this.manageWatchlistBtn.addEventListener('click', () => {
        this.renderWatchlistModal();
        this.watchlistModal.style.display = 'flex';
      });
      
      this.closeWatchlistBtn.addEventListener('click', () => {
        this.watchlistModal.style.display = 'none';
        this.render(); // Re-render sidebar to show any updates
      });
      
      this.addTickerBtn.addEventListener('click', () => {
        const newTicker = this.newTickerInput.value.trim().toUpperCase();
        if (newTicker) {
          this.addToWatchlist(newTicker);
          this.newTickerInput.value = '';
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

    // Tabs Logic
    if (this.tabDashboard && this.tabHeatmap && this.tabPortfolio) {
      const resetTabs = () => {
        [this.tabDashboard, this.tabHeatmap, this.tabPortfolio].forEach(t => {
          t.style.background = 'transparent';
          t.style.color = 'var(--text-secondary)';
        });
        [this.viewDashboard, this.viewHeatmap, this.viewPortfolio].forEach(v => {
          if(v) v.style.display = 'none';
        });
      };

      this.tabDashboard.addEventListener('click', () => {
        resetTabs();
        this.tabDashboard.style.background = 'rgba(255,255,255,0.1)';
        this.tabDashboard.style.color = 'var(--text-primary)';
        if(this.viewDashboard) this.viewDashboard.style.display = 'flex';
      });
      
      this.tabHeatmap.addEventListener('click', () => {
        resetTabs();
        this.tabHeatmap.style.background = 'rgba(255,255,255,0.1)';
        this.tabHeatmap.style.color = 'var(--text-primary)';
        if(this.viewHeatmap) this.viewHeatmap.style.display = 'block';
        
        if (this.heatmap) {
          const allStocks = window.StockData.getAllStocks();
          const mentions = window.MentionData.getAllMentions();
          this.heatmap.render(allStocks, mentions, this.rankings);
        }
      });
      
      this.tabPortfolio.addEventListener('click', () => {
        resetTabs();
        this.tabPortfolio.style.background = 'rgba(255,255,255,0.1)';
        this.tabPortfolio.style.color = 'var(--text-primary)';
        if(this.viewPortfolio) this.viewPortfolio.style.display = 'block';
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

  renderWatchlistModal() {
    this.watchlistItemsContainer.innerHTML = '';
    const currentList = window.STOCKS || window.StockData.getAllStocks();
    
    currentList.forEach(stock => {
      const item = document.createElement('div');
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.background = 'rgba(255,255,255,0.05)';
      item.style.padding = '8px 12px';
      item.style.borderRadius = '6px';
      
      const tickerLabel = document.createElement('span');
      tickerLabel.style.fontWeight = '600';
      tickerLabel.innerText = stock.ticker;
      
      const delBtn = document.createElement('button');
      delBtn.innerText = 'Remove';
      delBtn.style.background = 'var(--semantic-danger)';
      delBtn.style.color = 'white';
      delBtn.style.border = 'none';
      delBtn.style.padding = '4px 8px';
      delBtn.style.borderRadius = '4px';
      delBtn.style.cursor = 'pointer';
      delBtn.style.fontSize = '12px';
      
      delBtn.onclick = () => {
        this.removeFromWatchlist(stock.ticker);
      };
      
      item.appendChild(tickerLabel);
      item.appendChild(delBtn);
      this.watchlistItemsContainer.appendChild(item);
    });
  }

  async addToWatchlist(ticker) {
    const success = await window.StockData.addStock(ticker);
    if (success) {
      this.renderWatchlistModal();
      this.syncWatchlistToBackend();
    } else {
      alert('Could not find data for ticker: ' + ticker);
    }
  }

  removeFromWatchlist(ticker) {
    if (window.STOCKS) {
      window.STOCKS = window.STOCKS.filter(s => s.ticker !== ticker);
    }
    this.renderWatchlistModal();
    this.syncWatchlistToBackend();
    
    if (this.selectedTicker === ticker) {
      const first = window.STOCKS[0];
      if (first) this.selectStock(first.ticker);
    }
  }

  async syncWatchlistToBackend() {
    const tickers = (window.STOCKS || []).map(s => s.ticker);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watchlist: tickers })
      });
    } catch(e) {
      console.warn("Could not sync watchlist to backend config", e);
    }
  }

  async fetchAndRenderAlerts() {
    this.alertsContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-secondary);">Loading alerts from background monitor...</div>';
    
    try {
      // Try to fetch the alerts from the backend API (SQLite)
      const response = await fetch('/api/alerts');
      if (!response.ok) throw new Error('Alerts API not found. Ensure monitor.py and server.py are running.');
      
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

        let sentimentColor = 'var(--text-secondary)';
        if (alert.sentiment === 'Bullish') sentimentColor = 'var(--semantic-success)';
        if (alert.sentiment === 'Bearish') sentimentColor = 'var(--semantic-danger)';

        html += `
        <div style="background: rgba(255,255,255,0.05); padding: var(--space-3); border-radius: 8px; margin-bottom: var(--space-3); border-left: 4px solid var(--semantic-${alert.impact === 'High' ? 'danger' : 'warning'});">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong style="color: var(--text-primary); font-size: 16px;">${alert.ticker} • <span style="text-transform: uppercase;">${alert.keyword}</span></strong>
            <span style="font-size: 12px; color: var(--text-tertiary);">${new Date(alert.timestamp).toLocaleString()}</span>
          </div>
          <div style="font-size: 14px; margin-bottom: 12px; color: var(--text-secondary);">
            ${alert.headline}
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
            <div style="font-size: 12px;">
              <span style="color: var(--text-tertiary);">Sentiment:</span> <strong style="color: ${sentimentColor}">${alert.sentiment || 'Unknown'}</strong>
            </div>
            <div style="font-size: 12px;">
              <span style="color: var(--text-tertiary);">Price Target:</span> <strong>${alert.price_target || 'N/A'}</strong>
            </div>
            <div style="font-size: 12px;">
              <span style="color: var(--text-tertiary);">Horizon:</span> <strong>${alert.horizon || 'N/A'}</strong>
            </div>
            <div style="font-size: 12px; display: flex; align-items: center; gap: 6px;">
              <span style="color: var(--text-tertiary);">Conviction:</span> <strong>${alert.conviction || 50}/100</strong>
              <div style="flex-grow: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${alert.conviction || 50}%; background: ${(alert.conviction || 50) >= 70 ? 'var(--semantic-success)' : 'var(--accent-primary)'};"></div>
              </div>
            </div>
          </div>
          
          <div style="font-size: 13px; color: var(--accent-primary); font-weight: 500;">
            🤖 AI Thesis: ${alert.prediction}
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
    const statusText = document.querySelector('#loading-overlay div:nth-child(2)');
    const updateStatus = (msg) => {
      if(statusText) statusText.innerText = msg;
      console.log("[DEBUG]", msg);
    };

    // Show loading early
    this.loadingOverlay.style.display = 'flex';
    updateStatus('Fetching backend settings and keys...');

    try {
      const settingsResp = await fetch('/api/settings');
      if (settingsResp.ok) {
        const settings = await settingsResp.json();
        
        // Auto-load keys from backend config!
        if (settings.finnhub_api_key) {
          window.finnhubApi.setApiKey(settings.finnhub_api_key);
        }
        if (settings.alpaca_api_key && settings.alpaca_secret_key && window.alpacaApi) {
          window.alpacaApi.setKeys(settings.alpaca_api_key, settings.alpaca_secret_key);
        }
        
        if (settings.watchlist && settings.watchlist.length > 0) {
          window.StockData.setStocksList(settings.watchlist);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch settings from backend", e);
    }

    if (!window.finnhubApi.hasApiKey()) {
      this.loadingOverlay.style.display = 'none';
      this.settingsModal.style.display = 'flex';
      return;
    }

    try {
      updateStatus('Fetching stock prices...');
      await window.StockData.loadAllStockPrices();
      
      console.log('Fetching company news...');
      await window.MentionData.loadAllMentions();
      
      try {
        const resp = await fetch('/api/alerts');
        if (resp.ok) {
          this.allAlerts = await resp.json();
        }
      } catch (e) { }
      
      try {
        const resp = await fetch('/api/rankings');
        if (resp.ok) {
          this.rankings = await resp.json();
        }
      } catch (e) { }
      
      const testStock = window.StockData.getStockByTicker('TSLA');

      // Safe isolated load for portfolio
      try {
        await this.loadPortfolio();
      } catch (e) {
        console.warn("Portfolio failed to load, continuing without it.", e);
      }
      
      this.render();
      window.finnhubApi.subscribe(this.selectedTicker);
      
      // Data loaded successfully! Hide the spinner.
      this.loadingOverlay.style.display = 'none';
      
    } catch (e) {
      console.error('Error loading data', e);
      const statusText = document.querySelector('#loading-overlay div:nth-child(2)');
      if(statusText) {
        statusText.style.color = 'var(--semantic-danger)';
        statusText.innerText = 'ERROR: ' + e.message + '\n' + e.stack;
      }
      // Do NOT hide the overlay on error so the user can read it
    }
  }

  async loadPortfolio() {
    try {
      const resp = await fetch('/api/portfolio');
      if (!resp.ok) return;
      const data = await resp.json();
      
      let cashBalance = 0;
      let trades = [];
      if (data.trades) {
        cashBalance = data.cash_balance;
        trades = data.trades;
      } else {
        trades = data;
      }
      
      // Fetch real live prices for all open trades dynamically to ensure accurate PNL!
      for (const t of trades) {
        if (t.status === 'OPEN') {
           try {
             // Delay slightly to help with rate limits
             await new Promise(r => setTimeout(r, 100));
             const quote = await window.finnhubApi.getQuote(t.ticker);
             if (quote && quote.c) {
                t.livePrice = quote.c;
             }
           } catch(e) {}
        }
      }
      
      this.renderPortfolio(trades, cashBalance);
    } catch (e) {
      console.warn("Failed to load portfolio data", e);
    }
  }

  renderPortfolio(trades, cashBalance = 0) {
    let totalInvested = 0;
    let currentBalance = 0;
    let realizedPnl = 0;
    let unrealizedPnl = 0;

    const cashEl = document.getElementById('portfolio-cash');
    if (cashEl) {
      cashEl.innerText = `$${cashBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }

    const listEl = document.getElementById('portfolio-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (trades.length === 0) {
      listEl.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 40px;">No AI trades have been executed yet.</div>';
    }

    trades.forEach(t => {
      // Prioritize the dynamically fetched real price
      let currentPrice = t.price;
      
      if (t.livePrice) {
        currentPrice = t.livePrice;
      } else {
        const liveData = window.StockData.getLatestPrice(t.ticker);
        const fallbackPrice = liveData ? liveData.close : t.price;
        
        // If the fallback price is absurdly different (>30% off), it's likely a rate-limited mock data artifact.
        // In that case, anchor it to the trade price so we don't show an insane fake PnL.
        if (Math.abs(fallbackPrice - t.price) / t.price < 0.3) {
           currentPrice = fallbackPrice;
        }
      }
      
      if (t.status === 'OPEN') {
        const invested = t.shares * t.price;
        const currentVal = t.shares * currentPrice;
        totalInvested += invested;
        currentBalance += currentVal;
        
        const openPnl = currentVal - invested;
        if (t.action === 'BUY') {
          unrealizedPnl += openPnl;
        } else {
          unrealizedPnl -= openPnl; // Short
        }
      } else {
        realizedPnl += (t.pnl || 0);
      }

      // Render Card
      const isUp = t.status === 'OPEN' ? (currentPrice >= t.price) : ((t.pnl || 0) >= 0);
      const colorClass = isUp ? 'stock-card__change--up' : 'stock-card__change--down';
      const arrow = isUp ? '↑' : '↓';
      
      const pnlDisplay = t.status === 'OPEN' 
        ? `${arrow} $${Math.abs((currentPrice - t.price) * t.shares).toFixed(2)}`
        : `${arrow} $${Math.abs(t.pnl || 0).toFixed(2)}`;

      const html = `
        <div class="glass-card" style="display: flex; flex-direction: column; gap: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-weight: bold; font-size: 18px; color: var(--text-primary);">
                <span style="color: ${t.action === 'BUY' ? 'var(--semantic-success)' : 'var(--semantic-danger)'}; font-size: 14px; margin-right: 8px;">${t.action}</span>
                ${t.ticker}
              </div>
              <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                ${t.shares} shares @ $${t.price.toFixed(2)} &nbsp;&bull;&nbsp; ${new Date(t.timestamp).toLocaleString()}
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-secondary); border: 1px solid var(--border-subtle); padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 4px;">${t.status}</div>
              <div class="chart-header__change ${colorClass}" style="font-size: 16px;">${pnlDisplay}</div>
            </div>
          </div>
          
          <div style="background: rgba(0,0,0,0.2); border-left: 3px solid var(--accent-primary); padding: 12px; border-radius: 4px;">
            <div style="font-size: 10px; text-transform: uppercase; color: var(--text-secondary); font-weight: bold; margin-bottom: 4px;">AI Rationale</div>
            <div style="color: var(--text-primary); font-size: 14px; line-height: 1.4;">${t.headline || 'Technical Catalyst'}</div>
            <div style="color: var(--accent-primary); font-size: 12px; margin-top: 8px;">Prediction: ${t.prediction || 'N/A'}</div>
          </div>
        </div>
      `;
      listEl.innerHTML += html;
    });

    const f = (val) => '$' + Math.abs(val).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    document.getElementById('portfolio-invested').innerText = f(totalInvested);
    document.getElementById('portfolio-balance').innerText = f(currentBalance);
    
    const unPnlEl = document.getElementById('portfolio-unrealized-pnl');
    unPnlEl.innerText = (unrealizedPnl >= 0 ? '+' : '-') + f(unrealizedPnl);
    unPnlEl.className = `stat-card__value ${unrealizedPnl >= 0 ? 'stock-card__change--up' : 'stock-card__change--down'}`;
    
    const realPnlEl = document.getElementById('portfolio-realized-pnl');
    realPnlEl.innerText = (realizedPnl >= 0 ? '+' : '-') + f(realizedPnl);
    realPnlEl.className = `stat-card__value ${realizedPnl >= 0 ? 'stock-card__change--up' : 'stock-card__change--down'}`;
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
    this.dashboard.renderSidebar(allStocks, this.selectedTicker, this.currentTimeframe, this.rankings);

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
      // Pass the full stock object as well so the chart can compute moving averages
      this.stockChart.render(chartStockObj, mentions, stockAlerts, latestPrice.close, predictions, stock);
    }
    
    if (this.sentimentGauge) {
      this.sentimentGauge.render(sentiment);
    }

    // 4. Render Feed
    this.dashboard.renderFeed(mentions, this.filterState);
    
    // 5. Update Heatmap (if active)
    if (this.heatmap && this.viewHeatmap.style.display === 'block') {
      const allMentions = window.MentionData.getAllMentions();
      this.heatmap.render(allStocks, allMentions, this.rankings);
    }
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
