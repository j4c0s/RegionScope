#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
MeshCore Lightweight Packet Collector for Mikr.us
--------------------------------------------------
Saves raw and decoded packets from MQTT into a lightweight SQLite database.
Designed to use minimal memory (<15MB) and CPU.
"""

import os
import sys
import json
import sqlite3
import logging
from datetime import datetime
import paho.mqtt.client as mqtt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('collector.log', encoding='utf-8')
    ]
)
logger = logging.getLogger("Collector")

# Configuration
DB_PATH = os.environ.get("DB_PATH", "mesh.db")
MQTT_BROKER = os.environ.get("MQTT_BROKER", "meshcorekrk.cma.pl")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "meshcore/+/+/packets")
MQTT_USER = os.environ.get("MQTT_USER", "")
MQTT_PASS = os.environ.get("MQTT_PASS", "")

def init_db():
    logger.info(f"Initializing database at: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Packets table to store raw hex and decoded payloads
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS packets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            topic TEXT NOT NULL,
            raw_hex TEXT NOT NULL,
            sender_key TEXT,
            sender_name TEXT,
            recipient_key TEXT,
            payload_type INTEGER,
            route_type INTEGER,
            scope_name TEXT,
            path_hops TEXT, -- JSON array of prefix hops
            payload_text TEXT,
            raw_payload TEXT,
            rssi REAL,
            snr REAL
        )
    """)

    # Create indexes for fast queries and analytics
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_sender ON packets(sender_key)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_timestamp ON packets(timestamp)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_packets_scope ON packets(scope_name)")

    conn.commit()
    conn.close()

def decode_hops_from_hex(raw_hex, route_type):
    """
    Decodes raw hex path prefix hops similar to packetpath.DecodePathFromRawHex
    """
    try:
        clean = raw_hex.strip().replace(" ", "").upper()
        if len(clean) < 4:
            return []

        # Determine path length offset based on route type
        # Transport routes (0 or 3) have transport bytes first (bytes 1-4)
        is_transport = (route_type == 0 or route_type == 3)
        offset = 5 if is_transport else 1

        if len(clean) < (offset + 1) * 2:
            return []

        path_len_byte = int(clean[offset*2 : offset*2+2], 16)
        hash_size = ((path_len_byte >> 6) & 0x03) + 1
        hash_count = path_len_byte & 0x3F

        hops = []
        hop_offset = offset + 1
        for i in range(hash_count):
            start = hop_offset * 2
            end = (hop_offset + hash_size) * 2
            if len(clean) >= end:
                hops.append(clean[start:end])
            hop_offset += hash_size

        return hops
    except Exception as e:
        logger.error(f"Error parsing path hops: {e}")
        return []

def save_packet(topic, payload_str):
    try:
        # Payload may be raw hex or a JSON wrapper (e.g. meshcoretomqtt payload)
        raw_hex = ""
        rssi = None
        snr = None

        # Try JSON first
        try:
            data = json.loads(payload_str)
            raw_hex = data.get("hex", data.get("raw_hex", ""))
            rssi = data.get("rssi")
            snr = data.get("snr")
        except json.JSONDecodeError:
            # Fallback: assume payload_str itself is the raw hex
            raw_hex = payload_str.strip()

        raw_hex = raw_hex.upper().replace(" ", "")
        if not raw_hex:
            return

        timestamp = datetime.utcnow().isoformat() + "Z"

        # Parse minimal header bytes to extract route/payload types
        # byte 0 is route/payload type byte
        header_byte = int(raw_hex[0:2], 16)
        route_type = header_byte & 0x03
        payload_type = (header_byte >> 2) & 0x0F

        # Decode path hops
        hops = decode_hops_from_hex(raw_hex, route_type)
        path_hops_json = json.dumps(hops)

        # Scope name extraction from topic or payload
        # e.g. topic: meshcore/SJC/pubkey/packets
        topic_parts = topic.split('/')
        scope_name = topic_parts[1] if len(topic_parts) >= 2 else None

        # Save to SQLite
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO packets (
                timestamp, topic, raw_hex, route_type, payload_type,
                scope_name, path_hops, rssi, snr
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (timestamp, topic, raw_hex, route_type, payload_type, scope_name, path_hops_json, rssi, snr))
        conn.commit()
        conn.close()

        logger.info(f"Saved packet: Hash={raw_hex[:8]}... Hops={len(hops)} Scope={scope_name}")
    except Exception as e:
        logger.error(f"Failed to save packet: {e}")

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        logger.info("Connected to MQTT Broker successfully!")
        client.subscribe(MQTT_TOPIC)
        logger.info(f"Subscribed to topic: {MQTT_TOPIC}")
    else:
        logger.error(f"Connection failed with code: {rc}")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode('utf-8', errors='ignore')
        save_packet(msg.topic, payload_str)
    except Exception as e:
        logger.error(f"on_message error: {e}")

def main():
    logger.info("Starting MeshCore Lightweight Packet Collector...")
    init_db()

    client = mqtt.Client(callback_api_version=mqtt.CallbackAPIVersion.VERSION2)

    if MQTT_USER and MQTT_PASS:
        client.username_pw_set(MQTT_USER, MQTT_PASS)

    client.on_connect = on_connect
    client.on_message = on_message

    try:
        logger.info(f"Connecting to MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}...")
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Collector stopped by user.")
    except Exception as e:
        logger.error(f"Collector fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
