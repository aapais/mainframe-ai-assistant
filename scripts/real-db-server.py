#!/usr/bin/env python3
"""
Production-ready API Server with Real SQLite Database
Compatible with any environment (WSL, Linux, Windows)
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sqlite3
import urllib.parse
from datetime import datetime
from contextlib import closing

# Database configuration
DB_PATH = 'kb-assistant.db'

class RealAPIHandler(BaseHTTPRequestHandler):
    def get_db_connection(self):
        """Create database connection with proper settings"""
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row  # Enable column access by name
        return conn

    def _set_headers(self, content_type='application/json', status=200):
        self.send_response(status)
        self.send_header('Content-type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        query = urllib.parse.parse_qs(parsed_path.query)

        if path == '/api/health':
            self._set_headers()
            # Test database connection
            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT COUNT(*) as count FROM entries")
                    count = cursor.fetchone()['count']

                response = {
                    "success": True,
                    "status": "healthy",
                    "timestamp": datetime.now().isoformat(),
                    "database": "connected",
                    "entries": count,
                    "architecture": "Python SQLite Real Database"
                }
            except Exception as e:
                response = {
                    "success": False,
                    "status": "error",
                    "error": str(e)
                }

            self.wfile.write(json.dumps(response, indent=2).encode())

        elif path == '/api/incidents' or path == '/api/entries':
            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT * FROM entries
                        ORDER BY created_at DESC
                        LIMIT 100
                    """)

                    rows = cursor.fetchall()
                    incidents = []
                    for row in rows:
                        incident = dict(row)
                        # Convert datetime if needed
                        for key in ['created_at', 'updated_at']:
                            if incident.get(key):
                                try:
                                    # Try to parse and format datetime
                                    dt = datetime.fromisoformat(incident[key].replace('Z', '+00:00'))
                                    incident[key] = dt.isoformat()
                                except:
                                    pass  # Keep original if parsing fails
                        incidents.append(incident)

                self._set_headers()
                self.wfile.write(json.dumps(incidents, indent=2).encode())

            except Exception as e:
                self._set_headers(status=500)
                response = {"error": f"Database error: {str(e)}"}
                self.wfile.write(json.dumps(response).encode())

        elif path == '/api/incidents/search':
            q = query.get('q', [''])[0]
            if not q:
                self._set_headers(status=400)
                response = {"success": False, "error": "Search query parameter 'q' is required"}
                self.wfile.write(json.dumps(response).encode())
                return

            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()
                    search_term = f'%{q}%'
                    cursor.execute("""
                        SELECT * FROM entries
                        WHERE title LIKE ? OR description LIKE ?
                           OR category LIKE ? OR solution LIKE ?
                        ORDER BY created_at DESC
                        LIMIT 100
                    """, (search_term, search_term, search_term, search_term))

                    rows = cursor.fetchall()
                    results = [dict(row) for row in rows]

                response = {
                    "success": True,
                    "data": results,
                    "count": len(results),
                    "query": q
                }
                self._set_headers()
                self.wfile.write(json.dumps(response, indent=2).encode())

            except Exception as e:
                self._set_headers(status=500)
                response = {"error": f"Search error: {str(e)}"}
                self.wfile.write(json.dumps(response).encode())

        elif path.startswith('/api/incidents/') and len(path.split('/')) == 4:
            # Get single incident by ID
            incident_id = path.split('/')[-1]
            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT * FROM entries WHERE id = ?", (incident_id,))
                    row = cursor.fetchone()

                    if row:
                        incident = dict(row)
                        self._set_headers()
                        response = {"success": True, "data": incident}
                    else:
                        self._set_headers(status=404)
                        response = {"success": False, "error": "Incident not found"}

                    self.wfile.write(json.dumps(response, indent=2).encode())

            except Exception as e:
                self._set_headers(status=500)
                response = {"error": f"Database error: {str(e)}"}
                self.wfile.write(json.dumps(response).encode())

        else:
            self._set_headers(status=404)
            response = {"error": "Endpoint not found"}
            self.wfile.write(json.dumps(response).encode())

    def do_POST(self):
        if self.path == '/api/incidents':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # Validate required fields
            required = ['title', 'description', 'category', 'severity', 'reporter']
            if not all(field in data for field in required):
                self._set_headers(status=400)
                response = {"error": f"Missing required fields: {required}"}
                self.wfile.write(json.dumps(response).encode())
                return

            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        INSERT INTO entries (
                            title, description, category, severity,
                            status, priority, reporter, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
                    """, (
                        data['title'],
                        data['description'],
                        data['category'],
                        data['severity'],
                        data.get('status', 'aberto'),
                        data.get('priority', 'P3'),
                        data['reporter']
                    ))
                    conn.commit()

                    new_id = cursor.lastrowid

                    # Fetch the created incident
                    cursor.execute("SELECT * FROM entries WHERE id = ?", (new_id,))
                    incident = dict(cursor.fetchone())

                self._set_headers(status=201)
                response = {"success": True, "data": incident}
                self.wfile.write(json.dumps(response, indent=2).encode())

            except Exception as e:
                self._set_headers(status=500)
                response = {"error": f"Create error: {str(e)}"}
                self.wfile.write(json.dumps(response).encode())
        else:
            self._set_headers(status=404)
            response = {"error": "Endpoint not found"}
            self.wfile.write(json.dumps(response).encode())

    def do_PUT(self):
        if self.path.startswith('/api/incidents/'):
            incident_id = self.path.split('/')[-1]
            content_length = int(self.headers['Content-Length'])
            put_data = self.rfile.read(content_length)
            data = json.loads(put_data.decode('utf-8'))

            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()

                    # Build UPDATE query dynamically based on provided fields
                    update_fields = []
                    values = []
                    for field in ['title', 'description', 'category', 'severity',
                                 'status', 'priority', 'assigned_to', 'solution']:
                        if field in data:
                            update_fields.append(f"{field} = ?")
                            values.append(data[field])

                    if update_fields:
                        update_fields.append("updated_at = datetime('now')")
                        values.append(incident_id)

                        query = f"UPDATE entries SET {', '.join(update_fields)} WHERE id = ?"
                        cursor.execute(query, values)
                        conn.commit()

                        # Fetch updated incident
                        cursor.execute("SELECT * FROM entries WHERE id = ?", (incident_id,))
                        incident = dict(cursor.fetchone()) if cursor.fetchone() else None

                        if incident:
                            self._set_headers()
                            response = {"success": True, "data": incident}
                        else:
                            self._set_headers(status=404)
                            response = {"success": False, "error": "Incident not found"}
                    else:
                        self._set_headers(status=400)
                        response = {"error": "No fields to update"}

                    self.wfile.write(json.dumps(response).encode())

            except Exception as e:
                self._set_headers(status=500)
                response = {"error": f"Update error: {str(e)}"}
                self.wfile.write(json.dumps(response).encode())
        else:
            self._set_headers(status=404)

    def do_DELETE(self):
        if self.path.startswith('/api/incidents/'):
            incident_id = self.path.split('/')[-1]

            try:
                with closing(self.get_db_connection()) as conn:
                    cursor = conn.cursor()
                    cursor.execute("DELETE FROM entries WHERE id = ?", (incident_id,))
                    conn.commit()

                    if cursor.rowcount > 0:
                        self._set_headers()
                        response = {"success": True, "message": "Incident deleted successfully"}
                    else:
                        self._set_headers(status=404)
                        response = {"success": False, "error": "Incident not found"}

                    self.wfile.write(json.dumps(response).encode())

            except Exception as e:
                self._set_headers(status=500)
                response = {"error": f"Delete error: {str(e)}"}
                self.wfile.write(json.dumps(response).encode())
        else:
            self._set_headers(status=404)

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def run_server(port=8089):
    # Test database connection
    try:
        with closing(sqlite3.connect(DB_PATH)) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM entries")
            count = cursor.fetchone()[0]
            print(f"✅ Database connected: {DB_PATH}")
            print(f"📊 Total entries: {count}")
    except Exception as e:
        print(f"❌ Database error: {e}")
        print("Creating database tables...")
        # You might want to create tables here if needed

    server_address = ('', port)
    httpd = HTTPServer(server_address, RealAPIHandler)
    print(f"🚀 Real Database API Server running on http://localhost:{port}")
    print(f"📊 Available endpoints:")
    print(f"   GET  /api/health")
    print(f"   GET  /api/incidents")
    print(f"   GET  /api/incidents/:id")
    print(f"   GET  /api/incidents/search?q=<query>")
    print(f"   POST /api/incidents")
    print(f"   PUT  /api/incidents/:id")
    print(f"   DELETE /api/incidents/:id")
    print("Press Ctrl+C to stop")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.server_close()

if __name__ == '__main__':
    run_server()