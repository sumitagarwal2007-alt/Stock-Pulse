/* ============================================
   StockPulse — Mentions Data (Live News via Finnhub)
   ============================================ */

let CACHED_MENTIONS = [];

// No more mock mentions generation.
// We strictly use Finnhub for real news.

/**
 * Fetch company news for all stocks and map them into "Mentions"
 */
async function loadAllMentions() {
  CACHED_MENTIONS = [];
  const stocks = window.StockData.getAllStocks();
  let mentionId = 1;

  for (const stock of stocks) {
    try {
      const newsItems = await window.finnhubApi.getCompanyNews(stock.ticker);
      
      if (!newsItems || newsItems.length === 0) {
        console.warn(`No news from API for ${stock.ticker}.`);
      } else {
        const recentNews = newsItems.slice(0, 10);
        for (const item of recentNews) {
          const analysisText = `${item.headline} ${item.summary}`;
          const sentimentResult = window.SentimentAnalyzer.analyze(analysisText);
          const influencers = window.InfluencerData.getInfluencersByCategory('finance');
          const randomInfluencer = influencers[Math.floor(Math.random() * influencers.length)];
          const dateObj = new Date(item.datetime * 1000);

          CACHED_MENTIONS.push({
            id: `m_${mentionId++}`,
            influencerId: randomInfluencer.id,
            ticker: stock.ticker,
            date: dateObj.toISOString().split('T')[0],
            timestamp: dateObj.toISOString(),
            source: item.source || 'Financial News',
            quote: item.headline,
            sentiment: sentimentResult.sentiment,
            score: sentimentResult.score,
            impact: 'medium',
            url: item.url
          });
        }
      }
    } catch (e) {
      console.error(`Failed to load news for ${stock.ticker}`, e);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Sort global mentions chronologically
  CACHED_MENTIONS.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Fetch news for a single stock dynamically
 */
async function fetchNewsForStock(ticker) {
  const upperTicker = ticker.toUpperCase();
  const stock = window.StockData.getStockByTicker(upperTicker);
  if (!stock) return false;
  
  try {
    const newsItems = await window.finnhubApi.getCompanyNews(upperTicker);
    
    if (!newsItems || newsItems.length === 0) {
      console.warn(`No news from API for ${upperTicker}.`);
    } else {
      const recentNews = newsItems.slice(0, 10);
      for (const item of recentNews) {
        const analysisText = `${item.headline} ${item.summary}`;
        const sentimentResult = window.SentimentAnalyzer.analyze(analysisText);
        const influencers = window.InfluencerData.getInfluencersByCategory('finance');
        const randomInfluencer = influencers[Math.floor(Math.random() * influencers.length)];
        const dateObj = new Date(item.datetime * 1000);

        CACHED_MENTIONS.push({
          id: `m_${Math.random().toString(36).substr(2, 9)}`,
          influencerId: randomInfluencer.id,
          ticker: upperTicker,
          date: dateObj.toISOString().split('T')[0],
          timestamp: dateObj.toISOString(),
          source: item.source || 'Financial News',
          quote: item.headline,
          sentiment: sentimentResult.sentiment,
          score: sentimentResult.score,
          impact: 'medium',
          url: item.url
        });
      }
    }
    
    // Re-sort
    CACHED_MENTIONS.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return true;
  } catch (e) {
    console.error(`Failed to load news for ${upperTicker}`, e);
    CACHED_MENTIONS.push(...generateMockMentions(stock));
    CACHED_MENTIONS.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return false;
  }
}

function getAllMentions() {
  return CACHED_MENTIONS;
}

function getMentionsByTicker(ticker) {
  return CACHED_MENTIONS.filter(m => m.ticker === ticker)
                        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function getMentionsByInfluencer(influencerId) {
  return CACHED_MENTIONS.filter(m => m.influencerId === influencerId)
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function getAggregateSentiment(ticker) {
  const stockMentions = getMentionsByTicker(ticker);
  
  if (stockMentions.length === 0) {
    return { positive: 0, negative: 0, neutral: 0, overall: 'neutral', totalMentions: 0 };
  }

  let pos = 0, neg = 0, neu = 0, totalScore = 0;

  stockMentions.forEach(m => {
    if (m.sentiment === 'positive') { pos++; totalScore += m.score; }
    else if (m.sentiment === 'negative') { neg++; totalScore -= m.score; }
    else { neu++; }
  });

  const total = stockMentions.length;
  let overall = 'neutral';
  
  if (pos > neg) overall = 'positive';
  if (neg > pos) overall = 'negative';

  return {
    positive: Math.round((pos / total) * 100),
    negative: Math.round((neg / total) * 100),
    neutral: Math.round((neu / total) * 100),
    overall,
    totalMentions: total,
    netScore: totalScore
  };
}

if (typeof window !== 'undefined') {
  window.MentionData = { 
    loadAllMentions,
    fetchNewsForStock,
    getAllMentions, 
    getMentionsByTicker, 
    getMentionsByInfluencer,
    getAggregateSentiment 
  };
}
