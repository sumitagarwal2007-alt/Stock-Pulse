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
        alert_price REAL
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
