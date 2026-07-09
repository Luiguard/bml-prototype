#!/usr/bin/env python3
import asyncio
import json
import logging
import os
import re
import subprocess
import time
from collections import deque
from pathlib import Path

import aiohttp.web
import tinytuya
import websockets
from websockets.asyncio.server import serve as ws_serve

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("climate-sync")

BASE = Path(__file__).parent
CONFIG_PATH = BASE / "config.json"

def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)

def save_config(cfg):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)

config = load_config()

class SignalFilter:
    def __init__(self, alpha=0.3):
        self.alpha = alpha
        self.values = {}

    def update(self, bssid, rssi):
        bssid = bssid.lower()
        if bssid not in self.values:
            self.values[bssid] = rssi
        else:
            self.values[bssid] = self.alpha * rssi + (1 - self.alpha) * self.values[bssid]
        return self.values[bssid]

    def get(self, bssid):
        return self.values.get(bssid.lower(), -100)

class ZoneEngine:
    def __init__(self, cfg):
        self.zones = cfg["zones"]
        self.aps = cfg["access_points"]
        self.threshold = cfg["tracking"]["rssi_threshold_db"]
        self.delay = cfg["tracking"]["zone_switch_delay_s"]
        self.current_zone = None
        self.pending_zone = None
        self.pending_since = 0

    def point_in_polygon(self, x, y, polygon):
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def compute_position(self, filt):
        total_w = 0
        wx = 0
        wy = 0
        rssi_data = {}
        for ap in self.aps:
            rssi = filt.get(ap["bssid"])
            rssi_data[ap["id"]] = rssi
            if rssi <= -95:
                continue
            w = 10 ** ((rssi + 100) / 20)
            wx += ap["position"]["x"] * w
            wy += ap["position"]["y"] * w
            total_w += w
        if total_w == 0:
            return None, rssi_data
        return {"x": wx / total_w, "y": wy / total_w}, rssi_data

    def determine_zone(self, pos):
        if pos is None:
            return None
        for z in self.zones:
            if self.point_in_polygon(pos["x"], pos["y"], z["polygon"]):
                return z["id"]
        return None

    def update(self, filt):
        pos, rssi_data = self.compute_position(filt)
        raw_zone = self.determine_zone(pos)
        now = time.time()
        zone_changed = False

        if raw_zone != self.pending_zone:
            self.pending_zone = raw_zone
            self.pending_since = now

        if self.pending_zone and self.pending_zone != self.current_zone:
            if now - self.pending_since >= self.delay:
                self.current_zone = self.pending_zone
                zone_changed = True

        return {
            "position": pos,
            "rssi": rssi_data,
            "zone": self.current_zone,
            "pending_zone": self.pending_zone,
            "zone_changed": zone_changed,
            "timestamp": now
        }

class WifiScanner:
    def __init__(self, interface):
        self.interface = interface
        self.known_bssids = set()

    def set_known_bssids(self, bssids):
        self.known_bssids = {b.lower() for b in bssids}

    @staticmethod
    def pct_to_dbm(pct):
        return (pct / 2) - 100

    def scan(self):
        try:
            out = subprocess.run(
                ["nmcli", "-t", "-f", "BSSID,SIGNAL,SSID", "dev", "wifi", "list"],
                capture_output=True, text=True, timeout=10
            )
            if out.returncode != 0:
                log.error(f"nmcli error: {out.stderr.strip()}")
                return {}
        except Exception as e:
            log.error(f"WiFi scan error: {e}")
            return {}

        results = {}
        for line in out.stdout.strip().splitlines():
            parts = line.replace("\\:", "§").split(":")
            if len(parts) < 2:
                continue
            bssid = parts[0].replace("§", ":").strip().lower()
            try:
                signal_pct = int(parts[1].strip())
            except ValueError:
                continue
            if self.known_bssids and bssid not in self.known_bssids:
                continue
            results[bssid] = self.pct_to_dbm(signal_pct)
        return results

class TuyaController:
    def __init__(self, cfg):
        self.cfg = cfg["tuya"]
        self.device = None
        self.current_mode = None
        self._connect()

    def _connect(self):
        if not self.cfg["device_id"] or not self.cfg["local_key"]:
            log.warning("Tuya nicht konfiguriert — Device-ID und Local Key fehlen")
            self.device = None
            return
        try:
            self.device = tinytuya.Device(
                self.cfg["device_id"],
                self.cfg["ip"],
                self.cfg["local_key"]
            )
            self.device.set_version(self.cfg["version"])
            log.info(f"Tuya verbunden: {self.cfg['ip']}")
        except Exception as e:
            log.error(f"Tuya Verbindungsfehler: {e}")
            self.device = None

    def set_mode(self, mode):
        if mode == self.current_mode:
            return False
        if not self.device:
            log.warning(f"Tuya nicht verbunden, kann Modus '{mode}' nicht setzen")
            self.current_mode = mode
            return True
        value = self.cfg["mode_values"].get(mode)
        if not value:
            log.error(f"Unbekannter Modus: {mode}")
            return False
        try:
            self.device.set_value(self.cfg["mode_dp"], value)
            self.current_mode = mode
            log.info(f"Monoblock → {mode} ({value})")
            return True
        except Exception as e:
            log.error(f"Tuya Fehler: {e}")
            return False

    def get_status(self):
        if not self.device:
            return {"connected": False, "mode": self.current_mode}
        try:
            status = self.device.status()
            return {"connected": True, "mode": self.current_mode, "dps": status.get("dps", {})}
        except Exception:
            return {"connected": False, "mode": self.current_mode}

    def reload(self, cfg):
        self.cfg = cfg["tuya"]
        self._connect()

