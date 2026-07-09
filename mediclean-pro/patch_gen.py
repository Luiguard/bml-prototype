import sys

filepath = 'bweb-converter/generate_polyfill.js'
with open(filepath, 'r') as f:
    content = f.read()

router_old = """                    targetUrl = baseParts.join('/');
                } else {
                    targetUrl = targetUrl.substring(1);
                }

                if (pagesMap[targetUrl]) {"""

router_new = """                    targetUrl = baseParts.join('/');
                } else {
                    targetUrl = targetUrl.substring(1);
                }
                if (targetUrl.endsWith('/')) targetUrl = targetUrl.substring(0, targetUrl.length - 1);
                if (targetUrl === '') targetUrl = 'index.html';

                if (pagesMap[targetUrl]) {"""

content = content.replace(router_old, router_new)

with open(filepath, 'w') as f:
    f.write(content)
