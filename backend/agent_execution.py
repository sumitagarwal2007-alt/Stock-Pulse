import os
import json
import time
import urllib.request
import urllib.parse
import sqlite3
import subprocess
from datetime import datetime, time as datetime_time
try:
    import zoneinfo
except ImportError:
    from backports import zoneinfo

# Paths
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
                headers={"Title": title.encode('utf-8'), "Tags": "chart_with_upwards_trend,rotating_light"},
                method="POST"
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            pass

def fetch_live_price(ticker, finnhub_key):
    try:
        quote_url = f"https://finnhub.io/api/v1/quote?symbol={ticker}&token={finnhub_key}"
        q_req = urllib.request.Request(quote_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(q_req) as q_resp:
            q_data = json.loads(q_resp.read().decode())
        return q_data.get('c', 0.0)
    except:
        return 0.0

def is_market_open():
    """
    Check if current time is within US Market Hours:
    Monday-Friday, 9:30 AM - 4:00 PM Eastern Time.
    """
    try:
        eastern = zoneinfo.ZoneInfo("America/New_York")
    except Exception:
        # Fallback if timezone not found (unlikely in Python 3.9+)
        return True
        
    now = datetime.now(eastern)
    
    # 0 = Monday, 4 = Friday
    if now.weekday() > 4:
        return False
        
    market_open = datetime_time(9, 30)
    market_close = datetime_time(16, 0)
    
    current_time = now.time()
    
    return market_open <= current_time <= market_close

def run_executioner():
    current_time = datetime.now().strftime("%I:%M:%S %p")
    print(f"\n[{current_time}] ⚡ Agent 3 (Executioner) checking for pending actionable alerts...", flush=True)
    
    try:
        with open(CONFIG_PATH, 'r') as f:
            config = json.load(f)
    except Exception:
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Find all alerts that recommend BUY, have high conviction, and haven't been traded yet
        cursor.execute('''
        SELECT a.id, a.ticker, a.headline, a.prediction, a.conviction 
        FROM alerts a 
        LEFT JOIN paper_trades pt ON a.id = pt.alert_id 
        WHERE a.recommended_action = 'BUY' 
        AND a.conviction >= 70 
        AND pt.trade_id IS NULL
        ''')
        actionable_alerts = cursor.fetchall()
    except Exception as e:
        print(f"Error reading DB: {e}")
        return
        
    if not actionable_alerts:
        print("💤 No executable actions found.", flush=True)
        return
        # Market Hours Constraint
        if not is_market_open():
            print(f"🛑 Market is closed. {len(actionable_alerts)} approved trades waiting in queue for market open.", flush=True)
            return

        for row in actionable_alerts:
            alert_id, ticker, headline, prediction, conviction = row
            
            # Fetch current cash balance
            cursor.execute("SELECT cash_balance FROM portfolio_state WHERE id = 1")
            cash_row = cursor.fetchone()
            cash_balance = cash_row[0] if cash_row else 0.0
            
            trade_allocation = min(5000.0, cash_balance)
            
            if trade_allocation <= 0:
                print(f"🛑 INSUFFICIENT FUNDS: Cannot execute BUY for {ticker}. Cash balance is $0.", flush=True)
                continue
                
            print(f"🔥 EXECUTIONER INITIATING BUY FOR {ticker} (Conviction: {conviction})", flush=True)
            
            live_price = fetch_live_price(ticker, config.get("finnhub_api_key"))
            
            if live_price and live_price > 0:
                shares = trade_allocation / live_price
                trade_id = "TRD_" + alert_id
                try:
                    cursor.execute('''
                    INSERT INTO paper_trades 
                    (trade_id, ticker, action, price, shares, timestamp, status, alert_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        trade_id, ticker, "BUY", live_price, shares, 
                        datetime.utcnow().isoformat() + "Z", "OPEN", alert_id
                    ))
                    
                    # Deduct from cash balance
                    new_balance = cash_balance - trade_allocation
                    cursor.execute("UPDATE portfolio_state SET cash_balance = ? WHERE id = 1", (new_balance,))
                    
                    # Update alert_price in alerts table now that we fetched it
                    cursor.execute("UPDATE alerts SET alert_price = ? WHERE id = ?", (live_price, alert_id))
                    
                    conn.commit()
                    print(f"✅ MOCK BUY EXECUTED: ${trade_allocation:.2f} USD of {ticker} @ {live_price}")
                send_notification(ticker, f"MOCK BUY Executed: ${trade_allocation:.2f} at ${live_price} | Conviction: {conviction}\n\n{headline}", config.get("ntfy_topic"))
            except Exception as e:
                print(f"Failed to record trade: {e}")
        else:
            print(f"⚠️ Could not fetch live price for {ticker}. Aborting execution.")
            
    conn.close()

if __name__ == "__main__":
    print("==============================================")
    print("⚡ Agent 3: The Executioner Started")
    print("==============================================", flush=True)
    
    run_executioner()
    
    while True:
        # Executioner wakes up very frequently to instantly execute trades
        time.sleep(15) 
        run_executioner()
