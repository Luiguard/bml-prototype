import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add A11y layer creation to CanvasEngine constructor
old_constructor = """    constructor() {
        this.root = null;
        this.blbMap = {};
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.layoutHeight = 0;"""
new_constructor = """    constructor() {
        this.root = null;
        this.blbMap = {};
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.layoutHeight = 0;
        
        this.a11yLayer = document.createElement('div');
        this.a11yLayer.style.position = 'absolute';
        this.a11yLayer.style.top = '0';
        this.a11yLayer.style.left = '0';
        this.a11yLayer.style.width = '100%';
        this.a11yLayer.style.height = '100%';
        this.a11yLayer.style.pointerEvents = 'none';
        this.a11yLayer.style.overflow = 'hidden';
        this.a11yNodes = new Map();"""
content = content.replace(old_constructor, new_constructor)

# 2. Add layer to mount
old_mount = """    mount(container) {
        container.innerHTML = '';
        container.appendChild(this.canvas);
    }"""
new_mount = """    mount(container) {
        container.innerHTML = '';
        container.style.position = 'relative';
        container.appendChild(this.canvas);
        container.appendChild(this.a11yLayer);
    }"""
content = content.replace(old_mount, new_mount)

# 3. Build A11y Nodes in update
start_update = "    update(rootVNode, bdtNodes, blbs) {"
end_update = "        this.draw();\n    }"

parts = content.split(start_update)
pre_update = parts[0]
post_parts = parts[1].split(end_update)
post_update = end_update + end_update.join(post_parts[1:])

new_update = """    update(rootVNode, bdtNodes, blbs) {
        this.root = rootVNode;
        this.blbs = blbs;
        this.blbMap = {};
        
        let activeBlocks = blbs.desktop;
        if(window.innerWidth <= 768 && blbs.tablet) activeBlocks = blbs.tablet;
        if(window.innerWidth <= 375 && blbs.mobile) activeBlocks = blbs.mobile;
        for(const b of activeBlocks) this.blbMap[b.nid] = b.props;
        
        this.a11yLayer.innerHTML = '';
        this.a11yNodes.clear();

        let bdtIdx = 0;
        const linkTree = (node, parentNode) => {
            if(!node) return;
            node.id = bdtIdx++;
            node.parent = parentNode;
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[], scrollY: 0 };
            
            // Build A11y Node
            const el = findBMLElementForNode(node.id, currentBMLRoot);
            if (el && !node.isText) {
                let tagName = 'div';
                if (el.tag === 4) tagName = 'a';
                else if (el.tag === 22) tagName = 'input';
                else if (el.tag === 23) tagName = 'button';
                else if (el.tag === 24) tagName = 'textarea';
                else if (el.tag === 25) tagName = 'select';
                else if (el.tag === 5) tagName = 'h1';
                else if (el.tag === 6) tagName = 'h2';
                else if (el.tag >= 5 && el.tag <= 10) tagName = 'h' + (el.tag - 4);
                
                if (tagName !== 'div' || (el.attributes && el.attributes.length > 0)) {
                    const domNode = document.createElement(tagName);
                    domNode.style.position = 'absolute';
                    domNode.style.opacity = '0';
                    domNode.style.pointerEvents = (tagName==='a'||tagName==='input'||tagName==='button'||tagName==='textarea'||tagName==='select') ? 'auto' : 'none';
                    if (tagName === 'input') domNode.style.opacity = '0.01'; // Webkit bug with fully transparent inputs
                    
                    if (el.attributes) {
                        for(const a of el.attributes) {
                            if (a.id === 18) domNode.href = new TextDecoder().decode(a.val); // href
                            if (a.id === 21) domNode.type = new TextDecoder().decode(a.val); // type
                            if (a.id === 22) domNode.name = new TextDecoder().decode(a.val); // name
                            if (a.id === 24) domNode.placeholder = new TextDecoder().decode(a.val); // placeholder
                            if (a.id === 32) domNode.setAttribute('aria-label', new TextDecoder().decode(a.val)); // aria-label
                        }
                    }
                    this.a11yLayer.appendChild(domNode);
                    this.a11yNodes.set(node.id, domNode);
                }
            }
            
            for(const c of node.children) linkTree(c, node);
        };
        linkTree(this.root, null);
        
        this.measureAndLayout();
        this.draw();
    }"""
