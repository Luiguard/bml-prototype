#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════╗
║           EASY INSTALL — App Manager                 ║
║     Scan, Install & Update für Linux Mint            ║
║  + Custom Programs (TAR/ZIP/Binary)                  ║
╚══════════════════════════════════════════════════════╝
"""
import subprocess
import sys
import os
import json
import gi
import tarfile
import zipfile
import shutil
from pathlib import Path
from urllib.request import urlretrieve
import tempfile
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GdkPixbuf, Gdk, GLib, Pango

CSS = b"""
window { background-color: #1a1a2e; }
.header-bar { background: linear-gradient(135deg, #16213e, #0f3460); border: none; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
.app-title { color: #e2e8f0; font-size: 22px; font-weight: 700; }
.app-subtitle { color: #94a3b8; font-size: 13px; }
.sidebar { background-color: #0f0f23; border-right: 1px solid #1e1e3a; }
.sidebar button { background: transparent; border: none; color: #94a3b8; padding: 12px 20px; border-radius: 0; font-size: 14px; }
.sidebar button:hover { background-color: rgba(99,102,241,0.1); color: #e2e8f0; }
.sidebar button:checked, .sidebar button.active { background-color: rgba(99,102,241,0.2); color: #6366f1; border-left: 3px solid #6366f1; }
.app-card { background-color: #13132b; border: 1px solid #1e1e3a; border-radius: 12px; padding: 16px; margin: 4px 8px; }
.app-card:hover { background-color: #1a1a3e; border-color: #6366f1; }
.app-name { color: #e2e8f0; font-size: 14px; font-weight: 600; }
.app-version { color: #94a3b8; font-size: 12px; }
.app-type { color: #6366f1; font-size: 11px; font-weight: 500; }
.update-badge { background-color: #22c55e; color: white; border-radius: 99px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
.btn-update { background: linear-gradient(135deg, #6366f1, #818cf8); color: white; border: none; border-radius: 99px; padding: 8px 20px; font-weight: 600; font-size: 13px; }
.btn-update:hover { background: linear-gradient(135deg, #818cf8, #a5b4fc); }
.btn-update-all { background: linear-gradient(135deg, #22c55e, #4ade80); color: white; border: none; border-radius: 99px; padding: 10px 28px; font-weight: 700; font-size: 14px; }
.btn-update-all:hover { background: linear-gradient(135deg, #4ade80, #86efac); }
.btn-danger { background: #ef4444; color: white; border: none; border-radius: 8px; padding: 6px 14px; font-size: 12px; }
.search-entry { background-color: #0f0f23; color: #e2e8f0; border: 1px solid #1e1e3a; border-radius: 8px; padding: 8px 14px; }
.search-entry:focus { border-color: #6366f1; }
.status-bar { background-color: #0f0f23; border-top: 1px solid #1e1e3a; padding: 6px 16px; }
.status-text { color: #64748b; font-size: 12px; }
.section-title { color: #6366f1; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
.empty-state { color: #475569; font-size: 16px; }
.spinner { color: #6366f1; }
"""


def run_cmd(cmd, sudo=False, timeout=120):
    if sudo:
        cmd = f"pkexec /bin/bash -c '{cmd}'"
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "Timeout", 1
    except Exception as e:
        return "", str(e), 1


def scan_apt_packages():
    """Scan installed apt/deb packages and check for updates."""
    apps = []
    # Get manually installed packages (not dependencies)
    out, _, _ = run_cmd("apt-mark showmanual 2>/dev/null")
    manual = set(out.split('\n')) if out else set()
    
    # Get upgradeable packages
    out_upg, _, _ = run_cmd("apt list --upgradeable 2>/dev/null")
    upgradeable = {}
    for line in out_upg.split('\n'):
        if '/' in line and '[upgradable' in line.lower():
            name = line.split('/')[0]
            parts = line.split()
            new_ver = parts[1] if len(parts) > 1 else ''
            upgradeable[name] = new_ver

    # Known GUI apps to highlight
    known_apps = {
        'code': 'Visual Studio Code',
        'firefox': 'Firefox Browser',
        'thunderbird': 'Thunderbird Mail',
        'gimp': 'GIMP',
        'vlc': 'VLC Media Player',
        'libreoffice-common': 'LibreOffice',
        'inkscape': 'Inkscape',
        'blender': 'Blender',
        'obs-studio': 'OBS Studio',
        'steam': 'Steam',
        'discord': 'Discord',
        'spotify-client': 'Spotify',
        'google-chrome-stable': 'Google Chrome',
        'brave-browser': 'Brave Browser',
        'telegram-desktop': 'Telegram',
        'signal-desktop': 'Signal',
        'docker-ce': 'Docker',
        'nodejs': 'Node.js',
        'python3': 'Python 3',
    }

    # Only show apps the user cares about (manual + known)
    for pkg in manual:
        if not pkg:
            continue
        out_ver, _, rc = run_cmd(f"dpkg-query -W -f='${{Version}}' {pkg} 2>/dev/null")
        if rc != 0:
            continue
        display_name = known_apps.get(pkg, pkg)
        has_update = pkg in upgradeable
        apps.append({
            'name': display_name,
            'package': pkg,
            'version': out_ver,
            'new_version': upgradeable.get(pkg, ''),
            'type': 'apt',
            'has_update': has_update
        })

    return apps


def scan_flatpak():
    """Scan installed Flatpak apps and check for updates."""
    apps = []
    out, _, rc = run_cmd("flatpak list --app --columns=name,application,version 2>/dev/null")
    if rc != 0 or not out:
        return apps

    # Check for updates
    upd_out, _, _ = run_cmd("flatpak remote-ls --updates --app --columns=name,application 2>/dev/null")
    updatable = set()
    for line in upd_out.split('\n'):
        parts = line.split('\t')
        if len(parts) >= 2:
            updatable.add(parts[1].strip())

    for line in out.split('\n'):
        parts = line.split('\t')
        if len(parts) < 2:
            continue
        name = parts[0].strip()
        app_id = parts[1].strip() if len(parts) > 1 else ''
        version = parts[2].strip() if len(parts) > 2 else ''
        if not name:
            continue
        apps.append({
            'name': name,
            'package': app_id,
            'version': version,
            'new_version': '',
            'type': 'flatpak',
            'has_update': app_id in updatable
        })
    return apps


def scan_appimages():
    """Scan ~/Applications and ~/.local/bin for AppImages."""
    apps = []
    search_dirs = [
        os.path.expanduser('~/Applications'),
        os.path.expanduser('~/.local/bin'),
        '/opt'
    ]
    for d in search_dirs:
        if not os.path.isdir(d):
            continue
        for f in os.listdir(d):
            if f.lower().endswith('.appimage'):
                full = os.path.join(d, f)
                name = f.replace('.AppImage', '').replace('.appimage', '').replace('-', ' ').replace('_', ' ')
                apps.append({
                    'name': name,
                    'package': full,
                    'version': 'AppImage',
                    'new_version': '',
                    'type': 'appimage',
                    'has_update': False
                })
    return apps


def load_custom_programs_config():
    """Load custom programs from JSON config."""
    config_path = os.path.join(os.path.dirname(__file__), 'custom_programs.json')
    if not os.path.exists(config_path):
        return []
    try:
        with open(config_path, 'r') as f:
            return json.load(f).get('programs', [])
    except:
        return []


def find_latest_download(patterns, validate_arch=False):
    """Find the latest downloaded file in ~/Downloads matching any of the patterns."""
    import glob
    downloads_dir = os.path.expanduser('~/Downloads')
    files = []
    for pattern in patterns:
        files.extend(glob.glob(os.path.join(downloads_dir, pattern)))
    if not files:
        return None
    files.sort(key=os.path.getmtime, reverse=True)
    
    if not validate_arch:
        return files[0]
    
    # Filter by architecture: check top-level folder name in archive
    machine = os.uname().machine
    arch_keywords = {'x86_64': ['x64', 'x86_64', 'amd64'], 'aarch64': ['arm64', 'aarch64']}
    valid_archs = arch_keywords.get(machine, [])
    wrong_archs = []
    for kw_list in arch_keywords.values():
        if kw_list != valid_archs:
            wrong_archs.extend(kw_list)
    
    for f in files:
        try:
            with tarfile.open(f, 'r:gz') as tar:
                top_dir = tar.getnames()[0].split('/')[0]
                # Reject if top dir contains wrong arch keyword
                top_lower = top_dir.lower()
                if any(wa in top_lower for wa in wrong_archs):
                    continue
                return f
        except:
            continue
    return files[0] if files else None


def install_local_archive(prog_config, archive_path):
    """Extract and install a local tar.gz archive to a system folder using pkexec."""
    prog_id = prog_config.get('id', 'antigravity')
    install_path = os.path.expanduser(prog_config.get('install_path', f'/opt/{prog_id}'))
    
    # Copy archive to /tmp/ first so root (pkexec) can access it
    tmp_archive_path = f"/tmp/{prog_id}_archive.tar.gz"
    try:
        shutil.copy(archive_path, tmp_archive_path)
        os.chmod(tmp_archive_path, 0o644)
    except Exception as e:
        return False, f"❌ Vorbereitung fehlgeschlagen (Kopieren nach /tmp): {str(e)}"
    
    script = f"""#!/bin/bash
set -e
STAGING=$(mktemp -d)
tar -xzf "{tmp_archive_path}" -C "$STAGING"
EXTRACTED_DIR=$(find "$STAGING" -mindepth 1 -maxdepth 1 -type d | head -n 1)
if [ -z "$EXTRACTED_DIR" ]; then
    echo "No directory found in archive"
    exit 1
fi

rm -rf "{install_path}"
mkdir -p "{install_path}"
cp -r "$EXTRACTED_DIR"/* "{install_path}"/
rm -rf "$STAGING"

chmod -R 755 "{install_path}"
if [ -f "{install_path}/chrome-sandbox" ]; then
    chmod 4755 "{install_path}/chrome-sandbox"
fi

# Find main executable
EXE=""
for candidate in "{install_path}/antigravity" "{install_path}/bin/antigravity-ide" "{install_path}/{prog_id}"; do
    if [ -f "$candidate" ]; then
        EXE="$candidate"
        break
    fi
done
if [ -z "$EXE" ]; then
    EXE=$(find "{install_path}" -maxdepth 2 -type f -executable ! -name '*.so*' ! -name 'chrome*' ! -name 'lib*' | head -n 1)
fi

# Touch executable so mtime reflects install time
if [ -n "$EXE" ]; then
    touch "$EXE"
    ln -sf "$EXE" "/usr/local/bin/{prog_id}"
fi

# Copy icon if in archive
if [ -f "/home/benjamin/Downloads/icon.png" ] && [ ! -f "{install_path}/icon.png" ]; then
    cp /home/benjamin/Downloads/icon.png "{install_path}/icon.png"
fi

ICON="system-run"
if [ -f "{install_path}/icon.png" ]; then
    ICON="{install_path}/icon.png"
fi

cat > /usr/share/applications/{prog_id}.desktop << DESKEOF
[Desktop Entry]
Name={prog_config.get('name', prog_id)}
Comment=Updated automatically by Easy Install
Exec="/usr/local/bin/{prog_id}" %U
Icon=$ICON
Terminal=false
Type=Application
Categories=Development;IDE;
StartupNotify=true
DESKEOF
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sh', delete=False) as f:
        f.write(script)
        temp_script_path = f.name
        
    try:
        shutil.copy(temp_script_path, '/tmp/update_antigravity.sh')
        os.chmod('/tmp/update_antigravity.sh', 0o755)
        out, err, rc = run_cmd("/tmp/update_antigravity.sh", sudo=True, timeout=300)
        os.remove(temp_script_path)
        run_cmd("rm -f /tmp/update_antigravity.sh", sudo=True)
        run_cmd(f"rm -f {tmp_archive_path}", sudo=True)
        if rc == 0:
            return True, f"✅ {prog_config.get('name')} erfolgreich aktualisiert!"
        else:
            return False, f"❌ Update fehlgeschlagen: {err}"
    except Exception as e:
        run_cmd(f"rm -f {tmp_archive_path}", sudo=True)
        return False, f"❌ Fehler: {str(e)}"


def scan_custom_programs():
    """Scan for custom programs that are registered."""
    apps = []
    programs = load_custom_programs_config()
    
    for prog in programs:
        prog_id = prog.get('id', '')
        name = prog.get('name', prog_id)
        install_path = os.path.expanduser(prog.get('install_path', f'~/.local/bin/{prog_id}'))
        
        # Check if installed
        is_installed = os.path.exists(install_path) or os.path.exists(f"/opt/{prog_id}")
        if is_installed:
            if os.path.exists(f"/opt/{prog_id}"):
                install_path = f"/opt/{prog_id}"
                
            version = "installed"
            version_cmd = prog.get('version_cmd', '')
            if version_cmd:
                out, _, rc = run_cmd(version_cmd)
                if rc == 0 and out:
                    version = out.split('\n')[0][:20]
            
            # Check for newer downloaded archive in ~/Downloads
            # Architecture-aware: exclude wrong arch and IDE archives for Hub
            arch = 'x64' if os.uname().machine == 'x86_64' else 'arm64'
            patterns = prog.get('download_patterns', [])
            if not patterns:
                if 'antigravity' in name.lower() and 'ide' not in name.lower():
                    # Hub only: match Antigravity*.tar.gz but NOT "Antigravity IDE"
                    patterns = ['Antigravity.tar.gz', 'Antigravity ([0-9]*).tar.gz']
                elif 'ide' in name.lower():
                    patterns = ['Antigravity IDE.tar.gz', 'Antigravity IDE ([0-9]*).tar.gz']
                else:
                    patterns = [f"*{prog_id}*.tar.gz", f"*{prog_id}*.zip", f"*{prog_id}*.tgz"]
                
            downloaded = find_latest_download(patterns, validate_arch=True)
            has_update = False
            new_version = ''
            local_archive = None
            
            if downloaded:
                download_mtime = os.path.getmtime(downloaded)
                install_mtime = 0
                exe_path = os.path.join(install_path, 'antigravity')
                if not os.path.exists(exe_path):
                    exe_path = os.path.join(install_path, 'bin/antigravity-ide')
                if not os.path.exists(exe_path):
                    for root, dirs, files in os.walk(install_path):
                        for file in files:
                            fp = os.path.join(root, file)
                            if os.access(fp, os.X_OK):
                                exe_path = fp
                                break
                        if exe_path:
                            break
                            
                if os.path.exists(exe_path):
                    install_mtime = os.path.getmtime(exe_path)
                    
                if download_mtime > install_mtime:
                    has_update = True
                    new_version = 'Lokales Update: ' + os.path.basename(downloaded)
                    local_archive = downloaded
            
            apps.append({
                'name': name,
                'package': prog_id,
                'version': version,
                'new_version': new_version,
                'type': 'custom',
                'has_update': has_update,
                'description': prog.get('description', ''),
                'config': prog,
                'local_archive': local_archive
            })
    return apps


def install_custom_program(prog_config):
    """Install a custom program from archive or binary."""
    prog_id = prog_config.get('id', '')
    install_path = os.path.expanduser(prog_config.get('install_path', f'~/.local/bin/{prog_id}'))
    download_url = prog_config.get('download_url', '')
    
    if not download_url:
        return False, "No download URL provided"
    
    # Create install directory if needed
    os.makedirs(os.path.dirname(install_path), exist_ok=True)
    
    try:
        print(f"📥 Downloading {prog_id}...")
        
        # Download to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.tmp') as tmp:
            tmp_path = tmp.name
            urlretrieve(download_url, tmp_path)
        
        print(f"📦 Extracting...")
        
        # Handle different archive types
        if download_url.endswith('.tar.gz') or download_url.endswith('.tgz'):
            with tarfile.open(tmp_path, 'r:gz') as tar:
                tar.extractall(os.path.dirname(install_path))
        elif download_url.endswith('.tar.bz2'):
            with tarfile.open(tmp_path, 'r:bz2') as tar:
                tar.extractall(os.path.dirname(install_path))
        elif download_url.endswith('.tar'):
            with tarfile.open(tmp_path, 'r') as tar:
                tar.extractall(os.path.dirname(install_path))
        elif download_url.endswith('.zip'):
            with zipfile.ZipFile(tmp_path, 'r') as z:
                z.extractall(os.path.dirname(install_path))
        else:
            # Assume it's a binary, just copy
            shutil.copy(tmp_path, install_path)
        
        # Make executable if needed
        if prog_config.get('needs_chmod', False):
            os.chmod(install_path, 0o755)
        
        os.remove(tmp_path)
        return True, f"✅ {prog_config.get('name', prog_id)} installed"
    
    except Exception as e:
        return False, f"❌ Installation failed: {str(e)}"


def uninstall_custom_program(prog_config):
    """Uninstall a custom program."""
    install_path = os.path.expanduser(prog_config.get('install_path', ''))
    
    try:
        if os.path.exists(install_path):
            if os.path.isdir(install_path):
                shutil.rmtree(install_path)
            else:
                os.remove(install_path)
        return True, f"✅ Removed {prog_config.get('name', 'program')}"
    except Exception as e:
        return False, f"❌ Uninstall failed: {str(e)}"


class EasyInstallWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="Easy Install")
        self.set_default_size(960, 680)
        self.set_position(Gtk.WindowPosition.CENTER)

        # Apply CSS
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data(CSS)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), css_provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        self.all_apps = []
        self.current_filter = 'all'
        self.search_text = ''

        # Main layout
        main_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.add(main_box)

        # ── Header ──
        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=16)
        header.get_style_context().add_class('header-bar')
        header.set_margin_start(20)
        header.set_margin_end(20)
        header.set_margin_top(16)
        header.set_margin_bottom(8)

        title_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        title = Gtk.Label(label="Easy Install")
        title.get_style_context().add_class('app-title')
        title.set_halign(Gtk.Align.START)
        subtitle = Gtk.Label(label="App Manager für Linux Mint")
        subtitle.get_style_context().add_class('app-subtitle')
        subtitle.set_halign(Gtk.Align.START)
        title_box.pack_start(title, False, False, 0)
        title_box.pack_start(subtitle, False, False, 0)
        header.pack_start(title_box, False, False, 0)

        # Search
        self.search = Gtk.SearchEntry()
        self.search.set_placeholder_text("Suchen...")
        self.search.get_style_context().add_class('search-entry')
        self.search.set_size_request(250, -1)
        self.search.connect('search-changed', self.on_search)
        header.pack_end(self.search, False, False, 0)

        # Update All Button
        self.btn_update_all = Gtk.Button(label="⬆ Alle updaten")
        self.btn_update_all.get_style_context().add_class('btn-update-all')
        self.btn_update_all.connect('clicked', self.on_update_all)
        header.pack_end(self.btn_update_all, False, False, 0)

        main_box.pack_start(header, False, False, 0)

        # ── Content ──
        content = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        main_box.pack_start(content, True, True, 0)

        # Sidebar
        sidebar = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        sidebar.get_style_context().add_class('sidebar')
        sidebar.set_size_request(200, -1)
        sidebar.set_margin_top(8)

        cat_label = Gtk.Label(label="KATEGORIEN")
        cat_label.get_style_context().add_class('section-title')
        cat_label.set_halign(Gtk.Align.START)
        cat_label.set_margin_start(20)
        cat_label.set_margin_top(12)
        cat_label.set_margin_bottom(8)
        sidebar.pack_start(cat_label, False, False, 0)

        self.filter_buttons = {}
        filters = [
            ('all', '📦 Alle Programme'),
            ('updates', '⬆ Updates verfügbar'),
            ('apt', '🐧 System (APT)'),
            ('flatpak', '📀 Flatpak'),
            ('appimage', '📁 AppImage'),
            ('custom', '⚙️  Benutzerdefiniert'),
        ]
        for key, label in filters:
            btn = Gtk.Button(label=label)
            btn.set_relief(Gtk.ReliefStyle.NONE)
            btn.connect('clicked', self.on_filter, key)
            sidebar.pack_start(btn, False, False, 0)
            self.filter_buttons[key] = btn

        # Refresh button
        sep = Gtk.Separator()
        sidebar.pack_start(sep, False, False, 8)
        refresh_btn = Gtk.Button(label="🔄 Neu scannen")
        refresh_btn.set_relief(Gtk.ReliefStyle.NONE)
        refresh_btn.connect('clicked', lambda _: self.scan_apps())
        sidebar.pack_start(refresh_btn, False, False, 0)

        content.pack_start(sidebar, False, False, 0)

        # App List
        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        self.app_list = Gtk.ListBox()
        self.app_list.set_selection_mode(Gtk.SelectionMode.NONE)
        scroll.add(self.app_list)
        content.pack_start(scroll, True, True, 0)

        # ── Status Bar ──
        self.statusbar = Gtk.Label(label="Starte Scan...")
        self.statusbar.get_style_context().add_class('status-text')
        self.statusbar.set_halign(Gtk.Align.START)
        status_box = Gtk.Box()
        status_box.get_style_context().add_class('status-bar')
        status_box.pack_start(self.statusbar, False, False, 8)
        main_box.pack_end(status_box, False, False, 0)

        self.show_all()
        self.set_active_filter('all')

        # Start scanning in background
        GLib.idle_add(self.scan_apps)

    def set_active_filter(self, key):
        self.current_filter = key
        for k, btn in self.filter_buttons.items():
            ctx = btn.get_style_context()
            if k == key:
                ctx.add_class('active')
            else:
                ctx.remove_class('active')

    def scan_apps(self):
        self.statusbar.set_text("🔍 Scanne installierte Programme...")
        self.all_apps = []

        # Clear list
        for child in self.app_list.get_children():
            self.app_list.remove(child)

        # Show spinner
        spinner = Gtk.Spinner()
        spinner.start()
        spinner.set_size_request(48, 48)
        spinner.set_halign(Gtk.Align.CENTER)
        spinner.set_valign(Gtk.Align.CENTER)
        spinner.set_margin_top(40)
        self.app_list.add(spinner)
        self.app_list.show_all()

        # Scan in background thread
        import threading
        def do_scan():
            apt_apps = scan_apt_packages()
            flatpak_apps = scan_flatpak()
            appimage_apps = scan_appimages()
            custom_apps = scan_custom_programs()
            
            # Post-process APT packages to check for local .deb updates in ~/Downloads
            for app in apt_apps:
                pkg = app['package']
                deb_pattern = f"*{pkg}*.deb"
                if pkg == 'google-chrome-stable':
                    deb_pattern = "*google-chrome*.deb"
                elif pkg == 'code':
                    deb_pattern = "*code*.deb"
                
                downloaded_deb = find_latest_download([deb_pattern])
                if downloaded_deb:
                    try:
                        deb_ver, _, _ = run_cmd(f"dpkg-deb -f '{downloaded_deb}' Version")
                        if deb_ver and deb_ver != app['version']:
                            app['has_update'] = True
                            app['new_version'] = f"Lokaler Deb: {deb_ver}"
                            app['local_deb'] = downloaded_deb
                    except:
                        pass
                        
            all_apps = apt_apps + flatpak_apps + appimage_apps + custom_apps
            # Sort: updates first, then alphabetically
            all_apps.sort(key=lambda a: (not a['has_update'], a['name'].lower()))
            GLib.idle_add(self.on_scan_complete, all_apps)

        t = threading.Thread(target=do_scan, daemon=True)
        t.start()

    def on_scan_complete(self, apps):
        self.all_apps = apps
        update_count = sum(1 for a in apps if a['has_update'])
        self.statusbar.set_text(f"✅ {len(apps)} Programme gefunden — {update_count} Updates verfügbar")
        self.btn_update_all.set_label(f"⬆ Alle updaten ({update_count})")
        self.btn_update_all.set_sensitive(update_count > 0)
        self.refresh_list()

    def refresh_list(self):
        for child in self.app_list.get_children():
            self.app_list.remove(child)

        filtered = self.all_apps
        if self.current_filter == 'updates':
            filtered = [a for a in filtered if a['has_update']]
        elif self.current_filter in ('apt', 'flatpak', 'appimage', 'custom'):
            filtered = [a for a in filtered if a['type'] == self.current_filter]

        if self.search_text:
            q = self.search_text.lower()
            filtered = [a for a in filtered if q in a['name'].lower() or q in a['package'].lower()]

        if not filtered:
            label = Gtk.Label(label="Keine Programme gefunden.")
            label.get_style_context().add_class('empty-state')
            label.set_margin_top(40)
            self.app_list.add(label)
        else:
            for app in filtered:
                row = self.create_app_row(app)
                self.app_list.add(row)

        self.app_list.show_all()

    def create_app_row(self, app):
        row = Gtk.ListBoxRow()
        row.set_margin_start(8)
        row.set_margin_end(8)
        row.set_margin_top(2)
        row.set_margin_bottom(2)

        card = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        card.get_style_context().add_class('app-card')

        # Icon placeholder
        icon_label = Gtk.Label()
        icon_map = {'apt': '🐧', 'flatpak': '📀', 'appimage': '📁', 'custom': '⚙️'}
        icon_label.set_markup(f"<span size='xx-large'>{icon_map.get(app['type'], '📦')}</span>")
        icon_label.set_size_request(48, 48)
        card.pack_start(icon_label, False, False, 0)

        # Info
        info = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        name_label = Gtk.Label(label=app['name'])
        name_label.get_style_context().add_class('app-name')
        name_label.set_halign(Gtk.Align.START)
        name_label.set_ellipsize(Pango.EllipsizeMode.END)
        info.pack_start(name_label, False, False, 0)

        ver_text = f"v{app['version']}"
        if app['has_update'] and app['new_version']:
            ver_text += f"  →  v{app['new_version']}"
        ver_label = Gtk.Label(label=ver_text)
        ver_label.get_style_context().add_class('app-version')
        ver_label.set_halign(Gtk.Align.START)
        info.pack_start(ver_label, False, False, 0)

        type_label = Gtk.Label(label=app['type'].upper())
        type_label.get_style_context().add_class('app-type')
        type_label.set_halign(Gtk.Align.START)
        info.pack_start(type_label, False, False, 0)

        card.pack_start(info, True, True, 0)

        # Actions
        actions = Gtk.Box(spacing=8)
        actions.set_valign(Gtk.Align.CENTER)

        if app['has_update']:
            badge = Gtk.Label(label="Update")
            badge.get_style_context().add_class('update-badge')
            actions.pack_start(badge, False, False, 0)

            btn = Gtk.Button(label="Updaten")
            btn.get_style_context().add_class('btn-update')
            btn.connect('clicked', self.on_update_single, app)
            actions.pack_start(btn, False, False, 0)
        elif app['type'] == 'custom':
            # For custom programs: Install or Uninstall buttons
            btn = Gtk.Button(label="Installieren")
            btn.get_style_context().add_class('btn-update')
            btn.connect('clicked', self.on_install_custom, app)
            actions.pack_start(btn, False, False, 0)
            
            del_btn = Gtk.Button(label="✕")
            del_btn.get_style_context().add_class('btn-danger')
            del_btn.connect('clicked', self.on_uninstall_custom, app)
            actions.pack_start(del_btn, False, False, 0)

        card.pack_end(actions, False, False, 0)

        row.add(card)
        return row

    def on_filter(self, btn, key):
        self.set_active_filter(key)
        self.refresh_list()

    def on_search(self, entry):
        self.search_text = entry.get_text()
        self.refresh_list()

    def on_update_single(self, btn, app):
        btn.set_sensitive(False)
        btn.set_label("⏳")
        self.statusbar.set_text(f"⬆ Aktualisiere {app['name']}...")

        import threading
        def do_update():
            if app['type'] == 'apt':
                if 'local_deb' in app and app['local_deb']:
                    tmp_deb = f"/tmp/{app['package']}_update.deb"
                    try:
                        shutil.copy(app['local_deb'], tmp_deb)
                        os.chmod(tmp_deb, 0o644)
                        run_cmd(f"apt-get install -y {tmp_deb}", sudo=True)
                        run_cmd(f"rm -f {tmp_deb}", sudo=True)
                    except Exception as e:
                        GLib.idle_add(self.statusbar.set_text, f"❌ Deb-Installation fehlgeschlagen: {str(e)}")
                else:
                    run_cmd(f"apt-get install --only-upgrade -y {app['package']}", sudo=True)
            elif app['type'] == 'flatpak':
                run_cmd(f"flatpak update -y {app['package']}")
            elif app['type'] == 'custom':
                if 'local_archive' in app and app['local_archive']:
                    success, msg = install_local_archive(app['config'], app['local_archive'])
                    GLib.idle_add(self.statusbar.set_text, msg)
                else:
                    install_custom_program(app['config'])
            GLib.idle_add(self.scan_apps)

        threading.Thread(target=do_update, daemon=True).start()

    def on_install_custom(self, btn, app):
        btn.set_sensitive(False)
        btn.set_label("⏳")
        self.statusbar.set_text(f"📥 Installiere {app['name']}...")

        import threading
        def do_install():
            if 'local_archive' in app and app['local_archive']:
                success, msg = install_local_archive(app['config'], app['local_archive'])
            else:
                success, msg = install_custom_program(app['config'])
            GLib.idle_add(self.statusbar.set_text, msg)
            GLib.idle_add(self.scan_apps)

        threading.Thread(target=do_install, daemon=True).start()

    def on_uninstall_custom(self, btn, app):
        dialog = Gtk.MessageDialog(
            transient_for=self,
            flags=0,
            message_type=Gtk.MessageType.WARNING,
            buttons=Gtk.ButtonsType.YES_NO,
            text=f"{app['name']} wirklich deinstallieren?"
        )
        response = dialog.run()
        dialog.destroy()
        if response != Gtk.ResponseType.YES:
            return

        btn.set_sensitive(False)
        self.statusbar.set_text(f"🗑 Entferne {app['name']}...")

        import threading
        def do_uninstall():
            success, msg = uninstall_custom_program(app['config'])
            GLib.idle_add(self.statusbar.set_text, msg)
            GLib.idle_add(self.scan_apps)

        threading.Thread(target=do_uninstall, daemon=True).start()

    def on_update_all(self, btn):
        btn.set_sensitive(False)
        btn.set_label("⏳ Wird aktualisiert...")
        self.statusbar.set_text("⬆ Alle Updates werden installiert...")

        import threading
        def do_update_all():
            run_cmd("apt-get update && apt-get upgrade -y", sudo=True)
            run_cmd("flatpak update -y")
            GLib.idle_add(self.scan_apps)
            GLib.idle_add(btn.set_label, "⬆ Alle updaten")
            GLib.idle_add(btn.set_sensitive, True)

        threading.Thread(target=do_update_all, daemon=True).start()


if __name__ == '__main__':
    app = EasyInstallWindow()
    app.connect('destroy', Gtk.main_quit)
    Gtk.main()
