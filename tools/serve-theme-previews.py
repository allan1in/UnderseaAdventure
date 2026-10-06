from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

root=Path(__file__).resolve().parents[2]/'主题素材/海底冒险'
ThreadingHTTPServer(('127.0.0.1',8789),partial(QuietHandler,directory=str(root))).serve_forever()
