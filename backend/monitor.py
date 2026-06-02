import os
import json
import time
import urllib.request
import subprocess
from datetime import datetime, timedelta

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, 'config.json')
ALERTS_PATH = os.path.join(BASE_DIR, 'alerts.json')

# Catalyst Engine Logic
CATALYST_KEYWORDS = {
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
}

def send_mac_notification(title, message):
    """Trigger a native macOS Desktop Notification"""
    safe_title = title.replace('"', '\\"')
    safe_message = message.replace('"', '\\"')
    
    script = f'display notification "{safe_message}" with title "MarketOracle Alert: {safe_title}" sound name "Glass"'
    try:
        subprocess.run(["osascript", "-e", script], check=True)
    except Exception as e:
        print(f"Failed to send macOS notification: {e}")

def analyze_catalyst(headline, summary):
    """Scan text for catalytic events"""
    text = f"{headline} {summary}".lower()
    
    triggered_catalyst = None
    impact = "Low"
    
    for keyword, lvl in CATALYST_KEYWORDS.items():
        if keyword in text:
            triggered_catalyst = keyword
            impact = lvl
            break
            
    if triggered_catalyst:
        prediction = f"Positive momentum likely due to {triggered_catalyst}."
        if triggered_catalyst in ['investigation', 'ceo resigns', 'plummets']:
            prediction = f"Negative momentum likely due to {triggered_catalyst}."
            
        return {
            "isCatalyst": True,
            "keyword": triggered_catalyst,
            "impact": impact,
            "prediction": prediction
        }
        
    return {"isCatalyst": False}

def run_monitor():
    current_time = datetime.now().strftime("%I:%M:%S %p")
    print(f"\n[{current_time}] 🔍 Scanning for catalysts...", flush=True)
    
    # 1. Read Config
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
    except Exception as e:
        print("❌ Could not read config.json. Please ensure it exists.")
        return

    if not config.get("finnhub_api_key") or config["finnhub_api_key"] == "YOUR_API_KEY_HERE":
        print("❌ Missing API Key in backend/config.json")
        return

    # 2. Read previous alerts
    try:
        if os.path.exists(ALERTS_PATH):
            with open(ALERTS_PATH, 'r') as f:
                content = f.read().strip()
                previous_alerts = json.loads(content) if content else []
        else:
            previous_alerts = []
    except Exception as e:
        previous_alerts = []

    processed_urls = {a.get('url') for a in previous_alerts if isinstance(a, dict)}
    new_alerts_found = False

    # 3. Scan General Market News (Trending)
    url = f"https://finnhub.io/api/v1/news?category=general&token={config['finnhub_api_key']}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            
        if isinstance(data, list):
            # Check the latest 30 articles for any trending catalysts
            recent_news = data[:30]
            
            for article in recent_news:
                article_url = article.get('url', '')
                if article_url in processed_urls:
                    continue
                
                # Extract related ticker (Finnhub provides related symbols in general news)
                related = article.get('related', '')
                if not related: 
                    continue
                
                # Some articles have multiple related, just grab the first one
                ticker = related.split(',')[0].strip()
                if not ticker:
                    continue
                    
                headline = article.get('headline', '')
                summary = article.get('summary', '')
                
                analysis = analyze_catalyst(headline, summary)
                
                if analysis.get('isCatalyst'):
                    keyword = analysis['keyword']
                    print(f"🚨 TRENDING CATALYST FOUND FOR {ticker}: {keyword}", flush=True)
                    
                    # 4. Fetch Exact Live Quote to record Alert Price
                    alert_price = 0.0
                    try:
                        quote_url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={config['finnhub_api_key']}"
                        q_req = urllib.request.Request(quote_url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(q_req) as q_resp:
                            q_data = json.loads(q_resp.read().decode())
                            alert_price = q_data.get('c', 0.0)
                    except Exception as q_err:
                        print(f"Failed to fetch live quote for {ticker}: {q_err}")
                    
                    alert_obj = {
                        "id": str(int(time.time() * 1000)),
                        "ticker": ticker,
                        "timestamp": datetime.now().isoformat() + "Z",
                        "date": datetime.now().strftime('%Y-%m-%d'),
                        "headline": headline,
                        "url": article_url,
                        "keyword": keyword,
                        "impact": analysis['impact'],
                        "prediction": analysis['prediction'],
                        "alert_price": alert_price
                    }
                    
                    previous_alerts.insert(0, alert_obj)
                    processed_urls.add(article_url)
                    new_alerts_found = True
                    
                    send_mac_notification(ticker, f"${alert_price} | {analysis['prediction']}\n\n{headline}")
                    
                    time.sleep(1) # Rate limit protection when a catalyst is found
                    
    except Exception as e:
        print(f"Error fetching general news: {e}")

    # 5. Save to JSON if new alerts found
    if new_alerts_found:
        trimmed_alerts = previous_alerts[:100]
        try:
            with open(ALERTS_PATH, 'w') as f:
                json.dump(trimmed_alerts, f, indent=2)
            print("✅ Saved new alerts to alerts.json", flush=True)
        except Exception as e:
            print(f"Error saving alerts: {e}")
    else:
        print("💤 No new catalysts found.", flush=True)

if __name__ == "__main__":
    print("==============================================")
    print("🚀 MarketOracle 24/7 Catalyst Monitor Started")
    print("==============================================", flush=True)
    
    # Read config for interval
    try:
        with open(CONFIG_PATH, 'r') as f:
            cfg = json.load(f)
            interval_minutes = cfg.get("check_interval_minutes", 15)
    except:
        interval_minutes = 15
        
    # Initial run
    run_monitor()
    
    # Loop
    while True:
        time.sleep(interval_minutes * 60)
        run_monitor()
