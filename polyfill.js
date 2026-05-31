
const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'iframe',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFD:'#text',0xFD:'#text',0xFE:'div',0xFF:'div'};
const TAG_FWD={};
for(const[k,v]of Object.entries(TAG_REV))TAG_FWD[v]=parseInt(k);
const ATTR_REV={0x10:'class',0x11:'id',0x12:'href',0x13:'src',0x14:'style',0x15:'type',0x16:'name',0x17:'value',0x18:'placeholder',0x19:'alt',0x1A:'title',0x1B:'action',0x1C:'method',0x1D:'target',0x1E:'rel',0x1F:'role',0x20:'aria-label',0x21:'data-bind',0x22:'onclick',0x23:'onsubmit',0x24:'width',0x25:'height',0x26:'disabled',0x27:'checked',0x28:'selected',0x29:'required',0x2A:'autofocus',0x2B:'autocomplete',0x2C:'min',0x2D:'max',0x2E:'step',0x2F:'pattern',0x30:'for',0x31:'tabindex',0x32:'content',0x33:'charset',0x34:'http-equiv',0x35:'lang',0x36:'dir',0x37:'hidden'};
const ATTR_FWD={};
for(const[k,v]of Object.entries(ATTR_REV))ATTR_FWD[v]=parseInt(k);
const DISPLAY=['block','inline','flex','grid','none','inline-block','inline-flex','list-item','table','table-row','table-cell','inline-grid'];
const POSITION=['static','relative','absolute','fixed','sticky'];
const TEXT_ALIGN=['left','center','right','justify'];
const FLEX_DIR=['row','column','row-reverse','column-reverse'];
const JUSTIFY=['flex-start','flex-end','center','space-between','space-around','space-evenly'];
const ALIGN_ITEMS=['flex-start','flex-end','center','stretch','baseline'];
const OVERFLOW=['visible','hidden','scroll','auto'];
const BLB_BLOCK_SIZE=60;

const DANGEROUS_TAGS = new Set(['script','iframe','object','embed','applet','meta','link','base']);
const DANGEROUS_ATTRS = new Set(['onclick','onsubmit','onload','onerror','onmouseover','onfocus','onblur','onchange','oninput','onkeydown','onkeyup','onkeypress','formaction','xlink:href','srcdoc','data']);
const MAX_RECURSION_DEPTH = 256;


