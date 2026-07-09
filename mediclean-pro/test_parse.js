
const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'iframe',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFD:'#text',0xFD:'#text',0xFE:'div',0xFF:'div'};
const ATTR_REV={0x10:'class',0x11:'id',0x12:'href',0x13:'src',0x14:'style',0x15:'type',0x16:'name',0x17:'value',0x18:'placeholder',0x19:'alt',0x1A:'title',0x1B:'action',0x1C:'method',0x1D:'target',0x1E:'rel',0x1F:'role',0x20:'aria-label',0x21:'data-bind',0x22:'onclick',0x23:'onsubmit',0x24:'width',0x25:'height',0x26:'disabled',0x27:'checked',0x28:'selected',0x29:'required',0x2A:'autofocus',0x2B:'autocomplete',0x2C:'min',0x2D:'max',0x2E:'step',0x2F:'pattern',0x30:'for',0x31:'tabindex',0x32:'content',0x33:'charset',0x34:'http-equiv',0x35:'lang',0x36:'dir',0x37:'hidden'};
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
            tagName: tagName,
            attrs: {},
            children: [],
            text: '',
            isText: tagName === '#text'
        };
        for(let i=0;i<nAttr;i++){
            if(this.o+3>this.v.byteLength)break;
            const aId=this.v.getUint8(this.o++);
            const aLen=this.v.getUint16(this.o);this.o+=2;
            if(this.o+aLen>this.v.byteLength)break;
            const aVal=this.d.decode(new Uint8Array(this.v.buffer,this.o,aLen));this.o+=aLen;
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
                    const v = this.v.getUint16(this.o); this.o+=2;
                    val = {u, v};
                } else if(type === 1) { // Enum / Int16 (Wait! I wrote flex properties as type=1 but len=2! Let me read by type properly)
                    // Let's rely on tag to know the size!
                    // Tag 21, 27, 28 are uint16
                    if(tag===21 || tag===27 || tag===28) {
                        val = this.v.getUint16(this.o); this.o+=2;
                    } else {
                        val = this.v.getUint8(this.o++);
                    }
                } else if(type === 2) { // Color
                    val = this.v.getUint32(this.o); this.o+=4;
                }
                b.props[tag] = val;
            }
            blocks.push(b);
        }
        return blocks;
    }
}

const MAX_CANVAS_DIM = 8192;

class BIBParser{
    constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
    parse(){
        const count=this.v.getUint32(this.o);this.o+=4;
        const images={};
        for(let i=0;i<count;i++){
            const id=this.v.getUint32(this.o);this.o+=4;
            const w=this.v.getUint16(this.o);this.o+=2;
            const h=this.v.getUint16(this.o);this.o+=2;
            const cs=this.v.getUint8(this.o++);
            const comp=this.v.getUint8(this.o++);
            this.o+=6; // padding
            
            const blockId=this.v.getUint16(this.o);this.o+=2;
            const dataLen=this.v.getUint32(this.o);this.o+=4;
            
            if(w>MAX_CANVAS_DIM||h>MAX_CANVAS_DIM)throw new Error(`BIB: Bilddimensionen ${w}x${h} überschreiten Limit ${MAX_CANVAS_DIM}`);
            if(comp === 0 && dataLen!==w*h*4)throw new Error(`BIB: dataLen ${dataLen} != erwartete ${w*h*4} Bytes`);
            if(this.o+dataLen>this.v.byteLength)throw new Error('BIB: Buffer-Overread');
            
            const pxData=new Uint8Array(this.v.buffer,this.o,dataLen);
            this.o+=dataLen;
            
            images[id]={w,h,data:pxData,comp:comp};
        }
        return images;
    }
}

class BVSParser {
    constructor(buf, offset=0) {
        this.v = new DataView(buf);
        this.o = offset;
        this.u8 = new Uint8Array(buf);
    }
    parse() {
        const count = this.v.getUint32(this.o); this.o += 4;
        const videos = {};
        for(let i=0; i<count; i++) {
            const id = this.v.getUint32(this.o); this.o += 4;
            const w = this.v.getUint16(this.o); this.o += 2;
            const h = this.v.getUint16(this.o); this.o += 2;
            const codecLen = this.v.getUint8(this.o++);
            if(this.o+codecLen>this.v.byteLength)throw new Error('BVS: Buffer-Overread');
            const codecBytes = this.u8.slice(this.o, this.o + codecLen);
            this.o += codecLen;
            const codec = new TextDecoder('ascii').decode(codecBytes);
            const chunkCount = this.v.getUint32(this.o); this.o += 4;
            
            if(w>MAX_CANVAS_DIM||h>MAX_CANVAS_DIM)throw new Error(`BVS: Videodimensionen ${w}x${h} überschreiten Limit`);
            
            const chunks = [];
            for(let j=0; j<chunkCount; j++) {
                const flags = this.v.getUint8(this.o++);
                const isKey = (flags & 1) === 1;
                const ptsHigh = this.v.getUint32(this.o); this.o += 4;
                const ptsLow = this.v.getUint32(this.o); this.o += 4;
                const pts = Number((BigInt(ptsHigh) << 32n) | BigInt(ptsLow));
                const dur = this.v.getUint32(this.o); this.o += 4;
                const dataLen = this.v.getUint32(this.o); this.o += 4;
                if(this.o+dataLen>this.v.byteLength)throw new Error('BVS: Buffer-Overread');
                const data = this.u8.slice(this.o, this.o + dataLen);
                this.o += dataLen;
                
                chunks.push({
                    type: isKey ? 'key' : 'delta',
                    timestamp: pts,
                    duration: dur,
                    data: data
                });
            }
            videos[id] = {w, h, codec, chunks};
        }
        return videos;
    }
}

async function applyBVS(rootEl, videos) {
    if (!('VideoDecoder' in window)) {
        console.warn('WebCodecs API not supported.');
        return;
    }

    const canvases = rootEl.querySelectorAll('canvas[data-bind-video]');
    for(const canvas of canvases) {
        const vidId = parseInt(canvas.getAttribute('data-bind-video'));
        const vid = videos[vidId];
        if(!vid) continue;
        
        canvas.width = vid.w;
        canvas.height = vid.h;
        const ctx = canvas.getContext('2d');
        
        const playbackLoop = async () => {
            let startRealTime = performance.now();
            let currentChunk = 0;
            let pendingFrames = [];
            let started = false;
            
            const decoder = new VideoDecoder({
                output: (frame) => pendingFrames.push(frame),
                error: (e) => console.error("VideoDecoder error:", e)
            });
            
            decoder.configure({
                codec: vid.codec,
                codedWidth: vid.w,
                codedHeight: vid.h,
                hardwareAcceleration: 'prefer-hardware'
            });

            while(true) {
                while(decoder.decodeQueueSize < 10 && currentChunk < vid.chunks.length) {
                    decoder.decode(new EncodedVideoChunk(vid.chunks[currentChunk++]));
                }
                
                if (pendingFrames.length > 0) {
                    if (!started) {
                        started = true;
                        canvas.dispatchEvent(new CustomEvent('bvs-loop-restart', {detail: {time: startRealTime}}));
                    }
                    const frame = pendingFrames[0];
                    const elapsedRealUs = (performance.now() - startRealTime) * 1000;
                    
                    if (frame.timestamp <= elapsedRealUs) {
                        ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
                        frame.close();
                        pendingFrames.shift();
                    }
                }
                
                if (currentChunk >= vid.chunks.length && pendingFrames.length === 0) {
                    await decoder.flush();
                    currentChunk = 0;
                    startRealTime = performance.now(); // Loop video
                    canvas.dispatchEvent(new CustomEvent('bvs-loop-restart', {detail: {time: startRealTime}}));
                }
                
                await new Promise(r => requestAnimationFrame(r));
            }
        };
        playbackLoop();
    }
}

