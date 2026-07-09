import re

# 1. Update SPEC.md
with open('/home/benjamin/projects/bml-prototype/SPEC.md', 'r', encoding='utf-8') as f:
    spec = f.read()

spec_old = """### 4.2 Node Record (11 Bytes per node)

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 2    | Uint16 | Node ID                                        |
| 2      | 2    | Uint16 | Parent ID (`0xFFFF` = root)                    |
| 4      | 2    | Uint16 | First Child ID (`0xFFFF` = no children)        |
| 6      | 2    | Uint16 | Next Sibling ID (`0xFFFF` = last sibling)      |
| 8      | 1    | Uint8  | Node type (1 = element)                        |
| 9      | 1    | Uint8  | Tag byte (from BML Tag Table)                  |
| 10     | 1    | Uint8  | Depth (0 = root, max 255)                      |"""

spec_new = """### 4.2 Node Record (16 Bytes per node)

*Note: 16-byte alignment guarantees optimal CPU-Cache utilization, saving parsing energy (CO2) while fully supporting modern DOM traversal.*

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 2    | Uint16 | Node ID                                        |
| 2      | 2    | Uint16 | Parent ID (`0xFFFF` = root)                    |
| 4      | 2    | Uint16 | First Child ID (`0xFFFF` = no children)        |
| 6      | 2    | Uint16 | Next Sibling ID (`0xFFFF` = last sibling)      |
| 8      | 2    | Uint16 | Last Child ID (`0xFFFF` = no children)         |
| 10     | 2    | Uint16 | Previous Sibling ID (`0xFFFF` = first sibling) |
| 12     | 1    | Uint8  | Node type (1 = element)                        |
| 13     | 1    | Uint8  | Tag byte (from BML Tag Table)                  |
| 14     | 1    | Uint8  | Depth (0 = root, max 255)                      |
| 15     | 1    | Uint8  | Padding (0x00 for 16-byte alignment)           |"""

spec = spec.replace(spec_old, spec_new)
with open('/home/benjamin/projects/bml-prototype/SPEC.md', 'w', encoding='utf-8') as f:
    f.write(spec)


# 2. Update binary_formats.py
with open('/home/benjamin/projects/bml-prototype/binary_formats.py', 'r', encoding='utf-8') as f:
    pycode = f.read()

pycode_old = """    for i, node in enumerate(flat):
        first_child = 0xFFFF
        next_sibling = 0xFFFF

        for j, n in enumerate(flat):
            if n.parent_id == i:
                first_child = j
                break

        found_self = False
        for j, n in enumerate(flat):
            if j == i:
                found_self = True
                continue
            if found_self and n.parent_id == node.parent_id:
                next_sibling = j
                break

        depth = 0
        pid = node.parent_id
        while pid != 0xFFFF and depth < 255:
            depth += 1
            pid = flat[pid].parent_id

        buf += _u16(i)
        buf += _u16(node.parent_id)
        buf += _u16(first_child)
        buf += _u16(next_sibling)
        buf.append(1)  # node_type=element
        buf.append(TAG.get(node.tag, 0x01))
        buf.append(depth)"""

pycode_new = """    for i, node in enumerate(flat):
        first_child = node.children[0].node_id if node.children else 0xFFFF
        last_child = node.children[-1].node_id if node.children else 0xFFFF

        prev_sibling = 0xFFFF
        next_sibling = 0xFFFF
        if node.parent_id != 0xFFFF:
            parent_node = flat[node.parent_id]
            my_idx = parent_node.children.index(node)
            if my_idx > 0:
                prev_sibling = parent_node.children[my_idx-1].node_id
            if my_idx < len(parent_node.children) - 1:
                next_sibling = parent_node.children[my_idx+1].node_id

        depth = 0
        pid = node.parent_id
        while pid != 0xFFFF and depth < 255:
            depth += 1
            pid = flat[pid].parent_id

        buf += _u16(i)
        buf += _u16(node.parent_id)
        buf += _u16(first_child)
        buf += _u16(next_sibling)
        buf += _u16(last_child)
        buf += _u16(prev_sibling)
        buf.append(1)  # node_type=element
        buf.append(TAG.get(node.tag, 0x01))
        buf.append(depth)
        buf.append(0)  # padding 16-byte alignment"""

