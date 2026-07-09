import os
import re

PROJECTS_DIR = "/home/benjamin/projects"
SITES = ["mediclean-pro", "telemeet", "podcast-pro", "convertany"]

# Pages where it doesn't make sense to show ads/funding choices
EXCLUDE_PAGES = [
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

def is_excluded(filepath):
    for ex in EXCLUDE_PAGES:
        if ex in filepath:
            return True
    return False

html_files = []

for site_dir in SITES:
    site_path = os.path.join(PROJECTS_DIR, site_dir)
    if not os.path.exists(site_path):
        continue
    for root, _, files in os.walk(site_path):
        for file in files:
            if file.endswith(".html"):
                html_files.append(os.path.join(root, file))

funding_script = """
    <!-- Google Funding Choices -->
    <script async src="https://fundingchoicesmessages.google.com/i/pub-5875560078954393?ers=1"></script>
    <script>(function() {function signalGooglefcPresent() {if (!window.frames['googlefcPresent']) {if (document.body) {const iframe = document.createElement('iframe'); iframe.style = 'width: 0; height: 0; border: none; z-index: -1000; left: -1000px; top: -1000px;'; iframe.style.display = 'none'; iframe.name = 'googlefcPresent'; document.body.appendChild(iframe);} else {setTimeout(signalGooglefcPresent, 0);}}}signalGooglefcPresent();})();</script>
"""

count = 0
for filepath in html_files:
    if is_excluded(filepath):
        continue

    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Avoid duplicate injection
    if "fundingchoicesmessages.google.com" not in content:
        # Insert right before </head>
        content = re.sub(r'</head>', f'{funding_script}</head>', content, flags=re.IGNORECASE)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        count += 1
        print(f"Added to {filepath}")
    else:
        print(f"Already present in {filepath}")

print(f"Successfully injected Google Funding Choices script into {count} files.")
