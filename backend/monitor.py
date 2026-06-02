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

def analyze_catalyst_with_gemini(headline, summary, gemini_key):
    """Scan text for catalytic events using Google Gemini 2.5 Flash"""
    if not gemini_key:
        return {"isCatalyst": False}
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    
    prompt = (
        "You are a quantitative AI analyst. Read the following news headline and summary. "
        "Determine if it is a major market-moving catalyst (High impact) for the stock. "
        "If it is NOT a catalyst, return exactly: {\"isCatalyst\": false}. "
        "If it IS a catalyst, return exactly a JSON object in this format: "
        "{\"isCatalyst\": true, \"keyword\": \"<1-3 word catalyst reason>\", \"impact\": \"High\", \"prediction\": \"<1 sentence Bull/Bear thesis prediction on stock price momentum>\"}. "
        f"Headline: {headline} | Summary: {summary}"
    )
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            text_resp = data['candidates'][0]['content']['parts'][0]['text']
            
            # Clean up markdown JSON blocks if present
            clean_text = text_resp.replace('```json', '').replace('```', '').strip()
            
            result = json.loads(clean_text)
            return result
    except Exception as e:
        print(f"Gemini API Error: {e}")
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
                
                analysis = analyze_catalyst_with_gemini(headline, summary, config.get("gemini_api_key"))
                
                if analysis and analysis.get('isCatalyst'):
                    keyword = analysis.get('keyword', 'UNKNOWN')
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