class BASParser {
    constructor(buf, offset=0) {
        this.v = new DataView(buf);
        this.o = offset;
        this.u8 = new Uint8Array(buf);
    }
    parse() {
        const count = this.v.getUint32(this.o); this.o += 4;
        const audios = {};
        for(let i=0; i<count; i++) {
            const id = this.v.getUint32(this.o); this.o += 4;
            const codecLen = this.v.getUint8(this.o++);
            const codecBytes = this.u8.slice(this.o, this.o + codecLen);
            this.o += codecLen;
            const codec = new TextDecoder('ascii').decode(codecBytes);
            const sampleRate = this.v.getUint32(this.o); this.o += 4;
            const channels = this.v.getUint8(this.o++);
            const chunkCount = this.v.getUint32(this.o); this.o += 4;
            
            const chunks = [];
            for(let j=0; j<chunkCount; j++) {
                const flags = this.v.getUint8(this.o++);
                const isKey = (flags & 1) === 1;
                const ptsHigh = this.v.getUint32(this.o); this.o += 4;
                const ptsLow = this.v.getUint32(this.o); this.o += 4;
                const pts = Number((BigInt(ptsHigh) << 32n) | BigInt(ptsLow));
                const dur = this.v.getUint32(this.o); this.o += 4;
                const dataLen = this.v.getUint32(this.o); this.o += 4;
                const data = this.u8.slice(this.o, this.o + dataLen);
                this.o += dataLen;
                
                chunks.push({
                    type: isKey ? 'key' : 'delta',
                    timestamp: pts,
                    duration: dur,
                    data: data
                });
            }
            audios[id] = {codec, sampleRate, channels, chunks};
        }
        return audios;
    }
}

let globalAudioContext = null;

