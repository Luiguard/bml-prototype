import re

bweb_css = """
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --bg: #000000;
            --surface: #0a0a0a;
            --border: rgba(255, 255, 255, 0.1);
            --text-main: #ffffff;
            --text-muted: #8a8f98;
            --accent: #ffffff;
            --radius: 12px;
            --transition: 0.2s ease;
        }
        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text-main);
            line-height: 1.6;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
            letter-spacing: -0.02em;
        }

        /* Subtle Ambient Glow */
        .ambient {
            position: fixed; inset: 0; z-index: -1; pointer-events: none;
            background: radial-gradient(circle 800px at 50% -20%, rgba(255, 255, 255, 0.05), transparent 80%);
        }

        /* Navigation */
        nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem 5%;
            border-bottom: 1px solid var(--border);
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(12px);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .logo { font-weight: 700; font-size: 1.2rem; letter-spacing: -0.04em; color: var(--text-main); }
        .nav-links a {
            color: var(--text-muted); text-decoration: none; margin-left: 2rem; font-size: 0.9rem; transition: color 0.2s; font-weight: 500;
        }
        .nav-links a:hover { color: var(--text-main); }

        /* Hero */
        header { padding: 8rem 5% 6rem; text-align: center; max-width: 900px; margin: 0 auto; }
        h1 {
            font-size: clamp(3rem, 8vw, 5.5rem);
            line-height: 1.05;
            margin-bottom: 1.5rem;
            letter-spacing: -0.04em;
            font-weight: 600;
            background: linear-gradient(180deg, #fff 0%, #a1a1aa 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle { font-size: 1.25rem; color: var(--text-muted); margin-bottom: 3rem; max-width: 600px; margin-left: auto; margin-right: auto; line-height: 1.5; font-weight: 400; }
        
        .cta-group { display: flex; gap: 16px; justify-content: center; }
        .btn {
            display: inline-block; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 500; font-size: 0.95rem; transition: all 0.2s;
        }
        .btn-primary { background: var(--text-main); color: #000; box-shadow: 0 4px 14px rgba(255,255,255,0.1); }
        .btn-primary:hover { transform: scale(1.02); background: #f0f0f0; }
        .btn-secondary { background: transparent; color: var(--text-main); border: 1px solid var(--border); }
        .btn-secondary:hover { background: var(--surface); border-color: rgba(255,255,255,0.2); }

        /* Features */
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; padding: 0 5% 6rem; max-width: 1200px; margin: 0 auto; }
        .feature-card {
            background: var(--surface); border: 1px solid var(--border); padding: 40px 32px; border-radius: var(--radius); transition: all 0.2s;
        }
        .feature-card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.8); }
        .feature-card h3 { font-size: 1.1rem; margin-bottom: 12px; font-weight: 600; letter-spacing: -0.02em; }
        .feature-card p { font-size: 0.95rem; color: var(--text-muted); }

        /* Tech Section */
        .tech-section { padding: 4rem 5%; text-align: center; border-top: 1px solid var(--border); }
        .tech-section h2 { font-size: 2.5rem; margin-bottom: 2rem; letter-spacing: -0.04em; }
        .tech-code {
            background: #000; border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #a1a1aa; max-width: 600px; margin: 0 auto; text-align: left;
        }
        .tech-code .highlight { color: #fff; }
"""

files_to_update = [
    '/home/benjamin/projects/bml-prototype/index.html',
    '/home/benjamin/projects/mediclean-pro/bweb-converter/index.html'
]

pattern = re.compile(r'<style>.*?</style>', re.DOTALL)

for filepath in files_to_update:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        match = pattern.search(content)
        if match:
            new_style_block = f"<style>\n{bweb_css}\n    </style>"
            new_content = content[:match.start()] + new_style_block + content[match.end():]
            
            # ensure body has ambient div
            if '<div class="ambient"></div>' not in new_content:
                new_content = new_content.replace('<body>', '<body>\n    <div class="ambient"></div>')
                
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
    except FileNotFoundError:
        pass