class BMLParser{
    constructor(buf,offset=0){this.v=new DataView(buf);this.d=new TextDecoder('utf-8');this.o=offset}
    parse(){return this.parseNode(0)}
    parseNode(depth=0){
        if(depth>MAX_RECURSION_DEPTH)return null;
        if(this.o+6>this.v.byteLength)return null;
        const tag=this.v.getUint8(this.o++);
        const nAttr=this.v.getUint8(this.o++);
        const nChild=this.v.getUint16(this.o);this.o+=2;
        const tLen=this.v.getUint16(this.o);this.o+=2;
        const tagName=TAG_REV[tag]||'div';
        if(DANGEROUS_TAGS.has(tagName)){
            for(let i=0;i<nAttr;i++){
                if(this.o+3>this.v.byteLength)return null;
                this.o++;
                const aLen=this.v.getUint16(this.o);this.o+=2;
                if(this.o+aLen>this.v.byteLength)return null;
                this.o+=aLen;
            }
            if(tLen>0){if(this.o+tLen>this.v.byteLength)return null;this.o+=tLen;}
            for(let i=0;i<nChild;i++){this.parseNode(depth+1);}
            return null;
        }
        let el = {
            tag: tag,
            tagName: tagName,
            attrs: {},
            attributes: [],
            children: [],
            text: '',
            isText: tagName === '#text'
        };
        for(let i=0;i<nAttr;i++){
            if(this.o+3>this.v.byteLength)break;
            const aId=this.v.getUint8(this.o++);
            const aLen=this.v.getUint16(this.o);this.o+=2;
            if(this.o+aLen>this.v.byteLength)break;
            const rawBytes=new Uint8Array(this.v.buffer,this.o,aLen);
            el.attributes.push({id:aId,val:new Uint8Array(rawBytes)});
            const aVal=this.d.decode(rawBytes);this.o+=aLen;
            const aName=ATTR_REV[aId];
            if(!aName||aName==='style'||DANGEROUS_ATTRS.has(aName))continue;
            if((aName==='href'||aName==='src'||aName==='action')&&/^\s*javascript:/i.test(aVal))continue;
            el.attrs[aName] = aVal;
        }
        if(tLen>0){
            if(this.o+tLen>this.v.byteLength){return el;}
            const txt=this.d.decode(new Uint8Array(this.v.buffer,this.o,tLen));this.o+=tLen;
            el.text=txt;
        }
        for(let i=0;i<nChild;i++){const c=this.parseNode(depth+1);if(c)el.children.push(c)}
        return el;
    }
}
class BDTParser{
    constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
    parse(){
        const count=this.v.getUint32(this.o);this.o+=4;
        const nodes=[];
        for(let i=0;i<count;i++){
            const nid=this.v.getUint16(this.o);this.o+=2;
            const pid=this.v.getUint16(this.o);this.o+=2;
            const fc=this.v.getUint16(this.o);this.o+=2;
            const ns=this.v.getUint16(this.o);this.o+=2;
            const lc=this.v.getUint16(this.o);this.o+=2;
            const ps=this.v.getUint16(this.o);this.o+=2;
            const nt=this.v.getUint8(this.o++);
            const tt=this.v.getUint8(this.o++);
            const depth=this.v.getUint8(this.o++);
            this.o++; // padding
            nodes.push({id:nid,parent:pid,firstChild:fc,nextSibling:ns,lastChild:lc,previousSibling:ps,type:nt,tag:tt,depth});
        }
        return nodes;
    }
}
class BLBParser{
    constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
    parse(){
        const count=this.v.getUint32(this.o);this.o+=4;
        const blocks=[];
        for(let i=0;i<count;i++){
            const nid=this.v.getUint16(this.o);this.o+=2;
            const propCount=this.v.getUint8(this.o++);
            
            const b = { nid, props: {} };
            
            for(let p=0; p<propCount; p++){
                const tag=this.v.getUint8(this.o++);
                const type=this.v.getUint8(this.o++);
                
                let val = null;
                if(type === 0) { // Dimension
                    const u = this.v.getUint8(this.o++);
                    const v = this.v.getInt32(this.o); this.o+=4;
                    val = {u, v};
                } else if(type === 1) { // Enum / Int16 (Wait! I wrote flex properties as type=1 but len=2! Let me read by type properly)
                    // Let's rely on tag to know the size!
                    // Tag 21, 27, 28, 44 are uint16/int16
                    if(tag===21 || tag===27 || tag===28 || tag===44) {
                        val = tag===44 ? this.v.getInt16(this.o) : this.v.getUint16(this.o); this.o+=2;
                    } else {
                        val = this.v.getUint8(this.o++);
                    }
                } else if(type === 2) { // Color
                    val = this.v.getUint32(this.o); this.o+=4;
                } else if(type === 3) { // String
                    const sLen = this.v.getUint32(this.o); this.o += 4;
                    val = new TextDecoder().decode(new Uint8Array(this.v.buffer, this.o + this.v.byteOffset, sLen));
                    this.o += sLen;
                }
                b.props[tag] = val;
            }
            blocks.push(b);
        }
        return blocks;
    }
}

function parseBLB(buf) {
    const p = new BLBParser(buf);
    return p.parse();
}

function parseBDT(buf) {
    const u8 = new Uint8Array(buf);
    let off = 0;
    if(u8[0]===0x42 && u8[1]===0x44 && u8[2]===0x54) off = 4;
    const p = new BDTParser(buf, off);
    return p.parse();
}

let cachedBMLRoot = null;
let cachedFlatBML = [];
function findBMLElementForNode(id, el) {
    if(!el) return null;
    if(el!==cachedBMLRoot){
        cachedBMLRoot=el;
        cachedFlatBML=[];
        const flatten=(n)=>{
            if(!n.isText) cachedFlatBML.push(n);
            if(n.children) for(const ch of n.children) flatten(ch);
        };
        flatten(el);
    }
    return cachedFlatBML[id]||null;
}
class CanvasEngine {
    constructor() {
        this.root = null;
        this.blbMap = {};
        this.assets = window.bwebAssets || {};
        window.bwebAssets = this.assets;
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
        this.a11yNodes = new Map();
        
        window.addEventListener('resize', () => {
            if (this.blbs) {
                let activeBlocks = this.blbs.desktop;
                if(window.innerWidth <= 768 && this.blbs.tablet) activeBlocks = this.blbs.tablet;
                if(window.innerWidth <= 375 && this.blbs.mobile) activeBlocks = this.blbs.mobile;
                this.blbMap = {};
                for(const b of activeBlocks) this.blbMap[b.nid] = b.props;
            }
            this.measureAndLayout();
            this.draw();
        });
        window.addEventListener('scroll', () => {
            this.draw();
        });
    }