async function applyBAS(rootEl, audios) {
    if (!('AudioDecoder' in window)) {
        console.warn('WebCodecs AudioDecoder API not supported.');
        return;
    }

    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const resumeAudio = () => {
        if (globalAudioContext.state === 'suspended') {
            globalAudioContext.resume();
        }
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
    document.addEventListener('keydown', resumeAudio);

    const canvases = rootEl.querySelectorAll('canvas[data-bind-audio]');
    for(const canvas of canvases) {
        const audId = parseInt(canvas.getAttribute('data-bind-audio'));
        const aud = audios[audId];
        if(!aud) continue;
        
        let totalSamples = 0;
        const decodedBuffers = [];
        
        const decoder = new AudioDecoder({
            output: (audioData) => {
                const planarData = [];
                for(let c=0; c<audioData.numberOfChannels; c++) {
                    const chData = new Float32Array(audioData.numberOfFrames);
                    audioData.copyTo(chData, {planeIndex: c, format: 'f32-planar'});
                    planarData.push(chData);
                }
                decodedBuffers.push({
                    frames: audioData.numberOfFrames,
                    data: planarData
                });
                totalSamples += audioData.numberOfFrames;
                audioData.close();
            },
            error: (e) => console.error("AudioDecoder error:", e)
        });
        
        decoder.configure({
            codec: aud.codec,
            sampleRate: aud.sampleRate,
            numberOfChannels: aud.channels
        });

        for (const chunk of aud.chunks) {
            decoder.decode(new EncodedAudioChunk(chunk));
        }
        
        await decoder.flush();
        if (decodedBuffers.length === 0) continue;
        
        const finalBuffer = globalAudioContext.createBuffer(
            aud.channels,
            totalSamples,
            aud.sampleRate
        );
        
        let offset = 0;
        for (const db of decodedBuffers) {
            for (let c=0; c<aud.channels; c++) {
                finalBuffer.getChannelData(c).set(db.data[c], offset);
            }
            offset += db.frames;
        }
        
        let sourceNode = null;
        let loopDuration = totalSamples / aud.sampleRate;
        let videoStartTime = performance.now();
        
        function playAudio(offsetSec) {
             if (globalAudioContext.state === 'suspended') return;
             if (sourceNode) {
                 try { sourceNode.stop(); } catch(e){}
             }
             sourceNode = globalAudioContext.createBufferSource();
             sourceNode.buffer = finalBuffer;
             sourceNode.connect(globalAudioContext.destination);
             sourceNode.start(0, offsetSec);
        }
        
        canvas.addEventListener('bvs-loop-restart', (e) => {
             videoStartTime = e.detail.time;
             playAudio(0);
        });
        
        globalAudioContext.addEventListener('statechange', () => {
             if (globalAudioContext.state === 'running') {
                  let elapsedSec = (performance.now() - videoStartTime) / 1000;
                  elapsedSec = elapsedSec % loopDuration;
                  playAudio(elapsedSec);
             }
        });
    }
}

function cssVal(v){
    if(v===0xFFFF)return'auto';
    return v/10+'px';
}
// --- BWEB Canvas Layout Engine (BLB-2) ---
class CanvasEngine {
    constructor() {
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
    }

    mount(container) {
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
        const s = this.blbMap[node.id] || {};
        
        const pl = this.getVal(s[15], parentW), pr = this.getVal(s[13], parentW);
        const pt = this.getVal(s[12], parentW), pb = this.getVal(s[14], parentW);
        const mt = this.getVal(s[8], parentW), mb = this.getVal(s[10], parentW);
        const ml = this.getVal(s[11], parentW), mr = this.getVal(s[9], parentW);
        
        node.layout.mt=mt; node.layout.mb=mb; node.layout.ml=ml; node.layout.mr=mr;
        node.layout.pt=pt; node.layout.pb=pb; node.layout.pl=pl; node.layout.pr=pr;
        node.layout.position = s[6] || 0; 
        
        let expW = s[1] && s[1].u !== 4 ? this.getVal(s[1], parentW) : null;
        let expH = s[2] && s[2].u !== 4 ? this.getVal(s[2], 0) : null;
        
        let availInnerW = (expW !== null ? expW : parentW - ml - mr) - pl - pr;
        if(availInnerW < 0) availInnerW = 0;
        
        if (node.isText) {
            const text = node.text.trim();
            if(!text) { node.layout.w = 0; node.layout.h = 0; return; }
            
            const fs = s[19] ? this.getVal(s[19], parentW) : 16;
            this.ctx.font = `${s[21]||400} ${fs}px sans-serif`;
            
            const words = text.split(/[ \t\n]+/);
            let lines = [];
            let currentLine = words[0];
            let maxW = 0;
            
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
            
            node.layout.w = expW !== null ? expW : node.layout.innerW + pl + pr;
            node.layout.h = expH !== null ? expH : node.layout.innerH + pt + pb;
            return;
        }
        
        let maxChildW = 0;
        let totalChildH = 0;
        let isFlexRow = s[5]===2 && s[23]===0; 
        let totalFlexRowW = 0;
        let maxFlexRowH = 0;
        
        for(const c of node.children) {
            this.measureNode(c, availInnerW);
            if(c.layout.position === 2) continue; 
            
            if(isFlexRow) {
                totalFlexRowW += c.layout.w + c.layout.ml + c.layout.mr;
                maxFlexRowH = Math.max(maxFlexRowH, c.layout.h + c.layout.mt + c.layout.mb);
            } else {
                maxChildW = Math.max(maxChildW, c.layout.w + c.layout.ml + c.layout.mr);
                totalChildH += c.layout.h + c.layout.mt + c.layout.mb;
            }
        }
        
        if(isFlexRow) {
            const gap = s[30] ? this.getVal(s[30], parentW) : 0;
            const gaps = Math.max(0, node.children.length - 1) * gap;
            node.layout.innerW = totalFlexRowW + gaps;
            node.layout.innerH = maxFlexRowH;
        } else {
            node.layout.innerW = maxChildW;
            node.layout.innerH = totalChildH;
        }
        
        node.layout.w = expW !== null ? expW : node.layout.innerW + pl + pr;
        node.layout.h = expH !== null ? expH : node.layout.innerH + pt + pb;
    }

    layoutNode(node, x, y) {
        if(!node) return;
        node.layout.x = x;
        node.layout.y = y;
        
        if(node.isText) return;
        
        const s = this.blbMap[node.id] || {};
        let isFlexRow = s[5]===2 && s[23]===0;
        
        let cx = x + node.layout.pl;
        let cy = y + node.layout.pt;
        const gap = s[30] ? this.getVal(s[30], node.layout.w) : 0;
        
        if(isFlexRow) {
            let freeSpace = node.layout.w - node.layout.pl - node.layout.pr - node.layout.innerW;
            let totalGrow = 0;
            for(const c of node.children) {
                if(c.layout.position !== 2) {
                    const cStyle = this.blbMap[c.id] || {};
                    totalGrow += (cStyle[27] || 0);
                }
            }
            
            for(const c of node.children) {
                if(c.layout.position === 2) {
                    this.layoutNode(c, cx + c.layout.ml, cy + c.layout.mt);
                    continue;
                }
                
                const cStyle = this.blbMap[c.id] || {};
                let cW = c.layout.w;
                if(freeSpace > 0 && totalGrow > 0) {
                    const grow = cStyle[27] || 0;
                    cW += (grow / totalGrow) * freeSpace;
                    c.layout.w = cW;
                }
                
                let aY = cy + c.layout.mt;
                let cHeight = c.layout.h;
                const ai = s[26] || 0;
                if(ai === 2) {
                    aY = cy + (node.layout.innerH - cHeight) / 2;
                } else if(ai === 3 && (cStyle[2] && cStyle[2].u===4)) {
                    cHeight = node.layout.innerH - c.layout.mt - c.layout.mb;
                    c.layout.h = cHeight;
                }
                
                this.layoutNode(c, cx + c.layout.ml, aY);
                cx += cW + c.layout.ml + c.layout.mr + gap;
            }
        } else {
            for(const c of node.children) {
                if(c.layout.position === 2) {
                    this.layoutNode(c, x + c.layout.ml, y + c.layout.mt);
                    continue;
                }
                
                const cStyle = this.blbMap[c.id] || {};
                if((!cStyle[1] || cStyle[1].u===4) && c.layout.position !== 2 && !c.isText) {
                    c.layout.w = node.layout.w - node.layout.pl - node.layout.pr - c.layout.ml - c.layout.mr;
                }
                
                this.layoutNode(c, cx + c.layout.ml, cy + c.layout.mt);
                cy += c.layout.h + c.layout.mt + c.layout.mb + gap;
            }
        }
    }

    paintNode(node, accX = 0, accY = 0) {
        if(!node) return;
        const s = this.blbMap[node.id] || {};
        
        let rx = node.layout.x - accX;
        let ry = node.layout.y - accY;
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
            if(s[17]) {
                let color = s[17];
                if (node.isHovered) {
                    // Simple hover effect: alpha reduction or lighten
                    const r=(color>>>24)&0xFF,g=(color>>>16)&0xFF,b=(color>>>8)&0xFF,a=color&0xFF;
                    color = ((r+20)<<24) | ((g+20)<<16) | ((b+20)<<8) | a;
                }
                this.ctx.fillStyle = rgba(color);
                this.ctx.fillRect(rx, ry, rw, rh);
            }
            
            const el = findBMLElementForNode(node.id, currentBMLRoot);
            if (el && (el.tag === 11 || el.tag === 43)) {
                let srcAttr = null;
                if(el.attributes) srcAttr = el.attributes.find(a => a.id === 19 || a.id === 33);
                if (srcAttr) {
                    const srcStr = new TextDecoder().decode(srcAttr.val);
                    let bibId = null;
                    if (srcStr.startsWith('bib://')) bibId = parseInt(srcStr.split('://')[1], 10);
                    else bibId = parseInt(srcStr, 10);
                    
                    if (!isNaN(bibId) && window.bwebBIB && window.bwebBIB[bibId]) {
                        this.ctx.drawImage(window.bwebBIB[bibId], rx + node.layout.pl, ry + node.layout.pt, rw - node.layout.pl - node.layout.pr, rh - node.layout.pt - node.layout.pb);
                    }
                }
            }
            
            if(s[16] && s[25]) {
                this.ctx.strokeStyle = rgba(s[16]);
                this.ctx.lineWidth = s[25]/10;
                this.ctx.strokeRect(rx, ry, rw, rh);
            }
        } else {
            if(node.layout.lines && node.layout.lines.length > 0) {
                this.ctx.fillStyle = s[18] ? rgba(s[18]) : '#000000';
                this.ctx.font = `${s[21]||400} ${node.layout.fs}px sans-serif`;
                this.ctx.textBaseline = "top";
                let lY = ry;
                for(const line of node.layout.lines) {
                    this.ctx.fillText(line, rx, lY);
                    lY += node.layout.lh;
                }
            }
        }
        
        let nScrollX = node.layout.scrollX || 0;
        let nScrollY = node.layout.scrollY || 0;
        for(const c of node.children) this.paintNode(c, accX + nScrollX, accY + nScrollY);
        
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
        this.layoutNode(this.root, 0, 0);
        
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

function applyBLB(rootEl, blocks) {}
function rgba(v){
    if(v===0)return'transparent';
    const r=(v>>>24)&0xFF,g=(v>>>16)&0xFF,b=(v>>>8)&0xFF,a=v&0xFF;
    return`rgba(${r},${g},${b},${(a/255).toFixed(2)})`;
}

async function applyBIB(rootEl,images){
    const canvases = Array.from(rootEl.querySelectorAll('canvas')).filter(c => c.getAttribute('data-bind') || c.getAttribute('src'));
    const promises = canvases.map(async cvs=>{
        const rawId = cvs.getAttribute('data-bind') || cvs.getAttribute('src');
        let id = rawId;
        if(typeof rawId === 'string' && rawId.startsWith('bib://')) id = parseInt(rawId.split('://')[1], 10);
        else id = parseInt(rawId, 10);
        const img=images[id];
        if(img){
            cvs.width=img.w;
            cvs.height=img.h;
            const ctx=cvs.getContext('2d');
            if (img.comp === 0) {
                const imgData = new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.w * img.h * 4), img.w, img.h);
                ctx.putImageData(imgData, 0, 0);
            } else {
                const mime = img.comp === 1 ? 'image/png' : img.comp === 2 ? 'image/jpeg' : img.comp === 3 ? 'image/webp' : 'application/octet-stream';
                const blob = new Blob([img.data], { type: mime });
                const bitmap = await createImageBitmap(blob);
                ctx.drawImage(bitmap, 0, 0);
            }
        }
    });
    await Promise.all(promises);
}

