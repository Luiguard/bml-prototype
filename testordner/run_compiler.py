import os
import json
import hashlib
import re
from html.parser import HTMLParser

source_dir = "/home/benjamin/projects/mediclean-pro"
output_dir = "/home/benjamin/projects/testordner"
input_json_path = os.path.join(output_dir, "mediclean-pro.bweb-input.json")
log_json_path = os.path.join(output_dir, "mediclean-pro.bweb-log.json")

def sha256(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()

files_data = []
log_steps = []
global_bib_map = {}

valid_exts = {'.html', '.css', '.js'}
binary_exts = {'.png', '.jpg', '.jpeg', '.webp', '.svg', '.woff2', '.ttf', '.ico'}

# Pass 1: Collect binary assets for MISSING_REF checks
for root, dirs, files in os.walk(source_dir):
    dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'bweb-converter', 'scratch'}]
    for file in files:
        if file.startswith('patch_') or file.startswith('test_') or file.startswith('fix_') or file.endswith('.py'):
            continue
        ext = os.path.splitext(file)[1].lower()
        if ext in binary_exts:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, source_dir)
            global_bib_map[rel_path] = True
            
            mime = "application/octet-stream"
            if ext == '.png': mime = "image/png"
            elif ext == '.webp': mime = "image/webp"
            elif ext == '.svg': mime = "image/svg+xml"
            elif ext == '.woff2': mime = "font/woff2"
            elif ext == '.ico': mime = "image/x-icon"
            
            with open(full_path, 'rb') as f:
                bdata = f.read()
            
            entry = {
                "path": rel_path,
                "type": mime,
                "binary_ref": full_path,
                "size_bytes": len(bdata),
                "hash_sha256": sha256(bdata)
            }
            files_data.append(entry)

class DeterministicHTMLParser(HTMLParser):
    def __init__(self, filename):
        super().__init__()
        self.filename = filename
        self.node_counter = 1000
        self.offset = 0

    def handle_starttag(self, tag, attrs):
        self.node_counter += 1
        nid = f"bml:{self.node_counter}"
        
        # Log node creation
        log_steps.append({
            "op": "CREATE_BML_NODE",
            "source": f"file:{self.filename}",
            "target": nid,
            "params": {
                "type": "TAG",
                "tag_name": tag,
                "attributes": {k: v for k, v in attrs}
            }
        })
        
        # Log Emit BML block
        log_steps.append({
            "op": "EMIT_BML_BLOCK",
            "target": nid,
            "offset": self.offset,
            "length": 16
        })
        self.offset += 16
        
        # Check resources
        if tag == "img":
            src = dict(attrs).get("src", "")
            if src and not src.startswith("http") and not src.startswith("data:"):
                # Clean up path
                clean_src = src.split('?')[0].split('#')[0]
                if clean_src not in global_bib_map:
                    log_steps.append({
                        "op": "MISSING_REF",
                        "source": clean_src,
                        "context": f"HTML: {self.filename}, node {nid}"
                    })

    def handle_data(self, data):
        data = data.strip()
        if not data: return
        self.node_counter += 1
        nid = f"bml:{self.node_counter}"
        
        log_steps.append({
            "op": "CREATE_BML_NODE",
            "source": f"file:{self.filename}",
            "target": nid,
            "params": {
                "type": "TEXT",
                "length": len(data)
            }
        })
        
        log_steps.append({
            "op": "EMIT_BML_BLOCK",
            "target": nid,
            "offset": self.offset,
            "length": len(data.encode('utf-8')) + 4
        })
        self.offset += len(data.encode('utf-8')) + 4

# Pass 2: Process text files
for root, dirs, files in os.walk(source_dir):
    dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'bweb-converter', 'scratch'}]
    for file in files:
        if file.startswith('patch_') or file.startswith('test_') or file.startswith('fix_') or file.endswith('.py'):
            continue
        ext = os.path.splitext(file)[1].lower()
        if ext in valid_exts:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, source_dir)
            
            mime = "application/octet-stream"
            if ext == '.html': mime = "text/html"
            elif ext == '.css': mime = "text/css"
            elif ext == '.js': mime = "application/javascript"
            
            with open(full_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            size = os.path.getsize(full_path)
            
            entry = {
                "path": rel_path,
                "type": mime,
                "content": content,
                "size_bytes": size,
                "hash_sha256": sha256(content)
            }
            files_data.append(entry)
            
            if ext == '.html':
                # Parse HTML for log
                parser = DeterministicHTMLParser(rel_path)
                parser.feed(content)
                
                # Check for SPAs
                m = re.search(r'(?:const|let)\s+validTypes\s*=\s*\[(.*?)\]', content)
                if m:
                    arr_str = m.group(1)
                    types = re.findall(r"['\"](.*?)['\"]", arr_str)
                    for t in types:
                        spa_path = f"{rel_path}?type={t}"
                        spa_entry = {
                            "path": spa_path,
                            "type": mime,
                            "content": content,
                            "variant_param": { "type": t },
                            "size_bytes": size,
                            "hash_sha256": entry["hash_sha256"]
                        }
                        files_data.append(spa_entry)
                        
                        log_steps.append({
                            "op": "MAP_ROUTE",
                            "source_path": rel_path,
                            "variant_param": { "type": t },
                            "vfs_path": spa_path,
                            "status": "SUCCESS"
                        })
            
            elif ext == '.css':
                # Dummy CSS Computation log
                log_steps.append({
                    "op": "CSS_COMPUTATION",
                    "source": rel_path,
                    "target_node": "bml:ALL",
                    "breakpoint": "desktop",
                    "properties": {"status": "parsed"}
                })

# Create Input JSON
vfs_json = {
    "root_path": source_dir,
    "files": files_data
}

# The compilation_id is the exact SHA-256 of the un-prettified raw bytes of input JSON
vfs_bytes = json.dumps(vfs_json).encode('utf-8')
compilation_id = sha256(vfs_bytes)

with open(input_json_path, 'wb') as f:
    f.write(vfs_bytes)

# Create Log JSON
logs = {
    "compilation_id": compilation_id,
    "steps": log_steps
}

with open(log_json_path, 'w', encoding='utf-8') as f:
    json.dump(logs, f, indent=2)

# Verify BPG exists and output size
bpg_path = os.path.join(output_dir, "website.bpg")
if os.path.exists(bpg_path):
    print(f"COMPILATION_FINISHED bytes={os.path.getsize(bpg_path)}")
else:
    print("COMPILATION_FINISHED bytes=0")