    update(rootVNode, bdtNodes, blbs) {
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
            node.parent = parentNode;
            if(!node.isText) { node.id = bdtIdx++; } else { node.id = -1; }
            node.layout = { x:0, y:0, w:0, h:0, innerW:0, innerH:0, lines:[], scrollY: 0 };
            
            // Build A11y Node
            const el = (node.id >= 0) ? findBMLElementForNode(node.id, this.root) : null;
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
    }

    mount(container) {
        if(container.tagName === 'CANVAS') {
            const div = document.createElement('div');
            div.id = container.id;
            div.className = container.className;
            div.style.cssText = container.style.cssText;
            container.parentNode.replaceChild(div, container);
            container = div;
        }
        container.innerHTML = '';
        container.style.position = 'relative';
        container.appendChild(this.canvas);
        container.appendChild(this.a11yLayer);
    }
    
    getVal(val, parentSize) {
        if(!val) return 0;
        if(val.u === 0) return val.v / 10;
        if(val.u === 1) return (val.v / 1000) * parentSize;
        if(val.u === 2) return (val.v / 1000) * window.innerWidth;
        if(val.u === 3) return (val.v / 1000) * window.innerHeight;
        return 0;
    }

    measureNode(node, parentW) {
        if(!node) return;
        const s = node.isText ? (this.blbMap[node.parent?.id] || {}) : (this.blbMap[node.id] || {});
        if(!node.isText && s[5] === 4) { node.layout.w=0; node.layout.h=0; return; }
        
        node.layout.mt = this.getVal(s[8], parentW);
        node.layout.mr = this.getVal(s[9], parentW);
        node.layout.mb = this.getVal(s[10], parentW);
        node.layout.ml = this.getVal(s[11], parentW);
        
        node.layout.pt = this.getVal(s[12], parentW);
        node.layout.pr = this.getVal(s[13], parentW);
        node.layout.pb = this.getVal(s[14], parentW);
        node.layout.pl = this.getVal(s[15], parentW);
        
        node.layout.position = s[6] || 0;

        if (s[46] && s[46].u !== 4) node.layout.x = this.getVal(s[46], 0);
        if (s[47] && s[47].u !== 4) node.layout.y = this.getVal(s[47], 0);
        if (s[48] && s[48].u !== 4) node.layout.w = this.getVal(s[48], 0);
        if (s[49] && s[49].u !== 4) node.layout.h = this.getVal(s[49], 0);

        if (node.isText) {
            const text = node.text.trim();
            if(!text) { node.layout.w = 0; node.layout.h = 0; return; }
            
            const fs = s[19] && s[19].u !== 4 ? this.getVal(s[19], parentW) : 16;
            const fw = s[21] ? s[21] : 400;
            const ff = s[33] ? s[33] : "sans-serif";
            
            this.ctx.font = `${fw} ${fs}px ${ff}`;
            
            const words = text.split(/[ \t\n]+/);
            let lines = [];
            let currentLine = words[0];
            let maxW = 0;
            
            const availInnerW = parentW;
            
            for(let i=1; i<words.length; i++) {
                const w = words[i];
                const width = this.ctx.measureText(currentLine + " " + w).width;
                if(width < availInnerW) {
                    currentLine += " " + w;
                } else {
                    lines.push(currentLine);
                    maxW = Math.max(maxW, this.ctx.measureText(currentLine).width);
                    currentLine = w;
                }
            }
            lines.push(currentLine);
            maxW = Math.max(maxW, this.ctx.measureText(currentLine).width);
            
            node.layout.lines = lines;
            node.layout.innerW = maxW;
            const lh = s[20] && s[20].u !== 4 ? this.getVal(s[20], parentW) : (fs * 1.2);
            node.layout.innerH = lines.length * lh;
            node.layout.fs = fs;
            node.layout.lh = lh;
            
            node.layout.w = maxW;
            node.layout.h = node.layout.innerH;
            return;
        }
        
        node.layout.innerW = Math.max(0, node.layout.w - node.layout.pl - node.layout.pr);
        node.layout.innerH = Math.max(0, node.layout.h - node.layout.pt - node.layout.pb);

        for(let i=0; i<node.children.length; i++) {
            this.measureNode(node.children[i], node.layout.innerW);
        }
    }