function renderBDTTree(nodes){
    const tv=document.getElementById('treeView');
    const tp=document.getElementById('treePanel');
    if(!nodes||!nodes.length){tp.style.display='none';return}
    tp.style.display='';
    let html='';
    nodes.forEach(n=>{
        const indent='  '.repeat(n.depth);
        const tag=TAG_REV[n.tag]||'?';
        html+=`${indent}<span class="tag">&lt;${tag}&gt;</span> <span class="id-ref">#${n.id}</span> <span class="depth">p:${n.parent===0xFFFF?'root':n.parent} fc:${n.firstChild===0xFFFF?'-':n.firstChild} lc:${n.lastChild===0xFFFF?'-':n.lastChild} ps:${n.previousSibling===0xFFFF?'-':n.previousSibling} ns:${n.nextSibling===0xFFFF?'-':n.nextSibling}</span>\n`;
    });
    tv.innerHTML=html;
}

async function clientSideConvert(htmlMap) {
    return new Promise(async (resolve, reject) => {
        const TAG_FWD={};
        for(const[k,v]of Object.entries(TAG_REV))TAG_FWD[v]=parseInt(k);
        const ATTR_FWD={};
        for(const[k,v]of Object.entries(ATTR_REV))ATTR_FWD[v]=parseInt(k);
        const enc=new TextEncoder();
        const SKIP_TAGS=new Set(['script','style','noscript','template','iframe','object','embed','applet','link','meta','base','head','source','track','slot']);

        function colorToU32(c) {
            const m = c.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
            if (!m) return 0;
            const r=parseInt(m[1]),g=parseInt(m[2]),b=parseInt(m[3]);
            const a=m[4]!==undefined?Math.round(parseFloat(m[4])*255):255;
            return((r<<24)|(g<<16)|(b<<8)|a)>>>0;
        }
        const DM={'block':0,'inline':1,'flex':2,'grid':3,'none':4,'inline-block':5,'inline-flex':6,'list-item':7,'table':8,'table-row':9,'table-cell':10,'inline-grid':11};
        const PM_={'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4};
        const TAM={'left':0,'center':1,'right':2,'justify':3,'start':0,'end':2};
        const FDM={'row':0,'column':1,'row-reverse':2,'column-reverse':3};
        const FWM={'nowrap':0,'wrap':1,'wrap-reverse':2};
        const JCM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5,'normal':0};
        const AIM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'stretch':3,'baseline':4,'normal':3};

        const extractedImages = [];
        
        async function snapshotSinglePage(htmlContent) {
            return new Promise((res) => {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.height = '1080px';
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
                document.body.appendChild(iframe);

                const cleanHtml = htmlContent
                    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
                    .replace(/\son[a-z]+\s*=\s*(['"])(.*?)\1/gi, '');

                const blob = new Blob([cleanHtml], {type: 'text/html'});
                iframe.src = URL.createObjectURL(blob);
                iframe.onload = async () => {
                    try {
                        const doc = iframe.contentWindow.document;
                        for (const imgEl of doc.querySelectorAll('img')) {
                            const src = imgEl.src;
                            if (src && !src.startsWith('bib://') && !src.startsWith('data:')) {
                                if (!globalImages.has(src)) {
                                    globalImages.set(src, { id: globalImages.size, url: src });
                                }
                                imgEl.setAttribute('src', `bib://${globalImages.get(src).id}`);
                            }
                        }
                        const fontsExtracted = [];
                        try {
                            for (const sheet of iframe.contentWindow.document.styleSheets) {
                                try {
                                    for (const rule of sheet.cssRules) {
                                        if (rule instanceof CSSFontFaceRule) {
                                            const family = rule.style.fontFamily.replace(/['"]/g, '');
                                            const srcMatch = rule.style.src.match(/url\(['"]?(.*?)['"]?\)/);
                                            if (srcMatch) {
                                                const url = srcMatch[1];
                                                let weight = 400;
                                                if(rule.style.fontWeight === 'bold') weight = 700;
                                                else if(parseInt(rule.style.fontWeight)) weight = parseInt(rule.style.fontWeight);
                                                const style = rule.style.fontStyle === 'italic' ? 1 : 0;
                                                fontsExtracted.push({ family, url, weight, style });
                                            }
                                        }
                                    }
                                } catch(e) {}
                            }
                        } catch(e) {}

                        const bmlBuf=[];
                        const flatNodes=[];

                        function serNode(el,parentIdx){
                            if(el.nodeType===3){
                                const t=el.textContent.trim();
                                if(!t)return;
                                bmlBuf.push(0xFD, 0, 0, 0);
                                const textBytes=enc.encode(t + " ");
                                bmlBuf.push((textBytes.length>>8)&0xFF,textBytes.length&0xFF);
                                for(const b of textBytes)bmlBuf.push(b);
                                return;
                            }
                            if (el.nodeType !== 1) return;
                            let tag=el.tagName?el.tagName.toLowerCase():'div';
                            if(SKIP_TAGS.has(tag))return;
                            const attrs=[];
                            if (tag === 'img') tag = 'canvas';
                            const myIdx=flatNodes.length;
                            flatNodes.push({node:el,tag:TAG_FWD[tag]||255,parentIdx,children:[],id:myIdx});
                            if(parentIdx>=0) flatNodes[parentIdx].children.push(myIdx);
                            bmlBuf.push(TAG_FWD[tag]||255);
                            for(const a of el.attributes){
                                const aid=ATTR_FWD[a.name];
                                if(aid!==undefined){
                                    const vBytes=enc.encode(a.value);
                                    attrs.push({id:aid,val:vBytes});
                                } else if(a.name === 'href') {
                                    const vBytes=enc.encode(a.value);
                                    attrs.push({id:ATTR_FWD['href']||18,val:vBytes});
                                }
                            }
                            bmlBuf.push(attrs.length);
                            for(const a of attrs){
                                bmlBuf.push(a.id);
                                bmlBuf.push((a.val.length>>8)&0xFF,a.val.length&0xFF);
                                for(const b of a.val)bmlBuf.push(b);
                            }
                            for(const c of el.childNodes) serNode(c,myIdx);
                            bmlBuf.push(0xFE);
                        }
                        
                        serNode(doc.body,-1);
                        
                        const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
                        const bdtView=new DataView(bdtBuf);
                        bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
                        bdtView.setUint32(4,flatNodes.length);
                        for(let i=0;i<flatNodes.length;i++){
                            const off=8+i*16;
                            const n=flatNodes[i];
                            bdtView.setUint16(off,i);
                            bdtView.setUint16(off+2,n.parentIdx>=0?n.parentIdx:0xFFFF);
                            bdtView.setUint16(off+4,n.children.length?n.children[0]:0xFFFF);
                            let ns=0xFFFF;
                            if(n.parentIdx>=0){
                                const siblings=flatNodes[n.parentIdx].children;
                                const myPos=siblings.indexOf(i);
                                if(myPos>=0&&myPos<siblings.length-1)ns=siblings[myPos+1];
                            }
                            bdtView.setUint16(off+6,ns);
                            bdtView.setUint8(off+8,1);
                            bdtView.setUint8(off+9,n.tag);
                            bdtView.setUint8(off+10,0);
                        }

                        function getOriginalCSS(el, prop, computed) {
                            if(el.style[prop]) return el.style[prop];
                            return computed;
                        }
                        function parseUnitValue(val) {
                            if(!val || val==='auto' || val==='none') return {u:4, v:0};
                            if(val.endsWith('%')) return {u:1, v:Math.round(parseFloat(val)*10)};
                            if(val.endsWith('vw')) return {u:2, v:Math.round(parseFloat(val)*10)};
                            if(val.endsWith('vh')) return {u:3, v:Math.round(parseFloat(val)*10)};
                            const n = parseFloat(val);
                            return isNaN(n) ? {u:4, v:0} : {u:0, v:Math.round(n*10)};
                        }

                        const extractBLB = () => {
                            const blbBuf = new ArrayBuffer(4 + flatNodes.length * 150);
                            const blbView = new DataView(blbBuf);
                            blbView.setUint32(0, flatNodes.length);
                            let off = 4;
                            for(let i=0; i<flatNodes.length; i++){
                                const n = flatNodes[i].node;
                                blbView.setUint16(off, flatNodes[i].id); off += 2;
                                if(n.nodeType!==1) { blbView.setUint8(off++, 0); continue; }
                                const s = iframe.contentWindow.getComputedStyle(n);
                                const props = [];
                                const addDim = (tag, cssProp) => {
                                    const raw = getOriginalCSS(n, cssProp, s[cssProp]);
                                    const {u,v} = parseUnitValue(raw);
                                    if(u!==4 || (tag===1 || tag===2)) props.push({tag, type:0, len:3, write:(vwr, o)=>{ vwr.setUint8(o, u); vwr.setUint16(o+1, v); }});
                                };
                                const addEnum = (tag, val) => { if(val!==undefined) props.push({tag, type:1, len:1, write:(vwr, o)=>vwr.setUint8(o, val)}); };
                                const addColor = (tag, val) => {
                                    const c = colorToU32(val);
                                    if(c!==0) props.push({tag, type:2, len:4, write:(vwr, o)=>vwr.setUint32(o, c)});
                                };
                                addDim(1, 'width'); addDim(2, 'height'); addDim(3, 'minWidth'); addDim(4, 'minHeight');
                                addEnum(5, DM[s.display]); addEnum(6, PM_[s.position]); addEnum(7, s.boxSizing==='border-box'?1:0);
                                addDim(8, 'marginTop'); addDim(9, 'marginRight'); addDim(10, 'marginBottom'); addDim(11, 'marginLeft');
                                addDim(12, 'paddingTop'); addDim(13, 'paddingRight'); addDim(14, 'paddingBottom'); addDim(15, 'paddingLeft');
                                addColor(16, s.borderColor); addColor(17, s.backgroundColor); addColor(18, s.color);
                                addDim(19, 'fontSize'); addDim(20, 'lineHeight');
                                props.push({tag: 21, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, parseInt(s.fontWeight)||400)});
                                addEnum(22, TAM[s.textAlign]);
                                if (DM[s.display]===2 || DM[s.display]===6 || DM[s.display]===11) { 
                                    addEnum(23, FDM[s.flexDirection]);
                                    addEnum(24, FWM[s.flexWrap]);
                                    addEnum(25, JCM[s.justifyContent]);
                                    addEnum(26, AIM[s.alignItems]||0);
                                    props.push({tag:27, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexGrow||0)*100))});
                                    props.push({tag:28, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexShrink||1)*100))});
                                    addDim(30, 'gap');
                                }
                                addDim(31, 'borderRadius');
                                addEnum(32, s.overflow==='hidden'?1:(s.overflow==='scroll'?2:0));
                                
                                blbView.setUint8(off++, props.length);
                                for(const p of props) {
                                    blbView.setUint8(off++, p.tag);
                                    blbView.setUint8(off++, p.type);
                                    p.write(blbView, off); off += p.len;
                                }
                            }
                            return blbBuf.slice(0, off);
                        };

                        const runViewport = (width) => new Promise(resolvePass => {
                            iframe.style.width = width + 'px';
                            setTimeout(() => {
                                resolvePass(extractBLB());
                            }, 100);
                        });

                        const blbDesktop = await runViewport(1920);
                        const blbTablet = await runViewport(768);
                        const blbMobile = await runViewport(375);
                        
                        const bmlData = new Uint8Array([0x42,0x4D,0x4C,0x01, ...bmlBuf]);
                        document.body.removeChild(iframe);
                        
                        res({ bml: bmlData, bdt: bdtBuf, blbDesktop, blbTablet, blbMobile, fontsExtracted });
                    } catch(e) {
                        console.error(e);
                        res(null);
                    }
                };
            });
        }

        const vfsBlocks = [];
        const globalFonts = new Map();
        const globalImages = new Map();
        const toc = {};
        
        let fileIndex = 0;
        const htmlKeys = typeof htmlMap === 'object' ? Object.keys(htmlMap) : [];
        if (htmlKeys.length === 0 && typeof htmlMap === 'string') {
            htmlKeys.push('index.html');
            htmlMap = { 'index.html': htmlMap };
        }

        for (let path of htmlKeys) {
            updateLoader(50 + (fileIndex/htmlKeys.length)*30, "VFS Compilation", `Kompiliere Seite ${path}...`);
            const snap = await snapshotSinglePage(htmlMap[path]);
            if (snap) {
                // Normalize path
                if(!path.startsWith('/')) path = '/' + path;
                toc[path] = { index: fileIndex };
                vfsBlocks.push(snap);
                fileIndex++;
            }
        }

        const tocBytes = enc.encode(JSON.stringify(toc));
        let secCount = 1 + (vfsBlocks.length * 5);
        
        const sections = [];
        function appendSection(type, data) {
            const head = new DataView(new ArrayBuffer(5));
            head.setUint8(0, type);
            head.setUint32(1, data.byteLength || data.length);
            sections.push(new Uint8Array(head.buffer));
            sections.push(new Uint8Array(data));
            return 5 + (data.byteLength || data.length);
        }

        let archiveSize = 6;
        
        // Custom TOC Header: "VFS\x01" at the beginning of the TOC block
        const tocHeader = new Uint8Array([0x56, 0x46, 0x53, 0x01]);
        const tocPayload = new Uint8Array(4 + tocBytes.length);
        tocPayload.set(tocHeader, 0);
        tocPayload.set(tocBytes, 4);
        
        archiveSize += appendSection(9, tocPayload);
        
        
        const validImages = [];
        for (const img of Array.from(globalImages.values())) {
            try {
                const fr = await fetch(img.url);
                if (fr.ok) {
                    const blob = await fr.blob();
                    const buf = await blob.arrayBuffer();
                    let comp = 0;
                    if(blob.type.includes('png')) comp=1;
                    else if(blob.type.includes('jpeg')) comp=2;
                    else if(blob.type.includes('webp')) comp=3;
                    
                    const imgEl = new Image();
                    imgEl.src = URL.createObjectURL(blob);
                    await new Promise(r => { imgEl.onload = r; imgEl.onerror = r; });
                    
                    validImages.push({
                        id: img.id,
                        w: imgEl.naturalWidth || 0,
                        h: imgEl.naturalHeight || 0,
                        comp,
                        data: new Uint8Array(buf)
                    });
                }
            } catch(e) {}
        }
        
        let bibBuf = null;
        if (validImages.length > 0) {
            let totalBytes = 8;
            for(const img of validImages) totalBytes += 24 + 2 + 4 + img.data.byteLength;
            const bibArr = new ArrayBuffer(totalBytes);
            const v = new DataView(bibArr);
            v.setUint8(0, 0x42); v.setUint8(1, 0x49); v.setUint8(2, 0x42); v.setUint8(3, 0x01); // BIB
            v.setUint32(4, validImages.length);
            let off = 8;
            for(const img of validImages) {
                v.setUint32(off, img.id); off+=4;
                v.setUint16(off, img.w); off+=2;
                v.setUint16(off, img.h); off+=2;
                v.setUint8(off++, 1); // RGBA type
                v.setUint8(off++, img.comp); // Compression
                off+=6; // Padding
                v.setUint16(off, 0); off+=2; // Block Count
                v.setUint32(off, img.data.byteLength); off+=4;
                const srcView = img.data;
                for(let i=0; i<srcView.length; i++) v.setUint8(off++, srcView[i]);
            }
            bibBuf = bibArr;
        }

        let bfbBuf = null;
        if (globalFonts.size > 0) {
            const fontList = Array.from(globalFonts.values());
            let totalFontBytes = 0;
            for(const f of fontList) {
                try {
                    const fr = await fetch(f.url);
                    if(fr.ok) {
                        f.data = await fr.arrayBuffer();
                        totalFontBytes += f.data.byteLength;
                    }
                } catch(e) {}
            }
            
            const validFonts = fontList.filter(f => f.data);
            if (validFonts.length > 0) {
                const bfbSize = 8 + validFonts.reduce((acc, f) => acc + 2 + 1 + f.family.length + 2 + 1 + 1 + 4 + f.data.byteLength, 0);
                const bfbArr = new ArrayBuffer(bfbSize);
                const v = new DataView(bfbArr);
                v.setUint8(0, 0x42); v.setUint8(1, 0x46); v.setUint8(2, 0x53); v.setUint8(3, 0x01); // BFS
                v.setUint32(4, validFonts.length);
                let off = 8;
                for(let i=0; i<validFonts.length; i++) {
                    const f = validFonts[i];
                    v.setUint16(off, i); off += 2;
                    const famBytes = new TextEncoder().encode(f.family);
                    v.setUint8(off++, famBytes.length);
                    for(const b of famBytes) v.setUint8(off++, b);
                    v.setUint16(off, f.weight); off += 2;
                    v.setUint8(off++, f.style);
                    v.setUint8(off++, 0); // format woff2=0
                    v.setUint32(off, f.data.byteLength); off += 4;
                    const srcView = new Uint8Array(f.data);
                    for(const b of srcView) v.setUint8(off++, b);
                }
                bfbBuf = bfbArr;
            }
        }

        for(const vfs of vfsBlocks) {
            archiveSize += appendSection(1, vfs.bml);
            archiveSize += appendSection(2, vfs.bdt);
            archiveSize += appendSection(7, vfs.blbDesktop);
            archiveSize += appendSection(8, vfs.blbTablet);
            archiveSize += appendSection(10, vfs.blbMobile);
        }
        if (bfbBuf) {
            archiveSize += appendSection(11, bfbBuf);
        }
        if (bibBuf) {
            archiveSize += appendSection(4, bibBuf);
        }

        const bwebBuf = new ArrayBuffer(archiveSize);
        const bwebView = new Uint8Array(bwebBuf);
        bwebView.set([0x42, 0x57, 0x45, 0x42, 0x01, secCount], 0);
        let curOffset = 6;
        for(const chunk of sections) {
            bwebView.set(chunk, curOffset);
            curOffset += chunk.length;
        }

        updateLoader(90, "Zusammenbau", `VFS TOC erstellt: ${Object.keys(toc).length} Seiten, ${archiveSize} Bytes`);
        resolve(bwebBuf);
    });
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
            } else if (secType === 11) {
                if(!sections[11]) sections[11] = [];
                sections[11].push(chunk);
            } else {
                if(!sections[secType]) sections[secType] = [];
                sections[secType].push(chunk);
            }
        }
        return sections;
    }
    if(u8[0]===0x42&&u8[1]===0x4D&&u8[2]===0x4C) return{1:[buf], vfs:[{bml:buf}]};
    return{1:[buf], vfs:[{bml:buf}]};
}

