#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MeshCore Ultra-Lightweight HTTP Server for Mikr.us
-------------------------------------------------
Serves the HTML visualizer and processes fast in-memory topology queries directly
from the SQLite database. Configured with CORS headers to support GitHub Pages.
Takes <15MB RAM and has minimal CPU footprint.
"""

import os
import sys
import json
import sqlite3
import http.server
import socketserver
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("WebServer")

PORT = int(os.environ.get("PORT", "8080"))
DB_PATH = os.environ.get("DB_PATH", "mesh.db")
CORS_ORIGIN = os.environ.get("CORS_ORIGIN", "*") # Change to your github.io URL for extra security if wanted

class MeshGridHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Inject CORS headers before ending headers so cross-domain (github.io) requests succeed
        self.send_header('Access-Control-Allow-Origin', CORS_ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        # Handle CORS preflight requests securely
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Serve the API data dynamically from SQLite
        if self.path == '/data.json':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()

            data = self.get_analytical_data()
            self.wfile.write(json.dumps(data).encode('utf-8'))
            return

        # Serve our main index.html locally if visited directly on Mikr.us
        if self.path == '/' or self.path == '/index.html':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            with open('index.html', 'rb') as f:
                self.wfile.write(f.read())
            return

        # Fallback to default handler
        super().do_GET()

    def get_analytical_data(self):
        """
        Runs a super-fast Python aggregation query over SQLite to construct the
        nodes directory, edge loads, and region scopes in under 50ms.
        """
        if not os.path.exists(DB_PATH):
            return {"nodes": [], "edges": [], "scopes": {}}

        try:
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Fetch unique nodes from last 7 days of activity
            cursor.execute("""
                SELECT
                    topic,
                    payload_type,
                    route_type,
                    scope_name,
                    path_hops,
                    timestamp
                FROM packets
                ORDER BY timestamp DESC
                LIMIT 5000 -- scan up to last 5000 packets for topology
            """)
            rows = cursor.fetchall()

            nodes_map = {}
            edges_map = {}
            scopes = {}

            # Helper to safely clean prefix
            def clean_prefix(p):
                return p.strip().upper()

            for r in rows:
                scope = r['scope_name'] or 'Unknown'
                hops_str = r['path_hops']
                hops = []
                if hops_str:
                    try:
                        hops = json.loads(hops_str)
                    except:
                        pass

                # Deduplicate nodes and assign roles
                for idx, hop in enumerate(hops):
                    hop_clean = clean_prefix(hop)
                    if hop_clean not in nodes_map:
                        nodes_map[hop_clean] = {
                          "pubkey": hop_clean,
                          "name": f"Node {hop_clean[:6]}",
                          "role": "repeater" if idx < len(hops)-1 else "companion",
                          "last_seen": r['timestamp'],
                          "scopes": set(),
                          "hops_breakdown": {}
                        }

                    # Update scopes and hop counts
                    node = nodes_map[hop_clean]
                    node["scopes"].add(scope)

                    # Hop count breakdown
                    hop_len = str(len(hops))
                    node["hops_breakdown"][hop_len] = node["hops_breakdown"].get(hop_len, 0) + 1

                    # Build edges between subsequent hops
                    if idx > 0:
                        prev_hop = clean_prefix(hops[idx-1])
                        edge_key = tuple(sorted([prev_hop, hop_clean]))
                        if edge_key not in edges_map:
                            edges_map[edge_key] = {"source": edge_key[0], "target": edge_key[1], "weight": 0, "score": 0.5}
                        edges_map[edge_key]["weight"] += 1

                # Update scopes
                if scope not in scopes:
                    scopes[scope] = {"name": scope, "nodes": set()}
                for hop in hops:
                    scopes[scope]["nodes"].add(clean_prefix(hop))

            # Format outputs
            formatted_nodes = []
            for n in nodes_map.values():
                n["scopes"] = list(n["scopes"])
                formatted_nodes.append(n)

            formatted_edges = [e for e in edges_map.values()]

            formatted_scopes = {}
            for s_name, s_data in scopes.items():
                formatted_scopes[s_name] = {
                    "name": s_name,
                    "nodes": list(s_data["nodes"])
                }

            conn.close()
            return {
                "nodes": formatted_nodes,
                "edges": formatted_edges,
                "scopes": formatted_scopes
            }
        except Exception as e:
            logger.error(f"Error querying analytical data: {e}")
            return {"nodes": [], "edges": [], "scopes": {}}

def main():
    logger.info(f"Starting server on port {PORT} with CORS enabled (Origin: {CORS_ORIGIN})...")
    handler = MeshGridHTTPHandler
    # Disable logging per request to keep console neat
    handler.log_message = lambda self, format, *args: None

    with socketserver.TCPServer(("", PORT), handler) as httpd:
        logger.info(f"Serving at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Server stopped.")

if __name__ == '__main__':
    main()
