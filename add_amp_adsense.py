import glob
import os

html_files = glob.glob('/home/benjamin/projects/**/*.html', recursive=True)
exclude_dirs = ['node_modules', '.git', '__pycache__']

snippet_head = """<script async custom-element="amp-auto-ads" src="https://cdn.ampproject.org/v0/amp-auto-ads-0.1.js"></script>"""
snippet_body = """<amp-auto-ads type="adsense" data-ad-client="ca-pub-5875560078954393"></amp-auto-ads>"""

for file_path in html_files:
    skip = False
    for ex in exclude_dirs:
        if f'/{ex}/' in file_path:
            skip = True
            break
    if skip:
        continue

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    if "amp-auto-ads" not in content and "</head>" in content:
        content = content.replace("</head>", f"    {snippet_head}\n</head>", 1)
        modified = True

    if "type=\"adsense\" data-ad-client=\"ca-pub-5875560078954393\"" not in content and "<body" in content:
        # Find the end of the body tag
        body_start = content.find("<body")
        if body_start != -1:
            body_end = content.find(">", body_start)
            if body_end != -1:
                content = content[:body_end+1] + f"\n    {snippet_body}" + content[body_end+1:]
                modified = True

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Added AMP AdSense to {file_path}")
    else:
        print(f"Already present or tags missing in {file_path}")