let currentVFSMap = {};
let globalEngine = null;
let currentBMLRoot = null;

function findBMLElementForNode(id, el) {
    if(!el) return null;
    // Simple BFS/DFS map if IDs align. Actually flatNodes indices are mapped to id.
    // In our parser, BML elements aren't given flatNode IDs explicitly.
    // But we know BDT nodes were built in exact DFS order of BML elements!
    // So we can flatten BML elements and index by id.
    const flatBML = [];
    const flatten = (n) => {
        if(n.type === 'text') return;
        flatBML.push(n);
        for(const c of n.children) flatten(c);
    };
    flatten(el);
    return flatBML[id] || null;
}

async function loadPage(path) {
    if (!currentVFSMap[path]) {
        console.warn("VFS: Page not found:", path);
        // Fallback to first page if not found
        path = Object.keys(currentVFSMap)[0];
        if(!path) return;
    }
    
    const vfsData = window.bwebVFS[currentVFSMap[path].index];
    if (!vfsData) return;

    window.history.pushState({path}, "", path);
    updateLoader(100, "VFS Routing", `Lade Seite: ${path}`);

    // 1. Parse BML
    let bmlStart=0;
    const bmlView=new Uint8Array(vfsData.bml);
    if(bmlView[0]===0x42&&bmlView[1]===0x4D&&bmlView[2]===0x4C)bmlStart=4;
    const parser=new BMLParser(vfsData.bml, bmlStart);
    currentBMLRoot = parser.parse();

    // 2. Parse BDT
    let bdtNodes = null;
    if(vfsData.bdt){
        bdtNodes = parseBDT(vfsData.bdt);
        renderBDTTree(bdtNodes);
    }

    // 3. Parse BLBs
    let blbs = {};
    if(vfsData.blbDesktop) blbs.desktop = parseBLB(vfsData.blbDesktop);
    if(vfsData.blbTablet) blbs.tablet = parseBLB(vfsData.blbTablet);
    if(vfsData.blbMobile) blbs.mobile = parseBLB(vfsData.blbMobile);

    // 4. Update Engine
    const canvasContainer = document.getElementById('renderTarget');
    if (!globalEngine) {
        globalEngine = new CanvasEngine();
        globalEngine.mount(canvasContainer);
        
        // --- VFS Router Hit-Testing ---
        globalEngine.canvas.addEventListener('click', (e) => {
            const rect = globalEngine.canvas.getBoundingClientRect();
            const scaleX = globalEngine.canvas.width / rect.width;
            const scaleY = globalEngine.canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            // Native scrolling means e.clientY is relative to the canvas's visible top,
            // but the canvas itself is very tall.
            // Wait, rect.top already accounts for scroll! So e.clientY - rect.top is the exact Y position inside the canvas, even if scrolled!
            const cy = (e.clientY - rect.top) * scaleY;
            
            const hitNode = globalEngine.hitTest(cx, cy);
            if (hitNode) {
                const el = findBMLElementForNode(hitNode.id, currentBMLRoot);
                if (el && el.attributes) {
                    const hrefAttr = el.attributes.find(a => a.id === 18 || a.id === ATTR_FWD['href']); 
                    if (hrefAttr) {
                        const hrefStr = new TextDecoder().decode(hrefAttr.val);
                        let newPath = hrefStr;
                        if (!newPath.startsWith('/')) {
                            const parts = window.location.pathname.split('/');
                            parts.pop();
                            parts.push(newPath);
                            newPath = parts.join('/');
                            newPath = newPath.replace(/\/\//g, '/');
                        }
                        newPath = newPath.split('?')[0].split('#')[0];
                        if(!newPath.startsWith('/')) newPath = '/' + newPath;
                        if (currentVFSMap[newPath]) {
                            showLoader("VFS Router", "Navigiere...");
                            setTimeout(() => loadPage(newPath), 50);
                        }
                    }
                }
            }
        });

                globalEngine.canvas.addEventListener('wheel', (e) => {
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

        globalEngine.canvas.addEventListener('mousemove', (e) => {
            const rect = globalEngine.canvas.getBoundingClientRect();
            const scaleX = globalEngine.canvas.width / rect.width;
            const scaleY = globalEngine.canvas.height / rect.height;
            const cx = (e.clientX - rect.left) * scaleX;
            const cy = (e.clientY - rect.top) * scaleY;
            
            const hitNode = globalEngine.hitTest(cx, cy);
            let isInteractive = false;
            let needsRedraw = false;
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
            if(needsRedraw) globalEngine.draw();
        });
    }

    if(bdtNodes && blbs.desktop) {
        globalEngine.update(bdtNodes[0], bdtNodes, blbs);
    }
    
    setTimeout(() => hideLoader(), 200);
}

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.path) loadPage(e.state.path);
});

