#!/usr/bin/env python3
"""
Simple Frontend Server for Accenture Mainframe AI Assistant
Serves the integrated HTML application with proper CORS headers
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
from pathlib import Path

class FrontendHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent.parent), **kwargs)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_GET(self):
        # Serve the main HTML file for root request
        if self.path == '/':
            self.path = '/Accenture-Mainframe-AI-Assistant-Integrated.html'
        return super().do_GET()

def run_frontend_server():
    PORT = 8080
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, FrontendHandler)

    print("🚀 ===============================================")
    print("🚀 FRONTEND SERVER RUNNING")
    print("🚀 ===============================================")
    print(f"🚀 Port: {PORT}")
    print(f"🚀 Access: http://localhost:{PORT}")
    print(f"🚀 Backend: http://localhost:3001")
    print("🚀 ===============================================")
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n⏹️ Frontend server stopped")

if __name__ == '__main__':
    run_frontend_server()