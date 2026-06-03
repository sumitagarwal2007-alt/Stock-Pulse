import os
import json
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import subprocess
import sqlite3
from datetime import datetime, timedelta, timezone

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, 'config.json')
DB_PATH = os.path.join(BASE_DIR, 'market_data.db')

def send_notification(title, text, ntfy_topic=None):
    # Mac local notification
    try:
        text_safe = text.replace('"', '\\"')
        title_safe = title.replace('"', '\\"')
        subprocess.run(['osascript', '-e', f'display notification "{text_safe}" with title "{title_safe}"'])
    except Exception:
        pass
        
    # NTFY Push notification (iOS)
    if ntfy_topic:
        try:
            req = urllib.request.Request(
                f"https://ntfy.sh/{urllib.parse.quote(ntfy_topic)}",
                data=text.encode('utf-8'),
                headers={
                    "Title": title.encode('utf-8'),
                    "Tags": "chart_with_upwards_trend,rotating_light"
                },
                method="POST"
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            print(f"Failed to send ntfy push: {e}")

def analyze_catalyst_with_gemini(headline, summary, gemini_key):
    """Scan text for catalytic events using Google Gemini 2.5 Flash"""
    if not gemini_key:
        return []
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    
    prompt = (
        "You are a quantitative AI analyst. Read the following news headline and summary. "
        "Identify ALL publicly traded companies mentioned or implicitly affected. "
        "Identify ANY market-moving event, sentiment shift, or momentum driver (it does not need to be a massive catalyst, even minor news is okay). "
        "Return EXACTLY a JSON array of objects. Do not include markdown formatting. "
        "If no companies are affected, return []. "
        "Format for each object: "
        "{\"ticker\": \"<TICKER>\", \"isCatalyst\": true, \"keyword\": \"<1-3 word reason>\", \"impact\": \"<High/Medium/Low>\", \"prediction\": \"<1 sentence Bull/Bear thesis prediction on stock price momentum>\"} "
        f"Headline: {headline} | Summary: {summary}"
    )
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
    import time
    try_count = 0
    while try_count < 3:
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
            with urllib.request.urlopen(req) as response:
                if response.getcode() == 200:
                    text_resp = response.read().decode()
                    data = json.loads(text_resp)
                    text_resp = data['candidates'][0]['content']['parts'][0]['text']
                    
                    clean_text = text_resp.replace('```json', '').replace('```', '').strip()
                    
                    if clean_text.startswith('{') and clean_text.endswith('}') and '},' in clean_text:
                        clean_text = f"[{clean_text}]"
                        
                    try:
                        result = json.loads(clean_text)
                    except Exception as parse_err:
                        return []
    
                    if isinstance(result, list):
                        return result
                    elif isinstance(result, dict) and result.get("isCatalyst"):
                        return [result]
                    else:
                        return []
                else:
                    return []
        except urllib.error.HTTPError as e:
            if e.code == 429:
                try_count += 1
                time.sleep(30) # Wait 30 seconds before retrying
            else:
                return []
        except Exception as e:
            return []
            
    return "RATE_LIMIT"

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

    if not config.get("gemini_api_key") or config["gemini_api_key"] == "YOUR_GEMINI_KEY":
        print("❌ Missing Gemini API Key in backend/config.json")
        return

    # 2. Read previous state from SQLite
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Make sure scanned_urls exists just in case
        cursor.execute('''CREATE TABLE IF NOT EXISTS scanned_urls (url TEXT PRIMARY KEY, timestamp TEXT NOT NULL)''')
        
        cursor.execute("SELECT url FROM scanned_urls")
        processed_urls = {row[0] for row in cursor.fetchall()}
    except Exception as e:
        print(f"Error reading from SQLite: {e}")
        processed_urls = set()
        
    new_alerts_found = False
    watchlist_updated = False

    # 3. Google News RSS Autonomous Search
    queries = [
        "tech stock momentum",
        "stock President OR partnership",
        "CEO endorsement OR acquisition rumor",
        "stock price target upgrade",
        "earnings beat stock surge",
        "new product launch tech stock"
    ]
    
    recent_news = []
    for query in queries:
        encoded_query = urllib.parse.quote_plus(query)
        url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                xml_data = response.read()
                root = ET.fromstring(xml_data)
                for item in root.findall('.//item')[:10]:
                    title = item.find('title').text
                    link = item.find('link').text
                    if link not in processed_urls:
                        recent_news.append({
                            "headline": title,
                            "summary": "",
                            "url": link
                        })
        except Exception as e:
            print(f"Error fetching Google News: {e}")

    for article in recent_news:
        article_url = article.get('url', '')
        headline = article.get('headline', '')
        summary = article.get('summary', '')
        
        analysis_results = analyze_catalyst_with_gemini(headline, summary, config.get("gemini_api_key"))
        
        if analysis_results == "RATE_LIMIT":
            print("⏳ Rate Limit Hit severely! Skipping remaining articles for this cycle...")
            break
            
        if not analysis_results:
            processed_urls.add(article_url)
            try:
                cursor.execute("INSERT OR IGNORE INTO scanned_urls (url, timestamp) VALUES (?, ?)", (article_url, datetime.utcnow().isoformat() + "Z"))
                conn.commit()
            except:
                pass
            time.sleep(1) # Tiny sleep just to be safe
            continue

        for analysis in analysis_results:
            if analysis and analysis.get('isCatalyst') and analysis.get('ticker'):
                ticker = analysis['ticker'].upper()
                keyword = analysis.get('keyword', 'UNKNOWN')
                print(f"🚨 AUTONOMOUS CATALYST FOUND FOR {ticker}: {keyword}", flush=True)
                
                # Auto-Track Watchlist Injection
                if ticker not in config.get('watchlist', []):
                    config.setdefault('watchlist', []).append(ticker)
                    watchlist_updated = True
                    print(f"➕ Auto-tracking new ticker: {ticker}")
                # 4. Fetch Exact Live Quote to record Alert Price
                alert_price = 0.0
                if config.get("finnhub_api_key"):
                    try:
                        quote_url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={config['finnhub_api_key']}"
                        q_req = urllib.request.Request(quote_url, headers={'User-Agent': 'Mozilla/5.0'})
                        with urllib.request.urlopen(q_req) as q_resp:
                            q_data = json.loads(q_resp.read().decode())
                            alert_price = q_data.get('c', 0.0)
                    except Exception as q_err:
                        pass
                        
                # Insert into SQLite Alerts Table
                alert_id = str(int(time.time() * 1000))
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO alerts 
                    (id, ticker, timestamp, date, headline, url, keyword, impact, prediction, alert_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        alert_id,
                        ticker,
                        datetime.utcnow().isoformat() + "Z",
                        datetime.now().strftime('%Y-%m-%d'),
                        headline,
                        article_url,
                        keyword,
                        analysis.get('impact', 'High'),
                        analysis.get('prediction', ''),
                        alert_price
                    ))
                    
                    # Execute Mock Trade (Budget: $1000 per trade)
                    if alert_price and alert_price > 0:
                        shares = 1000.0 / alert_price
                        cursor.execute('''
                        INSERT INTO paper_trades 
                        (trade_id, ticker, action, price, shares, timestamp, status, alert_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            "TRD_" + alert_id,
                            ticker,
                            "BUY",
                            alert_price,
                            shares,
                            datetime.utcnow().isoformat() + "Z",
                            "OPEN",
                            alert_id
                        ))
                        
                    conn.commit()
                    new_alerts_found = True
                except Exception as e:
                    print(f"Failed to insert alert into DB: {e}")
                
                send_notification(ticker, f"MOCK BUY Executed: $1000 at ${alert_price} | {analysis.get('prediction', '')}\n\n{headline}", config.get("ntfy_topic"))
                
        processed_urls.add(article_url)
        try:
            cursor.execute("INSERT OR IGNORE INTO scanned_urls (url, timestamp) VALUES (?, ?)", (article_url, datetime.utcnow().isoformat() + "Z"))
            conn.commit()
        except:
            pass
            
        # Protect Gemini Free Tier Rate Limits (15 RPM -> 1 request every 4 seconds)
        time.sleep(5)
        
    if watchlist_updated:
        try:
            with open(CONFIG_PATH, 'w') as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            print(f"Error updating config: {e}")
            
    try:
        conn.close()
    except:
        pass

    if new_alerts_found:
        print("✅ Saved new alerts to market_data.db", flush=True)
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
