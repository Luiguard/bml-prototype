import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import database as db

# Simple env loader
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '.env.mail')
    config = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    config[key.strip()] = val.strip()
    return config

def get_profile_config(source, config):
    if source == 'podcast-pro':
        # Fetch from database
        db_config = db.get_podcast_smtp()
        if db_config and db_config.get("user") and db_config.get("pass"):
            db_config["from_name"] = "Podcast Pro"
            return db_config

    # Try to find a profile matching the source
    prefix = f"MAIL_{source.upper()}_"
    if f"{prefix}USER" in config:
        return {
            "server": config.get(f"{prefix}SERVER", "smtp.office365.com"),
            "port": int(config.get(f"{prefix}PORT", 587)),
            "user": config[f"{prefix}USER"],
            "pass": config.get(f"{prefix}PASS", ""),
            "from_name": source.replace('-', ' ').title()
        }
    # Fallback to default
    if "MAIL_DEFAULT_USER" in config:
        return {
            "server": config.get("MAIL_DEFAULT_SERVER", "smtp.office365.com"),
            "port": int(config.get("MAIL_DEFAULT_PORT", 587)),
            "user": config["MAIL_DEFAULT_USER"],
            "pass": config.get("MAIL_DEFAULT_PASS", ""),
            "from_name": "MediClean Pro System"
        }
    return None

def send_welcome_email(to_email, source):
    config = load_env()
    profile = get_profile_config(source, config)
    
    if not profile or not profile["user"] or profile["pass"] == "your_password_here" or profile["pass"] == "your_podcast_password_here":
        print(f"Skipping email to {to_email} - SMTP not configured yet.")
        return False
        
    try:
        msg = MIMEMultipart()
        msg['From'] = f"{profile['from_name']} <{profile['user']}>"
        msg['To'] = to_email
        
        if source == 'podcast-pro':
            msg['Subject'] = 'Willkommen bei Podcast Pro!'
            body = """\
Hallo!

Vielen Dank für deine Anmeldung bei Podcast Pro. 
Du gehörst jetzt zu den Ersten, die über neue Episoden, exklusive Interviews und tiefe Einblicke informiert werden.

Wir freuen uns, dich auf dieser Reise dabei zu haben!

Beste Grüße,
Dein Podcast Pro Team
            """
        else:
            msg['Subject'] = 'Erfolgreich abonniert!'
            body = f"""\
Hallo!

Vielen Dank für deine Anmeldung. Wir haben dich erfolgreich in unseren Verteiler aufgenommen.

Beste Grüße,
Das Team
            """
            
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(profile["server"], profile["port"])
        server.starttls()
        server.login(profile["user"], profile["pass"])
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email to {to_email}: {str(e)}")
        return False