async function renderBinary(buf){
    const t0=performance.now();
    const sections=parseBWEB(buf);
    
    window.bwebVFS = sections.vfs || [];
    currentVFSMap = {};

    if (sections[11]) { // BFB
        for (const chunk of sections[11]) {
            const v = new DataView(chunk);
            if (v.getUint8(0)===0x42 && v.getUint8(1)===0x46 && v.getUint8(2)===0x53) {
                let off = 4;
                const cnt = v.getUint32(off); off+=4;
                for (let i=0; i<cnt; i++) {
                    const id = v.getUint16(off); off+=2;
                    const flen = v.getUint8(off++);
                    const family = new TextDecoder().decode(new Uint8Array(chunk, off, flen)); off+=flen;
                    const weight = v.getUint16(off); off+=2;
                    const style = v.getUint8(off++);
                    const fmt = v.getUint8(off++);
                    const pLen = v.getUint32(off); off+=4;
                    const data = new Uint8Array(chunk, off, pLen); off+=pLen;
                    
                    try {
                        const font = new FontFace(family, data, { weight: weight.toString(), style: style===1?'italic':'normal' });
                        document.fonts.add(font);
                        await font.load();
                    } catch(e) { console.error('Font load error:', e); }
                }
            }
        }
    }
    
    if (sections[9]) {
        const tocView = new Uint8Array(sections[9]);
        if (tocView[0]===0x56 && tocView[1]===0x46 && tocView[2]===0x53 && tocView[3]===0x01) {
            const tocBytes = tocView.slice(4);
            const tocStr = new TextDecoder().decode(tocBytes);
            try { currentVFSMap = JSON.parse(tocStr); } catch(e){}
        }
    }

    let startPage = '/index.html';
    if (!currentVFSMap[startPage] && Object.keys(currentVFSMap).length > 0) {
        startPage = Object.keys(currentVFSMap)[0];
    }
    
    // If no TOC, fake one for the single page
    if(Object.keys(currentVFSMap).length === 0 && window.bwebVFS.length > 0) {
        currentVFSMap['/index.html'] = { index: 0 };
    }

    if (sections[4]) { await prepareGlobalBIB(sections[4]); }
    await loadPage(startPage);

    // Update Stats
    document.getElementById('statsGrid').style.display = 'grid';
    document.getElementById('statTotal').textContent = (buf.byteLength/1024).toFixed(1) + ' KB';
    document.getElementById('statTime').textContent = (performance.now()-t0).toFixed(1) + ' ms';
    if(window.bwebVFS.length > 0) {
        document.getElementById('statBml').textContent = (window.bwebVFS[0].bml.byteLength/1024).toFixed(1) + ' KB';
        document.getElementById('statBdt').textContent = window.bwebVFS[0].bdt ? (window.bwebVFS[0].bdt.byteLength/1024).toFixed(1) + ' KB' : '-';
        document.getElementById('statBlb').textContent = window.bwebVFS[0].blb ? (window.bwebVFS[0].blb.byteLength/1024).toFixed(1) + ' KB' : '-';
    }
    document.getElementById('sectionMap').style.display = 'block';
    const sbar=document.getElementById('sectionBar');
    sbar.innerHTML='';
    const total=buf.byteLength;
    if(sections[1]) sections[1].forEach(s => sbar.innerHTML+=`<div class="sec-bml" style="width:${(s.byteLength/total)*100}%"></div>`);
    if(sections[2]) sections[2].forEach(s => sbar.innerHTML+=`<div class="sec-bdt" style="width:${(s.byteLength/total)*100}%"></div>`);
    if(sections[3]) sections[3].forEach(s => sbar.innerHTML+=`<div class="sec-blb" style="width:${(s.byteLength/total)*100}%"></div>`);
    if(sections[4]) sections[4].forEach(s => sbar.innerHTML+=`<div class="sec-bib" style="width:${(s.byteLength/total)*100}%"></div>`);
}

