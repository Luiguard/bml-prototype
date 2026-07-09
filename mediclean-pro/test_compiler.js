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
const ATTR_FWD = { 'class':1, 'id':2, 'src':3, 'href':4, 'alt':5, 'type':6, 'value':7, 'placeholder':8, 'name':9, 'checked':10, 'disabled':11, 'readonly':12, 'required':13, 'min':14, 'max':15, 'step':16, 'role':17, 'aria-label':18, 'aria-hidden':19, 'aria-expanded':20, 'aria-controls':21, 'viewbox':22, 'd':23, 'fill':24, 'stroke':25, 'stroke-width':26, 'stroke-linecap':27, 'stroke-linejoin':28 };

const bmlBuf = [];

function serNode(el,parentIdx){
    if(el.nodeType===3){
        const t=el.textContent.trim();
        if(!t)return;
        const textBytes=enc.encode(t + " ");
        bmlBuf.push(0xFD, 0, 0, 0);
        bmlBuf.push((textBytes.length>>8)&0xFF,textBytes.length&0xFF);
        for(const b of textBytes)bmlBuf.push(b);
        return;
    }
    if (el.nodeType !== 1) return;
    let tag=el.tagName?el.tagName.toLowerCase():'div';
    if(SKIP_TAGS.has(tag))return;
    if (tag === 'img') tag = 'canvas';
    const myIdx=flatNodes.length;
    flatNodes.push({node:el,tag:TAG_FWD[tag]||255,parentIdx,children:[],id:myIdx});
    if(parentIdx>=0) flatNodes[parentIdx].children.push(myIdx);
    const attrs=[];
    for(const a of el.attributes){
        const aid=ATTR_FWD[a.name];
        if(aid!==undefined){
            attrs.push({id:aid,val:enc.encode(a.value)});
        } else if(a.name === 'href') {
            attrs.push({id:ATTR_FWD['href']||18,val:enc.encode(a.value)});
        }
    }
    let nChild=0;
    for(const ch of el.childNodes){
        if(ch.nodeType===3&&ch.textContent.trim())nChild++;
        else if(ch.nodeType===1){const ct=ch.tagName?ch.tagName.toLowerCase():'';if(!SKIP_TAGS.has(ct))nChild++;}
    }
    bmlBuf.push(TAG_FWD[tag]||255);
    bmlBuf.push(attrs.length);
    bmlBuf.push((nChild>>8)&0xFF,nChild&0xFF);
    bmlBuf.push(0,0);
    for(const a of attrs){
        bmlBuf.push(a.id);
        bmlBuf.push((a.val.length>>8)&0xFF,a.val.length&0xFF);
        for(const b of a.val)bmlBuf.push(b);
    }
    for(const ch of el.childNodes) serNode(ch,myIdx);
}

try {
    serNode(document.body, -1);
    console.log("BML serialized. Nodes:", flatNodes.length);
    
    // Now BDT
    const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
    const bdtView=new DataView(bdtBuf);
    bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
    bdtView.setUint32(4,flatNodes.length);
    const depths=new Array(flatNodes.length).fill(0);
    for(let i=0;i<flatNodes.length;i++){if(flatNodes[i].parentIdx>=0)depths[i]=depths[flatNodes[i].parentIdx]+1;}
    for(let i=0;i<flatNodes.length;i++){
        const off=8+i*16;
        const n=flatNodes[i];
        bdtView.setUint16(off,i);
        bdtView.setUint16(off+2,n.parentIdx>=0?n.parentIdx:0xFFFF);
        bdtView.setUint16(off+4,n.children.length?n.children[0]:0xFFFF);
        let ns=0xFFFF,ps=0xFFFF;
        if(n.parentIdx>=0){
            const siblings=flatNodes[n.parentIdx].children;
            const myPos=siblings.indexOf(i);
            if(myPos>=0&&myPos<siblings.length-1)ns=siblings[myPos+1];
            if(myPos>0)ps=siblings[myPos-1];
        }
        bdtView.setUint16(off+6,ns);
        bdtView.setUint16(off+8,n.children.length?n.children[n.children.length-1]:0xFFFF);
        bdtView.setUint16(off+10,ps);
        bdtView.setUint8(off+12,1);
        bdtView.setUint8(off+13,n.tag);
        bdtView.setUint8(off+14,depths[i]);
    }
    console.log("BDT serialized.");

} catch(e) {
    console.error("Error:", e);
}
