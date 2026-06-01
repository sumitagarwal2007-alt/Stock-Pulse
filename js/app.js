/* ============================================
   StockPulse — Main Application (Live Data)
   ============================================ */

class App {
  constructor() {
    this.selectedTicker = 'TSLA'; 
    this.filterState = { category: 'all' };
    
    this.stockChart = null;
    this.sentimentGauge = null;
    this.dashboard = null;

    // UI Elements
    this.loadingOverlay = document.getElementById('loading-overlay');
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsBtn = document.getElementById('settings-btn');
    this.closeModalBtn = document.getElementById('close-modal-btn');
    this.saveKeyBtn = document.getElementById('save-key-btn');
    this.apiKeyInput = document.getElementById('api-key-input');
    this.searchInput = document.getElementById('ticker-search-input');
  }

  async init() {
    console.log("🚀 Initializing StockPulse Live...");
    
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

    // Check API Key & Load Data
    await this.checkAndLoadData();
  }

  attachEvents() {
    this.settingsBtn.addEventListener('click', () => {
      this.apiKeyInput.value = window.finnhubApi.apiKey;
      this.settingsModal.style.display = 'flex';
    });

    this.closeModalBtn.addEventListener('click', () => {
      this.settingsModal.style.display = 'none';
    });

    this.saveKeyBtn.addEventListener('click', async () => {
      const key = this.apiKeyInput.value.trim();
      if (key) {
        window.finnhubApi.setApiKey(key);
        this.settingsModal.style.display = 'none';
        await this.checkAndLoadData();
      } else {
        alert('Please enter a valid API key.');
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
    this.dashboard.renderSidebar(allStocks, this.selectedTicker);

    // 2. Update Header & Stats
    this.dashboard.updateMainView(stock, latestPrice, sentiment);

    // 3. Render Charts
    if (this.stockChart) {
      this.stockChart.render(stock, mentions);
    }
    
    if (this.sentimentGauge) {
      this.sentimentGauge.render(sentiment);
    }

    // 4. Render Feed
    this.dashboard.renderFeed(mentions, this.filterState);
  }

  selectStock(ticker) {
    if (this.selectedTicker !== ticker) {
      this.selectedTicker = ticker;
      this.render();
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
