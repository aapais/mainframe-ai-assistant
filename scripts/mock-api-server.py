#!/usr/bin/env python3
"""
Mock API Server for Next.js Application
Serves the same endpoints as the original Express server with mock data
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.parse
from datetime import datetime

# Mock data
MOCK_INCIDENTS = [
    {
        "id": 1,
        "title": "COBOL Compilation Error - Missing LINKAGE",
        "description": "Programa COBOL PAYCALC01 falha na compilação com erro 'LINKAGE SECTION item not found'. Afeta o processamento de folha de pagamento.",
        "category": "COBOL",
        "severity": "high",
        "priority": "P1",
        "status": "aberto",
        "reporter": "ricardo.mendes@accenture.com",
        "created_at": "2025-01-20T10:30:00Z",
        "updated_at": "2025-01-20T10:30:00Z",
        "type": "incident"
    },
    {
        "id": 2,
        "title": "JCL Step ABEND S0C4",
        "description": "Job JOB001 termina com ABEND S0C4 no step STEP02. Verificar overflow de array.",
        "category": "JCL",
        "severity": "critical",
        "priority": "P1",
        "status": "em_tratamento",
        "reporter": "ana.silva@accenture.com",
        "created_at": "2025-01-20T09:15:00Z",
        "updated_at": "2025-01-20T11:45:00Z",
        "type": "incident"
    },
    {
        "id": 3,
        "title": "VSAM File Access Error",
        "description": "Erro ao acessar dataset VSAM PROD.CUSTOMER.DATA com retorno 92.",
        "category": "VSAM",
        "severity": "medium",
        "priority": "P2",
        "status": "resolvido",
        "reporter": "carlos.costa@accenture.com",
        "solution": "Reorganizar o dataset VSAM e aplicar nova alocação de espaço.",
        "created_at": "2025-01-19T14:20:00Z",
        "updated_at": "2025-01-20T08:30:00Z",
        "type": "knowledge",
        "success_rate": 95
    },
    {
        "id": 4,
        "title": "DB2 Deadlock Detection",
        "description": "Múltiplas transações causando deadlocks na tabela CUSTOMER.",
        "category": "DB2",
        "severity": "high",
        "priority": "P1",
        "status": "resolvido",
        "reporter": "maria.santos@accenture.com",
        "solution": "Implementar timeout de transação e otimizar queries com FETCH FIRST.",
        "created_at": "2025-01-19T16:45:00Z",
        "updated_at": "2025-01-20T12:15:00Z",
        "type": "knowledge",
        "success_rate": 87
    },
    {
        "id": 5,
        "title": "CICS Transaction Timeout",
        "description": "Transação TRAN001 excede timeout padrão durante processamento batch.",
        "category": "CICS",
        "severity": "medium",
        "priority": "P3",
        "status": "aberto",
        "reporter": "joao.ferreira@accenture.com",
        "created_at": "2025-01-20T13:10:00Z",
        "updated_at": "2025-01-20T13:10:00Z",
        "type": "incident"
    }
]

class MockAPIHandler(BaseHTTPRequestHandler):
    def _set_headers(self, content_type='application/json'):
        self.send_response(200)
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
            response = {
                "success": True,
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "database": "connected (mock)",
                "architecture": "Python Mock API"
            }
            self.wfile.write(json.dumps(response, indent=2).encode())

        elif path == '/api/incidents':
            self._set_headers()
            self.wfile.write(json.dumps(MOCK_INCIDENTS, indent=2).encode())

        elif path == '/api/incidents/search':
            self._set_headers()
            q = query.get('q', [''])[0]
            if not q:
                response = {"success": False, "error": "Search query parameter 'q' is required"}
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                return

            # Filter incidents based on search query
            filtered = [
                incident for incident in MOCK_INCIDENTS
                if q.lower() in incident['title'].lower() or q.lower() in incident['description'].lower()
            ]

            response = {
                "success": True,
                "data": filtered,
                "count": len(filtered),
                "query": q
            }
            self.wfile.write(json.dumps(response, indent=2).encode())

        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            response = {"error": "Endpoint not found"}
            self.wfile.write(json.dumps(response).encode())

    def do_POST(self):
        if self.path == '/api/incidents':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))

            # Create new incident
            new_incident = {
                "id": max([i['id'] for i in MOCK_INCIDENTS]) + 1,
                "title": data.get('title'),
                "description": data.get('description'),
                "category": data.get('category'),
                "severity": data.get('severity'),
                "priority": data.get('priority', 'P3'),
                "status": "aberto",
                "reporter": data.get('reporter'),
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "type": "incident"
            }

            MOCK_INCIDENTS.append(new_incident)

            self._set_headers()
            response = {"success": True, "data": new_incident}
            self.wfile.write(json.dumps(response, indent=2).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format % args}")

def run_server(port=3001):
    server_address = ('', port)
    httpd = HTTPServer(server_address, MockAPIHandler)
    print(f"🚀 Mock API Server running on http://localhost:{port}")
    print(f"📊 Available endpoints:")
    print(f"   GET  /api/health")
    print(f"   GET  /api/incidents")
    print(f"   GET  /api/incidents/search?q=<query>")
    print(f"   POST /api/incidents")
    print(f"💾 Serving {len(MOCK_INCIDENTS)} mock incidents")
    print("Press Ctrl+C to stop")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")
        httpd.server_close()

if __name__ == '__main__':
    run_server()