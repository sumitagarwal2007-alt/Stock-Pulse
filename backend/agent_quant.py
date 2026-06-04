import os
import json
import time
import urllib.request
import urllib.parse
import sqlite3
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, 'config.json')
DB_PATH = os.path.join(BASE_DIR, 'market_data.db')

def analyze_catalyst_with_gemini(headline, summary, gemini_key):
    """Scan text for catalytic events using Google Gemini"""
    if not gemini_key:
        return []
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    
    prompt = (
        "You are a Senior Quantitative Analyst at a top AI Hedge Fund. Read the following news headline and summary. "
        "Identify ALL publicly traded companies mentioned or implicitly affected. "
        "Identify ANY market-moving event, sentiment shift, or momentum driver. "
        "CRITICAL TEMPORALITY RULE: You must determine if this is a 'BREAKING' catalyst (happening now) or a 'RETROSPECTIVE' summary (explaining why a stock already moved in the past). "
        "If the news is RETROSPECTIVE or OLD, you MUST set the recommended_action to 'HOLD', regardless of how bullish the text is, because the alpha has already decayed. "
        "Return EXACTLY a JSON array of objects. Do not include markdown formatting. "
        "If no companies are affected, return []. "
        "Format for each object: "
        "{\"ticker\": \"<TICKER>\", \"isCatalyst\": true, \"keyword\": \"<1-3 word reason>\", \"impact\": \"<High/Medium/Low>\", "
        "\"temporality\": \"<BREAKING or RETROSPECTIVE>\", "
        "\"prediction\": \"<1 sentence Bull/Bear thesis prediction>\", \"sentiment\": \"<Bullish/Bearish/Neutral>\", "
        "\"conviction\": <integer from 1 to 100 based on source reliability and historical weight>, "
        "\"price_target\": \"<e.g. +5% to +10%>\", \"horizon\": \"<1-7 Days / 1-3 Months / 1 Year+>\", "
        "\"recommended_action\": \"<BUY/SELL/HOLD>\"} "
        f"Headline: {headline} | Summary: {summary}"
    )
    
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    
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
                    except Exception:
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
        except Exception:
            return []
            
    return "RATE_LIMIT"

