import os
import json
from http.server import SimpleHTTPRequestHandler, HTTPServer

PORT = 8080
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(BASE_DIR, 'backend', 'config.json')

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
