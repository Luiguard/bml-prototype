import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Let's add wheel listener to globalEngine instantiation
start_str = "globalEngine.canvas.addEventListener('mousemove', (e) => {"
parts = content.split(start_str)

new_wheel = """        globalEngine.canvas.addEventListener('wheel', (e) => {
            const rect = globalEngine.canvas.getBoundingClientRect();
            const scaleX = globalEngine.canvas.width / rect.width;
            const scaleY = globalEngine.canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;
            
            let hitNode = globalEngine.hitTest(cx, cy);
            let scrolled = false;
            while(hitNode) {
                const s = globalEngine.blbMap[hitNode.id] || {};
                if (s[32] === 2 || s[32] === 3) { // scroll or auto
                    hitNode.layout.scrollY = (hitNode.layout.scrollY || 0) + e.deltaY;
                    if(hitNode.layout.scrollY < 0) hitNode.layout.scrollY = 0;
                    const maxScroll = Math.max(0, hitNode.layout.innerH - hitNode.layout.h);
                    if(hitNode.layout.scrollY > maxScroll) hitNode.layout.scrollY = maxScroll;
                    scrolled = true;
                    e.preventDefault();
                    break;
                }
                
                // traverse up BDT parents
                if(hitNode.parentIdx !== undefined && hitNode.parentIdx >= 0) {
                    // wait, hitNode in CanvasEngine doesn't have parent pointer by default, let's add it in update()
                    hitNode = hitNode.parent;
                } else {
                    hitNode = null;
                }
            }
            if(scrolled) globalEngine.draw();
        }, {passive: false});

        globalEngine.canvas.addEventListener('mousemove', (e) => {"""

content = parts[0] + new_wheel + parts[1]

# Make sure we add parent pointers in CanvasEngine update()
old_link = """        const linkTree = (node) => {
            if(!node) return;
            node.id = bdtIdx++;
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[] };
            for(const c of node.children) linkTree(c);
        };"""
new_link = """        const linkTree = (node, parentNode) => {
            if(!node) return;
            node.id = bdtIdx++;
            node.parent = parentNode;
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[], scrollY: 0 };
            for(const c of node.children) linkTree(c, node);
        };"""

content = content.replace(old_link, new_link)
content = content.replace("linkTree(this.root);", "linkTree(this.root, null);")

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Wheel listener and parent pointers added.")