pycode = pycode.replace(pycode_old, pycode_new)
with open('/home/benjamin/projects/bml-prototype/binary_formats.py', 'w', encoding='utf-8') as f:
    f.write(pycode)


# 3. Update converter.html
for p in ['/home/benjamin/projects/bml-prototype/converter.html', '/home/benjamin/projects/mediclean-pro/bweb-converter/converter.html']:
    try:
        with open(p, 'r', encoding='utf-8') as f:
            html = f.read()

        html = html.replace('nodes.push({id:nid,parent:pid,firstChild:fc,nextSibling:ns,type:nt,tag:tt,depth});', 
                            'const lc=this.v.getUint16(this.o);this.o+=2;const ps=this.v.getUint16(this.o);this.o+=2;const nt=this.v.getUint8(this.o++);const tt=this.v.getUint8(this.o++);const depth=this.v.getUint8(this.o++);this.o++;nodes.push({id:nid,parent:pid,firstChild:fc,nextSibling:ns,lastChild:lc,previousSibling:ps,type:nt,tag:tt,depth});')

        html = html.replace('const nt=this.v.getUint8(this.o++);\n            const tt=this.v.getUint8(this.o++);\n            const depth=this.v.getUint8(this.o++);\n            nodes.push({id:nid,parent:pid,firstChild:fc,nextSibling:ns,type:nt,tag:tt,depth});', '')

        # Fixing the writer in JS
        js_writer_old = """                const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*11);
                const bdtView=new DataView(bdtBuf);
                bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
                bdtView.setUint32(4,flatNodes.length);
                for(let i=0;i<flatNodes.length;i++){
                    const off=8+i*11;
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
                    let depth=0,p=n.parentIdx;
                    while(p>=0&&depth<255){depth++;p=flatNodes[p].parentIdx;}
                    bdtView.setUint8(off+10,depth);
                }"""

        js_writer_new = """                const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
                const bdtView=new DataView(bdtBuf);
                bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
                bdtView.setUint32(4,flatNodes.length);
                for(let i=0;i<flatNodes.length;i++){
                    const off=8+i*16;
                    const n=flatNodes[i];
                    bdtView.setUint16(off,i);
                    bdtView.setUint16(off+2,n.parentIdx>=0?n.parentIdx:0xFFFF);
                    bdtView.setUint16(off+4,n.children.length?n.children[0]:0xFFFF);
                    let ns=0xFFFF, ps=0xFFFF, lc=0xFFFF;
                    if(n.parentIdx>=0){
                        const siblings=flatNodes[n.parentIdx].children;
                        const myPos=siblings.indexOf(i);
                        if(myPos>=0&&myPos<siblings.length-1)ns=siblings[myPos+1];
                        if(myPos>0)ps=siblings[myPos-1];
                    }
                    if(n.children.length) lc=n.children[n.children.length-1];
                    bdtView.setUint16(off+6,ns);
                    bdtView.setUint16(off+8,lc);
                    bdtView.setUint16(off+10,ps);
                    bdtView.setUint8(off+12,1);
                    bdtView.setUint8(off+13,n.tag);
                    let depth=0,p=n.parentIdx;
                    while(p>=0&&depth<255){depth++;p=flatNodes[p].parentIdx;}
                    bdtView.setUint8(off+14,depth);
                    bdtView.setUint8(off+15,0);
                }"""
        html = html.replace(js_writer_old, js_writer_new)

        html = html.replace("const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*11);", "const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);")
        html = html.replace("const off=8+i*11;", "const off=8+i*16;")

        # Update Tree output
        html = html.replace("p:${n.parent===0xFFFF?'root':n.parent} fc:${n.firstChild===0xFFFF?'-':n.firstChild} ns:${n.nextSibling===0xFFFF?'-':n.nextSibling}", 
                            "p:${n.parent===0xFFFF?'root':n.parent} fc:${n.firstChild===0xFFFF?'-':n.firstChild} lc:${n.lastChild===0xFFFF?'-':n.lastChild} ps:${n.previousSibling===0xFFFF?'-':n.previousSibling} ns:${n.nextSibling===0xFFFF?'-':n.nextSibling}")


        with open(p, 'w', encoding='utf-8') as f:
            f.write(html)
    except Exception as e:
        pass

