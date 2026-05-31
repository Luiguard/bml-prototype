import re

with open('/home/benjamin/projects/bml-prototype/chrome-extension/content.js', 'r', encoding='utf-8') as f:
    c = f.read()

# First, let's restore content.js and polyfill.html from git to have a clean state!
import subprocess
subprocess.run(['git', 'checkout', '/home/benjamin/projects/bml-prototype/chrome-extension/content.js'])
subprocess.run(['git', 'checkout', '/home/benjamin/projects/mediclean-pro/bweb-converter/polyfill.html'])
print("Restored original files.")