(async()=>{
    try{
        const r=await fetch('page.bweb');
        if(r.ok){await renderBinary(await r.arrayBuffer());return}
    }catch(e){}
    try{
        const r=await fetch('page.bml');
        if(r.ok){await renderBinary(await r.arrayBuffer());return}
    }catch(e){}
})();


// Progress Bar & Overlay Helper Functions (Globally Accessible)
function showLoader(title, status) {
    document.getElementById('loadingOverlay').style.setProperty('display', 'flex', 'important');
    document.getElementById('loadingTitle').textContent = title;
    document.getElementById('loadingStatus').textContent = status;
    document.getElementById('loadingProgressBar').style.width = '0%';
    document.getElementById('loadingLog').innerHTML = '';
}

function updateLoader(percent, status, logText = null) {
    document.getElementById('loadingProgressBar').style.width = percent + '%';
    document.getElementById('loadingStatus').textContent = status;
    if (logText) {
        const logEl = document.getElementById('loadingLog');
        const div = document.createElement('div');
        const timeStr = new Date().toLocaleTimeString();
        const fullMsg = `[${timeStr}] ${logText}`;
        div.textContent = fullMsg;
        logEl.appendChild(div);
        logEl.scrollTop = logEl.scrollHeight;
        
        // Send to local log server
        fetch('http://localhost:8099/log', {
            method: 'POST',
            body: fullMsg
        }).catch(()=>{}); // Ignore if server is not running
    }
}