content = pre_update + new_update + post_parts[1]

# 4. Sync A11y nodes in draw()
old_draw = """    draw() {
        if(!this.root) return;
        const dpr = window.devicePixelRatio || 1;"""
new_draw = """    draw() {
        if(!this.root) return;
        const dpr = window.devicePixelRatio || 1;
        
        // Sync A11y DOM Overlay
        const syncA11y = (node, accX, accY) => {
            if(!node) return;
            const rx = node.layout.x - accX;
            const ry = node.layout.y - accY;
            const dom = this.a11yNodes.get(node.id);
            if (dom) {
                dom.style.left = rx + 'px';
                dom.style.top = ry + 'px';
                dom.style.width = node.layout.w + 'px';
                dom.style.height = node.layout.h + 'px';
            }
            const nScrollX = node.layout.scrollX || 0;
            const nScrollY = node.layout.scrollY || 0;
            for(const c of node.children) syncA11y(c, accX + nScrollX, accY + nScrollY);
        };
        syncA11y(this.root, 0, 0);
        """
content = content.replace(old_draw, new_draw)

# We also need to add Hover support
# In paintNode, check if node.isHovered, apply alternate background color maybe?
# The user said: "Hover als alternativer BLB-State/Palette"
# For now, we can just lighten/darken the background color if node.isHovered is true!
old_hover_paint = """        if(!node.isText) {
            if(s[17]) {
                this.ctx.fillStyle = rgba(s[17]);
                this.ctx.fillRect(rx, ry, rw, rh);
            }"""
new_hover_paint = """        if(!node.isText) {
            if(s[17]) {
                let color = s[17];
                if (node.isHovered) {
                    // Simple hover effect: alpha reduction or lighten
                    const r=(color>>>24)&0xFF,g=(color>>>16)&0xFF,b=(color>>>8)&0xFF,a=color&0xFF;
                    color = ((r+20)<<24) | ((g+20)<<16) | ((b+20)<<8) | a;
                }
                this.ctx.fillStyle = rgba(color);
                this.ctx.fillRect(rx, ry, rw, rh);
            }"""
content = content.replace(old_hover_paint, new_hover_paint)

# Add isHovered logic to mousemove
old_mousemove = """            if (hitNode) {
                const el = findBMLElementForNode(hitNode.id, currentBMLRoot);
                if (el && el.attributes) {
                    if (el.attributes.find(a => a.id === 18 || a.id === ATTR_FWD['href'])) isInteractive = true;
                }
            }
            globalEngine.canvas.style.cursor = isInteractive ? 'pointer' : 'default';"""
new_mousemove = """            let needsRedraw = false;
            const clearHover = (n) => {
                if(!n) return;
                if(n.isHovered) { n.isHovered = false; needsRedraw = true; }
                for(const c of n.children) clearHover(c);
            };
            clearHover(globalEngine.root);
            
            if (hitNode) {
                const el = findBMLElementForNode(hitNode.id, currentBMLRoot);
                if (el && el.attributes) {
                    if (el.attributes.find(a => a.id === 18 || a.id === ATTR_FWD['href'])) isInteractive = true;
                }
                hitNode.isHovered = true;
                needsRedraw = true;
            }
            globalEngine.canvas.style.cursor = isInteractive ? 'pointer' : 'default';
            if(needsRedraw) globalEngine.draw();"""
content = content.replace(old_mousemove, new_mousemove)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Accessibility Layer, Hover and Forms Overlay patched.")
