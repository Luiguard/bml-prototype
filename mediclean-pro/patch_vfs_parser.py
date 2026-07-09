import sys

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

old_parser = """            if (secType === 9) { // TOC
                sections[9] = chunk;
            } else if (secType === 1) {
                currentVfs = { bml: chunk };
            } else if (secType === 2 && currentVfs) {
                currentVfs.bdt = chunk;
            } else if (secType === 7 && currentVfs) {
                currentVfs.blb = chunk;
                sections.vfs.push(currentVfs);
                currentVfs = null;
            } else {"""

new_parser = """            if (secType === 9) { // TOC
                sections[9] = chunk;
            } else if (secType === 1) {
                currentVfs = { bml: chunk };
            } else if (secType === 2 && currentVfs) {
                currentVfs.bdt = chunk;
            } else if (secType === 7 && currentVfs) {
                currentVfs.blbDesktop = chunk;
            } else if (secType === 8 && currentVfs) {
                currentVfs.blbTablet = chunk;
            } else if (secType === 10 && currentVfs) {
                currentVfs.blbMobile = chunk;
                sections.vfs.push(currentVfs);
                currentVfs = null;
            } else {"""

content = content.replace(old_parser, new_parser)

old_loadPage = """    // 3. Parse BLB
    let blbBlocks = null;
    if(vfsData.blb){
        blbBlocks = parseBLB(vfsData.blb);
    }"""
new_loadPage = """    // 3. Parse BLBs
    let blbs = {};
    if(vfsData.blbDesktop) blbs.desktop = parseBLB(vfsData.blbDesktop);
    if(vfsData.blbTablet) blbs.tablet = parseBLB(vfsData.blbTablet);
    if(vfsData.blbMobile) blbs.mobile = parseBLB(vfsData.blbMobile);"""

content = content.replace(old_loadPage, new_loadPage)

old_update = """    if(bdtNodes && blbBlocks) {
        globalEngine.update(bdtNodes[0], bdtNodes, blbBlocks);
    }"""
new_update = """    if(bdtNodes && blbs.desktop) {
        globalEngine.update(bdtNodes[0], bdtNodes, blbs);
    }"""
content = content.replace(old_update, new_update)

old_canvas_update = """    update(rootVNode, bdtNodes, blbBlocks) {
        this.root = rootVNode;
        this.blbMap = {};
        for(const b of blbBlocks) this.blbMap[b.nid] = b.props;"""

new_canvas_update = """    update(rootVNode, bdtNodes, blbs) {
        this.root = rootVNode;
        this.blbs = blbs;
        this.blbMap = {};
        
        let activeBlocks = blbs.desktop;
        if(window.innerWidth <= 768 && blbs.tablet) activeBlocks = blbs.tablet;
        if(window.innerWidth <= 375 && blbs.mobile) activeBlocks = blbs.mobile;
        for(const b of activeBlocks) this.blbMap[b.nid] = b.props;
        """

content = content.replace(old_canvas_update, new_canvas_update)

old_resize = """        window.addEventListener('resize', () => {
            this.measureAndLayout();
            this.draw();
        });"""
new_resize = """        window.addEventListener('resize', () => {
            if (this.blbs) {
                let activeBlocks = this.blbs.desktop;
                if(window.innerWidth <= 768 && this.blbs.tablet) activeBlocks = this.blbs.tablet;
                if(window.innerWidth <= 375 && this.blbs.mobile) activeBlocks = this.blbs.mobile;
                this.blbMap = {};
                for(const b of activeBlocks) this.blbMap[b.nid] = b.props;
            }
            this.measureAndLayout();
            this.draw();
        });"""

content = content.replace(old_resize, new_resize)

with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: VFS Polyfill updated for multi-viewport.")
