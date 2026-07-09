import os
import glob

html_files = glob.glob('/home/benjamin/projects/mediclean-pro/**/*.html', recursive=True) + glob.glob('/home/benjamin/projects/convertany/**/*.html', recursive=True)

snippet = """    <meta name="google-adsense-account" content="ca-pub-5875560078954393">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5875560078954393" crossorigin="anonymous"></script>
"""

for file_path in html_files:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "google-adsense-account" not in content:
        content = content.replace("</head>", f"{snippet}</head>")
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Added to {file_path}")
    else:
        print(f"Already present in {file_path}")
