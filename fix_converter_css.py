import re

filepath = '/home/benjamin/projects/mediclean-pro/bweb-converter/converter.html'

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_css = """
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{
            --bg-primary:#000000;
            --bg-card:#0a0a0a;
            --bg-hover:#121212;
            --border:rgba(255, 255, 255, 0.1);
            --border-active:#ffffff;
            --text-primary:#ffffff;
            --text-secondary:#8a8f98;
            --text-muted:#6b7280;
            --accent:#ffffff;
            --accent-glow:rgba(255, 255, 255, 0.1);
            --success:#10b981;--warning:#f59e0b;--error:#ef4444;
            --glass:rgba(10, 10, 10, 0.85);
            --transition: 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            --radius: 12px;
        }
        body{
            font-family:'Inter',system-ui,-apple-system,sans-serif;
            background:var(--bg-primary);color:var(--text-primary);
            min-height:100vh;display:flex;flex-direction:column;align-items:center;
            padding:2rem 1rem;
            letter-spacing: -0.01em;
            -webkit-font-smoothing: antialiased;
        }
        
        /* Ambient Background */
        body::before {
            content: '';
            position: fixed; inset: 0; z-index: -1; pointer-events: none;
            background: radial-gradient(circle 800px at 50% -20%, rgba(255, 255, 255, 0.05), transparent 80%);
        }

        .engine-header{ text-align:center;margin-bottom:3rem; }
        .engine-header h1{ font-size:clamp(2rem, 5vw, 3rem); font-weight:600; letter-spacing: -0.04em; margin-bottom: 1rem; background: linear-gradient(180deg, #fff 0%, #a1a1aa 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .engine-header p{ color:var(--text-secondary); max-width:600px; margin:0 auto; }
        
        .format-badges{ display:flex;gap:.5rem;justify-content:center;margin-top:1.5rem;flex-wrap:wrap; }
        .badge{ padding:.25rem .75rem; border-radius:6px; font-family:'JetBrains Mono',monospace; font-size:.75rem; font-weight:600; border:1px solid var(--border); background:#000; color:var(--text-primary); }
        .badge-bml{ border-color:rgba(59,130,246,0.3); }
        .badge-bdt{ border-color:rgba(16,185,129,0.3); }
        .badge-blb{ border-color:rgba(245,158,11,0.3); }
        .badge-bweb{ border-color:rgba(139,92,246,0.3); }

        .main-grid{ display:grid;grid-template-columns:350px 1fr;gap:24px;width:100%;max-width:1400px;align-items:start; }
        @media(max-width:1024px){ .main-grid{grid-template-columns:1fr;} }
        
        .panel{
            background:var(--bg-card); border:1px solid var(--border);
            border-radius:var(--radius); padding:24px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transition: border-color var(--transition);
        }
        .panel:hover { border-color: rgba(255, 255, 255, 0.2); }
        
        .panel-title{ font-size:1.1rem;font-weight:600;margin-bottom:1.25rem;color:var(--text-primary);letter-spacing: -0.02em; }
        
        .drop-zone{
            border:2px dashed var(--border);border-radius:var(--radius);
            padding:3rem 2rem;text-align:center;color:var(--text-secondary);
            cursor:pointer;transition:all var(--transition);
            background: rgba(255, 255, 255, 0.02);
        }
        .drop-zone:hover,.drop-zone.dragover{
            border-color:var(--border-active);background:rgba(255,255,255,0.05);color:var(--text-primary);
        }
        
        .stats-grid{ display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:1.5rem; }
        .stat{ background:#000;padding:12px;border-radius:8px;border:1px solid var(--border); }
        .stat-label{ font-size:.75rem;color:var(--text-secondary);margin-bottom:4px;font-weight:500; }
        .stat-value{ font-size:1.1rem;font-weight:600;color:var(--text-primary);font-family:'JetBrains Mono',monospace; }
        
        .section-bar{ display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:1rem;background:var(--bg-primary); }
        .sec-bml{background:#3b82f6} .sec-bdt{background:#10b981} .sec-blb{background:#f59e0b} .sec-bib{background:#8b5cf6}
        .section-legend{ display:flex;gap:12px;font-size:.75rem;font-weight:600;justify-content:center;flex-wrap:wrap; }
        .legend-bml{color:#3b82f6} .legend-bdt{color:#10b981} .legend-blb{color:#f59e0b} .legend-bib{color:#8b5cf6}
        
        .html-input{
            width:100%;min-height:180px;background:#000;
            border:1px solid var(--border);border-radius:8px;
            color:var(--text-primary);padding:16px;
            font-family:'JetBrains Mono',monospace;font-size:.85rem;
            resize:vertical;margin-bottom:1rem;transition:border-color var(--transition);
        }
        .html-input:focus{ outline:none;border-color:var(--border-active); }
        
        .btn-row{ display:flex;gap:12px; }
        .btn{
            flex:1;padding:12px;border:none;border-radius:8px;
            font-weight:600;font-size:.9rem;cursor:pointer;
            transition:all var(--transition);display:flex;align-items:center;justify-content:center;gap:8px;
        }
        .btn-primary{ background:var(--text-primary);color:#000; }
        .btn-primary:hover{ transform:translateY(-2px);box-shadow:0 6px 20px rgba(255,255,255,0.15);opacity:0.9; }
        .btn-secondary{ background:transparent;color:var(--text-primary);border:1px solid var(--border); }
        .btn-secondary:hover{ background:var(--bg-hover);border-color:rgba(255,255,255,0.3); }
        
        .btn:disabled{ opacity:.5;cursor:not-allowed;transform:none;box-shadow:none; }
        
        .viewport-empty{
            height:500px;display:flex;align-items:center;justify-content:center;
            border:1px dashed var(--border);border-radius:var(--radius);
            color:var(--text-muted);font-size:.9rem;background:#000;
        }
        #renderCanvas{ width:100%;height:600px;background:#fff;border-radius:8px;border:1px solid var(--border); }
        
        .tree-view{
            font-family:'JetBrains Mono',monospace;font-size:.8rem;
            background:#000;padding:16px;border-radius:8px;border:1px solid var(--border);
            max-height:400px;overflow-y:auto;white-space:pre;color:var(--text-secondary);
        }
        .tree-view .tag{color:#f87171} .tree-view .id-ref{color:#38bdf8} .tree-view .depth{color:#a3a3a3}
        
        .attribution{ text-align:center;margin-top:4rem;color:var(--text-muted);font-size:.8rem; }
        .attribution a{ color:var(--text-primary);text-decoration:none; }
"""

    pattern = re.compile(r'<style>.*?</style>', re.DOTALL)
    match = pattern.search(content)
    if match:
        new_content = content[:match.start()] + f"<style>\n{new_css}\n    </style>" + content[match.end():]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        # Also copy to bml-prototype to keep them synced
        dev_path = '/home/benjamin/projects/bml-prototype/converter.html'
        try:
            with open(dev_path, 'w', encoding='utf-8') as f2:
                f2.write(new_content)
        except Exception:
            pass

except FileNotFoundError:
    pass