def fetch_live_price(ticker, finnhub_key):
    try:
        quote_url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={finnhub_key}"
        q_req = urllib.request.Request(quote_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(q_req) as q_resp:
            q_data = json.loads(q_resp.read().decode())
        return q_data.get('c', 0.0)
    except:
        return 0.0

def check_recent_momentum(ticker, finnhub_key, days=5):
    """
    Check if a stock has already surged or crashed heavily over the last N days.
    Returns the percentage change (e.g. 12.5 for 12.5%).
    Returns 0.0 if data cannot be fetched.
    """
    if not finnhub_key:
        return 0.0
        
    try:
        to_time = int(time.time())
        from_time = to_time - (days * 24 * 60 * 60)
        
        url = f"https://finnhub.io/api/v1/stock/candle?symbol={ticker}&resolution=D&from={from_time}&to={to_time}&token={finnhub_key}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            if response.getcode() == 200:
                data = json.loads(response.read().decode())
                if data.get('s') == 'ok' and data.get('c'):
                    closes = data['c']
                    if len(closes) >= 2:
                        oldest_close = closes[0]
                        newest_close = closes[-1]
                        if oldest_close > 0:
                            pct_change = ((newest_close - oldest_close) / oldest_close) * 100.0
                            return pct_change
    except Exception as e:
        pass
        
    return 0.0

def run_quant():
    current_time = datetime.now().strftime("%I:%M:%S %p")
    print(f"\n[{current_time}] 🧠 Agent 2 (Quant) checking for unanalyzed news...", flush=True)
    
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
    except Exception:
        print("❌ Could not read config.json. Please ensure it exists.")
        return

    gemini_key = config.get("gemini_api_key")
    if not gemini_key or gemini_key == "YOUR_GEMINI_KEY":
        print("❌ Missing Gemini API Key")
        return

    finnhub_key = config.get("finnhub_api_key")

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Grab up to 10 pending articles
        cursor.execute("SELECT id, headline, summary, url FROM raw_news WHERE status = 'PENDING' LIMIT 10")
        pending_news = cursor.fetchall()
    except Exception as e:
        print(f"Error reading from SQLite: {e}")
        return
        
    if not pending_news:
        print("💤 No pending news for the Quant to analyze.", flush=True)
        return
        
    print(f"📊 Quant found {len(pending_news)} articles to analyze. Engaging Gemini...", flush=True)
    
    for row in pending_news:
        article_id, headline, summary, article_url = row
        
        analysis_results = analyze_catalyst_with_gemini(headline, summary, gemini_key)
        
        if analysis_results == "RATE_LIMIT":
            print("⏳ Rate Limit Hit! Quant is going to sleep to preserve API quota.", flush=True)
            break # Exit the loop, will try again next cycle
            
        # Update status to ANALYZED so we don't do it again
        cursor.execute("UPDATE raw_news SET status = 'ANALYZED' WHERE id = ?", (article_id,))
        conn.commit()

        if not analysis_results:
            time.sleep(4) # Protect API
            continue

        for analysis in analysis_results:
            if analysis and analysis.get('isCatalyst') and analysis.get('ticker'):
                ticker = analysis['ticker'].upper()
                keyword = analysis.get('keyword', 'UNKNOWN')
                action = analysis.get('recommended_action', 'HOLD').upper()
                temporality = analysis.get('temporality', 'UNKNOWN').upper()
                
                # ---- MOMENTUM RISK FILTER ----
                momentum = check_recent_momentum(ticker, finnhub_key, days=5)
                if action == 'BUY' and momentum > 10.0:
                    print(f"🛑 TRADE REJECTED: {ticker} already surged +{momentum:.1f}% in the last 5 days. Catalyst is priced in.", flush=True)
                    continue
                elif action == 'SELL' and momentum < -10.0:
                    print(f"🛑 TRADE REJECTED: {ticker} already crashed {momentum:.1f}% in the last 5 days. Catalyst is priced in.", flush=True)
                    continue
                # ------------------------------

                if temporality == 'RETROSPECTIVE':
                    print(f"🛑 TRADE REJECTED (SEMANTIC): AI flagged news for {ticker} as a RETROSPECTIVE recap.", flush=True)
                else:
                    print(f"🚨 QUANT RECOMMENDS {action} ON {ticker} ({temporality}): {keyword}", flush=True)
                
                # Auto-Track Watchlist Injection
                if ticker not in config.get('watchlist', []):
                    config.setdefault('watchlist', []).append(ticker)
                    try:
                        with open(CONFIG_PATH, 'w') as f:
                            json.dump(config, f, indent=2)
                        print(f"➕ Auto-tracking new ticker: {ticker}")
                    except:
                        pass

                # Insert into Alerts Table for the Executioner
                alert_id = str(int(time.time() * 1000))
                try:
                    cursor.execute('''
                    INSERT OR IGNORE INTO alerts 
                    (id, ticker, timestamp, date, headline, url, keyword, impact, prediction, alert_price, sentiment, conviction, price_target, horizon, recommended_action)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                        fetch_live_price(ticker, finnhub_key), # Time Zero Price Capture
                        analysis.get('sentiment', 'Neutral'),
                        int(analysis.get('conviction', 50)),
                        analysis.get('price_target', 'Unknown'),
                        analysis.get('horizon', 'Unknown'),
                        action
                    ))
                    conn.commit()
                except Exception as e:
                    print(f"Failed to insert alert into DB: {e}")
                    
        # Protect Gemini Free Tier Rate Limits
        time.sleep(4)
        
    conn.close()

if __name__ == "__main__":
    print("==============================================")
    print("🧠 Agent 2: The Quant Started")
    print("==============================================", flush=True)
    
    # Quant checks slightly faster than Harvester to clear the backlog
    try:
        with open(CONFIG_PATH, 'r') as f:
            cfg = json.load(f)
            interval_minutes = cfg.get("check_interval_minutes", 15)
    except:
        interval_minutes = 15
        
    run_quant()
    
    while True:
        # Quant wakes up frequently to clear queues
        time.sleep(60) 
        run_quant()
