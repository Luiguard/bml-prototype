import os
import re

PROJECTS_DIR = "/home/benjamin/projects"
SITES = {
    "mediclean-pro": "https://mediclean-pro.at",
    "telemeet": "https://mediclean-pro.at/telemeet",
    "podcast-pro": "https://mediclean-pro.at/podcast-pro",
    "convertany": "https://mediclean-pro.at/convertany"
}

# Pages that should NEVER be indexed by search engines
NOINDEX_PAGES = [
    "login.html",
    "customer_login.html",
    "customer_register.html",
    "host.html",
    "session.html",
    "portal",
    "admin",
    "omnia-vault",
    "dashboard.html"
]

def is_noindex(filepath):
    for no_idx in NOINDEX_PAGES:
        if no_idx in filepath:
            return True
    return False

html_files = []
urls_for_sitemap = []

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

    # 1. Build Canonical URL
    rel_path = os.path.relpath(filepath, os.path.join(PROJECTS_DIR, site_dir))
    if rel_path == "index.html":
        canonical_url = f"{base_url}/"
    else:
        canonical_url = f"{base_url}/{rel_path.replace(os.sep, '/')}"

    # 2. Determine Indexing Status
    should_index = not is_noindex(filepath)
    robots_content = "index, follow" if should_index else "noindex, nofollow"

    if should_index:
        urls_for_sitemap.append((canonical_url, rel_path))

    # 3. Clean existing SEO tags to prevent duplicates
    content = re.sub(r'<link[^>]*rel=["\']canonical["\'][^>]*>\n?', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<meta[^>]*name=["\']robots["\'][^>]*>\n?', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<meta[^>]*name=["\']description["\'][^>]*>\n?', '', content, flags=re.IGNORECASE)

    # 4. Extract or Default Title
    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "MediClean Pro"
    
    # 5. Build New SEO Block
    seo_block = f"""
    <!-- Bulletproof SEO Tags -->
    <link rel="canonical" href="{canonical_url}">
    <meta name="robots" content="{robots_content}">
    <meta name="description" content="Offizielle Seite: {title}. Erfahren Sie mehr auf {base_url}.">
    <meta property="og:title" content="{title}">
    <meta property="og:url" content="{canonical_url}">
    <meta property="og:type" content="website">
    """
    
    # Insert before </head>
    if '</head>' in content:
        content = re.sub(r'</head>', f'{seo_block}</head>', content, flags=re.IGNORECASE)
        changed = True

    # Ensure lang="de" on html tag
    if '<html' in content and 'lang=' not in content:
        content = re.sub(r'<html', '<html lang="de"', content, count=1, flags=re.IGNORECASE)
        changed = True
    elif '<html ' in content:
        # replace existing lang if any, or just ensure it's de
        content = re.sub(r'<html([^>]*)lang=["\'][^"\']*["\']', r'<html\1lang="de"', content, count=1, flags=re.IGNORECASE)
        changed = True

    if changed:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

# 6. Generate Bulletproof Sitemap.xml
sitemap_path = os.path.join(PROJECTS_DIR, "mediclean-pro", "sitemap.xml")
with open(sitemap_path, "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for url, rel_path in urls_for_sitemap:
        priority = "1.0" if rel_path == "index.html" else "0.8"
        f.write('  <url>\n')
        f.write(f'    <loc>{url}</loc>\n')
        f.write('    <changefreq>weekly</changefreq>\n')
        f.write(f'    <priority>{priority}</priority>\n')
        f.write('  </url>\n')
    f.write('</urlset>')

print(f"Processed {len(html_files)} HTML files. Bulletproof Sitemap generated with {len(urls_for_sitemap)} indexed URLs.")