class App:
    def __init__(self):
        self.config = config
        self.filt = SignalFilter(self.config["tracking"]["ema_alpha"])
        self.zone_engine = ZoneEngine(self.config)
        self.scanner = WifiScanner(self.config["tracking"]["wifi_interface"])
        self.scanner.set_known_bssids([ap["bssid"] for ap in self.config["access_points"]])
        self.tuya = TuyaController(self.config)
        self.ws_clients = set()
        self.state = {}
        self.history = deque(maxlen=100)
        self.rssi_endpoint_data = {}

    async def broadcast(self, msg):
        data = json.dumps(msg)
        dead = set()
        for ws in self.ws_clients:
            try:
                await ws.send(data)
            except Exception:
                dead.add(ws)
        self.ws_clients -= dead

    async def scan_loop(self):
        interval = self.config["tracking"]["scan_interval_s"]
        while True:
            rssi_raw = self.scanner.scan()
            if self.rssi_endpoint_data:
                rssi_raw.update(self.rssi_endpoint_data)
                self.rssi_endpoint_data = {}
            for bssid, rssi in rssi_raw.items():
                self.filt.update(bssid, rssi)

            result = self.zone_engine.update(self.filt)
            self.state = result

            if result["zone_changed"]:
                zone_cfg = next((z for z in self.config["zones"] if z["id"] == result["zone"]), None)
                if zone_cfg and "climate_mode" in zone_cfg.get("actions", {}):
                    mode = zone_cfg["actions"]["climate_mode"]
                    self.tuya.set_mode(mode)
                self.history.append({
                    "zone": result["zone"],
                    "timestamp": result["timestamp"],
                    "position": result["position"]
                })

            tuya_status = self.tuya.get_status()
            await self.broadcast({
                "type": "update",
                "position": result["position"],
                "rssi": result["rssi"],
                "zone": result["zone"],
                "pending_zone": result["pending_zone"],
                "tuya": tuya_status,
                "raw_rssi": {b: round(r, 1) for b, r in rssi_raw.items()},
                "timestamp": result["timestamp"]
            })
            await asyncio.sleep(interval)

    async def ws_handler(self, ws):
        self.ws_clients.add(ws)
        try:
            await ws.send(json.dumps({
                "type": "init",
                "config": self.config,
                "state": self.state,
                "history": list(self.history)
            }))
            async for msg in ws:
                data = json.loads(msg)
                await self.handle_ws_msg(data, ws)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.ws_clients.discard(ws)

    async def handle_ws_msg(self, data, ws):
        if data.get("type") == "save_config":
            self.config = data["config"]
            save_config(self.config)
            self.filt = SignalFilter(self.config["tracking"]["ema_alpha"])
            self.zone_engine = ZoneEngine(self.config)
            self.scanner = WifiScanner(self.config["tracking"]["wifi_interface"])
            self.scanner.set_known_bssids([ap["bssid"] for ap in self.config["access_points"]])
            self.tuya.reload(self.config)
            await self.broadcast({"type": "config_updated", "config": self.config})
        elif data.get("type") == "override_mode":
            self.tuya.set_mode(data["mode"])
            await self.broadcast({"type": "override", "mode": data["mode"]})
        elif data.get("type") == "tuya_scan":
            result = await asyncio.to_thread(self._tuya_scan)
            await ws.send(json.dumps({"type": "tuya_scan_result", "devices": result}))

    def _tuya_scan(self):
        try:
            out = subprocess.run(
                [str(BASE / ".venv/bin/python3"), "-m", "tinytuya", "scan"],
                capture_output=True, text=True, timeout=25, cwd=str(BASE)
            )
            snap = BASE / "snapshot.json"
            if snap.exists():
                with open(snap) as f:
                    return json.load(f).get("devices", [])
        except Exception as e:
            log.error(f"Tuya scan error: {e}")
        return []

    async def http_handler(self, request):
        if request.path == "/" or request.path == "/index.html":
            return aiohttp.web.FileResponse(BASE / "index.html")
        if request.path == "/api/status":
            return aiohttp.web.json_response(self.state)
        if request.path == "/api/config":
            if request.method == "GET":
                return aiohttp.web.json_response(self.config)
            if request.method == "POST":
                data = await request.json()
                self.config = data
                save_config(self.config)
                return aiohttp.web.json_response({"ok": True})
        if request.path == "/api/rssi" and request.method == "POST":
            data = await request.json()
            for bssid, rssi in data.items():
                self.rssi_endpoint_data[bssid.lower()] = float(rssi)
            return aiohttp.web.json_response({"ok": True})
        if request.path == "/api/termux_rssi" and request.method == "POST":
            data = await request.json()
            for ap in data:
                bssid = ap.get("bssid", "").lower()
                rssi = ap.get("rssi")
                if bssid and rssi is not None:
                    self.rssi_endpoint_data[bssid] = float(rssi)
            return aiohttp.web.json_response({"ok": True})
        return aiohttp.web.Response(status=404, text="Not Found")

    async def run(self):
        http_app = aiohttp.web.Application()
        http_app.router.add_route("*", "/{path:.*}", self.http_handler)
        runner = aiohttp.web.AppRunner(http_app)
        await runner.setup()
        site = aiohttp.web.TCPSite(runner, "0.0.0.0", 8765)
        await site.start()
        log.info("HTTP Server: http://0.0.0.0:8765")

        ws_server = await ws_serve(self.ws_handler, "0.0.0.0", 8766)
        log.info("WebSocket Server: ws://0.0.0.0:8766")

        log.info("ClimateSync gestartet")
        await self.scan_loop()

if __name__ == "__main__":
    app = App()
    try:
        asyncio.run(app.run())
    except KeyboardInterrupt:
        log.info("Beendet")
