const fs = require('fs');

const bweb = fs.readFileSync('/home/benjamin/projects/mediclean-pro/service.bweb');
const numSections = bweb.readUInt32BE(4);
let headerOffset = 8;
let dataOffset = 8 + numSections * 8;

let bmlBuf = null;

for (let i = 0; i < numSections; i++) {
    const type = bweb.readUInt8(headerOffset);
    const len = bweb.readUInt32BE(headerOffset + 1);
    const compressed = bweb.readUInt8(headerOffset + 5);
    headerOffset += 8;
    
    let chunk = bweb.slice(dataOffset, dataOffset + len);
    dataOffset += len;
    
    if (type === 1) {
        bmlBuf = chunk;
        break;
    }
}

let o = 4; // Skip BML\x01
const nodes = [];

const TAG_REV={0x01:'div',0x02:'span',0x03:'p',0x04:'a',0x05:'h1',0x06:'h2',0x07:'h3',0x08:'h4',0x09:'h5',0x0A:'h6',0x0B:'img',0x0C:'ul',0x0D:'ol',0x0E:'li',0x0F:'table',0x10:'tr',0x11:'td',0x12:'th',0x13:'thead',0x14:'tbody',0x15:'form',0x16:'input',0x17:'button',0x18:'textarea',0x19:'select',0x1A:'option',0x1B:'label',0x1C:'header',0x1D:'footer',0x1E:'nav',0x1F:'main',0x20:'section',0x21:'article',0x22:'aside',0x23:'strong',0x24:'em',0x25:'code',0x26:'pre',0x27:'br',0x28:'hr',0x29:'video',0x2A:'audio',0x2B:'canvas',0x2C:'svg',0x2D:'div',0x2E:'figcaption',0x2F:'figure',0x30:'blockquote',0x31:'small',0x32:'sub',0x33:'sup',0x34:'details',0x35:'summary',0x36:'dialog',0x37:'dl',0x38:'dt',0x39:'dd',0x3A:'mark',0x3B:'time',0x3C:'abbr',0x3D:'cite',0x3E:'b',0x3F:'i',0x40:'u',0xFD:'#text',0xFE:'div',0xFF:'div'};
const ATTR_REV={0x10:'class',0x11:'id',0x12:'href',0x13:'src',0x14:'style',0x15:'type',0x16:'name',0x17:'value',0x18:'placeholder',0x19:'alt',0x1A:'title',0x1B:'action',0x1C:'method',0x1D:'target',0x1E:'rel',0x1F:'role',0x20:'aria-label',0x21:'data-bind',0x22:'data-onclick',0x23:'data-onsubmit',0x24:'width',0x25:'height',0x26:'disabled',0x27:'checked',0x28:'selected',0x29:'required',0x2A:'autofocus',0x2B:'autocomplete',0x2C:'min',0x2D:'max',0x2E:'step',0x2F:'pattern',0x30:'for',0x31:'tabindex',0x32:'content',0x33:'charset',0x34:'http-equiv',0x35:'lang',0x36:'dir',0x37:'hidden'};

while (o < bmlBuf.length) {
    const tagByte = bmlBuf.readUInt8(o++);
    const nAttr = bmlBuf.readUInt8(o++);
    
    if (tagByte === 0xFF) {
        o--;
        const tLen = bmlBuf.readUInt16BE(o); o += 2;
        const txt = bmlBuf.slice(o, o + tLen).toString('utf-8');
        o += tLen;
        nodes.push({ type: 'text', val: txt.substring(0, 20) });
        continue;
    }
    
    const tagName = TAG_REV[tagByte] || 'div';
    const attrs = {};
    for (let i = 0; i < nAttr; i++) {
        const aId = bmlBuf.readUInt8(o++);
        const aLen = bmlBuf.readUInt16BE(o); o += 2;
        const aVal = bmlBuf.slice(o, o + aLen).toString('utf-8');
        o += aLen;
        const aName = ATTR_REV[aId];
        if (aName) attrs[aName] = aVal;
    }
    nodes.push({ type: 'element', tag: tagName, attrs });
}

console.log(`Total BML nodes: ${nodes.length}`);
for (let i = 0; i < 15; i++) {
    console.log(`Node ${i+1}:`, nodes[i]);
}

let images = 0;
for (const n of nodes) {
    if (n.tag === 'img') images++;
}
console.log(`Found ${images} img tags`);