function hideLoader() {
    document.getElementById('loadingOverlay').style.setProperty('display', 'none', 'important');
}

function showSuccessModal(sizeBytes, nodeCount) {
    document.getElementById('modalStatSize').textContent = (sizeBytes / 1024).toFixed(1) + ' KB';
    document.getElementById('modalStatNodes').textContent = nodeCount;
    document.getElementById('modalStatSaving').textContent = '99.9%';
    
    const modal = document.getElementById('successModal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function hideSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

document.getElementById('modalClose').addEventListener('click', hideSuccessModal);
document.getElementById('successModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('successModal')) hideSuccessModal();
});

document.getElementById('modalBtnDownloadBweb').addEventListener('click', () => {
    document.getElementById('btnDownloadViewport').click();
    hideSuccessModal();
});

document.getElementById('modalBtnDownloadZip').addEventListener('click', () => {
    document.getElementById('btnDownloadZip').click();
    hideSuccessModal();
});

document.getElementById('btnFolderUpload').addEventListener('click', () => {
    document.getElementById('folderInput').click();
});

document.getElementById('folderInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    await compileFilesList(files);
    e.target.value = '';
});

async function readEntryRecursively(entry, path = '', filesList = []) {
    if (entry.isFile) {
        const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
        });
        file.customRelativePath = path ? `${path}/${file.name}` : file.name;
        filesList.push(file);
    } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve) => {
            const allEntries = [];
            function readBatch() {
                dirReader.readEntries((batch) => {
                    if (batch.length === 0) resolve(allEntries);
                    else { allEntries.push(...batch); readBatch(); }
                }, () => resolve(allEntries));
            }
            readBatch();
        });
        const currentPath = path ? `${path}/${entry.name}` : entry.name;
        for (const childEntry of entries) {
            await readEntryRecursively(childEntry, currentPath, filesList);
        }
    }
    return filesList;
}

async function compileFilesList(files) {
    const htmlFiles = files.filter(f => f.name.endsWith('.html') || f.name.endsWith('.htm'));
    const assetFiles = files.filter(f => !f.name.endsWith('.html') && !f.name.endsWith('.htm'));

    if (htmlFiles.length === 0) {
        alert("Keine HTML Dateien im Ordner gefunden!");
        return;
    }

    const btn = document.getElementById('btnFolderUpload');
    const oldText = btn.textContent;
    btn.textContent = 'Lese lokale Dateien...';
    btn.disabled = true;

    showLoader("Ordner-Kompilierung", "Analysiere hochgeladene Ordner-Struktur...");
    
    try {
        const fileDataMap = {};
        for (const file of assetFiles) {
            let dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.readAsDataURL(file);
            });
            if (file.name.endsWith('.css')) dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:text/css;');
            else if (file.name.endsWith('.js')) dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:application/javascript;');
            else if (file.name.endsWith('.svg')) dataUrl = dataUrl.replace(/^data:[^;]*;/, 'data:image/svg+xml;');

            let relativePath = file.customRelativePath || file.webkitRelativePath || file.name;
            if (relativePath && relativePath.includes('/')) {
                const pathParts = relativePath.split('/');
                pathParts.shift(); // Remove root folder
                relativePath = pathParts.join('/');
            }
            fileDataMap[relativePath] = dataUrl;
            fileDataMap[file.name] = dataUrl;
        }

        const htmlMap = {};
        for (const file of htmlFiles) {
            let relativePath = file.customRelativePath || file.webkitRelativePath || file.name;
            if (relativePath && relativePath.includes('/')) {
                const pathParts = relativePath.split('/');
                pathParts.shift(); // Remove root folder
                relativePath = pathParts.join('/');
            }
            if(!relativePath.startsWith('/')) relativePath = '/' + relativePath;
            
            let html = await new Promise(r => {
                const reader = new FileReader();
                reader.onload = ev => r(ev.target.result);
                reader.readAsText(file);
            });
            
            // Inline assets!
            html = html.replace(/href=["']([^"']+\.css)["']/ig, (match, p1) => {
                let cleanPath = p1.replace(/^\.\//, '');
                return `href="${fileDataMap[cleanPath] || fileDataMap[cleanPath.split('/').pop()] || p1}"`;
            });
            html = html.replace(/src=["']([^"']+\.js)["']/ig, (match, p1) => {
                let cleanPath = p1.replace(/^\.\//, '');
                return `src="${fileDataMap[cleanPath] || fileDataMap[cleanPath.split('/').pop()] || p1}"`;
            });
            html = html.replace(/src=["']([^"']+\.(png|jpe?g|svg|webp|gif))["']/ig, (match, p1) => {
                let cleanPath = p1.replace(/^\.\//, '');
                return `src="${fileDataMap[cleanPath] || fileDataMap[cleanPath.split('/').pop()] || p1}"`;
            });
            
            htmlMap[relativePath] = html;
        }
        
        await clientSideConvert(htmlMap);
        
        btn.textContent = oldText;
        btn.disabled = false;
    } catch(e) {
        console.error(e);
        alert("Fehler bei der Konvertierung: " + e);
        btn.textContent = oldText;
        btn.disabled = false;
        hideLoader();
    }
}
