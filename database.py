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
    return hashlib.sha256(f"{salt}:{password}".encode()).hexdigest()

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
        return {"success": True, "message": "Registrierung erfolgreich", "userId": user_id}
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
                "permissions": user["permissions"]
            },
            "apiKey": user["api_key"]
        }
    conn.close()
    return {"success": False, "message": "Benutzername oder Passwort falsch"}

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
    requester = conn.execute("SELECT role FROM users WHERE api_key = ?", (requesting_api_key,)).fetchone()
    if not requester or requester["role"] != "admin":
        conn.close()
        return {"success": False, "message": "Keine Berechtigung"}
    
    allowed = ["username", "email", "role", "permissions"]
    sets = []
    vals = []
    for k, v in updates.items():
        if k in allowed:
            sets.append(f"{k} = ?")
            vals.append(v)
    if "password" in updates and updates["password"]:
        sets.append("password_hash = ?")
        vals.append(hash_password(updates["password"]))
    
    if sets:
        vals.append(user_id)
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", vals)
        conn.commit()
    conn.close()
    return {"success": True}

def create_support_request(user_id, username, message, req_type="general"):
    conn = get_db()
    conn.execute(
        "INSERT INTO support_requests (user_id, username, message, type, created_at) VALUES (?, ?, ?, ?, ?)",
        (user_id, username, message, req_type, time.time())
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": "Anfrage wurde gesendet"}

# Initialize on import
init_db()
