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
import database as db
import ai_module as ai

PORT = 8001
CONVERTER_DIR = "convertany"
MAIN_SITE_DIR = "mediclean-pro"
UPLOAD_DIR = "convertany/uploads"
OUTPUT_DIR = "convertany/outputs"
FFMPEG_PATH = "./ffmpeg"
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 MB
CLEANUP_AGE_SECONDS = 3600  # 1 hour

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

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
            elif action == 'delete_user':
                uid = params.get('id', [None])[0]
                if uid:
                    self.send_json(db.delete_user(uid, api_key))
                else:
                    self.send_json({"success": False, "message": "Missing id"}, 400)
            else:
                self.send_json({"success": False, "message": "Unknown API action"}, 404)
            return

        # Redirect /convertany to /convertany/ for correct relative paths
        if original_path == '/convertany':
            self.send_response(301)
            self.send_header('Location', '/convertany/')
            self.end_headers()
            return

        # Handle Converter logic
        if original_path.startswith('/convertany/'):
            path_within_converter = original_path[len('/convertany'):]
            if path_within_converter == '/' or path_within_converter == '': path_within_converter = '/index.html'
            self.path = CONVERTER_DIR + path_within_converter
            return super().do_GET()
        
        # Handle Main Site logic
        else:
            if original_path == '/' or original_path == '': 
                self.path = MAIN_SITE_DIR + '/index.html'
            else:
                self.path = MAIN_SITE_DIR + original_path
            return super().do_GET()

    def do_POST(self):
        # --- Upload size check ---
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_UPLOAD_SIZE:
            self.send_error(413, f"Datei zu groß. Maximum: {MAX_UPLOAD_SIZE // (1024*1024)} MB")
            return

        parsed = urlparse(self.path)
        path = parsed.path

        # --- API POST endpoints ---
        if path.startswith('/api/'):
            action = path[len('/api/'):]
            try:
                data = self.read_json_body()
            except Exception:
                self.send_json({"success": False, "message": "Invalid JSON"}, 400)
                return
            
            api_key = self.headers.get('X-API-KEY', '')

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
        else:
            self.send_error(404, "Not Found")

    def handle_magic_conversion(self):
        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']}
            )
            file_item = form['file']
            target_format = form['format'].value.lower() if 'format' in form else 'pdf'
            style = form['style'].value.lower() if 'style' in form else 'modern'
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1].lower()
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            with open(input_path, 'wb') as f: f.write(file_item.file.read())

            # Text Extraction
            text = ""
            if input_ext == '.pdf':
                subprocess.run(["pdftotext", input_path, input_path + ".txt"])
                if os.path.exists(input_path + ".txt"):
                    with open(input_path + ".txt", 'r') as f: text = f.read()
            elif input_ext in ['.docx', '.doc', '.odt']:
                subprocess.run(["libreoffice", "--headless", "--convert-to", "txt:Text", "--outdir", UPLOAD_DIR, input_path])
                txt_path = os.path.join(UPLOAD_DIR, os.path.splitext(os.path.basename(input_path))[0] + ".txt")
                if os.path.exists(txt_path):
                    with open(txt_path, 'r') as f: text = f.read()
            
            # Template Filling
            with open("resume_template.html", 'r') as f: html = f.read()
            accent_color = "#2563eb"
            if style == 'classic': accent_color = "#334155"
            elif style == 'creative': accent_color = "#d946ef"
            
            name = re.search(r'^([A-Z][a-z]+ [A-Z][a-z]+)', text, re.M)
            name = name.group(1) if name else "Max Mustermann"
            html = html.replace("--primary: #2563eb;", f"--primary: {accent_color};").replace("{{NAME}}", name).replace("{{EMAIL}}", "email@beispiel.de").replace("{{PHONE}}", "+49 123 456789").replace("{{LOCATION}}", "Deutschland").replace("{{TITLE}}", "Bewerber").replace("{{SUMMARY}}", "Inhalt aus Dokument.").replace("{{SKILLS_LIST}}", "<li>Kommunikation</li>").replace("{{EXPERIENCE_ITEMS}}", "<div>Erfahrung</div>").replace("{{EDUCATION_ITEMS}}", "<div>Ausbildung</div>")

            html_path = os.path.join(UPLOAD_DIR, job_id + ".html")
            with open(html_path, 'w') as f: f.write(html)
            subprocess.run(["libreoffice", "--headless", "--convert-to", target_format, "--outdir", OUTPUT_DIR, html_path])
            output_path = os.path.join(OUTPUT_DIR, job_id + "." + target_format)
            
            if os.path.exists(output_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Optimiert.{target_format}"')
                self.send_header('Content-Length', os.path.getsize(output_path))
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else: self.send_error(500, "Failed")
        except Exception as e: self.send_error(500, str(e))

    def handle_conversion(self):
        try:
            form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={'REQUEST_METHOD': 'POST', 'CONTENT_TYPE': self.headers['Content-Type']})
            file_item = form['file']
            target_format = form['format'].value.lower()
            job_id = str(uuid.uuid4())
            input_ext = os.path.splitext(file_item.filename)[1]
            input_path = os.path.join(UPLOAD_DIR, job_id + input_ext)
            with open(input_path, 'wb') as f: f.write(file_item.file.read())
            output_path = os.path.join(OUTPUT_DIR, f"{job_id}.{target_format}")

            if input_ext.lower() in ['.docx', '.doc', '.odt', '.pdf', '.rtf', '.txt']:
                subprocess.run(["libreoffice", "--headless", "--convert-to", target_format, "--outdir", OUTPUT_DIR, input_path])
            else:
                subprocess.run([FFMPEG_PATH, "-y", "-i", input_path, output_path])

            if os.path.exists(output_path):
                self.send_response(200)
                self.send_header('Content-Type', 'application/octet-stream')
                self.send_header('Content-Disposition', f'attachment; filename="Converted.{target_format}"')
                self.end_headers()
                with open(output_path, 'rb') as f: shutil.copyfileobj(f, self.wfile)
            else: self.send_error(500, "Failed")
        except Exception as e: self.send_error(500, str(e))

if __name__ == "__main__":
    print(f"Multi-Project Server starting on port {PORT}...")
    print(f"  Upload limit: {MAX_UPLOAD_SIZE // (1024*1024)} MB")
    print(f"  Auto-cleanup: files older than {CLEANUP_AGE_SECONDS // 60} min")
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), MultiProjectHandler) as httpd:
        httpd.serve_forever()
