/* ============================================
   StockPulse — Finnhub API Service
   Handles fetching live data
   ============================================ */

class FinnhubAPI {
  constructor() {
    this.apiKey = localStorage.getItem('finnhub_api_key') || '';
    this.baseUrl = 'https://finnhub.io/api/v1';
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
   * Get 15 days of historical data for a symbol (often restricted on free tier)
   */
  async getHistoricalData(symbol) {
    const to = Math.floor(Date.now() / 1000);
    const from = to - (15 * 24 * 60 * 60); // 15 days ago

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
}

// Export singleton
if (typeof window !== 'undefined') {
  window.finnhubApi = new FinnhubAPI();
}
