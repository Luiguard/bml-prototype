with open("bweb-converter/converter.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace BLBParser definition
old_parser = """class BLBParser{
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
            const width=this.v.getUint16(o+5);
            const height=this.v.getUint16(o+7);
            const mt=this.v.getInt16(o+9),mr=this.v.getInt16(o+11),mb=this.v.getInt16(o+13),ml=this.v.getInt16(o+15);
            const pt=this.v.getUint16(o+17),pr=this.v.getUint16(o+19),pb=this.v.getUint16(o+21),pl=this.v.getUint16(o+23);
            const bwt=this.v.getUint8(o+25),bwr=this.v.getUint8(o+26),bwb=this.v.getUint8(o+27),bwl=this.v.getUint8(o+28);
            const bc=this.v.getUint32(o+29);
            const bgc=this.v.getUint32(o+33);
            const c=this.v.getUint32(o+37);
            const fs=this.v.getUint16(o+41);
            const fw=this.v.getUint16(o+43);
            const lh=this.v.getUint16(o+45);
            const ta=this.v.getUint8(o+47);
            const fd=this.v.getUint8(o+48);
            const flw=this.v.getUint8(o+49);
            const jc=this.v.getUint8(o+50);
            const ai=this.v.getUint8(o+51);
            const gap=this.v.getUint16(o+52);
            const br=this.v.getUint16(o+54);
            const of=this.v.getUint8(o+56);
            const op=this.v.getUint8(o+57);
            const zi=this.v.getInt16(o+58);
            this.o+=BLB_BLOCK_SIZE;
            blocks.push({nid,display,position,boxSizing,width,height,mt,mr,mb,ml,
                pt,pr,pb,pl,bwt,bwr,bwb,bwl,
                borderColor:bc,bgColor:bgc,color:c,fontSize:fs,fontWeight:fw,lineHeight:lh,
                textAlign:ta,flexDir:fd,flexWrap:flw,justifyContent:jc,alignItems:ai,gap,borderRadius:br,overflow:of,
                opacity:op,zIndex:zi});
        }
        return blocks;
    }
}"""

new_parser = """class BLBParser{
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
}"""

if old_parser in content:
    content = content.replace(old_parser, new_parser)
    with open("bweb-converter/converter.html", "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS: BLBParser patched to support TLV.")
else:
    print("FAILED: Old BLBParser not found.")
