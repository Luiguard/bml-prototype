(async () => {
    const url = window.location.href;
    const pathname = window.location.pathname.toLowerCase();
    const ext = pathname.split('.').pop();
    const bwebExtensions = ['bweb', 'bml', 'bdt', 'blb', 'bib'];

    if (!bwebExtensions.includes(ext)) {
        return;
    }

    const DANGEROUS_TAGS = new Set(['script','iframe','object','embed','applet','meta','link','base']);
    const DANGEROUS_ATTRS = new Set(['onclick','onsubmit','onload','onerror','onmouseover','onfocus','onblur','onchange','oninput','onkeydown','onkeyup','onkeypress','formaction','xlink:href','srcdoc','data']);
    const MAX_RECURSION_DEPTH = 256;
    const MAX_SECTION_SIZE = 256 * 1024 * 1024;
    const MAX_CANVAS_DIM = 8192;
    const SUPPORTED_CONTAINER_VERSION = 0x01;

    console.log(`⚡ BWEB Native Browser Engine: Intercepted ${ext.toUpperCase()} load for ${url}`);

    // Replaces document with clean canvas target
    document.documentElement.innerHTML = `
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BWEB Native Player</title>
        <style>
            *, *::before, *::after { box-sizing: border-box; }
            body { margin: 0; padding: 0; background: #fff; color: #000; font-family: system-ui, -apple-system, sans-serif; overflow-x: hidden; }
            #renderTarget { width: 100%; min-height: 100vh; position: relative; }
            .rendered-node { box-sizing: border-box; }
        </style>
    </head>
    <body>
        <div id="renderTarget"></div>
    </body>`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP Fehler ${response.status}`);
        const buffer = await response.arrayBuffer();

        // BWEB Engine Constants
        const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'div',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFD:'#text',0xFD:'#text',0xFD:'#text',0xFE:'div',0xFF:'div'};
        const ATTR_REV={0x10:'class',0x11:'id',0x12:'href',0x13:'src',0x14:'style',0x15:'type',0x16:'name',0x17:'value',0x18:'placeholder',0x19:'alt',0x1A:'title',0x1B:'action',0x1C:'method',0x1D:'target',0x1E:'rel',0x1F:'role',0x20:'aria-label',0x21:'data-bind',0x22:'data-onclick',0x23:'data-onsubmit',0x24:'width',0x25:'height',0x26:'disabled',0x27:'checked',0x28:'selected',0x29:'required',0x2A:'autofocus',0x2B:'autocomplete',0x2C:'min',0x2D:'max',0x2E:'step',0x2F:'pattern',0x30:'for',0x31:'tabindex',0x32:'content',0x33:'charset',0x34:'http-equiv',0x35:'lang',0x36:'dir',0x37:'hidden'};
        const DISPLAY=['block','inline','flex','grid','none','inline-block','inline-flex'];
        const POSITION=['static','relative','absolute','fixed','sticky'];
        const TEXT_ALIGN=['left','center','right','justify'];
        const FLEX_DIR=['row','column','row-reverse','column-reverse'];
        const JUSTIFY=['flex-start','flex-end','center','space-between','space-around','space-evenly'];
        const ALIGN_ITEMS=['flex-start','flex-end','center','stretch','baseline'];
        const OVERFLOW=['visible','hidden','scroll','auto'];
        const BLB_BLOCK_SIZE=60;

        // BWEB Parsers
        class BMLParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.d=new TextDecoder('utf-8');this.o=offset;this.globalNodeIndex=0}
            parseNode(depth=0){
                if(depth>MAX_RECURSION_DEPTH||this.o>=this.v.byteLength)return null;
                const tagByte=this.v.getUint8(this.o++);
                const nAttr=this.v.getUint8(this.o++);
                const nChild=this.v.getUint32(this.o);this.o+=4;
                const tLen=this.v.getUint32(this.o);this.o+=4;
                
                const tagName=TAG_REV[tagByte]||'div';
                if (tagName === '#text') {
                    const txt = tLen > 0 ? this.d.decode(new Uint8Array(this.v.buffer, this.v.byteOffset + this.o, tLen)) : '';
                    this.o += tLen;
                    return document.createTextNode(txt);
                }

                const currentNid=this.globalNodeIndex++;
                if(DANGEROUS_TAGS.has(tagName)){
                    for(let i=0;i<nAttr;i++){
                        if(this.o+3>this.v.byteLength)return null;
                        this.o++;
                        const aLen=this.v.getUint32(this.o);this.o+=4;
                        if(this.o+aLen>this.v.byteLength)return null;
                        this.o+=aLen;
                    }
                    if(tLen>0){if(this.o+tLen>this.v.byteLength)return null;this.o+=tLen;}
                    for(let i=0;i<nChild;i++){this.parseNode(depth+1);}
                    return null;
                }
                const el=document.createElement(tagName);
                el.classList.add('rendered-node',`bml-tag-${tagName}`);
                el.setAttribute('data-node-id',currentNid);
                for(let i=0;i<nAttr;i++){
                    if(this.o+3>this.v.byteLength)break;
                    const aId=this.v.getUint8(this.o++);
                    const aLen=this.v.getUint32(this.o);this.o+=4;
                    if(this.o+aLen>this.v.byteLength)break;
                    const aVal=this.d.decode(new Uint8Array(this.v.buffer,this.o,aLen));this.o+=aLen;
                    const aName=ATTR_REV[aId];
                    if(!aName||aName==='style'||DANGEROUS_ATTRS.has(aName))continue;
                    if((aName==='href'||aName==='src'||aName==='action')&&/^\s*javascript:/i.test(aVal))continue;
                    
                    el.setAttribute(aName,aVal);
                }
                if(tLen>0){
                    if(this.o+tLen>this.v.byteLength){return el;}
                    const txt=this.d.decode(new Uint8Array(this.v.buffer,this.o,tLen));this.o+=tLen;
                    el.textContent=txt;
                }
                for(let i=0;i<nChild;i++){const c=this.parseNode(depth+1);if(c)el.appendChild(c)}
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
            const nt=this.v.getUint8(this.o++);
            const tt=this.v.getUint8(this.o++);
            const depth=this.v.getUint8(this.o++);
            nodes.push({nId:nid,pId:pid,fcId:fc,nsId:ns,type:nt,tag:tt,depth});
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
            const o=this.o;
            const nid=this.v.getUint16(o);
            const display=this.v.getUint8(o+2);
            const position=this.v.getUint8(o+3);
            const boxSizing=this.v.getUint8(o+4);
            const w=this.v.getUint16(o+5);
            const h=this.v.getUint16(o+7);
            const mt=this.v.getInt16(o+9),mr=this.v.getInt16(o+11),mb=this.v.getInt16(o+13),ml=this.v.getInt16(o+15);
            const pt=this.v.getUint16(o+17),pr=this.v.getUint16(o+19),pb=this.v.getUint16(o+21),pl=this.v.getUint16(o+23);
            const btw=this.v.getUint8(o+25),brw=this.v.getUint8(o+26),bbw=this.v.getUint8(o+27),blw=this.v.getUint8(o+28);
            const borderCol=this.v.getUint32(o+29);
            const bgCol=this.v.getUint32(o+33);
            const col=this.v.getUint32(o+37);
            const fs=this.v.getUint16(o+41);
            const fw=this.v.getUint16(o+43);
            const lh=this.v.getUint16(o+45);
            const textAl=this.v.getUint8(o+47);
            const flexDir=this.v.getUint8(o+48);
            const flexWrap=this.v.getUint8(o+49);
            const justify=this.v.getUint8(o+50);
            const alignIt=this.v.getUint8(o+51);
            const gap=this.v.getUint16(o+52);
            const borderRad=this.v.getUint16(o+54);
            const overflow=this.v.getUint8(o+56);
            const opacity=this.v.getUint8(o+57);
            const zIndex=this.v.getInt16(o+58);
            blocks.push({nId:nid,display,position,boxSizing,w,h,mt,mr,mb,ml,pt,pr,pb,pl,btw,brw,bbw,blw,borderCol,bgCol,col,fs,fw,lh,textAl,flexDir,flexWrap,justify,alignIt,gap,borderRad,overflow,opacity,zIndex});
            this.o+=60;
        }
        return blocks;
    }
}


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
                    this.o+=6;
                    const blockId=this.v.getUint16(this.o);this.o+=2;
                    const dataLen=this.v.getUint32(this.o);this.o+=4;
                    if(w>MAX_CANVAS_DIM||h>MAX_CANVAS_DIM)throw new Error(`BIB: Bilddimensionen ${w}x${h} überschreiten Limit ${MAX_CANVAS_DIM}`);
                    if(comp === 0 && dataLen!==w*h*4)throw new Error(`BIB: dataLen ${dataLen} != erwartete ${w*h*4} Bytes`);
                    if(this.o+dataLen>this.v.byteLength)throw new Error('BIB: Buffer-Overread');
                    const pxData=new Uint8Array(this.v.buffer,this.o,dataLen);
                    this.o+=dataLen;
                    images[id]={w,h,comp,data:pxData};
                }
                return images;
            }
        }

        class BVSParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset;this.u8=new Uint8Array(buf)}
            parse(){
                const count=this.v.getUint32(this.o);this.o+=4;
                const videos={};
                for(let i=0;i<count;i++){
                    const id=this.v.getUint32(this.o);this.o+=4;
                    const w=this.v.getUint16(this.o);this.o+=2;
                    const h=this.v.getUint16(this.o);this.o+=2;
                    const codecLen=this.v.getUint8(this.o++);
                    if(this.o+codecLen>this.v.byteLength)throw new Error('BVS: Buffer-Overread');
                    const codec=new TextDecoder('ascii').decode(this.u8.slice(this.o,this.o+codecLen));
                    this.o+=codecLen;
                    const chunkCount=this.v.getUint32(this.o);this.o+=4;
                    if(w>MAX_CANVAS_DIM||h>MAX_CANVAS_DIM)throw new Error(`BVS: Videodimensionen ${w}x${h} überschreiten Limit`);
                    const chunks=[];
                    for(let j=0;j<chunkCount;j++){
                        const flags=this.v.getUint8(this.o++);
                        const isKey=(flags&1)===1;
                        const ptsHigh=this.v.getUint32(this.o);this.o+=4;
                        const ptsLow=this.v.getUint32(this.o);this.o+=4;
                        const pts=Number((BigInt(ptsHigh)<<32n)|BigInt(ptsLow));
                        const dur=this.v.getUint32(this.o);this.o+=4;
                        const dataLen=this.v.getUint32(this.o);this.o+=4;
                        if(this.o+dataLen>this.v.byteLength)throw new Error('BVS: Buffer-Overread');
                        const data=this.u8.slice(this.o,this.o+dataLen);
                        this.o+=dataLen;
                        chunks.push({type:isKey?'key':'delta',timestamp:pts,duration:dur,data});
                    }
                    videos[id]={w,h,codec,chunks};
                }
                return videos;
        class BASParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset;this.u8=new Uint8Array(buf)}
            parse(){
                if(this.o+4>this.v.byteLength)return {};
                const count=this.v.getUint32(this.o);this.o+=4;
                const audios={};
                for(let i=0;i<count;i++){
                    if(this.o+11>this.v.byteLength)break;
                    const id=this.v.getUint32(this.o);this.o+=4;
                    const codecLen=this.v.getUint8(this.o++);
                    if(this.o+codecLen>this.v.byteLength)break;
                    const codec=new TextDecoder('ascii').decode(this.u8.slice(this.o,this.o+codecLen));
                    this.o+=codecLen;
                    const sampleRate=this.v.getUint32(this.o);this.o+=4;
                    const channels=this.v.getUint8(this.o++);
                    const chunkCount=this.v.getUint32(this.o);this.o+=4;
                    const chunks=[];
                    for(let j=0;j<chunkCount;j++){
                        if(this.o+13>this.v.byteLength)break;
                        const flags=this.v.getUint8(this.o++);
                        const isKey=(flags&1)===1;
                        const ptsHigh=this.v.getUint32(this.o);this.o+=4;
                        const ptsLow=this.v.getUint32(this.o);this.o+=4;
                        const pts=Number((BigInt(ptsHigh)<<32n)|BigInt(ptsLow));
                        const dur=this.v.getUint32(this.o);this.o+=4;
                        const dataLen=this.v.getUint32(this.o);this.o+=4;
                        if(this.o+dataLen>this.v.byteLength)break;
                        const data=this.u8.slice(this.o,this.o+dataLen);
                        this.o+=dataLen;
                        chunks.push({type:isKey?'key':'delta',timestamp:pts,duration:dur,data});
                    }
                    audios[id]={codec,sampleRate,channels,chunks};
                }
                return audios;
            }
        }

        class BEXParser {
            constructor(buf, offset = 0) {
                this.v = new DataView(buf);
                this.d = new TextDecoder('utf-8');
                this.o = offset;
            }
            parse() {
                if (this.o + 4 > this.v.byteLength) return [];
                const count = this.v.getUint32(this.o); this.o += 4;
                const rules = [];
                for (let i = 0; i < count; i++) {
                    if (this.o + 14 > this.v.byteLength) break;
                    const triggerNode = this.v.getUint32(this.o); this.o += 4;
                    const eventType = this.v.getUint8(this.o++);
                    const actionType = this.v.getUint8(this.o++);
                    const targetNode = this.v.getUint32(this.o); this.o += 4;
                    const paramLen = this.v.getUint16(this.o); this.o += 2;
                    
                    if (this.o + paramLen > this.v.byteLength) break;
                    const paramStr = this.d.decode(new Uint8Array(this.v.buffer, this.o, paramLen));
                    this.o += paramLen;
                    
                    rules.push({ triggerNode, eventType, actionType, targetNode, paramStr });
                }
                return rules;
            }
        }
            }
        }

        class BASParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset;this.u8=new Uint8Array(buf)}
            parse(){
                const count=this.v.getUint32(this.o);this.o+=4;
                const audios={};
                for(let i=0;i<count;i++){
                    const id=this.v.getUint32(this.o);this.o+=4;
                    const codecLen=this.v.getUint8(this.o++);
                    const codec=new TextDecoder('ascii').decode(this.u8.slice(this.o,this.o+codecLen));
                    this.o+=codecLen;
                    const sampleRate=this.v.getUint32(this.o);this.o+=4;
                    const channels=this.v.getUint8(this.o++);
                    const chunkCount=this.v.getUint32(this.o);this.o+=4;
                    const chunks=[];
                    for(let j=0;j<chunkCount;j++){
            const targetNode = this.v.getUint32(this.o); this.o += 4;
            const paramLen = this.v.getUint16(this.o); this.o += 2;
            
            if (this.o + paramLen > this.v.byteLength) break;
            const paramStr = this.d.decode(new Uint8Array(this.v.buffer, this.o, paramLen));
            this.o += paramLen;
            
            rules.push({ triggerNode, eventType, actionType, targetNode, paramStr });
        }
        return rules;
    }
}

        // BWEB Container Section Unpacker
        function parseBWEB(buf){
            const dv=new DataView(buf);
            if(buf.byteLength<10)throw new Error('BWEB: Container zu klein');
            const magic=String.fromCharCode(dv.getUint8(0),dv.getUint8(1),dv.getUint8(2),dv.getUint8(3));
            if(magic!=='BWEB')throw new Error('Ungültiges BWEB Magic');
            const version=dv.getUint8(4);
            if(version!==1)throw new Error(`BWEB: Unbekannte Container-Version ${version}`);
            
            const flags = dv.getUint8(5);
            const dirOffset = dv.getUint32(6);
            
            if (dirOffset >= buf.byteLength || dirOffset === 0) throw new Error('BWEB: Ungültiges Central Directory Offset');
            
            let o = dirOffset;
            const nSec = dv.getUint16(o); o += 2;
            
            const sections={};
            for(let i=0;i<nSec;i++){
                if(o+9 > buf.byteLength)break;
                const type=dv.getUint8(o++);
                const offset=dv.getUint32(o); o+=4;
                const len=dv.getUint32(o); o+=4;
                
                if(!sections[type]) sections[type] = [];
                sections[type].push(buf.slice(offset,offset+len));
            }
            return sections;
        }

        // Core Layout Injector functions
        async function applyBDT(root,nodes){
            const elements={};
            if(root.hasAttribute('data-node-id')){
                elements[parseInt(root.getAttribute('data-node-id'))]=root;
            }
            root.querySelectorAll('[data-node-id]').forEach(el=>{
                elements[parseInt(el.getAttribute('data-node-id'))]=el;
            });
            return elements;
        }

        async function applyBLB(elements,blocks){
            for(const b of blocks){
                const el=elements[b.nid];
                if(!el)continue;
                const s=el.style;
                if(b.display!==undefined)s.display=DISPLAY[b.display]||'';
                if(b.position>0)s.position=POSITION[b.position];
                if(b.boxSizing)s.boxSizing='border-box';
                if(b.width!==0xFFFF)s.width=cssVal(b.width);
                if(b.height!==0xFFFF)s.height=cssVal(b.height);
                if(b.margin.t)s.marginTop=cssVal(b.margin.t);
                if(b.margin.r)s.marginRight=cssVal(b.margin.r);
                if(b.margin.b)s.marginBottom=cssVal(b.margin.b);
                if(b.margin.l)s.marginLeft=cssVal(b.margin.l);
                if(b.padding.t)s.paddingTop=cssVal(b.padding.t);
                if(b.padding.r)s.paddingRight=cssVal(b.padding.r);
                if(b.padding.b)s.paddingBottom=cssVal(b.padding.b);
                if(b.padding.l)s.paddingLeft=cssVal(b.padding.l);
                if(b.borderWidth.t||b.borderWidth.r||b.borderWidth.b||b.borderWidth.l){
                    s.borderStyle='solid';
                    s.borderTopWidth=b.borderWidth.t/10+'px';
                    s.borderRightWidth=b.borderWidth.r/10+'px';
                    s.borderBottomWidth=b.borderWidth.b/10+'px';
                    s.borderLeftWidth=b.borderWidth.l/10+'px';
                    if(b.borderColor)s.borderColor=rgba(b.borderColor);
                }
                if(b.bgColor)s.backgroundColor=rgba(b.bgColor);
                if(b.color!==0x000000FF&&b.color!==0)s.color=rgba(b.color);
                if(b.fontSize!==160)s.fontSize=b.fontSize/10+'px';
                if(b.fontWeight!==400)s.fontWeight=b.fontWeight;
                if(b.lineHeight>0)s.lineHeight=b.lineHeight/10+'px';
                if(b.textAlign>0)s.textAlign=TEXT_ALIGN[b.textAlign];
                if(b.display===2||b.display===6){
                    if(b.flexDir>0)s.flexDirection=FLEX_DIR[b.flexDir];
                    if(b.flexWrap)s.flexWrap='wrap';
                    if(b.justifyContent>0)s.justifyContent=JUSTIFY[b.justifyContent];
                    if(b.alignItems!==3)s.alignItems=ALIGN_ITEMS[b.alignItems];
                }
                if(b.gap>0)s.gap=b.gap/10+'px';
                if(b.borderRadius>0)s.borderRadius=b.borderRadius/10+'px';
                if(b.overflow>0)s.overflow=OVERFLOW[b.overflow];
                if(b.opacity<255)s.opacity=(b.opacity/255).toFixed(2);
                if(b.zIndex!==0)s.zIndex=b.zIndex;
            }
        }

        async function applyBIB(rootEl,images){
            const canvases=rootEl.querySelectorAll('canvas[data-bind]');
            const promises=Array.from(canvases).map(async cvs=>{
                const id=parseInt(cvs.getAttribute('data-bind'));
                const img=images[id];
                if(img){
                    cvs.width=img.w;
                    cvs.height=img.h;
                    const ctx=cvs.getContext('2d');
                    if (img.comp === 0) {
                        const imgData=new ImageData(new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.w * img.h * 4),img.w,img.h);
                        const bitmap=await createImageBitmap(imgData);
                        ctx.drawImage(bitmap,0,0);
                    if (targetUrl.endsWith("/")) targetUrl = targetUrl.slice(0, -1);
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

        async function applyBVS(rootEl,videos){
            if(!('VideoDecoder' in window)){console.warn('WebCodecs API not supported.');return}
            const canvases=rootEl.querySelectorAll('canvas[data-bind-video]');
            for(const canvas of canvases){
                const vidId=parseInt(canvas.getAttribute('data-bind-video'));
                const vid=videos[vidId];
                if(!vid)continue;
                canvas.width=vid.w;canvas.height=vid.h;
                const ctx=canvas.getContext('2d');
                const playbackLoop=async()=>{
                    let startRealTime=performance.now();
                    let currentChunk=0;
                    let pendingFrames=[];
                    const decoder=new VideoDecoder({
                        output:(frame)=>pendingFrames.push(frame),
                        error:(e)=>console.error('VideoDecoder error:',e)
                    });
                    decoder.configure({codec:vid.codec,codedWidth:vid.w,codedHeight:vid.h,hardwareAcceleration:'prefer-hardware'});
                    while(true){
                        while(decoder.decodeQueueSize<10&&currentChunk<vid.chunks.length){
                            decoder.decode(new EncodedVideoChunk(vid.chunks[currentChunk++]));
                        }
                        if(pendingFrames.length>0){
                            const frame=pendingFrames[0];
                            const elapsedRealUs=(performance.now()-startRealTime)*1000;
                            if(frame.timestamp<=elapsedRealUs){
                                ctx.drawImage(frame,0,0,canvas.width,canvas.height);
                                frame.close();
                                pendingFrames.shift();
                            }
                        }
                        if(currentChunk>=vid.chunks.length&&pendingFrames.length===0){
                            await decoder.flush();
                            currentChunk=0;
                            startRealTime=performance.now();
                        }
                        await new Promise(r=>requestAnimationFrame(r));
                    }
                };
                playbackLoop();
            }
        }

        let globalAudioContext=null;
        async function applyBAS(rootEl,audios){
            if(!('AudioDecoder' in window)){console.warn('WebCodecs AudioDecoder not supported.');return}
            if(!globalAudioContext)globalAudioContext=new(window.AudioContext||window.webkitAudioContext)();
            const resumeAudio=()=>{
                if(globalAudioContext.state==='suspended')globalAudioContext.resume();
                document.removeEventListener('click',resumeAudio);
                document.removeEventListener('keydown',resumeAudio);
            };
            document.addEventListener('click',resumeAudio);
            document.addEventListener('keydown',resumeAudio);
            const canvases=rootEl.querySelectorAll('canvas[data-bind-audio]');
            for(const canvas of canvases){
                const audId=parseInt(canvas.getAttribute('data-bind-audio'));
                const aud=audios[audId];
                if(!aud)continue;
                let totalSamples=0;
                const decodedBuffers=[];
                const decoder=new AudioDecoder({
                    output:(audioData)=>{
                        const planarData=[];
                        for(let c=0;c<audioData.numberOfChannels;c++){
                            const chData=new Float32Array(audioData.numberOfFrames);
                            audioData.copyTo(chData,{planeIndex:c,format:'f32-planar'});
                            planarData.push(chData);
                        }
                        decodedBuffers.push({frames:audioData.numberOfFrames,data:planarData});
                        totalSamples+=audioData.numberOfFrames;
                        audioData.close();
                    },
                    error:(e)=>console.error('AudioDecoder error:',e)
                });
                decoder.configure({codec:aud.codec,sampleRate:aud.sampleRate,numberOfChannels:aud.channels});
                for(const chunk of aud.chunks){decoder.decode(new EncodedAudioChunk(chunk))}
                await decoder.flush();
                if(decodedBuffers.length===0)continue;
                const finalBuffer=globalAudioContext.createBuffer(aud.channels,totalSamples,aud.sampleRate);
                let offset=0;
                for(const db of decodedBuffers){
                    for(let c=0;c<aud.channels;c++){finalBuffer.getChannelData(c).set(db.data[c],offset)}
                    offset+=db.frames;
                }
                let sourceNode=null;
                let videoStartTime=performance.now();
                function playAudio(offsetSec){
                    if(globalAudioContext.state==='suspended')return;
                    if(sourceNode){try{sourceNode.stop()}catch(e){}}
                    sourceNode=globalAudioContext.createBufferSource();
                    sourceNode.buffer=finalBuffer;
                    sourceNode.connect(globalAudioContext.destination);
                    sourceNode.start(0,offsetSec);
                }
                canvas.addEventListener('bvs-loop-restart',(e)=>{videoStartTime=e.detail.time;playAudio(0)});
                globalAudioContext.addEventListener('statechange',()=>{
                    if(globalAudioContext.state==='running'){
                        let elapsedSec=(performance.now()-videoStartTime)/1000;
                        elapsedSec=elapsedSec%(totalSamples/aud.sampleRate);
                        playAudio(elapsedSec);
                    }
                });
            }
        }

        // Native Render Binary Pipeline
        async function renderBinary(buf){
            const sections=parseBWEB(buf);
            const bmlBuf=sections[1];
            const bdtBuf=sections[2];
            const blbBuf=sections[3];

            let rootEl=null;

            if(bmlBuf){
                const bmlView=new Uint8Array(bmlBuf);
                let bmlStart=0;
                if(bmlView[0]===0x42&&bmlView[1]===0x4D&&bmlView[2]===0x4C)bmlStart=4;
                const parser=new BMLParser(bmlBuf,bmlStart);
                rootEl=parser.parseNode();
            }

            if(bdtBuf&&rootEl){
                const bdtView=new Uint8Array(bdtBuf);
                let bdtStart=0;
                if(bdtView[0]===0x42&&bdtView[1]===0x44&&bdtView[2]===0x54)bdtStart=4;
                const bdtNodes=new BDTParser(bdtBuf,bdtStart).parse();
                const elements=await applyBDT(rootEl,bdtNodes);

                if(blbBuf){
                    const blbView=new Uint8Array(blbBuf);
                    let blbStart=0;
                    if(blbView[0]===0x42&&blbView[1]===0x4C&&blbView[2]===0x42)blbStart=4;
                    const blbBlocks=new BLBParser(blbBuf,blbStart).parse();
                    await applyBLB(elements,blbBlocks);
                }
            }

            if(rootEl&&sections[4]){
                const bibBuf=sections[4];
                const bibView=new Uint8Array(bibBuf);
                let bibStart=0;
                if(bibView[0]===0x42&&bibView[1]===0x49&&bibView[2]===0x42)bibStart=4;
                const imgs=new BIBParser(bibBuf,bibStart).parse();
                await applyBIB(rootEl,imgs);
            }

            if(rootEl&&sections[5]){
                const bvsBuf=sections[5];
                const bvsView=new Uint8Array(bvsBuf);
                let bvsStart=0;
                if(bvsView[0]===0x42&&bvsView[1]===0x56&&bvsView[2]===0x53)bvsStart=4;
                const videos=new BVSParser(bvsBuf,bvsStart).parse();
                await applyBVS(rootEl,videos);
            }

            if(rootEl&&sections[6]){
                const basBuf=sections[6];
                const basView=new Uint8Array(basBuf);
                let basStart=0;
                if(basView[0]===0x42&&basView[1]===0x41&&basView[2]===0x53)basStart=4;
                const audios=new BASParser(basBuf,basStart).parse();
                await applyBAS(rootEl,audios);
            }

            


              const target=document.getElementById('renderTarget');
            target.innerHTML='';
            if(rootEl){
                target.appendChild(rootEl);
            }
        }

        await renderBinary(buffer);
    } catch(e) {
        console.error("BWEB Native Engine Error:", e);
        


              const target=document.getElementById('renderTarget');
        target.innerHTML='';
        const errBox=document.createElement('div');
        errBox.setAttribute('style','padding: 2rem; max-width: 600px; margin: 40px auto; background: #1e1b4b; border: 1px solid #312e81; border-radius: 8px; text-align: center;');
        const h=document.createElement('h2');h.setAttribute('style','color: #ef4444; margin-top: 0;');h.textContent='BWEB Ladefehler';errBox.appendChild(h);
        const p1=document.createElement('p');p1.setAttribute('style','color: #cbd5e1; line-height: 1.6;');p1.textContent='Die native BWEB-Erweiterung konnte die Binärdatei nicht rendern.';errBox.appendChild(p1);
        const p2=document.createElement('p');p2.setAttribute('style','color: #94a3b8; font-size: 0.85rem;');p2.textContent='Details: '+(e instanceof Error?e.message:'Unbekannter Fehler');errBox.appendChild(p2);
        target.appendChild(errBox);
    }
})();
