with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

old_width_height = """                blbView.setUint16(off+5,cssV(s.width));
                blbView.setUint16(off+7,cssV(s.height));"""

new_width_height = """                const isMedia = ['img','video','canvas','svg','iframe'].includes(n.tagName.toLowerCase());
                blbView.setUint16(off+5, isMedia ? cssV(s.width) : 0xFFFF);
                blbView.setUint16(off+7, isMedia ? cssV(s.height) : 0xFFFF);"""

if old_width_height in content:
    content = content.replace(old_width_height, new_width_height)
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: Width/Height capturing patched.")
else:
    print("FAILED: Old width/height logic not found.")
