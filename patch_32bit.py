import re

def patch_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # --- BML Updates ---
    # content.js & polyfill.html & converter.html parser
    html = html.replace('const nChild=this.v.getUint16(this.o);this.o+=2;', 'const nChild=this.v.getUint32(this.o);this.o+=4;')
    # converter.html compiler
    html = html.replace('bmlBuf.push((childElements.length>>8)&0xFF,childElements.length&0xFF);', 'bmlBuf.push((childElements.length>>24)&0xFF, (childElements.length>>16)&0xFF, (childElements.length>>8)&0xFF, childElements.length&0xFF);')

    # --- BDT Updates ---
    # content.js & polyfill.html parser
    bdt_old = '''        parse(){
            const count=this.v.getUint32(this.o);this.o+=4;
            const nodes=new Array(count);
            for(let i=0;i<count;i++){
                const off=this.o+i*16;
                nodes[i]={
                    id:this.v.getUint16(off),
                    parentId:this.v.getUint16(off+2),
                    firstChild:this.v.getUint16(off+4),
                    nextSibling:this.v.getUint16(off+6),
                    type:this.v.getUint8(off+8),
                    tag:this.v.getUint8(off+9),
                    depth:this.v.getUint8(off+10)
                };
            }
            return nodes;
        }'''
    bdt_new = '''        parse(){
            const count=this.v.getUint32(this.o);this.o+=4;
            const nodes=new Array(count);
            for(let i=0;i<count;i++){
                const off=this.o+i*24;
                nodes[i]={
                    id:this.v.getUint32(off),
                    parentId:this.v.getUint32(off+4),
                    firstChild:this.v.getUint32(off+8),
                    nextSibling:this.v.getUint32(off+12),
                    type:this.v.getUint8(off+16),
                    tag:this.v.getUint8(off+17),
                    depth:this.v.getUint8(off+18)
                };
            }
            return nodes;
        }'''
    html = html.replace(bdt_old, bdt_new)

    # converter.html compiler
    bdt_comp_old = '''                    const off=8+i*16;
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
                    while(p>=0&&depth<255){depth++;p=flatNodes[p].parentIdx}
                    bdtView.setUint8(off+10,depth);'''
    bdt_comp_new = '''                    const off=8+i*24;
                    const n=flatNodes[i];
                    bdtView.setUint32(off,i);
                    bdtView.setUint32(off+4,n.parentIdx>=0?n.parentIdx:0xFFFFFFFF);
                    bdtView.setUint32(off+8,n.children.length?n.children[0]:0xFFFFFFFF);
                    let ns=0xFFFFFFFF;
                    if(n.parentIdx>=0){
                        const siblings=flatNodes[n.parentIdx].children;
                        const myPos=siblings.indexOf(i);
                        if(myPos>=0&&myPos<siblings.length-1)ns=siblings[myPos+1];
                    }
                    bdtView.setUint32(off+12,ns);
                    bdtView.setUint8(off+16,1);
                    bdtView.setUint8(off+17,n.tag);
                    let depth=0,p=n.parentIdx;
                    while(p>=0&&depth<255){depth++;p=flatNodes[p].parentIdx}
                    bdtView.setUint8(off+18,depth);'''
    html = html.replace(bdt_comp_old, bdt_comp_new)

    # --- BLB Updates ---
    html = html.replace('const BLB_BLOCK_SIZE = 58;', 'const BLB_BLOCK_SIZE = 64;')
    
    # content.js & polyfill.html parser
    blb_old = '''            for(let i=0;i<count;i++){
                const off=4+i*58;
                const id=v.getUint16(off);'''
    blb_new = '''            for(let i=0;i<count;i++){
                const off=4+i*64;
                const id=v.getUint32(off);'''
    html = html.replace(blb_old, blb_new)

    # regex to shift offsets by +2 inside applyBLB and converter.html
    # We will do this carefully with targeted replaces for applyBLB parsing:
    offsets = [
        (2,4), (3,5), (4,6), (5,7), (7,9), (9,11), (11,13), (13,15), (15,17), (17,19),
        (19,21), (21,23), (23,25), (25,27), (26,28), (27,29), (28,30), (29,31), (33,35),
        (37,39), (41,43), (43,45), (45,47), (47,49), (48,50), (49,51), (50,52), (51,53),
        (52,54), (54,56), (56,58), (57,59), (58,60)
    ]
    
    # for content.js and polyfill.html applyBLB:
    # "b.display=v.getUint8(off+2);" -> "b.display=v.getUint8(off+4);"
    for old_off, new_off in offsets:
        html = html.replace(f'off+{old_off}', f'off+{new_off}')

    # For converter.html compiling:
    blb_comp_old = '''                    blbView.setUint16(off,i);
                    blbView.setUint8(off+2,DM[s.display]??0);'''
    blb_comp_new = '''                    blbView.setUint32(off,i);
                    blbView.setUint8(off+4,DM[s.display]??0);'''
    html = html.replace(blb_comp_old, blb_comp_new)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)

patch_file('converter.html')
patch_file('content.js')
patch_file('polyfill.html')
print("Successfully patched to 32-bit architecture!")
