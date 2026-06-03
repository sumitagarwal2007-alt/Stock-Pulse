import os
import json
import sqlite3
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8080
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'backend', 'config.json')
DB_PATH = os.path.join(BASE_DIR, 'backend', 'market_data.db')

class APIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        if self.path == '/api/settings':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            try:
                with open(CONFIG_PATH, 'r') as f:
                    config = json.load(f)
                    # Don't send the full raw API keys for security, or maybe send them since it's local
                    self.wfile.write(json.dumps(config).encode())
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
            
        if self.path == '/api/rankings':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT ticker, timestamp FROM alerts WHERE timestamp >= datetime('now', '-1 day')")
                rows = cursor.fetchall()
                conn.close()
                
                rankings = {}
                for ticker, timestamp in rows:
                    if ticker not in rankings:
                        rankings[ticker] = []
                    rankings[ticker].append(timestamp)
                    
                self.wfile.write(json.dumps(rankings).encode())
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
            
        if self.path == '/api/alerts':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            try:
                conn = sqlite3.connect(DB_PATH)
                cursor = conn.cursor()
                cursor.execute("SELECT id, ticker, timestamp, date, headline, url, keyword, impact, prediction, alert_price, sentiment, conviction, price_target, horizon FROM alerts ORDER BY timestamp DESC LIMIT 100")
                rows = cursor.fetchall()
                conn.close()
                
                alerts = []
                for row in rows:
                    alerts.append({
                        "id": row[0],
                        "ticker": row[1],
                        "timestamp": row[2],
                        "date": row[3],
                        "headline": row[4],
                        "url": row[5],
                        "keyword": row[6],
                        "impact": row[7],
                        "prediction": row[8],
                        "alert_price": row[9],
                        "sentiment": row[10],
                        "conviction": row[11],
                        "price_target": row[12],
                        "horizon": row[13]
                    })
                self.wfile.write(json.dumps(alerts).encode())
            except Exception as e:
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
        
        super().do_GET()

    def do_POST(self):
        if self.path == '/api/settings':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                new_settings = json.loads(post_data.decode('utf-8'))
                
                # Load existing config
                if os.path.exists(CONFIG_PATH):
                    with open(CONFIG_PATH, 'r') as f:
                        config = json.load(f)
                else:
                    config = {}
                
                # Update config
                for k, v in new_settings.items():
                    config[k] = v
                
                # Save config
                with open(CONFIG_PATH, 'w') as f:
                    json.dump(config, f, indent=2)
                    
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "config": config}).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return
            
        self.send_response(404)
        self.end_headers()

if __name__ == '__main__':
    print("==============================================")
    print(f"🚀 MarketOracle Server running at http://localhost:{PORT}")
    print("==============================================")
    server = HTTPServer(('', PORT), APIHandler)
    server.serve_forever()
