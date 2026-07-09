import glob

html_files = glob.glob('/home/benjamin/projects/**/*.html', recursive=True)
exclude_dirs = ['node_modules', '.git', '__pycache__']

snippet_head = """<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5875560078954393" crossorigin="anonymous"></script>"""

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

    if "pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" not in content and "</head>" in content:
        content = content.replace("</head>", f"    {snippet_head}\n</head>", 1)
        modified = True

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Added AdSense to {file_path}")
    else:
        pass
        # print(f"Already present in {file_path}")
