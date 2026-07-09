import re

with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

old_bml = """        let el;
        if(tagName === '#text') {
            el = document.createTextNode('');
        } else {
            el = document.createElement(tagName);
            el.classList.add('rendered-node',`bml-tag-${tagName}`);
        }
        for(let i=0;i<nAttr;i++){
            if(this.o+3>this.v.byteLength)break;
            const aId=this.v.getUint8(this.o++);
            const aLen=this.v.getUint16(this.o);this.o+=2;
            if(this.o+aLen>this.v.byteLength)break;
            const aVal=this.d.decode(new Uint8Array(this.v.buffer,this.o,aLen));this.o+=aLen;
            const aName=ATTR_REV[aId];
            if(!aName||aName==='style'||DANGEROUS_ATTRS.has(aName))continue;
            if((aName==='href'||aName==='src'||aName==='action')&&/^\\s*javascript:/i.test(aVal))continue;
            if(el.setAttribute) el.setAttribute(aName,aVal);
        }
        if(tLen>0){
            if(this.o+tLen>this.v.byteLength){return el;}
            const txt=this.d.decode(new Uint8Array(this.v.buffer,this.o,tLen));this.o+=tLen;
            el.textContent=txt;
        }
        for(let i=0;i<nChild;i++){const c=this.parseNode(depth+1);if(c)el.appendChild(c)}
        return el;"""

new_bml = """        let el = {
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
            if((aName==='href'||aName==='src'||aName==='action')&&/^\\s*javascript:/i.test(aVal))continue;
            el.attrs[aName] = aVal;
        }
        if(tLen>0){
            if(this.o+tLen>this.v.byteLength){return el;}
            const txt=this.d.decode(new Uint8Array(this.v.buffer,this.o,tLen));this.o+=tLen;
            el.text=txt;
        }
        for(let i=0;i<nChild;i++){const c=this.parseNode(depth+1);if(c)el.children.push(c)}
        return el;"""

if old_bml in content:
    content = content.replace(old_bml, new_bml)
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: BMLParser now returns Virtual DOM objects.")
else:
    print("FAILED: Old BMLParser logic not found.")
