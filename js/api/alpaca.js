/* ============================================
   MarketOracle — Alpaca API Service
   Handles fetching real historical data
   ============================================ */

class AlpacaAPI {
  constructor() {
    this.keyId = localStorage.getItem('alpaca_key_id') || '';
    this.secretKey = localStorage.getItem('alpaca_secret_key') || '';
    this.baseUrl = 'https://data.alpaca.markets/v2';
  }

  setKeys(keyId, secretKey) {
    this.keyId = keyId;
    this.secretKey = secretKey;
    localStorage.setItem('alpaca_key_id', keyId);
    localStorage.setItem('alpaca_secret_key', secretKey);
  }

  hasKeys() {
    return !!this.keyId && !!this.secretKey;
  }

  async fetch(endpoint, params = {}) {
    if (!this.hasKeys()) {
      throw new Error('Alpaca Keys missing');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    try {
      const response = await window.fetch(url, {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': this.keyId,
          'APCA-API-SECRET-KEY': this.secretKey,
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid Alpaca Keys');
        if (response.status === 429) throw new Error('Alpaca Rate limit exceeded');
        throw new Error(`Alpaca API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Alpaca fetch error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Get 90 days of historical data for a symbol
   */
  async getHistoricalData(symbol) {
    if (!this.hasKeys()) return [];
    
    // Calculate dates (90 days ago to today)
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);
    
    const data = await this.fetch('/stocks/bars', {
      symbols: symbol,
      timeframe: '1Day',
      start: fromDate.toISOString(),
      end: toDate.toISOString()
    });

    if (!data || !data.bars || !data.bars[symbol]) {
      return [];
    }

    // Map to our expected format
    return data.bars[symbol].map(bar => ({
      date: bar.t.split('T')[0], // Extract just the YYYY-MM-DD
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v
    }));
  }
}

// Export singleton
if (typeof window !== 'undefined') {
  window.alpacaApi = new AlpacaAPI();
}
