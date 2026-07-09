import re
with open('bweb-converter/converter.html', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("    }\n}\n}\n\nfunction applyBLB(rootEl, blocks)", "    }\n}\n\nfunction applyBLB(rootEl, blocks)")

with open('bweb-converter/converter.html', 'w', encoding='utf-8') as f:
    f.write(c)

