const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
const window = dom.window;

// Mock enc
const enc = new TextEncoder();

// Setup variables
const flatNodes = [];
const SKIP_TAGS = new Set(['script','style','meta','title','link','noscript']);
const TAG_FWD = { 'div':1, 'span':2, 'a':3, 'p':4, 'img':5, 'h1':6, 'h2':7, 'h3':8, 'ul':9, 'li':10, 'button':11, 'input':12, 'form':13, 'svg':14, 'path':15, 'canvas':16, 'header':17, 'footer':18, 'nav':19, 'main':20, 'section':21, 'article':22, 'aside':23, 'figure':24, 'figcaption':25, 'label':26 };

function serNode(el,parentIdx){
    if(el.nodeType===3){
        const t=el.textContent.trim();
        if(!t)return;
        return;
    }
    if (el.nodeType !== 1) return;
    let tag=el.tagName?el.tagName.toLowerCase():'div';
    if(SKIP_TAGS.has(tag))return;
    if (tag === 'img') tag = 'canvas';
    const myIdx=flatNodes.length;
    flatNodes.push({node:el,tag:TAG_FWD[tag]||255,parentIdx,children:[],id:myIdx});
    for(const ch of el.childNodes) serNode(ch,myIdx);
}

try {
    serNode(document.body, -1);
    console.log("Nodes:", flatNodes.length);
    
    // Now BLB
    function rgba(colorStr) { return 0; }
    function colorToU32(c) {
        if(!c) return 0;
        const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!m) return 0;
        const r=parseInt(m[1]),g=parseInt(m[2]),b=parseInt(m[3]);
        const a=m[4]!==undefined?Math.round(parseFloat(m[4])*255):255;
        return((r<<24)|(g<<16)|(b<<8)|a)>>>0;
    }

    const blbBuf = new ArrayBuffer(4 + flatNodes.length * 300);
    const blbView = new DataView(blbBuf);
    blbView.setUint8(0, 0x42); blbView.setUint8(1, 0x4C); blbView.setUint8(2, 0x42); blbView.setUint8(3, 0x01);
    let offset = 4;
    
    let count = 0;
    for(const n of flatNodes) {
        const props = [];
        const el = n.node;
        const s = window.getComputedStyle(el);
        
        const addDim = (tag, key) => {
            let v = parseFloat(s[key]);
            if (!isNaN(v) && v !== 0) {
                let u=0; if(s[key].endsWith('%'))u=1; else if(s[key].endsWith('vw'))u=2; else if(s[key].endsWith('vh'))u=3; else if(s[key]==='auto')u=4;
                if(u!==4 || (tag===1 || tag===2)) props.push({tag, type:0, len:3, write:(vwr, o)=>{ vwr.setUint8(o, u); vwr.setUint16(o+1, v); }});
            }
        };
        const addEnum = (tag, val) => { if(val!==undefined) props.push({tag, type:1, len:1, write:(vwr, o)=>vwr.setUint8(o, val)}); };
        const addCol = (tag, key) => {
            let c = colorToU32(s[key]);
            if(c!==0) props.push({tag, type:2, len:4, write:(vwr, o)=>vwr.setUint32(o, c)});
        };
        
        addDim(1, 'width'); addDim(2, 'height');
        addDim(3, 'marginTop'); addDim(4, 'marginRight'); addDim(5, 'marginBottom'); addDim(6, 'marginLeft');
        addDim(7, 'paddingTop'); addDim(8, 'paddingRight'); addDim(9, 'paddingBottom'); addDim(10, 'paddingLeft');
        addEnum(11, s.position==='absolute'?1:(s.position==='fixed'?2:(s.position==='relative'?3:0)));
        addDim(12, 'top'); addDim(13, 'right'); addDim(14, 'bottom'); addDim(15, 'left');
        addCol(16, 'borderColor'); addCol(17, 'backgroundColor'); addCol(18, 'color');
        addDim(19, 'fontSize');
        props.push({tag: 21, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, parseInt(s.fontWeight)||400)});
        const taMap={'left':0,'center':1,'right':2,'justify':3}; addEnum(22, taMap[s.textAlign]||0);
        addEnum(23, s.display==='flex'?1:(s.display==='grid'?2:(s.display==='none'?4:0)));
        addEnum(24, s.flexDirection==='column'?1:0);
        addDim(25, 'borderWidth');
        const jcMap={'flex-start':0,'flex-end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5};
        addEnum(25, jcMap[s.justifyContent]);
        const aiMap={'flex-start':0,'flex-end':1,'center':2,'stretch':3,'baseline':4};
        addEnum(26, aiMap[s.alignItems]);
        props.push({tag:27, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexGrow||0)*100))});
        props.push({tag:28, type:1, len:2, write:(vwr,o)=>vwr.setUint16(o, Math.round(parseFloat(s.flexShrink||1)*100))});
        addDim(29, 'gap');
        addDim(31, 'borderRadius');
        const ovMap={'visible':0,'hidden':1,'scroll':2,'auto':3};
        addEnum(32, ovMap[s.overflow]||0);
        const ff=s.fontFamily;
        if(ff){const ffClean=ff.split(',')[0].replace(/['"]/g,'').trim();const ffB=enc.encode(ffClean);props.push({tag:33,type:3,len:2+ffB.length,write:(vwr,o)=>{vwr.setUint16(o,ffB.length);new Uint8Array(vwr.buffer).set(ffB,o+2);}});}
        const opVal=parseFloat(s.opacity);if(!isNaN(opVal) && opVal<1.0)props.push({tag:34,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,Math.round(opVal*255))});
        
        const tdLine=s.textDecorationLine||s.textDecoration||'';if(tdLine!=='none'&&tdLine!==''){let tdV=0;if(tdLine.includes('underline'))tdV|=1;if(tdLine.includes('line-through'))tdV|=2;if(tdV)props.push({tag:35,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,tdV)});}
        const bs=s.boxShadow;if(bs&&bs!=='none'){const bsB=enc.encode(bs);props.push({tag:36,type:3,len:2+bsB.length,write:(vwr,o)=>{vwr.setUint16(o,bsB.length);new Uint8Array(vwr.buffer).set(bsB,o+2);}});}
        const bi=s.backgroundImage;if(bi&&bi!=='none'){const biB=enc.encode(bi);props.push({tag:37,type:3,len:2+biB.length,write:(vwr,o)=>{vwr.setUint16(o,biB.length);new Uint8Array(vwr.buffer).set(biB,o+2);}});}
        const ttMap={'none':0,'uppercase':1,'lowercase':2,'capitalize':3};if(s.textTransform&&ttMap[s.textTransform]){props.push({tag:38,type:1,len:1,write:(vwr,o)=>vwr.setUint8(o,ttMap[s.textTransform])});}
        const ls=parseFloat(s.letterSpacing);if(!isNaN(ls)&&ls!==0){props.push({tag:39,type:0,len:3,write:(vwr,o)=>{vwr.setUint8(o,0);vwr.setUint16(o+1,Math.round(ls*100));}});}
        
        blbView.setUint16(offset, n.id);
        blbView.setUint16(offset+2, props.length);
        offset += 4;
        for(const p of props) {
            blbView.setUint8(offset, p.tag);
            blbView.setUint8(offset+1, p.type);
            p.write(blbView, offset+2);
            offset += 2 + p.len;
        }
        count++;
    }
    console.log("BLB serialized. Nodes processed:", count);

} catch(e) {
    console.error("Error:", e);
}
