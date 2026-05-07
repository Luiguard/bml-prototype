import subprocess
import time
import requests
import os

SERVICES = ["mediclean-server", "mediclean-tunnel"]
URL = "http://localhost:8001" # Check locally first
PUBLIC_URL = "https://mediclean-pro.at"
CHECK_INTERVAL = 60 # seconds
SOUND_PATH = "/usr/share/sounds/freedesktop/stereo/dialog-warning.oga"

def play_alert():
    subprocess.run(["paplay", SOUND_PATH])

def send_notification(msg):
    subprocess.run(["notify-send", "Mediclean Monitor", msg, "-u", "critical"])

def check_service(service):
    result = subprocess.run(["systemctl", "is-active", service], capture_output=True, text=True)
    return result.stdout.strip() == "active"

def restart_service(service):
    send_notification(f"Dienst {service} ist down! Neustart wird versucht...")
    subprocess.run(["sudo", "systemctl", "restart", service])
    time.sleep(5)
    if check_service(service):
        send_notification(f"✅ {service} wurde erfolgreich repariert.")
    else:
        send_notification(f"❌ REPARATUR FEHLGESCHLAGEN: {service}")
        play_alert()

def monitor():
    print("Monitoring gestartet...")
    while True:
        try:
            # 1. Check Services
            for service in SERVICES:
                if not check_service(service):
                    restart_service(service)

            # 2. Check HTTP Reachability
            try:
                resp = requests.get(URL, timeout=10)
                if resp.status_code != 200:
                    send_notification(f"Warnung: Server antwortet mit Status {resp.status_code}")
                    play_alert()
            except Exception as e:
                send_notification("Fehler: Lokaler Server nicht erreichbar!")
                play_alert()
                subprocess.run(["sudo", "systemctl", "restart", "mediclean-server"])

        except Exception as e:
            print(f"Monitor Loop Error: {e}")
        
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    # Small delay to let services start
    time.sleep(10)
    monitor()
