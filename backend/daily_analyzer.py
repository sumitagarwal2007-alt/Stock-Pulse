import os
import json
import sqlite3
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta
import subprocess

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, 'config.json')
DB_PATH = os.path.join(BASE_DIR, 'market_data.db')

def send_notification(title, text, ntfy_topic=None):
    try:
        text_safe = text.replace('"', '\\"')
        title_safe = title.replace('"', '\\"')
        subprocess.run(['osascript', '-e', f'display notification "{text_safe}" with title "{title_safe}"'])
    except Exception:
        pass
        
    if ntfy_topic:
        try:
            req = urllib.request.Request(
                f"https://ntfy.sh/{urllib.parse.quote(ntfy_topic)}",
                data=text.encode('utf-8'),
                headers={
                    "Title": title.encode('utf-8'),
                    "Tags": "moneybag,chart_with_upwards_trend"
                },
                method="POST"
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            print(f"Failed to send ntfy push: {e}")

def get_current_price(ticker, finnhub_key):
    if not finnhub_key:
        return 0.0
    try:
        url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={finnhub_key}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get('c', 0.0)
    except Exception as e:
        print(f"Error fetching price for {ticker}: {e}")
        return 0.0

def summarize_with_gemini(portfolio_summary, gemini_key):
    if not gemini_key:
        return "Daily Analysis Complete. Total P&L computed."
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    
    prompt = (
        "You are the Chief Investment Officer of an AI Hedge Fund. "
        "Review the following daily mock trading performance data. "
        "Write a 2-paragraph executive summary to send directly to the user's phone. "
        "Keep it punchy, professional, and highlight the biggest winners or losers. "
        f"Data: {json.dumps(portfolio_summary)}"
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
                    data = json.loads(response.read().decode())
                    return data['candidates'][0]['content']['parts'][0]['text'].strip()
        except urllib.error.HTTPError as e:
            if e.code == 429:
                print("⏳ Gemini Rate Limit Hit during analysis. Waiting 30s...")
                import time
                time.sleep(30)
                try_count += 1
            else:
                print(f"Gemini API Error: {e}")
                break
        except Exception as e:
            print(f"Gemini API Error: {e}")
            break
            
    return "Daily Analysis Complete. Total P&L computed."

def run_daily_analysis():
    print("==============================================")
    print("📈 Running MarketOracle Daily Analysis")
    print("==============================================")
    
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
    except Exception as e:
        print("❌ Could not read config.json.")
        return
        
    finnhub_key = config.get("finnhub_api_key")
    gemini_key = config.get("gemini_api_key")
    ntfy_topic = config.get("ntfy_topic")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT trade_id, ticker, price, shares, timestamp FROM paper_trades WHERE status = 'OPEN'")
    open_trades = cursor.fetchall()
    
    portfolio_summary = {
        "total_closed_pnl": 0.0,
        "total_unrealized_pnl": 0.0,
        "closed_trades_today": [],
        "open_positions": []
    }
    
    now = datetime.utcnow().replace(tzinfo=timezone.utc)
    
    # Process Open Trades
    for trade in open_trades:
        trade_id, ticker, entry_price, shares, timestamp_str = trade
        
        # Parse timestamp safely
        try:
            if timestamp_str.endswith("Z"):
                timestamp_str = timestamp_str[:-1]
            trade_time = datetime.fromisoformat(timestamp_str).replace(tzinfo=timezone.utc)
        except:
            trade_time = now
            
        days_held = (now - trade_time).days
        current_price = get_current_price(ticker, finnhub_key)
        
        if current_price == 0.0:
            continue
            
        unrealized_pnl = (current_price - entry_price) * shares
        percent_change = ((current_price - entry_price) / entry_price) * 100
        
        # Trading Rules: Take Profit 10%, Stop Loss -5%, or Hold > 7 Days
        should_sell = False
        reason = ""
        
        if percent_change >= 10.0:
            should_sell = True
            reason = "Take Profit Hit (+10%)"
        elif percent_change <= -5.0:
            should_sell = True
            reason = "Stop Loss Hit (-5%)"
        elif days_held >= 7:
            should_sell = True
            reason = "Max Hold Time Reached (7 Days)"
            
        if should_sell:
            cursor.execute('''
            UPDATE paper_trades 
            SET status = 'CLOSED', close_price = ?, close_timestamp = ?, pnl = ?
            WHERE trade_id = ?
            ''', (current_price, now.isoformat() + "Z", unrealized_pnl, trade_id))
            
            portfolio_summary["closed_trades_today"].append({
                "ticker": ticker,
                "reason": reason,
                "pnl": round(unrealized_pnl, 2),
                "return_pct": round(percent_change, 2)
            })
            print(f"💰 SOLD {ticker} | {reason} | P&L: ${unrealized_pnl:.2f}")
        else:
            portfolio_summary["open_positions"].append({
                "ticker": ticker,
                "unrealized_pnl": round(unrealized_pnl, 2),
                "return_pct": round(percent_change, 2)
            })
            portfolio_summary["total_unrealized_pnl"] += unrealized_pnl
            
    conn.commit()
    
    # Get total historical realized PNL
    cursor.execute("SELECT sum(pnl) FROM paper_trades WHERE status = 'CLOSED'")
    row = cursor.fetchone()
    if row and row[0]:
        portfolio_summary["total_closed_pnl"] = round(row[0], 2)
        
    portfolio_summary["total_unrealized_pnl"] = round(portfolio_summary["total_unrealized_pnl"], 2)
    
    conn.close()
    
    # Generate AI Summary
    print("🤖 Generating AI Summary...")
    summary_text = summarize_with_gemini(portfolio_summary, gemini_key)
    
    # Send Notification
    title = f"Daily AI Portfolio Update"
    send_notification(title, summary_text, ntfy_topic)
    print("✅ Daily Analysis Complete and Notification Sent.")
    
if __name__ == "__main__":
    run_daily_analysis()
