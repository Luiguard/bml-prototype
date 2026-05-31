import re
import glob

# Master parsing block
bdt_blb_classes = """class BDTParser{
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
"""

apply_blb = """function applyBLB(rootEl,blocks){
    const cssVal = v => (v===0xFFFF||v===0x7FFF||v===-32768) ? 'auto' : (v/10)+'px';
    const rgba = u => `rgba(${(u>>>24)&255},${(u>>>16)&255},${(u>>>8)&255},${(u&255)/255})`;
    const nodeList={};
    if(rootEl.hasAttribute('data-node-id')) nodeList[parseInt(rootEl.getAttribute('data-node-id'))]=rootEl;
    rootEl.querySelectorAll('[data-node-id]').forEach(el=>{ nodeList[parseInt(el.getAttribute('data-node-id'))]=el; });
    
    blocks.forEach(bl=>{
        const el=nodeList[bl.nId];
        if(!el)return;
        const s=el.style;
        const DISPLAY = ['none','block','flex','inline','inline-block','grid','inline-flex'];
        const POSITION = ['static','relative','absolute','fixed','sticky'];
        const TEXT_ALIGN = ['left','center','right','justify'];
        const FLEX_DIR = ['row','row-reverse','column','column-reverse'];
        const JUSTIFY = ['flex-start','flex-end','center','space-between','space-around','space-evenly'];
        const ALIGN_ITEMS = ['flex-start','flex-end','center','stretch','baseline'];
        const OVERFLOW = ['visible','hidden','scroll','auto'];

        if(bl.display!==undefined)s.display=DISPLAY[bl.display]||'';
        if(bl.position>0)s.position=POSITION[bl.position];
        if(bl.boxSizing)s.boxSizing='border-box';
        if(bl.w!==0xFFFF)s.width=cssVal(bl.w);
        if(bl.h!==0xFFFF)s.height=cssVal(bl.h);
        s.marginTop=cssVal(bl.mt);
        s.marginRight=cssVal(bl.mr);
        s.marginBottom=cssVal(bl.mb);
        s.marginLeft=cssVal(bl.ml);
        s.paddingTop=cssVal(bl.pt);
        s.paddingRight=cssVal(bl.pr);
        s.paddingBottom=cssVal(bl.pb);
        s.paddingLeft=cssVal(bl.pl);
        if(bl.btw||bl.brw||bl.bbw||bl.blw){
            s.borderStyle='solid';
            s.borderTopWidth=bl.btw/10+'px';
            s.borderRightWidth=bl.brw/10+'px';
            s.borderBottomWidth=bl.bbw/10+'px';
            s.borderLeftWidth=bl.blw/10+'px';
            if(bl.borderCol)s.borderColor=rgba(bl.borderCol);
        }
        if(bl.bgCol)s.backgroundColor=rgba(bl.bgCol);
        if(bl.col!==0x000000FF&&bl.col!==0)s.color=rgba(bl.col);
        if(bl.fs!==160)s.fontSize=bl.fs/10+'px';
        if(bl.fw!==400)s.fontWeight=bl.fw;
        if(bl.lh>0)s.lineHeight=bl.lh/10+'px';
        if(bl.textAl>0)s.textAlign=TEXT_ALIGN[bl.textAl];
        if(bl.display===2||bl.display===6){
            if(bl.flexDir>0)s.flexDirection=FLEX_DIR[bl.flexDir];
            if(bl.flexWrap>0)s.flexWrap='wrap';
            if(bl.justify>0)s.justifyContent=JUSTIFY[bl.justify];
            if(bl.alignIt!==3)s.alignItems=ALIGN_ITEMS[bl.alignIt];
            if(bl.gap>0)s.gap=bl.gap/10+'px';
        }
        if(bl.borderRad>0)s.borderRadius=bl.borderRad/10+'px';
        if(bl.overflow>0)s.overflow=OVERFLOW[bl.overflow];
        if(bl.opacity<255)s.opacity=bl.opacity/255;
        if(bl.zIndex!==0)s.zIndex=bl.zIndex;
    });
}"""

# Patch converter.html
with open('converter.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Remove old BDTParser and BLBParser classes
text = re.sub(r'class BDTParser\{[\s\S]*?\}\s*class BLBParser\{[\s\S]*?\}\s*\}', bdt_blb_classes, text)
# Remove old applyBLB
text = re.sub(r'function applyBLB[\s\S]*?\}\s*\}\s*\}', apply_blb, text)

with open('converter.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch applied.")