    paintNode(node, accX = 0, accY = 0) {
        if(!node) return;
        const s = node.isText ? (this.blbMap[node.parent?.id] || {}) : (this.blbMap[node.id] || {});
        if(!node.isText && s[5] === 4) return; // display: none
        if(s[45] === 1) return; // visibility: hidden
        
        let rx = node.layout.x;
        let ry = node.layout.y;
        let rw = node.layout.w;
        let rh = node.layout.h;
        
        let clipped = false;
        if(s[32] === 1 || s[32] === 2) { // hidden or scroll
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.rect(rx, ry, rw, rh);
            this.ctx.clip();
            clipped = true;
        }

        if(!node.isText) {
            const br = s[31] ? this.getVal(s[31], rw) : 0;
            const hasOpacity = s[34] !== undefined && s[34] < 255;
            if(hasOpacity) { this.ctx.save(); this.ctx.globalAlpha = s[34]/255; }
            if(s[17]) {
                let color = s[17];
                if (node.isHovered) {
                    const cr=(color>>>24)&0xFF,cg=(color>>>16)&0xFF,cb=(color>>>8)&0xFF,ca=color&0xFF;
                    color = ((Math.min(255,cr+20))<<24) | ((Math.min(255,cg+20))<<16) | ((Math.min(255,cb+20))<<8) | ca;
                }
                this.ctx.fillStyle = rgba(color);
                
                if(s[36]) { // box-shadow
                    const shadowMatch = s[36].match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+)\s+([\d.-]+)px\s+([\d.-]+)px\s+([\d.-]+)px(?:\s+([\d.-]+)px)?/);
                    if(shadowMatch) {
                        this.ctx.shadowColor = shadowMatch[1];
                        this.ctx.shadowOffsetX = parseFloat(shadowMatch[2]);
                        this.ctx.shadowOffsetY = parseFloat(shadowMatch[3]);
                        this.ctx.shadowBlur = parseFloat(shadowMatch[4]);
                    }
                }
                
                if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.fill(); }
                else { this.ctx.fillRect(rx, ry, rw, rh); }
                
