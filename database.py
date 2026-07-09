"""
Database module for Mediclean Pro.
SQLite-based user management with password hashing.
"""
import sqlite3
import hashlib
import uuid
import os
import time

DB_PATH = os.path.join(os.path.dirname(__file__), "mediclean.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    """Create tables if they don't exist."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'customer',
            api_key TEXT UNIQUE,
            permissions TEXT DEFAULT '[]',
            profile_data TEXT DEFAULT '{}',
            created_at REAL,
            last_login REAL
        );

        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            permissions TEXT DEFAULT '[]',
            description TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS support_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            username TEXT,
            message TEXT,
            type TEXT DEFAULT 'general',
            status TEXT DEFAULT 'open',
            created_at REAL
        );
    """)

    # Insert default roles if empty
    existing = conn.execute("SELECT COUNT(*) FROM roles").fetchone()[0]
    if existing == 0:
        conn.executescript("""
            INSERT INTO roles (name, permissions, description) VALUES 
                ('admin', '["*"]', 'Vollzugriff auf alle Funktionen'),
                ('customer', '["view_documents", "book_appointments"]', 'Kundenportal-Zugang'),
                ('employee', '["view_schedule", "clock_in"]', 'Mitarbeiter-Basiszugang'),
                ('cleaning_staff', '["view_schedule", "clock_in", "report_issues"]', 'Reinigungspersonal'),
                ('team_lead', '["view_schedule", "clock_in", "manage_team", "report_issues"]', 'Teamleitung'),
                ('accounting', '["view_invoices", "manage_billing"]', 'Buchhaltung');
        """)

    # Try to add profile_data column to existing table to prevent errors if already created without it
    try:
        conn.execute("ALTER TABLE users ADD COLUMN profile_data TEXT DEFAULT '{}'")
    except sqlite3.OperationalError:
        pass # Column already exists

    # Create default admin if no admin exists
    admin = conn.execute("SELECT id FROM users WHERE role = 'admin'").fetchone()
    if not admin:
        admin_id = str(uuid.uuid4())
        admin_key = str(uuid.uuid4())
        pw_hash = hash_password("admin2026!")
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, role, api_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (admin_id, "admin", "admin@mediclean-pro.at", pw_hash, "admin", admin_key, time.time())
        )
        print(f"  ✅ Default admin created (user: admin / pw: admin2026!)")

    conn.commit()
    conn.close()

def hash_password(password):
    """SHA-256 hash with salt."""
    salt = "mediclean_pro_2026"
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), b'mediclean_pro_2026', 100000).hex()

def register_user(username, email, password, role="customer"):
    conn = get_db()
    try:
        user_id = str(uuid.uuid4())
        api_key = str(uuid.uuid4())
        pw_hash = hash_password(password)
        conn.execute(
            "INSERT INTO users (id, username, email, password_hash, role, api_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, username, email, pw_hash, role, api_key, time.time())
        )
        conn.commit()
        return {
            "success": True,
            "message": "Registrierung erfolgreich",
            "userId": user_id,
            "user": {
                "id": user_id,
                "username": username,
                "email": email,
                "role": role,
                "apiKey": api_key,
                "permissions": "[]",
                "profile_data": "{}"
            }
        }
    except sqlite3.IntegrityError as e:
        if "username" in str(e):
            return {"success": False, "message": "Benutzername bereits vergeben"}
        elif "email" in str(e):
            return {"success": False, "message": "E-Mail bereits registriert"}
        return {"success": False, "message": "Registrierung fehlgeschlagen"}
    finally:
        conn.close()

def login_user(username, password):
    conn = get_db()
    pw_hash = hash_password(password)
    user = conn.execute(
        "SELECT * FROM users WHERE (username = ? OR email = ?) AND password_hash = ?",
        (username, username, pw_hash)
    ).fetchone()
    
    if user:
        conn.execute("UPDATE users SET last_login = ? WHERE id = ?", (time.time(), user["id"]))
        conn.commit()
        conn.close()
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
                "role": user["role"],
                "apiKey": user["api_key"],
                "permissions": user["permissions"],
                "profile_data": user["profile_data"]
            },
            "apiKey": user["api_key"]
        }
    conn.close()
    return {"success": False, "message": "Benutzername oder Passwort falsch"}

def get_user_by_api_key(api_key):
    if not api_key: return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE api_key = ?", (api_key,)).fetchone()
    conn.close()
    if user:
        return dict(user)
    return None

def get_all_users(requesting_api_key):
    conn = get_db()
    requester = conn.execute("SELECT role FROM users WHERE api_key = ?", (requesting_api_key,)).fetchone()
    if not requester or requester["role"] != "admin":
        conn.close()
        return {"success": False, "message": "Keine Berechtigung"}
    
    users = conn.execute("SELECT id, username, email, role, created_at, last_login FROM users").fetchall()
    conn.close()
    return {"success": True, "users": [dict(u) for u in users]}

def get_all_roles():
    conn = get_db()
    roles = conn.execute("SELECT * FROM roles").fetchall()
    conn.close()
    return {"success": True, "roles": [dict(r) for r in roles]}

def upsert_role(name, permissions, description=""):
    conn = get_db()
    existing = conn.execute("SELECT id FROM roles WHERE name = ?", (name,)).fetchone()
    if existing:
        conn.execute("UPDATE roles SET permissions = ?, description = ? WHERE name = ?", (permissions, description, name))
    else:
        conn.execute("INSERT INTO roles (name, permissions, description) VALUES (?, ?, ?)", (name, permissions, description))
    conn.commit()
    conn.close()
    return {"success": True}

def delete_user(user_id, requesting_api_key):
    conn = get_db()
    requester = conn.execute("SELECT role FROM users WHERE api_key = ?", (requesting_api_key,)).fetchone()
    if not requester or requester["role"] != "admin":
        conn.close()
        return {"success": False, "message": "Keine Berechtigung"}
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return {"success": True}

def upsert_user(user_id, updates, requesting_api_key):
    conn = get_db()
    
    # Check if the user is updating themselves OR if they are an admin
    requester = conn.execute("SELECT id, role FROM users WHERE api_key = ?", (requesting_api_key,)).fetchone()
    if not requester:
        conn.close()
        return {"success": False, "message": "Nicht authentifiziert"}
        
    is_admin = (requester["role"] == "admin")
    is_self = (requester["id"] == user_id)
    
    if not (is_admin or is_self):
        conn.close()
        return {"success": False, "message": "Keine Berechtigung"}
    
    # Non-admins can only update their own profile_data, email, and password
    sets = []
    vals = []
    
    if "username" in updates and is_admin:
        sets.append("username = ?")
        vals.append(updates["username"])
    if "email" in updates:
        sets.append("email = ?")
        vals.append(updates["email"])
    if "role" in updates and is_admin:
        sets.append("role = ?")
        vals.append(updates["role"])
    if "permissions" in updates and is_admin:
        sets.append("permissions = ?")
        vals.append(updates["permissions"])
    if "profile_data" in updates:
        sets.append("profile_data = ?")
        vals.append(updates["profile_data"])
            
    if "password" in updates and updates["password"]:
        sets.append("password_hash = ?")
        vals.append(hash_password(updates["password"]))
    
    if sets:
        vals.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", vals)
        conn.commit()
        
    # Fetch updated user data
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    
    return {
        "success": True, 
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "apiKey": user["api_key"],
            "permissions": user["permissions"],
            "profile_data": user["profile_data"]
        }
    }

def create_support_request(user_id, username, message, req_type="general"):
    conn = get_db()
    conn.execute(
        "INSERT INTO support_requests (user_id, username, message, type, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, username, message, req_type, time.time())
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Anfrage wurde gesendet"}


# =====================================================
# OMNIA VAULT – Zero-Knowledge Relay Functions
# =====================================================

def init_vault_tables():
    """Create Omnia Vault tables."""
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS vault_users (
            id TEXT PRIMARY KEY,
            vault_id TEXT UNIQUE NOT NULL,
            passkey_hash TEXT NOT NULL,
            display_name TEXT DEFAULT 'Principal',
            created_at REAL
        );

        CREATE TABLE IF NOT EXISTS vault_delegates (
            id TEXT PRIMARY KEY,
            vault_user_id TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            label TEXT DEFAULT '',
            active INTEGER DEFAULT 1,
            created_at REAL,
            FOREIGN KEY (vault_user_id) REFERENCES vault_users(id)
        );

        CREATE TABLE IF NOT EXISTS vault_items (
            id TEXT PRIMARY KEY,
            vault_user_id TEXT NOT NULL,
            delegate_token TEXT,
            item_name TEXT NOT NULL,
            item_type TEXT DEFAULT 'Asset',
            item_value REAL DEFAULT 0,
            item_notes TEXT DEFAULT '',
            fetched INTEGER DEFAULT 0,
            created_at REAL,
            FOREIGN KEY (vault_user_id) REFERENCES vault_users(id)
        );
    """)
    conn.commit()
    conn.close()

