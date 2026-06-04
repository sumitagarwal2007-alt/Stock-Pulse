/* ============================================
   StockPulse — Stock Data (Live via Finnhub)
   ============================================ */

let STOCKS = [
  { ticker: 'TSLA', name: 'Tesla, Inc.', sector: 'Automotive / Energy', logo: '⚡' }
];

function setStocksList(tickers) {
  // Overwrite STOCKS array with basic objects based on tickers
  STOCKS = tickers.map(t => ({
    ticker: t,
    name: t,
    sector: 'Auto-Tracked',
    logo: '📈'
  }));
}

// Cache for API responses
const priceCache = {};

// No more mock data generation.
// We strictly use Finnhub or Alpaca for real data.

/**
 * Initialize all stock data by fetching from Finnhub
 */
async function loadAllStockPrices() {
  for (const stock of STOCKS) {
    try {
      // Fetch the LIVE quote (this is always free and reliable)
      const quote = await window.finnhubApi.getQuote(stock.ticker);
      
      if (quote && quote.c) {
        // Try to fetch real historical data first!
        let historicalPrices = [];
        try {
          if (window.alpacaApi && window.alpacaApi.hasKeys()) {
            historicalPrices = await window.alpacaApi.getHistoricalData(stock.ticker);
          } else {
            historicalPrices = await window.finnhubApi.getHistoricalData(stock.ticker);
          }
        } catch(e) { console.warn('Real historical data blocked or keys invalid, using fallback'); }
        
        let hybridPrices;
        if (historicalPrices && historicalPrices.length > 30) {
          hybridPrices = historicalPrices;
        } else {
          // Strictly use real live price if history fails due to rate limits
          hybridPrices = [{
            date: new Date().toISOString().split('T')[0],
            open: quote.o || quote.c,
            high: quote.h || quote.c,
            low: quote.l || quote.c,
            close: quote.c,
            volume: 0
          }];
        }
        
        // Ensure the absolute latest price matches the quote perfectly
        const last = hybridPrices[hybridPrices.length - 1];
        last.close = quote.c;
        last.open = quote.o || last.open;
        last.high = quote.h || last.high;
        last.low = quote.l || last.low;
        
        // Override the getLatestPrice logic slightly to use the real live change data
        stock.liveData = {
          close: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          isUp: quote.d >= 0
        };
        
        priceCache[stock.ticker] = hybridPrices;
      } else {
        console.warn(`No live quote for ${stock.ticker}.`);
      }
    } catch (e) {
      console.error(`Failed to load ${stock.ticker}`, e);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Dynamically add a single stock and fetch its live price
 */
async function addStock(ticker) {
  const upperTicker = ticker.toUpperCase();
  
  // Check if it already exists
  if (STOCKS.find(s => s.ticker === upperTicker)) {
    return true; // Already exists
  }
  
  try {
    // 1. Verify it's real by fetching a quote
    const quote = await window.finnhubApi.getQuote(upperTicker);
    
    // If it returns zeros, it might be invalid on Finnhub
    if (!quote || (quote.c === 0 && quote.h === 0)) {
      throw new Error("Invalid ticker or no data found");
    }
    
    // 2. Add to STOCKS array
    const newStock = { 
      ticker: upperTicker, 
      name: upperTicker + ' (Custom)', 
      sector: 'Custom Search', 
      logo: '🔎' 
    };
    STOCKS.push(newStock);
    
    // 3. Try to fetch REAL historical data
    let historicalPrices = [];
    try {
      if (window.alpacaApi && window.alpacaApi.hasKeys()) {
        historicalPrices = await window.alpacaApi.getHistoricalData(upperTicker);
      } else {
        historicalPrices = await window.finnhubApi.getHistoricalData(upperTicker);
      }
    } catch(e) { console.warn('Real historical data blocked or keys invalid, using fallback'); }
    
    let hybridPrices;
    if (historicalPrices && historicalPrices.length > 30) {
      hybridPrices = historicalPrices;
    } else {
      hybridPrices = [{
        date: new Date().toISOString().split('T')[0],
        open: quote.o || quote.c,
        high: quote.h || quote.c,
        low: quote.l || quote.c,
        close: quote.c,
        volume: 0
      }];
    }
    
    const last = hybridPrices[hybridPrices.length - 1];
    last.close = quote.c;
    last.open = quote.o || last.open;
    last.high = quote.h || last.high;
    last.low = quote.l || last.low;
    
    newStock.liveData = {
      close: quote.c,
      change: quote.d,
      changePercent: quote.dp,
      isUp: quote.d >= 0
    };
    
    priceCache[upperTicker] = hybridPrices;
    return true;
  } catch (error) {
    console.error("Failed to add stock:", error);
    return false;
  }
}

function getAllStocks() {
  return STOCKS.map(stock => ({
    ...stock,
    prices: priceCache[stock.ticker] || []
  }));
}

function getStockByTicker(ticker) {
  const stock = STOCKS.find(s => s.ticker === ticker);
  if (!stock) return null;
  return {
    ...stock,
    prices: priceCache[ticker] || []
  };
}

function getLatestPrice(ticker) {
  const stock = STOCKS.find(s => s.ticker === ticker);
  if (stock && stock.liveData) {
    return stock.liveData; // Return the exact live quote data!
  }
  
  const prices = priceCache[ticker];
  if (!prices || prices.length < 2) return { close: 0, change: 0, changePercent: 0, isUp: true };
  
  const latest = prices[prices.length - 1];
  const prev = prices[prices.length - 2];
  const change = latest.close - prev.close;
  const changePercent = (change / prev.close) * 100;
  
  return {
    ...latest,
    change,
    changePercent,
    isUp: change >= 0
  };
}

if (typeof window !== 'undefined') {
  window.StockData = { 
    get STOCKS() { return STOCKS; }, 
    setStocksList,
    loadAllStockPrices,
    addStock,
    getAllStocks, 
    getStockByTicker, 
    getLatestPrice 
  };
}
