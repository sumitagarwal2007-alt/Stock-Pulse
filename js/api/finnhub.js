/* ============================================
   StockPulse — Finnhub API Service
   Handles fetching live data
   ============================================ */

class FinnhubAPI {
  constructor() {
    this.apiKey = localStorage.getItem('finnhub_api_key') || '';
    this.baseUrl = 'https://finnhub.io/api/v1';
    this.ws = null;
    this.onTradeCallback = null;
  }

  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('finnhub_api_key', key);
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  async fetch(endpoint, params = {}) {
    if (!this.apiKey) {
      throw new Error('API Key missing');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('token', this.apiKey);
    
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    try {
      const response = await window.fetch(url);
      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid API Key');
        if (response.status === 429) throw new Error('Rate limit exceeded');
        throw new Error(`API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Finnhub fetch error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Get 90 days of historical data for a symbol
   */
  async getHistoricalData(symbol) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - (90 * 24 * 60 * 60); // 90 days ago

    const data = await this.fetch('/stock/candle', {
      symbol,
      resolution: 'D',
      from,
      to
    });

    if (data.s === 'no_data' || !data.c) {
      return [];
    }

    // Map to our expected format
    return data.t.map((timestamp, i) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: data.o[i],
      high: data.h[i],
      low: data.l[i],
      close: data.c[i],
      volume: data.v[i]
    }));
  }

  /**
   * Get real-time quote for a symbol (Supported on free tier)
   */
  async getQuote(symbol) {
    return await this.fetch('/quote', { symbol });
  }

  /**
   * Get latest company news (last 15 days)
   */
  async getCompanyNews(symbol) {
    const toObj = new Date();
    const fromObj = new Date();
    fromObj.setDate(fromObj.getDate() - 15);

    const to = toObj.toISOString().split('T')[0];
    const from = fromObj.toISOString().split('T')[0];

    const data = await this.fetch('/company-news', {
      symbol,
      from,
      to
    });

    return data; // Array of news objects
  }

  /**
   * Initialize WebSocket connection for live trades
   */
  connectWebSocket(callback) {
    if (!this.apiKey) return;
    
    this.onTradeCallback = callback;
    
    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

    this.ws.onopen = () => {
      console.log('⚡ Finnhub WebSocket Connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'trade' && this.onTradeCallback) {
          // data.data is an array of trades, we usually just care about the last one
          const lastTrade = data.data[data.data.length - 1];
          this.onTradeCallback(lastTrade);
        }
      } catch (e) {
        console.error('WebSocket parsing error:', e);
      }
    };
    
    this.ws.onclose = () => {
      console.log('⚡ Finnhub WebSocket Disconnected');
    };
  }

  subscribe(symbol) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({'type':'subscribe', 'symbol': symbol}));
      console.log(`Subscribed to live trades for ${symbol}`);
    } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      // If it's still connecting, wait and retry
      this.ws.addEventListener('open', () => this.subscribe(symbol), { once: true });
    }
  }

  unsubscribe(symbol) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({'type':'unsubscribe', 'symbol': symbol}));
      console.log(`Unsubscribed from live trades for ${symbol}`);
    }
  }
}

// Export singleton
if (typeof window !== 'undefined') {
  window.finnhubApi = new FinnhubAPI();
}