def vault_register(passkey, display_name="Principal"):
    """Register a new Vault owner with an auto-generated Vault ID."""
    conn = get_db()
    try:
        uid = str(uuid.uuid4())
        # Generate unique 12-char vault ID (uppercase alphanumeric)
        vault_id = uuid.uuid4().hex[:12].upper()
        pw_hash = hash_password(passkey)
        conn.execute(
            "INSERT INTO vault_users (id, vault_id, passkey_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
            (uid, vault_id, pw_hash, display_name, time.time())
        )
        conn.commit()
        return {"success": True, "userId": uid, "vaultId": vault_id}
    except sqlite3.IntegrityError:
        # Extremely unlikely collision, retry once
        vault_id = uuid.uuid4().hex[:12].upper()
        try:
            conn.execute(
                "INSERT INTO vault_users (id, vault_id, passkey_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
                (uid, vault_id, pw_hash, display_name, time.time())
            )
            conn.commit()
            return {"success": True, "userId": uid, "vaultId": vault_id}
        except:
            return {"success": False, "message": "Registration failed. Please try again."}
    finally:
        conn.close()

def vault_login(vault_id, passkey):
    """Authenticate a Vault owner and return their pending item count."""
    conn = get_db()
    pw_hash = hash_password(passkey)
    user = conn.execute(
        "SELECT * FROM vault_users WHERE vault_id = ? AND passkey_hash = ?",
        (vault_id.strip().lower(), pw_hash)
    ).fetchone()
    if user:
        # Count pending (unfetched) items
        pending = conn.execute(
            "SELECT COUNT(*) FROM vault_items WHERE vault_user_id = ? AND fetched = 0",
            (user["id"],)
        ).fetchone()[0]
        conn.close()
        return {
            "success": True,
            "userId": user["id"],
            "vaultId": user["vault_id"],
            "displayName": user["display_name"],
            "pendingItems": pending
        }
    conn.close()
    return {"success": False, "message": "Invalid Vault ID or Passkey"}

