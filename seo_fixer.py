import os
import re

PROJECTS_DIR = "/home/benjamin/projects"
SITES = {
    "mediclean-pro": "https://mediclean-pro.at",
    "telemeet": "https://mediclean-pro.at/telemeet",
    "podcast-pro": "https://mediclean-pro.at/podcast-pro",
    "convertany": "https://mediclean-pro.at/convertany"
}

html_files = []
urls = []

for site_dir, base_url in SITES.items():
    site_path = os.path.join(PROJECTS_DIR, site_dir)
    if not os.path.exists(site_path):
        continue
    for root, _, files in os.walk(site_path):
        for file in files:
            if file.endswith(".html"):
                html_files.append((site_dir, base_url, os.path.join(root, file)))

for site_dir, base_url, filepath in html_files:
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    changed = False

    # Fix legacy/aura-shop.html links
    if "legacy/aura-shop.html" in content:
        content = content.replace("/legacy/aura-shop.html", "/aura-shop.html")
        content = content.replace("legacy/aura-shop.html", "aura-shop.html")
        changed = True

    # Build canonical URL
    rel_path = os.path.relpath(filepath, os.path.join(PROJECTS_DIR, site_dir))
    if rel_path == "index.html":
        canonical_url = f"{base_url}/"
    else:
        canonical_url = f"{base_url}/{rel_path.replace(os.sep, '/')}"
        
    urls.append(canonical_url)

    # Insert Canonical Tag if missing
    if 'rel="canonical"' not in content:
        # find </head> and insert before it
        canonical_tag = f'\n    <link rel="canonical" href="{canonical_url}">\n'
        content = re.sub(r'</head>', f'{canonical_tag}</head>', content, flags=re.IGNORECASE)
        changed = True
        
    # Insert Meta description if missing
    if 'name="description"' not in content and 'name=\'description\'' not in content:
        title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else "MediClean Pro"
        meta_tag = f'\n    <meta name="description" content="Offizielle Seite für {title}. Mehr erfahren auf MediClean Pro.">\n'
        content = re.sub(r'</head>', f'{meta_tag}</head>', content, flags=re.IGNORECASE)
        changed = True

    if changed:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
            
# Create sitemap.xml
sitemap_path = os.path.join(PROJECTS_DIR, "mediclean-pro", "sitemap.xml")
with open(sitemap_path, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for url in urls:
        if "portal" in url or "admin" in url:
            continue
        f.write('  <url>\n')
        f.write(f'    <loc>{url}</loc>\n')
        f.write('    <changefreq>weekly</changefreq>\n')
        f.write('    <priority>0.8</priority>\n')
        f.write('  </url>\n')
    f.write('</urlset>')

print(f"Processed {len(html_files)} HTML files. Sitemap generated at {sitemap_path}.")
