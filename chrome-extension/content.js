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
        const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'div',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFE:'div',0xFF:'div'};
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
                const el=document.createElement(tagName);
                el.classList.add('rendered-node',`bml-tag-${tagName}`);
                for(let i=0;i<nAttr;i++){
                    if(this.o+3>this.v.byteLength)break;
                    const aId=this.v.getUint8(this.o++);
                    const aLen=this.v.getUint16(this.o);this.o+=2;
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
                const nodes=[];
                while(this.o<this.v.byteLength){
                    const nId=this.v.getUint16(this.o);this.o+=2;
                    const pId=this.v.getUint16(this.o);this.o+=2;
                    const fcId=this.v.getUint16(this.o);this.o+=2;
                    const nsId=this.v.getUint16(this.o);this.o+=2;
                    const tag=this.v.getUint8(this.o++);
                    const textLen=this.v.getUint16(this.o);this.o+=2;
                    nodes.push({nId,pId,fcId,nsId,tag,textLen,children:[]});
                }
                return nodes;
            }
        }

        class BLBParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
            parse(){
                const blocks=[];
                while(this.o<this.v.byteLength){
                    const nId=this.v.getUint16(this.o);this.o+=2;
                    const display=this.v.getUint8(this.o++);
                    const position=this.v.getUint8(this.o++);
                    const x=this.v.getInt32(this.o)/100;this.o+=4;
                    const y=this.v.getInt32(this.o)/100;this.o+=4;
                    const w=this.v.getInt32(this.o)/100;this.o+=4;
                    const h=this.v.getInt32(this.o)/100;this.o+=4;
                    const padT=this.v.getInt32(this.o)/100;this.o+=4;
                    const padR=this.v.getInt32(this.o)/100;this.o+=4;
                    const padB=this.v.getInt32(this.o)/100;this.o+=4;
                    const padL=this.v.getInt32(this.o)/100;this.o+=4;
                    const bgR=this.v.getUint8(this.o++);
                    const bgG=this.v.getUint8(this.o++);
                    const bgB=this.v.getUint8(this.o++);
                    const bgA=this.v.getUint8(this.o++)/255;
                    const borderRad=this.v.getUint16(this.o)/100;this.o+=2;
                    const textAl=this.v.getUint8(this.o++);
                    const flexDir=this.v.getUint8(this.o++);
                    const flexWrap=this.v.getUint8(this.o++);
                    const justify=this.v.getUint8(this.o++);
                    const alignIt=this.v.getUint8(this.o++);
                    const overflow=this.v.getUint8(this.o++);
                    const opacity=this.v.getUint8(this.o++)/100;
                    const zIndex=this.v.getInt32(this.o);this.o+=4;
                    const rowGap=this.v.getUint16(this.o)/100;this.o+=2;
                    blocks.push({nId,display,position,x,y,w,h,padT,padR,padB,padL,bgR,bgG,bgB,bgA,borderRad,textAl,flexDir,flexWrap,justify,alignIt,overflow,opacity,zIndex,rowGap});
                }
                return blocks;
            }
        }

        class BIBParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
            parse(){
                const imgs=[];
                while(this.o+10<=this.v.byteLength){
                    const id=this.v.getUint16(this.o);this.o+=2;
                    const w=this.v.getUint16(this.o);this.o+=2;
                    const h=this.v.getUint16(this.o);this.o+=2;
                    const dataLen=this.v.getUint32(this.o);this.o+=4;
                    if(w>MAX_CANVAS_DIM||h>MAX_CANVAS_DIM)throw new Error(`BIB: Bilddimensionen ${w}x${h} überschreiten Limit ${MAX_CANVAS_DIM}`);
                    if(dataLen!==w*h*4)throw new Error(`BIB: dataLen ${dataLen} != erwartete ${w*h*4} Bytes`);
                    if(this.o+dataLen>this.v.byteLength)throw new Error('BIB: Buffer-Overread');
                    const rgba=new Uint8Array(this.v.buffer,this.o,dataLen);this.o+=dataLen;
                    imgs.push({id,w,h,rgba});
                }
                return imgs;
            }
        }

        class BVSParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
            parse(){
                const vids=[];
                while(this.o+11<=this.v.byteLength){
                    const id=this.v.getUint16(this.o);this.o+=2;
                    const w=this.v.getUint16(this.o);this.o+=2;
                    const h=this.v.getUint16(this.o);this.o+=2;
                    const fps=this.v.getUint8(this.o++);
                    const dataLen=this.v.getUint32(this.o);this.o+=4;
                    if(w>MAX_CANVAS_DIM||h>MAX_CANVAS_DIM)throw new Error(`BVS: Videodimensionen ${w}x${h} überschreiten Limit`);
                    if(this.o+dataLen>this.v.byteLength)throw new Error('BVS: Buffer-Overread');
                    const stream=new Uint8Array(this.v.buffer,this.o,dataLen);this.o+=dataLen;
                    vids.push({id,w,h,fps,stream});
                }
                return vids;
            }
        }

        class BASParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset}
            parse(){
                const auds=[];
                while(this.o<this.v.byteLength){
                    const id=this.v.getUint16(this.o);this.o+=2;
                    const sampleRate=this.v.getUint32(this.o);this.o+=4;
                    const channels=this.v.getUint8(this.o++);
                    const dataLen=this.v.getUint32(this.o);this.o+=4;
                    const stream=new Uint8Array(this.v.buffer,this.o,dataLen);this.o+=dataLen;
                    auds.push({id,sampleRate,channels,stream});
                }
                return auds;
            }
        }

        // BWEB Container Section Unpacker
        function parseBWEB(buf){
            const v=new DataView(buf);
            if(buf.byteLength<6)throw new Error('BWEB: Container zu klein');
            const magic=String.fromCharCode(v.getUint8(0),v.getUint8(1),v.getUint8(2),v.getUint8(3));
            if(magic!=='BWEB')throw new Error('Ungültiges BWEB Magic');
            const version=v.getUint8(4);
            if(version!==SUPPORTED_CONTAINER_VERSION)throw new Error(`BWEB: Unbekannte Container-Version ${version}`);
            const nSec=v.getUint8(5);
            if(nSec>16)throw new Error(`BWEB: Zu viele Sektionen (${nSec}>16)`);
            let o=6;
            const sections={};
            for(let i=0;i<nSec;i++){
                if(o+5>buf.byteLength)throw new Error('BWEB: Unvollständiger Section-Header');
                const type=v.getUint8(o++);
                const len=v.getUint32(o);o+=4;
                if(len>MAX_SECTION_SIZE)throw new Error(`BWEB: Sektion ${type} überschreitet ${MAX_SECTION_SIZE} Bytes`);
                if(o+len>buf.byteLength)throw new Error(`BWEB: Sektion ${type} liest über Buffer-Ende (${o+len}>${buf.byteLength})`);
                sections[type]=buf.slice(o,o+len);o+=len;
            }
            return sections;
        }

        // Core Layout Injector functions
        async function applyBDT(root,nodes){
            const elements={};
            const mapNode=(nId,el)=>{
                elements[nId]=el;
                el.setAttribute('data-node-id',nId);
            };
            const bmlNodes=Array.from(root.querySelectorAll('.rendered-node'));
            bmlNodes.forEach((el,idx)=>mapNode(idx,el));
            return elements;
        }

        async function applyBLB(elements,blocks){
            for(const b of blocks){
                const el=elements[b.nId];
                if(!el)continue;
                el.style.display=DISPLAY[b.display];
                el.style.position=POSITION[b.position];
                if(b.position==='absolute'||b.position==='fixed'){
                    el.style.left=b.x+'px';
                    el.style.top=b.y+'px';
                }
                if(b.w>0)el.style.width=b.w+'px';
                if(b.h>0)el.style.height=b.h+'px';
                el.style.padding=`${b.padT}px ${b.padR}px ${b.padB}px ${b.padL}px`;
                el.style.backgroundColor=`rgba(${b.bgR},${b.bgG},${b.bgB},${b.bgA})`;
                if(b.borderRad>0)el.style.borderRadius=b.borderRad+'px';
                if(b.textAl>0)el.style.textAlign=TEXT_ALIGN[b.textAl-1];
                if(b.display===2||b.display===6){
                    el.style.flexDirection=FLEX_DIR[b.flexDir];
                    el.style.flexWrap=b.flexWrap?'wrap':'nowrap';
                    el.style.justifyContent=JUSTIFY[b.justify];
                    el.style.alignItems=ALIGN_ITEMS[b.alignIt];
                    if(b.rowGap>0)el.style.gap=b.rowGap+'px';
                }
                el.style.overflow=OVERFLOW[b.overflow];
                el.style.opacity=b.opacity;
                if(b.zIndex!==0)el.style.zIndex=b.zIndex;
            }
        }

        async function applyBIB(root,imgs){
            for(const img of imgs){
                const canvas=root.querySelector(`canvas[data-bind="${img.id}"]`);
                if(!canvas)continue;
                canvas.width=img.w;canvas.height=img.h;
                const ctx=canvas.getContext('2d');
                const imgData=ctx.createImageData(img.w,img.h);
                imgData.data.set(img.rgba);
                ctx.putImageData(imgData,0,0);
            }
        }

        async function applyBVS(root,videos){
            for(const vid of videos){
                const canvas=root.querySelector(`canvas[data-bind="${vid.id}"]`);
                if(!canvas)continue;
                canvas.width=vid.w;canvas.height=vid.h;
                const ctx=canvas.getContext('2d');
                const frameSize=vid.w*vid.h*4;
                let frameIdx=0;
                const renderFrame=()=>{
                    const offset=frameIdx*frameSize;
                    if(offset>=vid.stream.length){frameIdx=0;setTimeout(renderFrame,1000/vid.fps);return}
                    const imgData=ctx.createImageData(vid.w,vid.h);
                    imgData.data.set(new Uint8Array(vid.stream.buffer,vid.stream.byteOffset+offset,frameSize));
                    ctx.putImageData(imgData,0,0);
                    frameIdx++;
                    setTimeout(renderFrame,1000/vid.fps);
                };
                renderFrame();
            }
        }

        async function applyBAS(root,audios){
            if(!audios.length)return;
            let audioCtx=null;
            const resumeAudio=()=>{
                if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();
                if(audioCtx.state==='suspended')audioCtx.resume();
            };
            document.addEventListener('click',resumeAudio);
            document.addEventListener('keydown',resumeAudio);
            for(const aud of audios){
                const btn=root.querySelector(`button[data-bind="${aud.id}"]`);
                if(!btn)continue;
                btn.addEventListener('click',()=>{
                    resumeAudio();
                    const buffer=audioCtx.createBuffer(aud.channels,aud.stream.length/2,aud.sampleRate);
                    for(let c=0;c<aud.channels;c++){
                        const data=buffer.getChannelData(c);
                        const view=new DataView(aud.stream.buffer,aud.stream.byteOffset);
                        for(let i=0;i<data.length;i++){
                            data[i]=view.getInt16(i*2,true)/32768;
                        }
                    }
                    const source=audioCtx.createBufferSource();
                    source.buffer=buffer;
                    source.connect(audioCtx.destination);
                    source.start();
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
