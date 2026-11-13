#!/usr/bin/env python3
"""Static preview server for the Chaereve site.

Unlike `python3 -m http.server`, this:
  • serves 404.html (with HTTP 404) for missing paths — no ugly default error page
  • never shows raw directory listings (serves index.html inside a folder instead)
Usage:  python3 tools/serve.py [port]
"""
import sys
import pathlib
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = pathlib.Path(__file__).resolve().parent.parent


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_error(self, code, message=None, explain=None):
        page = ROOT / "404.html"
        if code == 404 and page.exists():
            body = page.read_bytes()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def list_directory(self, path):
        idx = pathlib.Path(path) / "index.html"
        if idx.exists():
            orig = self.path
            self.path = self.path.rstrip("/") + "/index.html"
            try:
                return self.send_head()
            finally:
                self.path = orig
        self.send_error(404)
        return None


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Serving {ROOT} at http://0.0.0.0:{port}")
    server.serve_forever()
