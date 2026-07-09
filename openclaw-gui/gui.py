#!/usr/bin/env python3
"""
OpenClaw Desktop GUI — Chat interface for OpenClaw gateway
"""
import gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, Gdk, WebKit2, GLib

CSS = b"""
window { background-color: #0a0a0f; }
headerbar { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: none; }
headerbar .title { color: #e2e8f0; font-weight: 700; }
headerbar .subtitle { color: #6366f1; }
.status-ok { color: #22c55e; }
.status-err { color: #ef4444; }
"""

class OpenClawGUI(Gtk.Window):
    def __init__(self):
        super().__init__()
        self.set_title("OpenClaw")
        self.set_default_size(1100, 750)
        self.set_position(Gtk.WindowPosition.CENTER)

        # CSS
        provider = Gtk.CssProvider()
        provider.load_from_data(CSS)
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(), provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        # Header
        header = Gtk.HeaderBar()
        header.set_show_close_button(True)
        header.set_title("🦞 OpenClaw")
        header.set_subtitle("Local AI Gateway")
        self.set_titlebar(header)

        # Status indicator
        self.status_label = Gtk.Label(label="● Connected")
        self.status_label.get_style_context().add_class('status-ok')
        header.pack_end(self.status_label)

        # Reload button
        reload_btn = Gtk.Button(label="⟳")
        reload_btn.set_tooltip_text("Reload")
        reload_btn.connect('clicked', self.on_reload)
        header.pack_end(reload_btn)

        # WebView — loads the OpenClaw Web UI
        self.webview = WebKit2.WebView()
        settings = self.webview.get_settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_javascript(True)
        settings.set_allow_file_access_from_file_urls(True)

        # Dark background while loading
        rgba = Gdk.RGBA()
        rgba.parse("#0a0a0f")
        self.webview.set_background_color(rgba)

        self.webview.connect('load-changed', self.on_load_changed)
        self.webview.connect('load-failed', self.on_load_failed)

        self.add(self.webview)

        # Load the dashboard with token
        self.load_dashboard()

        self.show_all()

        # Health check timer
        GLib.timeout_add_seconds(15, self.check_health)

    def load_dashboard(self):
        import subprocess, json
        token = ""
        try:
            result = subprocess.run(
                ['bash', '-c', 'export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && openclaw config get gateway.auth.token 2>/dev/null'],
                capture_output=True, text=True, timeout=10
            )
            token = result.stdout.strip()
        except:
            pass

        url = "http://127.0.0.1:18789/"
        if token:
            url += f"#token={token}"
        self.webview.load_uri(url)

    def on_reload(self, btn):
        self.webview.reload()

    def on_load_changed(self, webview, event):
        if event == WebKit2.LoadEvent.FINISHED:
            self.status_label.set_text("● Connected")
            self.status_label.get_style_context().remove_class('status-err')
            self.status_label.get_style_context().add_class('status-ok')

    def on_load_failed(self, webview, event, uri, error):
        self.status_label.set_text("● Offline")
        self.status_label.get_style_context().remove_class('status-ok')
        self.status_label.get_style_context().add_class('status-err')
        # Show error page
        webview.load_html(f"""
        <html><body style="background:#0a0a0f;color:#e2e8f0;font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0">
        <div style="text-align:center">
            <h1 style="font-size:64px;margin:0">🦞</h1>
            <h2 style="color:#6366f1">OpenClaw Gateway Offline</h2>
            <p style="color:#94a3b8">Gateway nicht erreichbar unter {uri}</p>
            <p style="color:#64748b;font-size:14px">Starte den Gateway: <code style="background:#1a1a2e;padding:4px 8px;border-radius:4px">openclaw gateway start</code></p>
        </div>
        </body></html>
        """, "about:blank")
        return True

    def check_health(self):
        import urllib.request
        try:
            urllib.request.urlopen('http://127.0.0.1:18789/', timeout=3)
            self.status_label.set_text("● Connected")
            self.status_label.get_style_context().remove_class('status-err')
            self.status_label.get_style_context().add_class('status-ok')
        except:
            self.status_label.set_text("● Offline")
            self.status_label.get_style_context().remove_class('status-ok')
            self.status_label.get_style_context().add_class('status-err')
        return True


if __name__ == '__main__':
    app = OpenClawGUI()
    app.connect('destroy', Gtk.main_quit)
    Gtk.main()
