import os
import json
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import sqlite3
import uuid
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, 'config.json')
DB_PATH = os.path.join(BASE_DIR, 'market_data.db')

def run_harvester():
    current_time = datetime.now().strftime("%I:%M:%S %p")
    print(f"\n[{current_time}] 👁️ Agent 1 (Harvester) scanning for raw news...", flush=True)
    
    # 1. Read processed urls
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''CREATE TABLE IF NOT EXISTS scanned_urls (url TEXT PRIMARY KEY, timestamp TEXT NOT NULL)''')
        cursor.execute("SELECT url FROM scanned_urls")
        processed_urls = {row[0] for row in cursor.fetchall()}
    except Exception as e:
        print(f"Error reading from SQLite: {e}")
        processed_urls = set()
        
    new_articles_found = 0

    # 2. Google News RSS Autonomous Search
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
                        processed_urls.add(link)
        except Exception as e:
            print(f"Error fetching Google News: {e}")

    # 3. Save to raw_news table
    for article in recent_news:
        article_url = article.get('url', '')
        headline = article.get('headline', '')
        summary = article.get('summary', '')
        
        try:
            article_id = str(uuid.uuid4())
            cursor.execute('''
            INSERT INTO raw_news (id, headline, summary, url, timestamp, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
            ''', (article_id, headline, summary, article_url, datetime.utcnow().isoformat() + "Z"))
            
            # Also log into scanned_urls so we don't fetch it again
            cursor.execute("INSERT OR IGNORE INTO scanned_urls (url, timestamp) VALUES (?, ?)", (article_url, datetime.utcnow().isoformat() + "Z"))
            conn.commit()
            new_articles_found += 1
        except Exception as e:
            pass
            
    try:
        conn.close()
    except:
        pass

    if new_articles_found > 0:
        print(f"✅ Harvester dumped {new_articles_found} new articles into the database for the Quant Agent.", flush=True)
    else:
        print("💤 No new news found.", flush=True)

if __name__ == "__main__":
    print("==============================================")
    print("👁️ Agent 1: The Harvester Started")
    print("==============================================", flush=True)
    
    # Read config for interval
    try:
        with open(CONFIG_PATH, 'r') as f:
            cfg = json.load(f)
            interval_minutes = cfg.get("check_interval_minutes", 15)
    except:
        interval_minutes = 15
        
    run_harvester()
    
    # Loop
    while True:
        time.sleep(interval_minutes * 60)
        run_harvester()
