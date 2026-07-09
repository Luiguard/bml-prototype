import subprocess
import time
import requests
import os
import logging
from datetime import datetime

# --- Logging Setup ---
LOG_FILE = "/home/benjamin/projects/monitor.log"
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
log = logging.getLogger("MedicleanMonitor")

SERVICES = ["mediclean-server", "mediclean-tunnel"]
URL = "http://localhost:8001"
PUBLIC_URL = "https://mediclean-pro.at"
CHECK_INTERVAL = 60  # seconds
SOUND_PATH = "/usr/share/sounds/freedesktop/stereo/dialog-warning.oga"
MAX_RESTART_ATTEMPTS = 3

def play_alert():
    try:
        subprocess.run(["paplay", SOUND_PATH], timeout=5)
    except Exception:
        pass

def send_notification(msg):
    try:
        subprocess.run(["notify-send", "Mediclean Monitor", msg, "-u", "critical"], timeout=5)
    except Exception:
        pass

def check_service(service):
    result = subprocess.run(["systemctl", "is-active", service], capture_output=True, text=True)
    return result.stdout.strip() == "active"

def kill_stale_port(port=8001):
    try:
        subprocess.run(["fuser", "-k", f"{port}/tcp"], timeout=5, capture_output=True)
        time.sleep(1)
    except Exception:
        pass

def restart_service(service):
    log.warning(f"Dienst '{service}' ist DOWN — Neustart wird versucht...")
    send_notification(f"⚠️ {service} ist down! Neustart wird versucht...")

    if service == "mediclean-server":
        kill_stale_port()

    for attempt in range(1, MAX_RESTART_ATTEMPTS + 1):
        log.info(f"  Versuch {attempt}/{MAX_RESTART_ATTEMPTS}...")
        subprocess.run(["sudo", "systemctl", "restart", service])
        wait = 5 + (attempt * 5)
        time.sleep(wait)

        if check_service(service):
            msg = f"✅ {service} wurde erfolgreich repariert (Versuch {attempt})."
            log.info(msg)
            send_notification(msg)
            return True

    msg = f"❌ REPARATUR FEHLGESCHLAGEN: {service} nach {MAX_RESTART_ATTEMPTS} Versuchen!"
    log.critical(msg)
    send_notification(msg)
    play_alert()
    return False

def monitor():
    log.info("=" * 50)
    log.info("Mediclean Monitor gestartet")
    log.info(f"  Überwachte Dienste: {', '.join(SERVICES)}")
    log.info(f"  Check-Intervall: {CHECK_INTERVAL}s")
    log.info(f"  Lokaler Endpunkt: {URL}")
    log.info("=" * 50)

    while True:
        try:
            # 1. Check systemd services
            for service in SERVICES:
                if not check_service(service):
                    restart_service(service)
                else:
                    log.debug(f"  ✓ {service} OK")

            # 2. Check HTTP reachability
            try:
                resp = requests.get(URL, timeout=10)
                if resp.status_code != 200:
                    msg = f"Server antwortet mit Status {resp.status_code}"
                    log.warning(msg)
                    send_notification(f"⚠️ {msg}")
                    play_alert()
                else:
                    log.debug("  ✓ HTTP OK")
            except requests.ConnectionError:
                msg = "Lokaler Server nicht erreichbar (Connection refused)"
                log.error(msg)
                send_notification(f"🔴 {msg}")
                play_alert()
                restart_service("mediclean-server")
            except requests.Timeout:
                msg = "Lokaler Server antwortet nicht (Timeout)"
                log.error(msg)
                send_notification(f"🔴 {msg}")
                play_alert()

        except Exception as e:
            log.error(f"Monitor Loop Error: {e}")
        
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    time.sleep(10)  # Wait for services to boot
    monitor()