def vault_create_delegate(vault_user_id, label=""):
    """Create a delegation token for staff."""
    conn = get_db()
    token = str(uuid.uuid4()).replace("-", "")[:16]
    delegate_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO vault_delegates (id, vault_user_id, token, label, created_at) VALUES (?, ?, ?, ?, ?)",
        (delegate_id, vault_user_id, token, label, time.time())
    )
    conn.commit()
    conn.close()
    return {"success": True, "token": token, "label": label}

def vault_submit_item(token, item_name, item_type, item_value, item_notes=""):
    """Staff submits an item via delegation token. Stored on server until owner fetches."""
    conn = get_db()
    delegate = conn.execute(
        "SELECT * FROM vault_delegates WHERE token = ? AND active = 1", (token,)
    ).fetchone()
    if not delegate:
        conn.close()
        return {"success": False, "message": "Invalid or expired delegation link"}
    
    item_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO vault_items (id, vault_user_id, delegate_token, item_name, item_type, item_value, item_notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (item_id, delegate["vault_user_id"], token, item_name, item_type, float(item_value or 0), item_notes, time.time())
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Item submitted successfully"}

def vault_fetch_pending(vault_user_id):
    """Owner fetches all pending items. Marks them as fetched (server cleanup)."""
    conn = get_db()
    items = conn.execute(
        "SELECT * FROM vault_items WHERE vault_user_id = ? AND fetched = 0 ORDER BY created_at DESC",
        (vault_user_id,)
    ).fetchall()
    
    result = []
    for item in items:
        result.append({
            "id": item["id"],
            "name": item["item_name"],
            "type": item["item_type"],
            "value": item["item_value"],
            "notes": item["item_notes"],
            "delegate": item["delegate_token"],
            "date": item["created_at"]
        })
    
    # Mark all as fetched
    conn.execute(
        "UPDATE vault_items SET fetched = 1 WHERE vault_user_id = ? AND fetched = 0",
        (vault_user_id,)
    )
    conn.commit()
    conn.close()
    return {"success": True, "items": result, "count": len(result)}

def vault_get_delegates(vault_user_id):
    """Get all delegation links for a vault owner."""
    conn = get_db()
    delegates = conn.execute(
        "SELECT token, label, active, created_at FROM vault_delegates WHERE vault_user_id = ? ORDER BY created_at DESC",
        (vault_user_id,)
    ).fetchall()
    conn.close()
    return {"success": True, "delegates": [dict(d) for d in delegates]}

def vault_revoke_delegate(vault_user_id, token):
    """Deactivate a delegation token."""
    conn = get_db()
    conn.execute(
        "UPDATE vault_delegates SET active = 0 WHERE vault_user_id = ? AND token = ?",
        (vault_user_id, token)
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Delegation revoked"}

def vault_heir_view(token):
    """Read-only view of vault assets for an heir token."""
    conn = get_db()
    delegate = conn.execute(
        "SELECT * FROM vault_delegates WHERE token = ? AND active = 1", (token,)
    ).fetchone()
    if not delegate:
        conn.close()
        return {"success": False, "message": "Invalid or expired heir link"}

    # Get vault owner info
    owner = conn.execute(
        "SELECT display_name FROM vault_users WHERE id = ?", (delegate["vault_user_id"],)
    ).fetchone()

    # Get ALL items (both fetched and unfetched) for this vault
    items = conn.execute(
        "SELECT * FROM vault_items WHERE vault_user_id = ? ORDER BY created_at DESC",
        (delegate["vault_user_id"],)
    ).fetchall()

    result = []
    total_value = 0
    for item in items:
        result.append({
            "name": item["item_name"],
            "type": item["item_type"],
            "value": item["item_value"],
            "notes": item["item_notes"],
            "date": item["created_at"]
        })
        total_value += item["item_value"]

    conn.close()
    return {
        "success": True,
        "ownerName": owner["display_name"] if owner else "Principal",
        "heirLabel": delegate["label"],
        "items": result,
        "totalValue": total_value,
        "count": len(result)
    }


# =====================================================
# SUBSCRIBERS / NEWSLETTER
# =====================================================

def init_subscribers_table():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS subscribers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            source TEXT DEFAULT 'unknown',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def add_subscriber(email, source='unknown'):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO subscribers (email, source) VALUES (?, ?)",
            (email.lower(), source)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "Erfolgreich angemeldet!"}
    except Exception:
        conn.close()
        return {"success": True, "message": "Du bist bereits angemeldet!"}


def get_podcast_smtp():
    conn = get_db()
    user = conn.execute("SELECT profile_data FROM users WHERE role = 'podcast_host' LIMIT 1").fetchone()
    conn.close()
    if user and user['profile_data']:
        import json
        try:
            data = json.loads(user['profile_data'])
            return {
                "server": data.get("smtp_server", "smtp.office365.com"),
                "port": int(data.get("smtp_port", 587)),
                "user": data.get("smtp_user", ""),
                "pass": data.get("smtp_pass", "")
            }
        except:
            return None
    return None

def get_subscribers(source='podcast-pro'):
    conn = get_db()
    rows = conn.execute("SELECT email, created_at FROM subscribers WHERE source = ? ORDER BY created_at DESC", (source,)).fetchall()
    conn.close()
    return [{"email": r["email"], "created_at": r["created_at"]} for r in rows]

def init_podcast_episodes_table():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS podcast_episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            audio_url TEXT NOT NULL,
            host_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def add_podcast_episode(title, description, audio_url, host_id):
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO podcast_episodes (title, description, audio_url, host_id) VALUES (?, ?, ?, ?)",
            (title, description, audio_url, host_id)
        )
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        conn.close()
        return {"success": False, "message": str(e)}

def get_podcast_episodes():
    conn = get_db()
    rows = conn.execute("SELECT * FROM podcast_episodes ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_podcast_episode(episode_id):
    conn = get_db()
    try:
        conn.execute("DELETE FROM podcast_episodes WHERE id = ?", (episode_id,))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        conn.close()
        return {"success": False, "message": str(e)}

# Initialize on import
init_db()
init_vault_tables()
init_subscribers_table()
init_podcast_episodes_table()
