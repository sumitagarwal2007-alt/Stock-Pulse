import sqlite3
import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'market_data.db')
ALERTS_PATH = os.path.join(BASE_DIR, 'alerts.json')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Create alerts table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        ticker TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        date TEXT,
        headline TEXT,
        url TEXT,
        keyword TEXT,
        impact TEXT,
        prediction TEXT,
        alert_price REAL,
        sentiment TEXT,
        conviction INTEGER,
        price_target TEXT,
        horizon TEXT,
        recommended_action TEXT
    )
    ''')
    
    # Safely run ALTER TABLE for existing databases
    new_columns = [
        ("sentiment", "TEXT"),
        ("conviction", "INTEGER"),
        ("price_target", "TEXT"),
        ("horizon", "TEXT"),
        ("recommended_action", "TEXT")
    ]
    
    for col_name, col_type in new_columns:
        try:
            cursor.execute(f"ALTER TABLE alerts ADD COLUMN {col_name} {col_type}")
        except sqlite3.OperationalError:
            pass # Column already exists
    
    # Create paper trades table for mock trading
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS paper_trades (
        trade_id TEXT PRIMARY KEY,
        ticker TEXT NOT NULL,
        action TEXT NOT NULL,
        price REAL NOT NULL,
        shares REAL NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        close_price REAL,
        close_timestamp TEXT,
        pnl REAL,
        alert_id TEXT
    )
    ''')
    
    # Create scanned_urls table to prevent re-scanning non-catalyst news
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS scanned_urls (
        url TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL
    )
    ''')
    
    # Create raw_news table for Agent 1 (Harvester) to dump articles into
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS raw_news (
        id TEXT PRIMARY KEY,
        ticker TEXT,
        headline TEXT NOT NULL,
        summary TEXT,
        url TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING'
    )
    ''')
    
    conn.commit()
    return conn

def migrate_old_alerts(conn):
    if not os.path.exists(ALERTS_PATH):
        return
        
    try:
        with open(ALERTS_PATH, 'r') as f:
            alerts = json.load(f)
    except Exception as e:
        print(f"Error reading alerts.json: {e}")
        return
        
    cursor = conn.cursor()
    inserted = 0
    for alert in alerts:
        try:
            cursor.execute('''
            INSERT OR IGNORE INTO alerts 
            (id, ticker, timestamp, date, headline, url, keyword, impact, prediction, alert_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                alert.get('id'),
                alert.get('ticker'),
                alert.get('timestamp'),
                alert.get('date'),
                alert.get('headline'),
                alert.get('url'),
                alert.get('keyword'),
                alert.get('impact'),
                alert.get('prediction'),
                alert.get('alert_price', 0.0)
            ))
            if cursor.rowcount > 0:
                inserted += 1
        except Exception as e:
            print(f"Failed to migrate alert {alert.get('id')}: {e}")
            
    conn.commit()
    print(f"Migrated {inserted} alerts to SQLite database.")

if __name__ == '__main__':
    print(f"Initializing database at {DB_PATH}")
    conn = init_db()
    migrate_old_alerts(conn)
    conn.close()
    print("Database initialization complete.")
