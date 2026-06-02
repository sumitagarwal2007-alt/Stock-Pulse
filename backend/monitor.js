/**
 * StockPulse 24/7 Catalyst Monitor
 * Runs continuously, checks Finnhub for high-impact news, triggers Mac Desktop Notifications.
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const configPath = path.join(__dirname, 'config.json');
const alertsPath = path.join(__dirname, 'alerts.json');

// ── Catalyst Engine Logic ──
// These are keywords that actually move markets significantly
const CATALYST_KEYWORDS = {
  "partnership": "High",
  "acquisition": "High",
  "merger": "High",
  "allocated": "High",
  "awarded": "High",
  "contract": "High",
  "earnings beat": "High",
  "fda approval": "High",
  "soars": "High",
  "plummets": "High",
  "guidance raised": "High",
  "ceo resigns": "High",
  "investigation": "High"
};

/**
 * Trigger a native macOS Desktop Notification
 */
function sendMacNotification(title, message) {
  // Escape quotes
  const safeTitle = title.replace(/"/g, '\\"');
  const safeMessage = message.replace(/"/g, '\\"');
  
  const script = `display notification "${safeMessage}" with title "StockPulse Alert: ${safeTitle}" sound name "Glass"`;
  
  exec(`osascript -e '${script}'`, (error) => {
    if (error) {
      console.error('Failed to send macOS notification:', error);
    }
  });
}

/**
 * Scan text for catalytic events
 */
function analyzeCatalyst(headline, summary) {
  const text = `${headline} ${summary}`.toLowerCase();
  
  let triggeredCatalyst = null;
  let impact = "Low";
  
  for (const [keyword, lvl] of Object.entries(CATALYST_KEYWORDS)) {
    if (text.includes(keyword)) {
      triggeredCatalyst = keyword;
      impact = lvl;
      break;
    }
  }
  
  if (triggeredCatalyst) {
    let prediction = `Positive momentum likely due to ${triggeredCatalyst}.`;
    if (['investigation', 'ceo resigns', 'plummets'].includes(triggeredCatalyst)) {
      prediction = `Negative momentum likely due to ${triggeredCatalyst}.`;
    }
    
    return {
      isCatalyst: true,
      keyword: triggeredCatalyst,
      impact: impact,
      prediction: prediction
    };
  }
  
  return { isCatalyst: false };
}

/**
 * Main Loop
 */
async function runMonitor() {
  console.log(`\n[${new Date().toLocaleTimeString()}] 🔍 Scanning for catalysts...`);
  
  // 1. Read Config
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error("❌ Could not read config.json. Please ensure it exists.");
    return;
  }

  if (!config.finnhub_api_key || config.finnhub_api_key === "YOUR_API_KEY_HERE") {
    console.error("❌ Missing API Key in backend/config.json");
    return;
  }

  // 2. Read previous alerts to prevent duplicates
  let previousAlerts = [];
  try {
    previousAlerts = JSON.parse(fs.readFileSync(alertsPath, 'utf8'));
  } catch (e) {
    previousAlerts = [];
  }

  const processedUrls = new Set(previousAlerts.map(a => a.url));
  let newAlertsFound = false;

  // 3. Scan Watchlist
  for (const ticker of config.watchlist) {
    const toObj = new Date();
    const fromObj = new Date();
    fromObj.setDate(fromObj.getDate() - 3); // Look at last 3 days of news for catalysts

    const to = toObj.toISOString().split('T')[0];
    const from = fromObj.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${from}&to=${to}&token=${config.finnhub_api_key}`;
    
    try {
      const res = await fetch(url);
      const news = await res.json();
      
      if (!Array.isArray(news)) continue;

      // Only check recent 5 articles per scan to save processing
      const recentNews = news.slice(0, 5);

      for (const article of recentNews) {
        if (processedUrls.has(article.url)) continue; // Already alerted
        
        const analysis = analyzeCatalyst(article.headline, article.summary);
        
        if (analysis.isCatalyst) {
          console.log(`🚨 CATALYST FOUND FOR ${ticker}: ${analysis.keyword}`);
          
          const alertObj = {
            id: Date.now().toString(),
            ticker: ticker,
            timestamp: new Date().toISOString(),
            headline: article.headline,
            url: article.url,
            keyword: analysis.keyword,
            impact: analysis.impact,
            prediction: analysis.prediction
          };
          
          previousAlerts.unshift(alertObj); // Add to top
          processedUrls.add(article.url);
          newAlertsFound = true;
          
          // Trigger Mac Desktop Notification
          sendMacNotification(ticker, `${analysis.prediction}\n\n${article.headline}`);
        }
      }
    } catch (e) {
      console.error(`Error fetching news for ${ticker}:`, e.message);
    }
    
    // Tiny delay to respect API limits
    await new Promise(r => setTimeout(r, 200));
  }

  // 4. Save to JSON if new alerts found
  if (newAlertsFound) {
    // Keep only the last 100 alerts to prevent huge files
    const trimmedAlerts = previousAlerts.slice(0, 100);
    fs.writeFileSync(alertsPath, JSON.stringify(trimmedAlerts, null, 2));
    console.log(`✅ Saved new alerts to alerts.json`);
  } else {
    console.log(`💤 No new catalysts found.`);
  }
}

// Start the scheduler
console.log('==============================================');
console.log('🚀 StockPulse 24/7 Catalyst Monitor Started');
console.log('==============================================');
runMonitor();

// Schedule to run based on config
const intervalMinutes = 15; // default
setInterval(runMonitor, intervalMinutes * 60 * 1000);
