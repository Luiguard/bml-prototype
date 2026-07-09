import http.server
import socketserver
import os
import cgi
import subprocess
import shutil
import uuid
import json
import re
import time
import threading
import glob
from urllib.parse import urlparse, parse_qs
from PIL import Image
import database as db
import ai_module as ai
import mailer
import sys
sys.stdout.reconfigure(line_buffering=True)

PORT = 8001
CONVERTER_DIR = "convertany"
MAIN_SITE_DIR = "mediclean-pro"
PODCAST_DIR = "podcast-pro"
TELEMEET_DIR = "telemeet"
CUSTOMRAG_DIR = "rag-custom-knowledge"
UPLOAD_DIR = "convertany/uploads"
OUTPUT_DIR = "convertany/outputs"
DOCS_DIR = "mediclean-pro/docs"
FFMPEG_PATH = "./ffmpeg"
MAX_UPLOAD_SIZE = 0  # No limit
CLEANUP_AGE_SECONDS = 3600  # 1 hour

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DOCS_DIR, exist_ok=True)

# --- Auto-Cleanup Thread ---
def cleanup_old_files():
    """Deletes files older than CLEANUP_AGE_SECONDS from uploads and outputs."""
    while True:
        try:
            now = time.time()
            for directory in [UPLOAD_DIR, OUTPUT_DIR]:
                for filepath in glob.glob(os.path.join(directory, "*")):
                    if os.path.isfile(filepath):
                        age = now - os.path.getmtime(filepath)
                        if age > CLEANUP_AGE_SECONDS:
                            os.remove(filepath)
        except Exception as e:
            print(f"Cleanup error: {e}")
        time.sleep(300)  # Check every 5 minutes

cleanup_thread = threading.Thread(target=cleanup_old_files, daemon=True)
cleanup_thread.start()

class MultiProjectHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Security headers
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('X-XSS-Protection', '1; mode=block')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        super().end_headers()

    def send_json(self, data, status=200):
        """Helper to send a JSON response."""
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_json_body(self):
        """Read and parse JSON from request body."""
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        original_path = parsed.path
        params = parse_qs(parsed.query)
        
        # --- API GET endpoints ---
        if original_path.startswith('/api/'):
            action = original_path[len('/api/'):]
            api_key = self.headers.get('X-API-KEY', '')

            if action == 'get_users':
                self.send_json(db.get_all_users(api_key))
            elif action == 'get_roles':
                self.send_json(db.get_all_roles())
            elif action == 'list_documents':
                user = db.get_user_by_api_key(api_key)
                if not user:
                    self.send_json({"success": False, "message": "Unauthorized"}, 401)
                    return
                
                # Admins see all docs (not implemented yet), users see their own
                user_doc_dir = os.path.join(DOCS_DIR, user['id'])
                os.makedirs(user_doc_dir, exist_ok=True)
                
                files = []
                for f in os.listdir(user_doc_dir):
                    f_path = os.path.join(user_doc_dir, f)
                    if os.path.isfile(f_path):
                        stat = os.stat(f_path)
                        files.append({
                            "name": f,
                            "size": stat.st_size,
                            "date": stat.st_mtime
                        })
                files.sort(key=lambda x: x['date'], reverse=True)
                self.send_json({"success": True, "files": files})
            elif action == 'delete_user':
                uid = params.get('id', [None])[0]
                if uid:
                    self.send_json(db.delete_user(uid, api_key))
                else:
                    self.send_json({"success": False, "message": "Missing id"}, 400)
            # --- Omnia Vault GET APIs ---
            elif action == 'vault/pending':
                vault_user_id = params.get('uid', [None])[0]
                if vault_user_id:
                    self.send_json(db.vault_fetch_pending(vault_user_id))
                else:
                    self.send_json({"success": False, "message": "Missing uid"}, 400)
            elif action == 'vault/delegates':
                vault_user_id = params.get('uid', [None])[0]
                if vault_user_id:
                    self.send_json(db.vault_get_delegates(vault_user_id))
                else:
                    self.send_json({"success": False, "message": "Missing uid"}, 400)
            elif action == 'vault/heir':
                token = params.get('token', [None])[0]
                if token:
                    self.send_json(db.vault_heir_view(token))
                else:
                    self.send_json({"success": False, "message": "Missing token"}, 400)
            else:
                self.send_json({"success": False, "message": "Unknown API action"}, 404)
            return

        # Redirect /convertany to /convertany/ for correct relative paths
        if original_path == '/convertany':
            self.send_response(301)
            self.send_header('Location', '/convertany/')
            self.end_headers()
            return

        # Redirect /podcast-pro to /podcast-pro/ for correct relative paths
        if original_path == '/podcast-pro':
            self.send_response(301)
            self.send_header('Location', '/podcast-pro/')
            self.end_headers()
            return
            
        # Redirect /omnia-vault to /omnia-vault/ for correct relative paths
        if original_path == '/omnia-vault':
            self.send_response(301)
            self.send_header('Location', '/omnia-vault/')
            self.end_headers()
            return

        # Handle Translator Status Polling
        if original_path.startswith('/convertany/translate-status'):
            job_id = params.get('job_id', [''])[0]
            if not job_id:
                self.send_json({"success": False, "status": "Missing job_id"})
                return
            
            # Die .status Datei heißt: {job_id}_translated.pdf.status
            status_file = os.path.join(OUTPUT_DIR, f"{job_id}_translated.pdf.status")
            if os.path.exists(status_file):
                with open(status_file, "r") as f:
                    status_text = f.read()
                self.send_json({"success": True, "status": status_text})
            else:
                self.send_json({"success": True, "status": "Warte auf Prozessstart..."})
            return

        if original_path.startswith('/convertany/download-pdf'):
            job_id = params.get('job_id', [''])[0]
            if not job_id:
                self.send_error(400, "Missing job_id")
                return
            
            output_path = os.path.join(OUTPUT_DIR, f"{job_id}_translated.pdf")
            if os.path.exists(output_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', 'attachment; filename="Uebersetzung.pdf"')
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else:
                self.send_error(404, "File not found")
            return

        # Handle Converter logic
        if original_path.startswith('/convertany/'):
            path_within_converter = original_path[len('/convertany'):]
            if path_within_converter == '/' or path_within_converter == '': path_within_converter = '/index.html'
            self.path = '/' + CONVERTER_DIR + path_within_converter
            return super().do_GET()
            
        # Handle Podcast logic
        if original_path.startswith('/podcast-pro/'):
            path_within_podcast = original_path[len('/podcast-pro'):]
            if path_within_podcast == '/' or path_within_podcast == '': path_within_podcast = '/index.html'
            self.path = '/' + PODCAST_DIR + path_within_podcast
            return super().do_GET()

        # Redirect /telemeet to /telemeet/ for correct relative paths
        if original_path == '/telemeet':
            self.send_response(301)
            self.send_header('Location', '/telemeet/')
            self.end_headers()
            return

        # Handle TeleMeet logic
        if original_path.startswith('/telemeet/'):
            path_within_telemeet = original_path[len('/telemeet'):]
            if path_within_telemeet == '/' or path_within_telemeet == '': path_within_telemeet = '/index.html'
            self.path = '/' + TELEMEET_DIR + path_within_telemeet
            return super().do_GET()

        # Redirect /customrag to /customrag/
        if original_path == '/customrag':
            self.send_response(301)
            self.send_header('Location', '/customrag/')
            self.end_headers()
            return

        # Handle CustomRAG logic
        if original_path.startswith('/customrag/'):
            path_within_rag = original_path[len('/customrag'):]
            if path_within_rag == '/' or path_within_rag == '': path_within_rag = '/index.html'
            self.path = '/' + CUSTOMRAG_DIR + path_within_rag
            return super().do_GET()
        
        # Handle Main Site logic
        else:
            if original_path == '/' or original_path == '': 
                self.path = '/' + MAIN_SITE_DIR + '/index.html'
            else:
                self.path = '/' + MAIN_SITE_DIR + original_path
            return super().do_GET()

    def do_POST(self):
        # --- Upload size check ---
        content_length = int(self.headers.get('Content-Length', 0))
        if MAX_UPLOAD_SIZE > 0 and content_length > MAX_UPLOAD_SIZE:
            self.send_error(413, f"Datei zu groß. Maximum: {MAX_UPLOAD_SIZE // (1024*1024)} MB")
            return

        parsed = urlparse(self.path)
        path = parsed.path

        # --- API POST endpoints ---
        if path.startswith('/api/'):
            action = path[len('/api/'):]
            api_key = self.headers.get('X-API-KEY', '')
            
            # Document upload needs multipart/form-data parsing
            if action == 'upload_document':
                user = db.get_user_by_api_key(api_key)
                if not user:
                    self.send_json({"success": False, "message": "Unauthorized"}, 401)
                    return
                    
                try:
                    form = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
                    )
                    file_item = form.getvalue('file') if 'file' in form else None
                    if not isinstance(file_item, bytes) and 'file' in form:
                        # Sometimes cgi parses it as FieldStorage object if filename is present
                        file_item = form['file'].file.read()
                        filename = os.path.basename(form['file'].filename)
                    else:
                        self.send_json({"success": False, "message": "Keine gültige Datei gefunden"}, 400)
                        return

                    if not filename:
                        filename = f"upload_{int(time.time())}.pdf"

                    # Basic sanitization
                    filename = "".join(c for c in filename if c.isalnum() or c in " .-_")
                    
                    user_doc_dir = os.path.join(DOCS_DIR, user['id'])
                    os.makedirs(user_doc_dir, exist_ok=True)
                    
                    file_path = os.path.join(user_doc_dir, filename)
                    with open(file_path, 'wb') as f:
                        f.write(file_item)
                        
                    self.send_json({"success": True, "message": "Dokument hochgeladen", "filename": filename})
                except Exception as e:
                    self.send_json({"success": False, "message": f"Upload Fehler: {str(e)}"}, 500)
                return

            # Vault photo upload (multipart)
            if action == 'vault/upload':
                try:
                    form = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
                    )
                    if 'photo' in form and form['photo'].filename:
                        file_data = form['photo'].file.read()
                        orig_name = form['photo'].filename
                        ext = os.path.splitext(orig_name)[1] or '.jpg'
                        filename = f"vault_{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
                    else:
                        self.send_json({"success": False, "message": "No photo found"}, 400)
                        return

                    upload_dir = os.path.join(MAIN_SITE_DIR, "omnia-vault", "uploads")
                    os.makedirs(upload_dir, exist_ok=True)
                    filepath = os.path.join(upload_dir, filename)
                    with open(filepath, 'wb') as f:
                        f.write(file_data)

                    self.send_json({"success": True, "filename": filename, "url": f"/omnia-vault/uploads/{filename}"})
                except Exception as e:
                    self.send_json({"success": False, "message": f"Upload error: {str(e)}"}, 500)
                return

            # Podcast episode upload (multipart)
            if action == 'podcast_upload':
                try:
                    form = cgi.FieldStorage(
                        fp=self.rfile,
                        headers=self.headers,
                        environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
                    )
                    
                    title = form.getvalue('title', 'Neue Episode')
                    desc = form.getvalue('description', '')
                    host_id = form.getvalue('host_id', 'unknown')
                    
                    if 'audio' in form and form['audio'].filename:
                        file_data = form['audio'].file.read()
                        orig_name = form['audio'].filename
                        ext = os.path.splitext(orig_name)[1] or '.mp3'
                        filename = f"ep_{int(time.time())}_{uuid.uuid4().hex[:6]}{ext}"
                    else:
                        self.send_json({"success": False, "message": "No audio found"}, 400)
                        return

                    upload_dir = os.path.join(PODCAST_DIR, "uploads")
                    os.makedirs(upload_dir, exist_ok=True)
                    filepath = os.path.join(upload_dir, filename)
                    with open(filepath, 'wb') as f:
                        f.write(file_data)
                        
                    audio_url = f"/podcast-pro/uploads/{filename}"
                    db.add_podcast_episode(title, desc, audio_url, host_id)

                    self.send_json({"success": True, "filename": filename, "url": audio_url})
                except Exception as e:
                    self.send_json({"success": False, "message": f"Upload error: {str(e)}"}, 500)
                return

            try:
                data = self.read_json_body()
            except Exception:
                self.send_json({"success": False, "message": "Invalid JSON"}, 400)
                return

            if action == 'login':
                result = db.login_user(data.get('username', ''), data.get('password', ''))
                self.send_json(result)
            elif action == 'register':
                result = db.register_user(
                    data.get('username', ''),
                    data.get('email', ''),
                    data.get('password', ''),
                    data.get('role', 'customer')
                )
                self.send_json(result)
            elif action == 'upsert_user':
                uid = data.pop('id', None)
                if uid:
                    self.send_json(db.upsert_user(uid, data, api_key))
                else:
                    self.send_json({"success": False, "message": "Missing id"}, 400)
            elif action == 'upsert_role':
                self.send_json(db.upsert_role(
                    data.get('name', ''),
                    data.get('permissions', '[]'),
                    data.get('description', '')
                ))
            elif action == 'support_request':
                self.send_json(db.create_support_request(
                    data.get('userId', 'guest'),
                    data.get('username', ''),
                    data.get('message', ''),
                    data.get('type', 'general')
                ))
            elif action == 'logout':
                self.send_json({"success": True})
            # --- AI Endpoints ---
            elif action == 'ai_chat':
                chat_type = data.get('type', 'customer')
                msg = data.get('message', '')
                ctx = data.get('context', None)
                if chat_type == 'staff':
                    self.send_json(ai.staff_chat(msg, ctx))
                else:
                    user_data = db.get_user_by_api_key(api_key)
                    self.send_json(ai.customer_chat(msg, ctx, user_data))
            elif action == 'ai_checklist':
                self.send_json(ai.generate_checklist(data.get('room_type', 'Büro')))
            elif action == 'ai_offer':
                self.send_json(ai.generate_offer(
                    data.get('service_type', 'Unterhaltsreinigung'),
                    data.get('area_sqm', None),
                    data.get('frequency', None)
                ))
            elif action == 'ai_analyze_appointment':
                self.send_json(ai.analyze_appointment_request(data.get('message', '')))
            # --- Omnia Vault POST APIs ---
            elif action == 'vault/register':
                self.send_json(db.vault_register(
                    data.get('passkey', ''),
                    data.get('displayName', 'Principal')
                ))
            elif action == 'vault/login':
                self.send_json(db.vault_login(
                    data.get('vaultId', ''),
                    data.get('passkey', '')
                ))
            elif action == 'vault/delegate':
                self.send_json(db.vault_create_delegate(
                    data.get('userId', ''),
                    data.get('label', '')
                ))
            elif action == 'vault/submit':
                self.send_json(db.vault_submit_item(
                    data.get('token', ''),
                    data.get('name', ''),
                    data.get('type', 'Asset'),
                    data.get('value', 0),
                    data.get('notes', '')
                ))
            elif action == 'vault/revoke':
                self.send_json(db.vault_revoke_delegate(
                    data.get('userId', ''),
                    data.get('token', '')
                ))
            elif action == 'subscribe':
                email = data.get('email', '').strip()
                source = data.get('source', 'unknown')
                if not email or '@' not in email:
                    self.send_json({"success": False, "message": "Ungültige E-Mail-Adresse"}, 400)
                else:
                    result = db.add_subscriber(email, source)
                    if result.get("success") and "bereits" not in result.get("message", ""):
                        # Send welcome email in background (or synchronously for now)
                        mailer.send_welcome_email(email, source)
                    self.send_json(result)
            elif action == 'subscribers':
                # Fetch subscribers
                self.send_json({"success": True, "subscribers": db.get_subscribers('podcast-pro')})
            elif action == 'podcast_episodes':
                self.send_json({"success": True, "episodes": db.get_podcast_episodes()})
            elif action == 'delete_podcast_episode':
                episode_id = data.get('id')
                if episode_id:
                    self.send_json(db.delete_podcast_episode(episode_id))
                else:
                    self.send_json({"success": False, "message": "Missing episode ID"}, 400)
            else:
                self.send_json({"success": False, "message": "Unknown API action"}, 404)
            return

        # --- Converter POST endpoints ---
        if path.startswith('/convertany'):
            path = path[len('/convertany'):]
            if not path.startswith('/'): path = '/' + path
            
        if path == '/convert' or path == 'convert':
            self.handle_conversion()
        elif path == '/magic-convert' or path == 'magic-convert':
            self.handle_magic_conversion()
        elif path == '/magic-extract' or path == 'magic-extract':
            self.handle_magic_extract()
        elif path == '/magic-generate' or path == 'magic-generate':
            self.handle_magic_generate()
        elif path == '/compress' or path == 'compress':
            self.handle_compress()
        elif path == '/resize' or path == 'resize':
            self.handle_resize()
        elif path == '/translate-pdf' or path == 'translate-pdf':
            self.handle_translate_pdf()
        else:
            self.send_error(404, "Not Found")

    def handle_magic_conversion(self):
        print("\n--- START handle_magic_conversion ---")
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )
            print(f"[MAGIC] Form keys: {list(form.keys())}")
            
            file_item = form['file']
            target_format = form['format'].value.lower() if 'format' in form else 'pdf'
            style = form['style'].value.lower() if 'style' in form else 'modern'
            print(f"[MAGIC] Target format: {target_format}, Style: {style}")
            
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1].lower()
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            print(f"[MAGIC] Original filename: {file_item.filename}, Extension: {input_ext}")
            print(f"[MAGIC] Saving input to: {input_path}")
            
            with open(input_path, 'wb') as f: 
                f.write(file_item.file.read())
            
            print(f"[MAGIC] File saved. Size: {os.path.getsize(input_path)} bytes")

            # Text Extraction
            text = ""
            print("[MAGIC] Starting Text Extraction...")
            if input_ext == '.pdf':
                print(f"[MAGIC] Extracting text from PDF using pdftotext...")
                res = subprocess.run(["pdftotext", input_path, input_path + ".txt"], capture_output=True, text=True)
                print(f"[MAGIC] pdftotext returncode: {res.returncode}")
                if res.stderr: print(f"[MAGIC] pdftotext stderr: {res.stderr}")
                
                if os.path.exists(input_path + ".txt"):
                    with open(input_path + ".txt", 'r') as f: text = f.read()
                    print(f"[MAGIC] Extracted text length: {len(text)}")
                else:
                    print("[MAGIC] ERROR: pdftotext did not create the .txt file")
            elif input_ext in ['.docx', '.doc', '.odt']:
                print(f"[MAGIC] Extracting text from {input_ext} using libreoffice...")
                cmd = ["libreoffice", "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", UPLOAD_DIR, input_path]
                print(f"[MAGIC] Running command: {' '.join(cmd)}")
                res = subprocess.run(cmd, capture_output=True, text=True)
                print(f"[MAGIC] libreoffice returncode: {res.returncode}")
                if res.stdout: print(f"[MAGIC] libreoffice stdout: {res.stdout.strip()}")
                if res.stderr: print(f"[MAGIC] libreoffice stderr: {res.stderr.strip()}")
                
                txt_path = os.path.join(UPLOAD_DIR, os.path.splitext(os.path.basename(input_path))[0] + ".txt")
                print(f"[MAGIC] Expected output txt path: {txt_path}")
                if os.path.exists(txt_path):
                    with open(txt_path, 'r', encoding='utf-8') as f: 
                        text = f.read()
                        if text.startswith('\ufeff'):
                            text = text[1:]
                    print(f"[MAGIC] Extracted text length: {len(text)}")
                else:
                    print(f"[MAGIC] ERROR: libreoffice did not create {txt_path}")
            else:
                print(f"[MAGIC] Unsupported extension for text extraction: {input_ext}")
            
            # Template Filling
            print("[MAGIC] Starting Template Filling...")
            # Note: The template should be in the correct directory. Let's make sure it reads from CONVERTER_DIR
            template_path = os.path.join(CONVERTER_DIR, "resume_template.html")
            print(f"[MAGIC] Reading template from: {template_path}")
            if not os.path.exists(template_path):
                # Fallback to current directory if not found in CONVERTER_DIR
                template_path = "resume_template.html"
                print(f"[MAGIC] Template not found in CONVERTER_DIR, falling back to: {template_path}")
                
            if not os.path.exists(template_path):
                print(f"[MAGIC] ERROR: Template file {template_path} not found!")
                raise Exception(f"Template file {template_path} not found")
                
            with open(template_path, 'r') as f: html = f.read()
            accent_color = "#2563eb"
            if style == 'classic': accent_color = "#334155"
            elif style == 'creative': accent_color = "#d946ef"
            
            print(f"[MAGIC] Parsing text for structured data...")
            text_clean = text.strip()
            parsed = {}

            if text_clean:
                try:
                    import urllib.request
                    print("[MAGIC] Calling Ollama for JSON extraction...")
                    prompt = f"""Extrahiere AUSSCHLIESSLICH die exakt im Text vorhandenen Informationen aus dem Lebenslauf.

WICHTIGSTE REGELN:
1. Erfinde ABSOLUT NICHTS. Keine Platzhalter, keine Fantasiedaten, keine Annahmen.
2. Wenn eine Information NICHT WÖRTLICH im Text steht, MUSS das Feld ein leerer String "" sein.
3. Halluzinationen sind STRENGSTENS VERBOTEN. Lieber ein leeres Feld als eine Erfindung.
4. Übernimm alle Texte so WORTGETREU wie möglich aus dem Originaldokument.
5. SKILLS: Übernimm Skills NUR wenn sie EXPLIZIT in einer eigenen Rubrik "Skills", "Kenntnisse", "Fähigkeiten", "EDV-Kenntnisse" o.ä. aufgelistet sind. Leite NIEMALS Skills aus Fließtexten, Kurstiteln oder Jobbeschreibungen ab. Ein besuchter Kurs ist KEIN Skill.
6. EXPERIENCE/EDUCATION: Übernimm Datum, Bezeichnung, Firma/Institution exakt wie im Text. Erfinde keine Beschreibungen.

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{{
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "title": "",
    "summary": "",
    "skills": [],
    "experience": [{{"role": "", "company": "", "date": "", "description": ""}}],
    "education": [{{"degree": "", "institution": "", "date": ""}}]
}}

Lebenslauf-Text:
{text_clean[:4000]}
"""
                    req = urllib.request.Request("http://localhost:11434/api/generate", json.dumps({
                        "model": "gemma3:4b",
                        "prompt": prompt,
                        "system": "Du extrahierst Daten aus Lebensläufen in JSON. Du erfindest NIEMALS Daten. Jedes Feld das nicht wörtlich im Text steht bleibt ein leerer String. Antworte nur mit JSON.",
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": 0.0, "top_p": 0.1, "num_predict": 2048}
                    }).encode('utf-8'), {"Content-Type": "application/json"})
                    
                    resp = urllib.request.urlopen(req, timeout=60)
                    raw = json.loads(resp.read())["response"]
                    parsed = json.loads(raw)
                    print(f"[MAGIC] Ollama extraction successful: {json.dumps(parsed, ensure_ascii=False)[:500]}")
                except Exception as e:
                    print(f"[MAGIC] Ollama extraction failed: {e}")
                    import traceback; traceback.print_exc()

            # Build name - only from parsed data, never fake
            name = (parsed.get("name") or "").strip()
            if not name and text_clean:
                first_line = text_clean.split('\n')[0].strip()
                if 2 < len(first_line) < 50:
                    name = first_line
            if not name:
                name = "Name nicht erkannt"
            
            print(f"[MAGIC] Final name: {name}")
            
            # Build contact section - only show fields that actually have data
            contact_items = []
            email_val = (parsed.get("email") or "").strip()
            phone_val = (parsed.get("phone") or "").strip()
            location_val = (parsed.get("location") or "").strip()
            
            if email_val:
                contact_items.append(f'<div class="contact-item"><span class="contact-label">Email</span>{email_val}</div>')
            if phone_val:
                contact_items.append(f'<div class="contact-item"><span class="contact-label">Telefon</span>{phone_val}</div>')
            if location_val:
                contact_items.append(f'<div class="contact-item"><span class="contact-label">Standort</span>{location_val}</div>')
            
            section_contact = ""
            if contact_items:
                section_contact = '<section><h2>Kontakt</h2>' + ''.join(contact_items) + '</section>'
            
            # Build title - only if present
            title_val = (parsed.get("title") or "").strip()
            section_title = f'<div class="job-title">{title_val}</div>' if title_val else ""
            
            # Build summary - only if present
            section_summary = ""
            summary_val = (parsed.get("summary") or "").strip()
            if summary_val:
                section_summary = f'<section><h2>Über mich</h2><p class="description">{summary_val}</p></section>'
            
            # Build skills - only if present
            section_skills = ""
            skills_list = [s.strip() for s in parsed.get("skills", []) if s and s.strip()]
            if skills_list:
                items = ''.join(f'<li>{s}</li>' for s in skills_list)
                section_skills = f'<section><h2>Skills</h2><ul class="skills-list">{items}</ul></section>'
            
            # Build experience - only entries with actual content
            section_experience = ""
            exp_list = parsed.get("experience", [])
            exp_items = []
            for e in exp_list:
                role = (e.get("role") or "").strip()
                company = (e.get("company") or "").strip()
                date = (e.get("date") or "").strip()
                desc = (e.get("description") or "").strip()
                if not role and not company:
                    continue
                parts = f'<div class="experience-item"><div class="date">{date}</div><div class="experience-content">'
                if role: parts += f'<div class="role">{role}</div>'
                if company: parts += f'<div class="company">{company}</div>'
                if desc: parts += f'<p class="description">{desc}</p>'
                parts += '</div></div>'
                exp_items.append(parts)
            if exp_items:
                section_experience = '<section><h2>Berufserfahrung</h2>' + ''.join(exp_items) + '</section>'
            
            # Build education - only entries with actual content
            section_education = ""
            edu_list = parsed.get("education", [])
            edu_items = []
            for e in edu_list:
                degree = (e.get("degree") or "").strip()
                inst = (e.get("institution") or "").strip()
                date = (e.get("date") or "").strip()
                if not degree and not inst:
                    continue
                parts = f'<div class="experience-item"><div class="date">{date}</div><div class="experience-content">'
                if degree: parts += f'<div class="role">{degree}</div>'
                if inst: parts += f'<div class="company">{inst}</div>'
                parts += '</div></div>'
                edu_items.append(parts)
            if edu_items:
                section_education = '<section><h2>Ausbildung</h2>' + ''.join(edu_items) + '</section>'

            # Build languages - only if present
            section_languages = ""
            lang_list = parsed.get("languages", [])
            lang_items = []
            for l in lang_list:
                lname = (l.get("name") or "").strip() if isinstance(l, dict) else str(l).strip()
                llevel = (l.get("level") or "").strip() if isinstance(l, dict) else ""
                if lname:
                    level_html = f'<span class="lang-level">{llevel}</span>' if llevel else ''
                    lang_items.append(f'<div class="lang-item"><span class="lang-name">{lname}</span>{level_html}</div>')
            if lang_items:
                section_languages = '<section><h2>Sprachen</h2>' + ''.join(lang_items) + '</section>'

            print("[MAGIC] Applying replacements to HTML...")
            
            html = html.replace("--primary: #2563eb;", f"--primary: {accent_color};")
            html = html.replace("{{NAME}}", name)
            html = html.replace("{{SECTION_CONTACT}}", section_contact)
            html = html.replace("{{SECTION_TITLE}}", section_title)
            html = html.replace("{{SECTION_SKILLS}}", section_skills)
            html = html.replace("{{SECTION_LANGUAGES}}", section_languages)
            html = html.replace("{{SECTION_PHOTO}}", "")
            html = html.replace("{{SECTION_SUMMARY}}", section_summary)
            html = html.replace("{{SECTION_EXPERIENCE}}", section_experience)
            html = html.replace("{{SECTION_EDUCATION}}", section_education)
            
            html_path = os.path.join(UPLOAD_DIR, job_id + ".html")
            print(f"[MAGIC] Saving generated HTML to: {html_path}")
            with open(html_path, 'w') as f: f.write(html)
            
            print(f"[MAGIC] Converting HTML to {target_format}...")
            output_path = os.path.join(OUTPUT_DIR, job_id + "." + target_format)
            
            if target_format == 'pdf':
                html_uri = "file://" + os.path.abspath(html_path)
                cmd2 = [
                    "google-chrome", 
                    "--headless", 
                    "--disable-gpu", 
                    "--no-sandbox",
                    "--run-all-compositor-stages-before-draw",
                    "--print-to-pdf=" + output_path,
                    "--no-pdf-header-footer",
                    html_uri
                ]
            else:
                cmd2 = ["libreoffice", "--headless", "--convert-to", target_format, "--outdir", OUTPUT_DIR, html_path]
                
            print(f"[MAGIC] Running command: {' '.join(cmd2)}")
            res2 = subprocess.run(cmd2, capture_output=True, text=True)
            print(f"[MAGIC] converter (html -> target) returncode: {res2.returncode}")
            if res2.stdout: print(f"[MAGIC] converter stdout: {res2.stdout.strip()}")
            if res2.stderr: print(f"[MAGIC] converter stderr: {res2.stderr.strip()}")
            
            print(f"[MAGIC] Expected output path: {output_path}")
            
            if os.path.exists(output_path):
                print(f"[MAGIC] SUCCESS: Output file found. Sending to client. Size: {os.path.getsize(output_path)}")
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Optimiert.{target_format}"')
                self.send_header('Content-Length', os.path.getsize(output_path))
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else: 
                print(f"[MAGIC] ERROR: Output file {output_path} not generated!")
                self.send_error(500, "Failed to generate output file")
        except Exception as e: 
            print(f"[MAGIC] UNHANDLED EXCEPTION: {e}")
            import traceback
            traceback.print_exc()
            self.send_error(500, str(e))
        print("--- END handle_magic_conversion ---\n")

    def handle_magic_extract(self):
        """Step 1: Upload file, extract text, call Ollama, return JSON for user editing."""
        print("\n--- START handle_magic_extract ---")
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )
            file_item = form['file']
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1].lower()
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            
            with open(input_path, 'wb') as f:
                f.write(file_item.file.read())
            
            print(f"[EXTRACT] File saved: {input_path} ({os.path.getsize(input_path)} bytes)")
            
            # Text Extraction
            text = ""
            if input_ext == '.pdf':
                res = subprocess.run(["pdftotext", input_path, input_path + ".txt"], capture_output=True, text=True)
                if os.path.exists(input_path + ".txt"):
                    with open(input_path + ".txt", 'r') as f: text = f.read()
            elif input_ext in ['.docx', '.doc', '.odt']:
                cmd = ["libreoffice", "--headless", "--convert-to", "txt:Text (encoded):UTF8", "--outdir", UPLOAD_DIR, input_path]
                subprocess.run(cmd, capture_output=True, text=True)
                txt_path = os.path.join(UPLOAD_DIR, os.path.splitext(os.path.basename(input_path))[0] + ".txt")
                if os.path.exists(txt_path):
                    with open(txt_path, 'r', encoding='utf-8') as f:
                        text = f.read()
                        if text.startswith('\ufeff'): text = text[1:]
            
            print(f"[EXTRACT] Text extracted: {len(text)} chars")
            text_clean = text.strip()
            parsed = {}
            
            # --- Photo Extraction ---
            photo_base64 = ""
            print("[EXTRACT] Starting Photo Extraction...")
            try:
                if input_ext == '.pdf':
                    import fitz
                    import base64
                    doc = fitz.open(input_path)
                    best_photo = None
                    best_area = 0
                    for page_num in range(min(doc.page_count, 2)):
                        page = doc[page_num]
                        for img_tuple in page.get_images():
                            xref = img_tuple[0]
                            try:
                                extracted = doc.extract_image(xref)
                                if not extracted or not extracted.get("image"):
                                    continue
                                w = extracted.get("width", 0)
                                h = extracted.get("height", 0)
                                area = w * h
                                img_bytes = extracted["image"]
                                # Skip tiny images (icons, decorations) and very large ones (background)
                                if area < 10000 or len(img_bytes) < 3000:
                                    continue
                                # Portrait photo heuristic: roughly square to tall, not super wide
                                ratio = w / h if h > 0 else 0
                                if ratio > 2.5:  # way too wide = likely a banner/header
                                    continue
                                if area > best_area:
                                    best_area = area
                                    best_photo = extracted
                            except Exception:
                                continue
                    if best_photo:
                        ext = best_photo["ext"]
                        photo_base64 = f"data:image/{ext};base64," + base64.b64encode(best_photo["image"]).decode('utf-8')
                        print(f"[EXTRACT] PDF photo extracted: {best_photo['width']}x{best_photo['height']}, {len(best_photo['image'])} bytes")
                    else:
                        print("[EXTRACT] No suitable photo found in PDF")
                    doc.close()
                elif input_ext == '.docx':
                    import zipfile
                    import base64
                    with zipfile.ZipFile(input_path, 'r') as z:
                        media_files = [f for f in z.namelist() if f.startswith('word/media/')]
                        if media_files:
                            valid_media = [f for f in media_files if f.lower().endswith(('jpeg', 'jpg', 'png'))]
                            if valid_media:
                                largest_media = max(valid_media, key=lambda x: z.getinfo(x).file_size)
                                if z.getinfo(largest_media).file_size > 5000:
                                    ext = largest_media.split('.')[-1].lower()
                                    mime = f"image/{ext}" if ext != 'jpg' else "image/jpeg"
                                    image_bytes = z.read(largest_media)
                                    photo_base64 = f"data:{mime};base64," + base64.b64encode(image_bytes).decode('utf-8')
                                    print(f"[EXTRACT] DOCX photo extracted: {largest_media}, {len(image_bytes)} bytes")
                            else:
                                print("[EXTRACT] No JPEG/PNG images found in DOCX")
                        else:
                            print("[EXTRACT] No media files found in DOCX")
                # Note: .doc (old binary format) cannot be read with zipfile - photo extraction not supported
            except Exception as e:
                print(f"[EXTRACT] Photo extraction failed: {e}")
            # ------------------------

            
            if text_clean:
                try:
                    import urllib.request
                    print("[EXTRACT] Calling Ollama...")
                    prompt = f"""Extrahiere AUSSCHLIESSLICH die exakt im Text vorhandenen Informationen aus dem Lebenslauf.

WICHTIGSTE REGELN:
1. Erfinde ABSOLUT NICHTS. Keine Platzhalter, keine Fantasiedaten, keine Annahmen.
2. Wenn eine Information NICHT WÖRTLICH im Text steht, MUSS das Feld ein leerer String "" sein.
3. Halluzinationen sind STRENGSTENS VERBOTEN. Lieber ein leeres Feld als eine Erfindung.
4. Übernimm alle Texte so WORTGETREU wie möglich aus dem Originaldokument.
5. SKILLS: Übernimm Skills NUR wenn sie EXPLIZIT in einer eigenen Rubrik "Skills", "Kenntnisse", "Fähigkeiten", "EDV-Kenntnisse" o.ä. aufgelistet sind. Leite NIEMALS Skills aus Fließtexten, Kurstiteln oder Jobbeschreibungen ab. Ein besuchter Kurs ist KEIN Skill.
6. EXPERIENCE/EDUCATION: Übernimm Datum, Bezeichnung, Firma/Institution exakt wie im Text. Erfinde keine Beschreibungen.

Antworte AUSSCHLIESSLICH mit gültigem JSON:
{{
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "title": "",
    "summary": "",
    "skills": [],
    "experience": [{{"role": "", "company": "", "date": "", "description": ""}}],
    "education": [{{"degree": "", "institution": "", "date": ""}}]
}}

Lebenslauf-Text:
{text_clean[:4000]}
"""
                    req = urllib.request.Request("http://localhost:11434/api/generate", json.dumps({
                        "model": "gemma3:4b",
                        "prompt": prompt,
                        "system": "Du extrahierst Daten aus Lebensläufen in JSON. Du erfindest NIEMALS Daten. Jedes Feld das nicht wörtlich im Text steht bleibt ein leerer String. Antworte nur mit JSON.",
                        "format": "json",
                        "stream": False,
                        "options": {"temperature": 0.0, "top_p": 0.1, "num_predict": 2048}
                    }).encode('utf-8'), {"Content-Type": "application/json"})
                    
                    resp = urllib.request.urlopen(req, timeout=60)
                    raw = json.loads(resp.read())["response"]
                    parsed = json.loads(raw)
                    print(f"[EXTRACT] Ollama OK")
                except Exception as e:
                    print(f"[EXTRACT] Ollama failed: {e}")

            # Fallback name from first line
            if not (parsed.get("name") or "").strip() and text_clean:
                first_line = text_clean.split('\n')[0].strip()
                if 2 < len(first_line) < 50:
                    parsed["name"] = first_line

            # Clean empty experience/education entries
            parsed["experience"] = [e for e in parsed.get("experience", []) if (e.get("role") or "").strip() or (e.get("company") or "").strip()]
            parsed["education"] = [e for e in parsed.get("education", []) if (e.get("degree") or "").strip() or (e.get("institution") or "").strip()]
            parsed["skills"] = [s for s in parsed.get("skills", []) if s and s.strip()]
            
            if photo_base64:
                parsed["photo"] = photo_base64

            result = json.dumps({"success": True, "data": parsed}, ensure_ascii=False)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', len(result.encode('utf-8')))
            self.end_headers()
            self.wfile.write(result.encode('utf-8'))
            
        except Exception as e:
            print(f"[EXTRACT] ERROR: {e}")
            import traceback; traceback.print_exc()
            err = json.dumps({"success": False, "error": str(e)})
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', len(err.encode('utf-8')))
            self.end_headers()
            self.wfile.write(err.encode('utf-8'))
        print("--- END handle_magic_extract ---\n")

    def handle_magic_generate(self):
        """Step 2: Receive edited JSON data, fill template, generate PDF."""
        print("\n--- START handle_magic_generate ---")
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            
            target_format = data.get("format", "pdf").lower()
            style = data.get("style", "modern").lower()
            resume = data.get("data", {})
            
            print(f"[GENERATE] Format: {target_format}, Style: {style}")
            
            job_id = str(uuid.uuid4())
            
            # Load template
            template_path = os.path.join(CONVERTER_DIR, "resume_template.html")
            if not os.path.exists(template_path):
                template_path = "resume_template.html"
            with open(template_path, 'r') as f: html = f.read()
            
            accent_color = "#2563eb"
            if style == 'classic': accent_color = "#334155"
            elif style == 'creative': accent_color = "#d946ef"
            
            name = (resume.get("name") or "").strip() or "Name nicht erkannt"
            
            # Contact
            contact_items = []
            for key, label in [("email", "Email"), ("phone", "Telefon"), ("location", "Standort")]:
                val = (resume.get(key) or "").strip()
                if val:
                    contact_items.append(f'<div class="contact-item"><span class="contact-label">{label}</span>{val}</div>')
            section_contact = ('<section><h2>Kontakt</h2>' + ''.join(contact_items) + '</section>') if contact_items else ""
            
            # Title
            title_val = (resume.get("title") or "").strip()
            section_title = f'<div class="job-title">{title_val}</div>' if title_val else ""
            
            # Summary
            summary_val = (resume.get("summary") or "").strip()
            section_summary = f'<section><h2>Über mich</h2><p class="description">{summary_val}</p></section>' if summary_val else ""
            
            # Skills
            skills = [s.strip() for s in resume.get("skills", []) if s and s.strip()]
            section_skills = ""
            if skills:
                items = ''.join(f'<li>{s}</li>' for s in skills)
                section_skills = f'<section><h2>Skills</h2><ul class="skills-list">{items}</ul></section>'
            
            # Experience
            exp_items = []
            for e in resume.get("experience", []):
                role = (e.get("role") or "").strip()
                company = (e.get("company") or "").strip()
                date = (e.get("date") or "").strip()
                desc = (e.get("description") or "").strip()
                if not role and not company: continue
                parts = f'<div class="experience-item"><div class="date">{date}</div><div class="experience-content">'
                if role: parts += f'<div class="role">{role}</div>'
                if company: parts += f'<div class="company">{company}</div>'
                if desc: parts += f'<p class="description">{desc}</p>'
                parts += '</div></div>'
                exp_items.append(parts)
            section_experience = ('<section><h2>Berufserfahrung</h2>' + ''.join(exp_items) + '</section>') if exp_items else ""
            
            # Education
            edu_items = []
            for e in resume.get("education", []):
                degree = (e.get("degree") or "").strip()
                inst = (e.get("institution") or "").strip()
                date = (e.get("date") or "").strip()
                if not degree and not inst: continue
                parts = f'<div class="experience-item"><div class="date">{date}</div><div class="experience-content">'
                if degree: parts += f'<div class="role">{degree}</div>'
                if inst: parts += f'<div class="company">{inst}</div>'
                parts += '</div></div>'
                edu_items.append(parts)
            section_education = ('<section><h2>Ausbildung</h2>' + ''.join(edu_items) + '</section>') if edu_items else ""
            
            # Languages
            section_languages = ""
            lang_items = []
            for l in resume.get("languages", []):
                lname = (l.get("name") or "").strip() if isinstance(l, dict) else str(l).strip()
                llevel = (l.get("level") or "").strip() if isinstance(l, dict) else ""
                if lname:
                    level_html = f'<span class="lang-level">{llevel}</span>' if llevel else ''
                    lang_items.append(f'<div class="lang-item"><span class="lang-name">{lname}</span>{level_html}</div>')
            if lang_items:
                section_languages = '<section><h2>Sprachen</h2>' + ''.join(lang_items) + '</section>'

            # Photo
            section_photo = ""
            photo_b64 = resume.get("photo", "").strip()
            if photo_b64:
                section_photo = f'<div class="profile-photo-container"><img src="{photo_b64}" alt="Profilbild"></div>'

            # Fill template
            html = html.replace("--primary: #2563eb;", f"--primary: {accent_color};")
            html = html.replace("{{SECTION_PHOTO}}", section_photo)
            html = html.replace("{{NAME}}", name)
            html = html.replace("{{SECTION_CONTACT}}", section_contact)
            html = html.replace("{{SECTION_TITLE}}", section_title)
            html = html.replace("{{SECTION_SKILLS}}", section_skills)
            html = html.replace("{{SECTION_LANGUAGES}}", section_languages)
            html = html.replace("{{SECTION_SUMMARY}}", section_summary)
            html = html.replace("{{SECTION_EXPERIENCE}}", section_experience)
            html = html.replace("{{SECTION_EDUCATION}}", section_education)
            
            html_path = os.path.join(UPLOAD_DIR, job_id + ".html")
            with open(html_path, 'w') as f: f.write(html)
            
            output_path = os.path.join(OUTPUT_DIR, job_id + "." + target_format)
            
            if target_format == 'pdf':
                html_uri = "file://" + os.path.abspath(html_path)
                cmd2 = [
                    "google-chrome", "--headless", "--disable-gpu", "--no-sandbox",
                    "--run-all-compositor-stages-before-draw",
                    "--print-to-pdf=" + output_path,
                    "--no-pdf-header-footer",
                    html_uri
                ]
            else:
                cmd2 = ["libreoffice", "--headless", "--convert-to", target_format, "--outdir", OUTPUT_DIR, html_path]
            
            print(f"[GENERATE] Running: {' '.join(cmd2)}")
            res2 = subprocess.run(cmd2, capture_output=True, text=True)
            print(f"[GENERATE] returncode: {res2.returncode}")
            
            if os.path.exists(output_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Optimiert.{target_format}"')
                self.send_header('Content-Length', os.path.getsize(output_path))
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else:
                self.send_error(500, "Failed to generate output file")
        except Exception as e:
            print(f"[GENERATE] ERROR: {e}")
            import traceback; traceback.print_exc()
            self.send_error(500, str(e))
        print("--- END handle_magic_generate ---\n")

    def handle_compress(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']})
            file_item = form['file']
            quality = int(form['quality'].value) if 'quality' in form else 80
            out_format = form['format'].value.lower() if 'format' in form else 'jpg'
            
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1].lower()
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            with open(input_path, 'wb') as f: f.write(file_item.file.read())
            
            if input_ext == '.pdf':
                out_format = 'pdf'
            
            output_path = os.path.join(OUTPUT_DIR, f"{job_id}.{out_format}")
            
            if input_ext in ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp']:
                img = Image.open(input_path)
                if img.mode in ('RGBA', 'P') and out_format in ('jpg', 'jpeg'):
                    img = img.convert('RGB')
                img.save(output_path, quality=quality, optimize=True)
            elif input_ext == '.pdf':
                if quality <= 30:
                    pdf_setting = "/screen"
                    dpi = "72"
                elif quality <= 70:
                    pdf_setting = "/ebook"
                    dpi = "150"
                else:
                    pdf_setting = "/printer"
                    dpi = "300"
                
                gs_args = [
                    "gs", "-sDEVICE=pdfwrite",
                    "-dCompatibilityLevel=1.4",
                    f"-dPDFSETTINGS={pdf_setting}",
                    "-dNOPAUSE", "-dQUIET", "-dBATCH",
                    "-dDetectDuplicateImages=true",
                    "-dCompressFonts=true",
                    "-dSubsetFonts=true",
                    "-dColorImageDownsampleType=/Bicubic",
                    f"-dColorImageResolution={dpi}",
                    "-dGrayImageDownsampleType=/Bicubic",
                    f"-dGrayImageResolution={dpi}",
                    "-dMonoImageDownsampleType=/Bicubic",
                    f"-dMonoImageResolution={dpi}",
                    "-dDownsampleColorImages=true",
                    "-dDownsampleGrayImages=true",
                    "-dDownsampleMonoImages=true",
                    f"-sOutputFile={output_path}",
                    input_path
                ]
                result = subprocess.run(gs_args, capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"GS error: {result.stderr}")
                
                if os.path.exists(output_path):
                    orig_size = os.path.getsize(input_path)
                    new_size = os.path.getsize(output_path)
                    if new_size >= orig_size:
                        shutil.copy2(input_path, output_path)
            else:
                self.send_error(400, "Unsupported compression format")
                return

            if os.path.exists(output_path):
                file_size = os.path.getsize(output_path)
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Compressed.{out_format}"')
                self.send_header('Content-Length', str(file_size))
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else: self.send_error(500, "Failed to compress")
        except Exception as e: self.send_error(500, str(e))

    def handle_resize(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']})
            file_item = form['file']
            width = int(form['width'].value) if 'width' in form and form['width'].value else 0
            height = int(form['height'].value) if 'height' in form and form['height'].value else 0
            format = form['format'].value.lower() if 'format' in form else 'jpg'
            
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1].lower()
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            with open(input_path, 'wb') as f: f.write(file_item.file.read())
            
            output_path = os.path.join(OUTPUT_DIR, f"{job_id}.{format}")
            
            if input_ext in ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp']:
                img = Image.open(input_path)
                
                if width and not height:
                    ratio = width / img.width
                    height = int(img.height * ratio)
                elif height and not width:
                    ratio = height / img.height
                    width = int(img.width * ratio)
                elif not width and not height:
                    width, height = img.width, img.height
                
                img = img.resize((width, height), Image.LANCZOS)
                
                if img.mode in ('RGBA', 'P') and format in ('jpg', 'jpeg'):
                    img = img.convert('RGB')
                
                img.save(output_path)
            else:
                self.send_error(400, "Unsupported resize format")
                return

            if os.path.exists(output_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Resized.{format}"')
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else: self.send_error(500, "Failed to resize")
        except Exception as e: self.send_error(500, str(e))

    def handle_translate_pdf(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']})
            file_item = form['file']
            source_lang = form['source_lang'].value if 'source_lang' in form else 'de'
            target_lang = form['target_lang'].value if 'target_lang' in form else 'sk'
            job_id = form['job_id'].value if 'job_id' in form else str(uuid.uuid4())
            
            input_ext = os.path.splitext(file_item.filename)[1].lower()
            if input_ext != '.pdf':
                self.send_error(400, "Only PDF files are supported for translation")
                return
                
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            with open(input_path, 'wb') as f: f.write(file_item.file.read())
            
            output_path = os.path.join(OUTPUT_DIR, f"{job_id}_translated.pdf")
            
            # Execute external python script IN BACKGROUND
            script_path = os.path.join(CONVERTER_DIR, "pdf_translator.py")
            subprocess.Popen(["python3", script_path, input_path, output_path, source_lang, target_lang])
            
            # Send success immediately
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "job_id": job_id}).encode())
        except Exception as e:
            print(f"Translator endpoint error: {e}")
            self.send_error(500, str(e))

    def handle_conversion(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']})
            file_item = form['file']
            target_format = form['format'].value.lower()
            quality = form['quality'].value.lower() if 'quality' in form else 'original'
            
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1]
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            with open(input_path, 'wb') as f: f.write(file_item.file.read())
            output_path = os.path.join(OUTPUT_DIR, f"{job_id}.{target_format}")

            if input_ext.lower() in ['.docx', '.doc', '.odt', '.pdf', '.rtf', '.txt']:
                subprocess.run(["libreoffice", "--headless", "--convert-to", target_format, "--outdir", OUTPUT_DIR, input_path])
            elif input_ext.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff'] and target_format in ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'pdf']:
                img = Image.open(input_path)
                if img.mode in ('RGBA', 'P') and target_format in ('jpg', 'jpeg'):
                    img = img.convert('RGB')
                if target_format == 'pdf':
                    img = img.convert('RGB')
                img.save(output_path)
            else:
                ffmpeg_args = [FFMPEG_PATH, "-y", "-i", input_path]
                if quality == 'high':
                    ffmpeg_args.extend(["-vf", "scale=-2:1080", "-b:a", "320k"])
                elif quality == 'medium':
                    ffmpeg_args.extend(["-vf", "scale=-2:720", "-b:a", "192k"])
                elif quality == 'low':
                    ffmpeg_args.extend(["-vf", "scale=-2:480", "-b:a", "128k"])
                ffmpeg_args.append(output_path)
                subprocess.run(ffmpeg_args)

            if os.path.exists(output_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Converted.{target_format}"')
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else: self.send_error(500, "Failed")
        except Exception as e: self.send_error(500, str(e))

if __name__ == "__main__":
    import signal

    def _kill_stale_port(port):
        """Kill any process still holding the port."""
        try:
            out = subprocess.check_output(
                ["fuser", f"{port}/tcp"], stderr=subprocess.DEVNULL
            ).decode().strip()
            for pid in out.split():
                pid = pid.strip()
                if pid.isdigit() and int(pid) != os.getpid():
                    os.kill(int(pid), signal.SIGKILL)
                    time.sleep(0.3)
        except Exception:
            pass

    _kill_stale_port(PORT)

    print(f"Multi-Project Server starting on port {PORT}...")
    print(f"  Upload limit: {MAX_UPLOAD_SIZE // (1024*1024)} MB")
    print(f"  Auto-cleanup: files older than {CLEANUP_AGE_SECONDS // 60} min")

    socketserver.ThreadingTCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(("", PORT), MultiProjectHandler)

    def _shutdown(signum, frame):
        print("Shutting down server...")
        httpd.shutdown()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    try:
        httpd.serve_forever()
    finally:
        httpd.server_close()