                if(s[36]) { this.ctx.shadowColor = 'transparent'; this.ctx.shadowBlur = 0; this.ctx.shadowOffsetX = 0; this.ctx.shadowOffsetY = 0; }
            }
            
            if(s[37] && s[37].includes('linear-gradient')) {
                const gradStr = s[37];
                let match = gradStr.match(/linear-gradient\(((?:[^)(]+|\([^)(]*\))*)\)/);
                if(!match) match = gradStr.match(/linear-gradient\((.*)\)/);
                if(match) {
                    let argsStr = match[1].trim();
                    let dirStr = 'to bottom';
                    let stopsStr = argsStr;
                    const dirMatch = argsStr.match(/^(to [a-z ]+|[\d.]+deg),\s*(.*)$/);
                    if(dirMatch) {
                        dirStr = dirMatch[1];
                        stopsStr = dirMatch[2];
                    }
                    let y1=ry, y0=ry, x0=rx, x1=rx;
                    if(dirStr==='to bottom') { y1=ry+rh; }
                    else if(dirStr==='to right') { x1=rx+rw; }
                    else if(dirStr.includes('deg')) {
                        const deg=parseFloat(dirStr);
                        if(deg===180) y1=ry+rh;
                        else if(deg===90) x1=rx+rw;
                        else if(deg===0) { y1=ry; y0=ry+rh; }
                    } else { y1=ry+rh; }
                    
                    const grad = this.ctx.createLinearGradient(x0, y0, x1, y1);
                    const stopParts = stopsStr.split(/,(?![^(]*\))/);
                    for(let i=0; i<stopParts.length; i++) {
                        const pt = stopParts[i].trim();
                        const colMatch = pt.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]+|\w+)\s*(\d+%|\d+px)?/);
                        if(colMatch) {
                            const cStr = colMatch[1];
                            let pos = i / (Math.max(1, stopParts.length - 1));
                            if(colMatch[2] && colMatch[2].includes('%')) pos = parseFloat(colMatch[2])/100;
                            grad.addColorStop(Math.min(1, Math.max(0, pos)), cStr);
                        }
                    }
                    this.ctx.fillStyle = grad;
                    if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.fill(); }
                    else { this.ctx.fillRect(rx, ry, rw, rh); }
                }
            }
            
            if(s[37] && s[37].includes('url(')) {
                const urlMatch = s[37].match(/url\(["']?([^"')]+)["']?\)/);
                if(urlMatch) {
                    const bgUrl = urlMatch[1];
                    const cacheKey = bgUrl.substring(0, 200);
                    if(!this._bgCache) this._bgCache = {};
                    if(this._bgCache[cacheKey] === undefined) {
                        this._bgCache[cacheKey] = null;
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = () => {
                            this._bgCache[cacheKey] = img;
                            this.draw();
                        };
                        img.onerror = () => { this._bgCache[cacheKey] = false; };
                        img.src = bgUrl;
                    } else if(this._bgCache[cacheKey]) {
                        const bgImg = this._bgCache[cacheKey];
                        this.ctx.save();
                        if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.clip(); }
                        else { this.ctx.beginPath(); this.ctx.rect(rx, ry, rw, rh); this.ctx.clip(); }
                        const scale = Math.max(rw / bgImg.width, rh / bgImg.height);
                        const dw = bgImg.width * scale;
                        const dh = bgImg.height * scale;
                        this.ctx.drawImage(bgImg, rx + (rw-dw)/2, ry + (rh-dh)/2, dw, dh);
                        this.ctx.restore();
                    }
                }
            }
            
            const el = findBMLElementForNode(node.id, this.root);
            if (el && (el.tag === 11 || el.tag === 43 || el.tag === 41)) {
                let srcAttr = null;
                if(el.attributes) srcAttr = el.attributes.find(a => a.id === 19 || a.id === 33);
                if (srcAttr) {
                    const srcStr = new TextDecoder().decode(srcAttr.val);
                    let isBib = srcStr.startsWith('bib://');
                    let isBvd = srcStr.startsWith('bvd://');
                    
                    if (isBib || isBvd) {
                        const assetId = parseInt(srcStr.split('://')[1], 10);
                        const cacheKey = srcStr;
                        if (this.assets[cacheKey] === undefined) {
                            this.assets[cacheKey] = { status: 'loading' };
                            const ext = isBib ? '.bib' : '.bvd';
                            fetch(`assets/${assetId}${ext}`).then(res => {
                                if(!res.ok) throw new Error('Asset not found');
                                return res.arrayBuffer();
                            }).then(async buf => {
                                if (isBib) {
                                    const parsed = parseBIB(buf);
                                    if (parsed[assetId]) {
                                        const img = parsed[assetId];
                                        const mime = img.comp === 1 ? 'image/png' : img.comp === 2 ? 'image/jpeg' : img.comp === 3 ? 'image/webp' : 'application/octet-stream';
                                        const blob = new Blob([img.data], { type: mime });
                                        this.assets[cacheKey].bitmap = await createImageBitmap(blob);
                                    }
                                } else {
                                    const view = new DataView(buf);
                                    if (view.getUint8(0) === 0x42 && view.getUint8(1) === 0x56 && view.getUint8(2) === 0x44) {
                                        const pLen = view.getUint32(8);
                                        const payload = new Uint8Array(buf, 12, pLen);
                                        // Attempting to deduce mime or default to mp4
                                        const blob = new Blob([payload], { type: 'video/mp4' });
                                        const videoEl = document.createElement('video');
                                        videoEl.src = URL.createObjectURL(blob);
                                        videoEl.muted = true;
                                        videoEl.loop = true;
                                        videoEl.playsInline = true;
                                        videoEl.play().catch(e => {});
                                        this.assets[cacheKey].videoEl = videoEl;
                                        
                                        const drawVideo = () => {
                                            if (this.assets[cacheKey].videoEl && !this.assets[cacheKey].videoEl.paused) {
                                                this.draw();
                                                requestAnimationFrame(drawVideo);
                                            }
                                        };
                                        videoEl.addEventListener('play', drawVideo);
                                    }
                                }
                                this.assets[cacheKey].status = 'loaded';
                                this.draw();
                            }).catch(err => {
                                this.assets[cacheKey].status = 'error';
                            });
                        } else if (this.assets[cacheKey].status === 'loaded') {
                            if (isBib && this.assets[cacheKey].bitmap) {
                                this.ctx.drawImage(this.assets[cacheKey].bitmap, rx + node.layout.pl, ry + node.layout.pt, rw - node.layout.pl - node.layout.pr, rh - node.layout.pt - node.layout.pb);
                            } else if (isBvd && this.assets[cacheKey].videoEl) {
                                this.ctx.drawImage(this.assets[cacheKey].videoEl, rx + node.layout.pl, ry + node.layout.pt, rw - node.layout.pl - node.layout.pr, rh - node.layout.pt - node.layout.pb);
                            }
                        } else if (this.assets[cacheKey].status === 'loading') {
                            this.ctx.fillStyle = 'rgba(0,0,0,0.05)';
                            this.ctx.fillRect(rx + node.layout.pl, ry + node.layout.pt, rw - node.layout.pl - node.layout.pr, rh - node.layout.pt - node.layout.pb);
                        }
                    }
                }
            }
            
            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                if(br > 0 && this.ctx.roundRect) { this.ctx.beginPath(); this.ctx.roundRect(rx, ry, rw, rh, br); this.ctx.stroke(); }
                else { this.ctx.strokeRect(rx, ry, rw, rh); }
            }
            if(hasOpacity) this.ctx.restore();
        } else {
            if(node.layout.lines && node.layout.lines.length > 0) {
                const ff = s[33] || 'sans-serif';
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px ${ff}`;
                this.ctx.textBaseline = "top";
                const ta = s[22] || 0;
                let lY = ry;
                if(s[39] && s[39].v) { this.ctx.letterSpacing = (s[39].v/100) + 'px'; } else { this.ctx.letterSpacing = 'normal'; }
                
                for(let line of node.layout.lines) {
                    if(s[38]===1) line = line.toUpperCase();
                    else if(s[38]===2) line = line.toLowerCase();
                    else if(s[38]===3) line = line.replace(/\b\w/g, c => c.toUpperCase());
                    
                    let lx = rx;
                    if(ta === 1) lx = rx + (node.layout.w - this.ctx.measureText(line).width) / 2;
                    else if(ta === 2) lx = rx + node.layout.w - this.ctx.measureText(line).width;
                    this.ctx.fillText(line, lx, lY);
                    if(s[35]) {
                        const tw = this.ctx.measureText(line).width;
                        this.ctx.strokeStyle = this.ctx.fillStyle;
                        this.ctx.lineWidth = 1;
                        if(s[35] & 1) { this.ctx.beginPath(); this.ctx.moveTo(lx, lY+node.layout.fs+1); this.ctx.lineTo(lx+tw, lY+node.layout.fs+1); this.ctx.stroke(); }
                        if(s[35] & 2) { this.ctx.beginPath(); this.ctx.moveTo(lx, lY+node.layout.fs*0.5); this.ctx.lineTo(lx+tw, lY+node.layout.fs*0.5); this.ctx.stroke(); }
                    }
                    lY += node.layout.lh;
                }
            }
        }
        
        for(const c of node.children) this.paintNode(c, 0, 0);
        
        if (clipped) {
            this.ctx.restore();
        }
    }

    measureAndLayout() {
        if(!this.root) return;
        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.parentElement.clientWidth || window.innerWidth;
        
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset for measureText
        
        this.measureNode(this.root, w);
        
        // Calculate max Y for layoutHeight
        let maxY = 0;
        const findMaxY = (n) => {
            if(!n) return;
            const bottom = n.layout.y + n.layout.h + n.layout.mb;
            if(bottom > maxY) maxY = bottom;
            for(const c of n.children) findMaxY(c);
        };
        findMaxY(this.root);
        this.layoutHeight = maxY;
        
        this.canvas.style.height = this.layoutHeight + 'px';
        this.canvas.height = this.layoutHeight * dpr;
        this.canvas.width = w * dpr;
        this.canvas.style.width = w + 'px';
    }

    draw() {
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
        
        
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx.clearRect(0,0, this.canvas.width, this.canvas.height);
        
        // Native Scrolling Integration
        this.ctx.save();
        // Since the canvas is positioned statically and grows in height, 
        // the browser natively scrolls it. We don't need ctx.translate if the canvas itself is long!
        // But if the container is fixed and we use canvas scroll, we do.
        // Assuming the canvas is full height:
        
        this.paintNode(this.root);
        this.ctx.restore();
    }
    
    hitTest(x, y) {
        if(!this.root) return null;
        let result = null;
        const search = (node, accX, accY) => {
            if(!node) return;
            const l = node.layout;
            const rx = l.x - accX;
            const ry = l.y - accY;
            
            const s = this.blbMap[node.id] || {};
            let isInside = (x >= rx && x <= rx + l.w && y >= ry && y <= ry + l.h);
            
            if (isInside) {
                result = node;
            } else if (s[32] === 1 || s[32] === 2) {
                // If clipped and click is outside, children cannot be hit
                return; 
            }
            
            const nScrollX = node.layout.scrollX || 0;
            const nScrollY = node.layout.scrollY || 0;
            for(const c of node.children) search(c, accX + nScrollX, accY + nScrollY);
        };
        search(this.root, 0, 0);
        return result;
    }
}
function parseBWEB(buf){
    const u8=new Uint8Array(buf);
    const magic=String.fromCharCode(u8[0],u8[1],u8[2],u8[3]);
    if(magic==='BWEB'){
        const version=u8[4],secCount=u8[5];
        let off=6;
        const sections={ vfs: [] };
        let currentVfs = null;

        for(let i=0;i<secCount;i++){
            if(off>=u8.length) break;
            const secType=u8[off++];
            const secLen=new DataView(buf).getUint32(off);off+=4;
            const chunk = buf.slice(off,off+secLen);
            off+=secLen;

            if (secType === 9) { // TOC
                sections[9] = chunk;
            } else if (secType === 1) {
                if (currentVfs) sections.vfs.push(currentVfs);
                currentVfs = { bml: chunk };
            } else if (secType === 2 && currentVfs) {
                currentVfs.bdt = chunk;
            } else if (secType === 7 && currentVfs) {
                currentVfs.blbDesktop = chunk;
            } else if (secType === 8 && currentVfs) {
                currentVfs.blbTablet = chunk;
            } else if (secType === 10 && currentVfs) {
                currentVfs.blbMobile = chunk;
            } else if (secType === 11) {
                if(!sections[11]) sections[11] = [];
                sections[11].push(chunk);
            } else {
                if(!sections[secType]) sections[secType] = [];
                sections[secType].push(chunk);
            }
        }
        if (currentVfs) sections.vfs.push(currentVfs);
        
        // Parse TOC to attach names to VFS
        if (sections[9]) {
            const tocArr = new Uint8Array(sections[9]);
            // Skip VFS\x01 (4 bytes)
            const jsonStr = new TextDecoder().decode(tocArr.slice(4));
            try {
                const tocObj = JSON.parse(jsonStr);
                for (const name of Object.keys(tocObj)) {
                    const idx = tocObj[name].index;
                    if (sections.vfs[idx]) {
                        sections.vfs[idx].name = name;
                    }
                }
            } catch (e) {
                console.error("Failed to parse TOC JSON:", e);
            }
        }
        
        return sections;
    }
    if(u8[0]===0x42&&u8[1]===0x4D&&u8[2]===0x4C) return{1:[buf], vfs:[{bml:buf}]};
    return{1:[buf], vfs:[{bml:buf}]};
}
function parseBIB(buf) {
    const view = new DataView(buf);
    let off = 4; // skip BIB\x01
    const count = view.getUint32(off); off+=4;
    const images = {};
    for(let i=0; i<count; i++){
        const id = view.getUint32(off); off+=4;
        const w = view.getUint16(off); off+=2;
        const h = view.getUint16(off); off+=2;
        const type = view.getUint8(off++);
        const comp = view.getUint8(off++);
        off += 6; // padding
        const bCount = view.getUint16(off); off+=2; // block count usually 0
        const pLen = view.getUint32(off); off+=4;
        const payload = new Uint8Array(buf, off, pLen);
        off += pLen;
        images[id] = {id, w, h, comp, data: payload};
    }
    return images;
}

function rgba(v){
    if(v===0)return'transparent';
    const r=(v>>>24)&0xFF,g=(v>>>16)&0xFF,b=(v>>>8)&0xFF,a=v&0xFF;
    return `rgba(${r},${g},${b},${(a/255).toFixed(2)})`;
}
async function prepareGlobalBIB(bibBufs) {
    window.bwebBIB = {};
    if(!bibBufs) return;
    for (const buf of bibBufs) {
        const parsed = parseBIB(buf);
        for(const [id, img] of Object.entries(parsed)) {
            if (img.comp === 0) {
                const imgData = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.w * img.h * 4), img.w, img.h);
                const tcvs = document.createElement('canvas');
                tcvs.width = img.w; tcvs.height = img.h;
                tcvs.getContext('2d').putImageData(imgData, 0, 0);
                window.bwebBIB[id] = tcvs;
            } else {
                const mime = img.comp === 1 ? 'image/png' : img.comp === 2 ? 'image/jpeg' : img.comp === 3 ? 'image/webp' : 'application/octet-stream';
                const blob = new Blob([img.data], { type: mime });
                window.bwebBIB[id] = await createImageBitmap(blob);
            }
        }
    }
}
function rgba(v){
    if(v===0)return'transparent';
    const r=(v>>>24)&0xFF,g=(v>>>16)&0xFF,b=(v>>>8)&0xFF,a=v&0xFF;
    return `rgba(${r},${g},${b},${(a/255).toFixed(2)})`;
}

function showBWEBExtensionModal() {
    if (localStorage.getItem('bweb_extension_dismissed')) return;
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.style.zIndex = '999999';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.fontFamily = 'system-ui, sans-serif';

    const box = document.createElement('div');
    box.style.background = '#1a1a2e';
    box.style.color = '#fff';
    box.style.padding = '40px';
    box.style.borderRadius = '16px';
    box.style.maxWidth = '500px';
    box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    box.style.textAlign = 'center';

    box.innerHTML = `
        <h2 style="margin-top:0;font-size:24px;background:linear-gradient(90deg, #00f2fe, #4facfe);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Erlebe das Binäre Web Nativ</h2>
        <p style="font-size:16px;line-height:1.5;color:#ccc;margin-bottom:20px;">
            Du betrachtest diese BWEB-Seite gerade über den Web-Polyfill. Installiere unsere offizielle Browser-Erweiterung für die volle Leistung:
        </p>
        <ul style="text-align:left;margin-bottom:30px;color:#ddd;line-height:1.6;">
            <li>⚡ <b>10x schnelleres Rendering</b> (Native Caching)</li>
            <li>🛡️ <b>Absolute Sicherheit</b> (Kein DOM-Hacking)</li>
            <li>🔒 <b>100% Privacy</b> (Keine Tracker, keine Cookies)</li>
            <li>🔋 <b>Energieeffizient</b> (GPU-optimiert)</li>
        </ul>
        <div style="display:flex;gap:15px;justify-content:center;">
            <a id="bweb-download-btn" href="#" target="_blank" style="background:#4facfe;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;transition:transform 0.2s;">Download Extension</a>
        </div>
        <button id="close-bweb-modal" style="background:transparent;border:none;color:#888;margin-top:20px;cursor:pointer;text-decoration:underline;">Weiter im Polyfill-Modus</button>
    `;

    modal.appendChild(box);
    document.body.appendChild(modal);

    const ua = navigator.userAgent;
    let browser = 'unknown';
    if (ua.match(/edg/i)) browser = 'edge';
    else if (ua.match(/opr\//i)) browser = 'opera';
    else if (ua.match(/chrome|chromium|crios/i)) browser = 'chrome';
    else if (ua.match(/firefox|fxios/i)) browser = 'firefox';
    else if (ua.match(/safari/i)) browser = 'safari';

    const githubRepo = 'https://github.com/Luiguard/bweb-native-engine/releases/latest/download';
    const links = {
        'chrome': `${githubRepo}/bweb-extension-chrome.zip`,
        'firefox': `${githubRepo}/bweb-extension-firefox.xpi`,
        'edge': `${githubRepo}/bweb-extension-edge.zip`,
        'safari': `${githubRepo}/bweb-extension-safari.zip`,
        'opera': `${githubRepo}/bweb-extension-chrome.zip`,
        'unknown': 'https://github.com/Luiguard/bml-prototype/releases'
    };

    const downloadBtn = document.getElementById('bweb-download-btn');
    downloadBtn.href = links[browser];
    
    // Kleines Label anpassen, damit Nutzer wissen, welcher Build geladen wird
    const browserName = browser.charAt(0).toUpperCase() + browser.slice(1);
    downloadBtn.textContent = browser === 'unknown' ? 'Zu den Downloads' : `Download für ${browserName}`;

    document.getElementById('close-bweb-modal').addEventListener('click', () => {
        localStorage.setItem('bweb_extension_dismissed', '1');
        modal.remove();
    });
}
