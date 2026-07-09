async function clientSideConvert(baseHtml, variantMap = {}){
    return new Promise(async (resolve, reject) => {
        const TAG_FWD={};
        for(const[k,v]of Object.entries(TAG_REV))TAG_FWD[v]=parseInt(k);
        const ATTR_FWD={};
        for(const[k,v]of Object.entries(ATTR_REV))ATTR_FWD[v]=parseInt(k);
        const enc=new TextEncoder();

        function colorToU32(c) {
            const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (!m) return 0;
            const r=parseInt(m[1]),g=parseInt(m[2]),b=parseInt(m[3]);
            const a=m[4]!==undefined?Math.round(parseFloat(m[4])*255):255;
            return((r<<24)|(g<<16)|(b<<8)|a)>>>0;
        }
        function cssV(v){if(!v||v==='auto'||v==='none')return 0xFFFF;const n=parseFloat(v);return isNaN(n)?0xFFFF:Math.round(n*10)}
        const DM={'block':0,'inline':1,'flex':2,'grid':3,'none':4,'inline-block':5,'inline-flex':6};
        const PM_={'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4};
        const TAM={'left':0,'start':0,'center':1,'right':2,'end':2,'justify':3};
        const FDM={'row':0,'column':1,'row-reverse':2,'column-reverse':3};
        const JCM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5};
        const AIM={'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'stretch':3,'baseline':4};
        const OFM={'visible':0,'hidden':1,'scroll':2,'auto':3};

        const extractedImages = [];

        async function snapshotDOM(htmlContent, queryStr = '') {
            return new Promise((res, rej) => {
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.width = '1920px';
                iframe.style.height = '1080px';
                iframe.style.opacity = '0';
                iframe.style.pointerEvents = 'none';
                document.body.appendChild(iframe);

                const cleanHtml = htmlContent
                    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
                    .replace(/<script\b[^>]*\/>/gi, '')
                    .replace(/\son[a-z]+\s*=\s*(['"])(.*?)\1/gi, '')
                    .replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, '');

                const blob = new Blob([cleanHtml], {type: 'text/html'});
                const blobUrl = URL.createObjectURL(blob) + queryStr;
                
                iframe.src = blobUrl;
                iframe.onload = () => {
                    setTimeout(() => {
                        try {
                            const doc = iframe.contentWindow.document;
                            const body = doc.body;
                            const reveals = doc.querySelectorAll('.reveal');
                            reveals.forEach(el => el.classList.add('active'));

                            const bmlBuf=[];
                            const flatNodes=[];

                            function serNode(el,parentIdx){
                                if (el.nodeType !== 1) return;
                                
                                let tag=el.tagName?el.tagName.toLowerCase():'div';
                                const attrs=[];
                                
                                if (tag === 'img') {
                                    tag = 'canvas';
                                    try {
                                        const cvs = document.createElement('canvas');
                                        cvs.width = el.width || el.naturalWidth || 100;
                                        cvs.height = el.height || el.naturalHeight || 100;
                                        const ctx = cvs.getContext('2d');
                                        ctx.drawImage(el, 0, 0, cvs.width, cvs.height);
                                        const imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
                                        const bibId = extractedImages.length;
                                        extractedImages.push({
                                            id: bibId, w: cvs.width, h: cvs.height,
                                            data: new Uint8Array(imgData.data.buffer)
                                        });
                                        const aid = ATTR_FWD['data-bind'];
                                        if (aid !== undefined) attrs.push({id: aid, val: enc.encode(bibId.toString()), name: 'data-bind', value: bibId.toString()});
                                    } catch(e) {}
                                }

                                const tagByte=TAG_FWD[tag]||0x01;
                                const nodeIdx=flatNodes.length;
                                
                                const cs=iframe.contentWindow.getComputedStyle(el);
                                const csObj = {
                                    display:cs.display,position:cs.position,boxSizing:cs.boxSizing,
                                    width:cs.width,height:cs.height,
                                    marginTop:cs.marginTop,marginRight:cs.marginRight,
                                    marginBottom:cs.marginBottom,marginLeft:cs.marginLeft,
                                    paddingTop:cs.paddingTop,paddingRight:cs.paddingRight,
                                    paddingBottom:cs.paddingBottom,paddingLeft:cs.paddingLeft,
                                    borderTopWidth:cs.borderTopWidth,borderRightWidth:cs.borderRightWidth,
                                    borderBottomWidth:cs.borderBottomWidth,borderLeftWidth:cs.borderLeftWidth,
                                    borderColor:cs.borderTopColor,backgroundColor:cs.backgroundColor,color:cs.color,
                                    fontSize:cs.fontSize,fontWeight:cs.fontWeight,
                                    lineHeight:cs.lineHeight,textAlign:cs.textAlign,
                                    flexDirection:cs.flexDirection,flexWrap:cs.flexWrap,
                                    justifyContent:cs.justifyContent,alignItems:cs.alignItems,
                                    gap:cs.rowGap||'0px',borderRadius:cs.borderTopLeftRadius||'0px',
                                    overflow:cs.overflowY||'visible',opacity:cs.opacity,zIndex:cs.zIndex,
                                };

                                if(el.attributes){
                                    for(const attr of el.attributes){
                                        if(attr.name === 'src' && tag === 'canvas') continue;
                                        const aid=ATTR_FWD[attr.name];
                                        if(aid!==undefined&&attr.name!=='style'){
                                            attrs.push({id:aid,val:enc.encode(attr.value), name: attr.name, value: attr.value});
                                        }
                                    }
                                }

                                let textContent='';
                                for(const cn of el.childNodes){
                                    if(cn.nodeType===3){
                                        const t=cn.textContent.trim();
                                        if(t)textContent+=t+' ';
                                    }
                                }
                                textContent=textContent.trim();
                                const textBytes=textContent?enc.encode(textContent):new Uint8Array(0);

                                const childElements=[];
                                for(const cn of el.childNodes){
                                    if(cn.nodeType===1)childElements.push(cn);
                                }

                                flatNodes.push({
                                    tag: tagByte, parentIdx, children: [], cs: csObj,
                                    textContent: textContent, textBytes: textBytes, attrs: attrs
                                });
                                
                                if(parentIdx>=0)flatNodes[parentIdx].children.push(nodeIdx);

                                bmlBuf.push(tagByte);
                                bmlBuf.push(attrs.length);
                                bmlBuf.push((childElements.length>>8)&0xFF,childElements.length&0xFF);
                                bmlBuf.push((textBytes.length>>24)&0xFF,(textBytes.length>>16)&0xFF,(textBytes.length>>8)&0xFF,textBytes.length&0xFF);

                                for(const a of attrs){
                                    bmlBuf.push(a.id);
                                    bmlBuf.push((a.val.length>>24)&0xFF,(a.val.length>>16)&0xFF,(a.val.length>>8)&0xFF,a.val.length&0xFF);
                                    for(const b of a.val)bmlBuf.push(b);
                                }
                                for(const b of textBytes)bmlBuf.push(b);

                                for(const ce of childElements)serNode(ce,nodeIdx);
                            }

                            serNode(body, -1);
                            document.body.removeChild(iframe);
                            URL.revokeObjectURL(blobUrl);
                            res({flatNodes, bmlBuf});
                        } catch(e) {
                            rej(e);
                        }
                    }, 600); // 600ms layout wait
                };
                iframe.onerror = (e) => rej(e);
            });
        }

        try {
            // Snapshot BASE
            const baseSnap = await snapshotDOM(baseHtml);
            const flatNodes = baseSnap.flatNodes;
            const bmlBuf = baseSnap.bmlBuf;

            const bmlData=new Uint8Array([0x42,0x4D,0x4C,0x02,...bmlBuf]);

            const bdtBuf=new ArrayBuffer(4+4+flatNodes.length*16);
            const bdtView=new DataView(bdtBuf);
            bdtView.setUint8(0,0x42);bdtView.setUint8(1,0x44);bdtView.setUint8(2,0x54);bdtView.setUint8(3,0x01);
            bdtView.setUint32(4,flatNodes.length);
            for(let i=0;i<flatNodes.length;i++){
                const off=8+i*16;
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
                bdtView.setUint8(off+10,depth);
            }

            const blbSize=4+4+flatNodes.length*60;
            const blbBuf=new ArrayBuffer(blbSize);
            const blbView=new DataView(blbBuf);
            blbView.setUint8(0,0x42);blbView.setUint8(1,0x4C);blbView.setUint8(2,0x42);blbView.setUint8(3,0x01);
            blbView.setUint32(4,flatNodes.length);
            for(let i=0;i<flatNodes.length;i++){
                const off=8+i*60;
                const s=flatNodes[i].cs;
                blbView.setUint16(off,i);
                blbView.setUint8(off+2,DM[s.display]??0);
                blbView.setUint8(off+3,PM_[s.position]??0);
                blbView.setUint8(off+4,s.boxSizing==='border-box'?1:0);
                blbView.setUint16(off+5,cssV(s.width));
                blbView.setUint16(off+7,cssV(s.height));
                blbView.setInt16(off+9,Math.round((parseFloat(s.marginTop)||0)*10));
                blbView.setInt16(off+11,Math.round((parseFloat(s.marginRight)||0)*10));
                blbView.setInt16(off+13,Math.round((parseFloat(s.marginBottom)||0)*10));
                blbView.setInt16(off+15,Math.round((parseFloat(s.marginLeft)||0)*10));
                blbView.setUint16(off+17,Math.max(0,Math.round((parseFloat(s.paddingTop)||0)*10)));
                blbView.setUint16(off+19,Math.max(0,Math.round((parseFloat(s.paddingRight)||0)*10)));
                blbView.setUint16(off+21,Math.max(0,Math.round((parseFloat(s.paddingBottom)||0)*10)));
                blbView.setUint16(off+23,Math.max(0,Math.round((parseFloat(s.paddingLeft)||0)*10)));
                blbView.setUint8(off+25,Math.min(Math.round((parseFloat(s.borderTopWidth)||0)*10),255));
                blbView.setUint8(off+26,Math.min(Math.round((parseFloat(s.borderRightWidth)||0)*10),255));
                blbView.setUint8(off+27,Math.min(Math.round((parseFloat(s.borderBottomWidth)||0)*10),255));
                blbView.setUint8(off+28,Math.min(Math.round((parseFloat(s.borderLeftWidth)||0)*10),255));
                blbView.setUint32(off+29,colorToU32(s.borderColor));
                blbView.setUint32(off+33,colorToU32(s.backgroundColor));
                blbView.setUint32(off+37,colorToU32(s.color));
                blbView.setUint16(off+41,Math.round((parseFloat(s.fontSize)||16)*10));
                blbView.setUint16(off+43,parseInt(s.fontWeight)||400);
                blbView.setUint16(off+45,Math.max(0,Math.round((parseFloat(s.lineHeight)||0)*10)));
                blbView.setUint8(off+47,TAM[s.textAlign]??0);
                blbView.setUint8(off+48,FDM[s.flexDirection]??0);
                blbView.setUint8(off+49,s.flexWrap==='wrap'?1:0);
                blbView.setUint8(off+50,JCM[s.justifyContent]??0);
                blbView.setUint8(off+51,AIM[s.alignItems]??3);
                blbView.setUint16(off+52,Math.max(0,Math.round((parseFloat(s.gap)||0)*10)));
                blbView.setUint16(off+54,Math.max(0,Math.round((parseFloat(s.borderRadius)||0)*10)));
                blbView.setUint8(off+56,OFM[s.overflow]??0);
                const op=parseFloat(s.opacity);
                blbView.setUint8(off+57,isNaN(op)?255:Math.round(op*255));
                const zi=parseInt(s.zIndex);blbView.setInt16(off+58,isNaN(zi)?0:Math.max(-32768,Math.min(32767,zi)));
            }

            // BDU Phase - Delta Generation!
            const bduVariants = [];
            for (const [url, htmlCode] of Object.entries(variantMap)) {
                let qStr = '';
                if (url.includes('?')) qStr = '?' + url.split('?').slice(1).join('?');
                
                const varSnap = await snapshotDOM(htmlCode, qStr);
                const vNodes = varSnap.flatNodes;
                
                const mutations = [];
                for (let i = 0; i < flatNodes.length; i++) {
                    if (i >= vNodes.length) break;
                    const bn = flatNodes[i];
                    const vn = vNodes[i];
                    
                    // Mutation 0x01: Text content changed
                    if (bn.textContent !== vn.textContent) {
                        mutations.push({ type: 1, nodeId: i, data: vn.textBytes });
                    }
                    
                    // Mutation 0x02: Attributes changed (like class)
                    const getAttr = (arr, id) => { const a = arr.find(x=>x.id===id); return a?a.value:null; };
                    const bnClass = getAttr(bn.attrs, ATTR_FWD['class']);
                    const vnClass = getAttr(vn.attrs, ATTR_FWD['class']);
                    if (bnClass !== vnClass && vnClass !== null) {
                        mutations.push({ type: 2, nodeId: i, attrId: ATTR_FWD['class'], data: enc.encode(vnClass) });
                    }
                }
                
                if (mutations.length > 0) {
                    bduVariants.push({ url, mutations });
                }
            }

            let bduLen = 0;
            const bduChunks = [];
            if (bduVariants.length > 0) {
                bduChunks.push(new Uint8Array([0x42, 0x44, 0x55, 0x01])); // BDU\\x01
                const vCountBuf = new ArrayBuffer(4);
                new DataView(vCountBuf).setUint32(0, bduVariants.length);
                bduChunks.push(new Uint8Array(vCountBuf));
                bduLen += 8;

                for (const v of bduVariants) {
                    const uBytes = enc.encode(v.url);
                    const headBuf = new ArrayBuffer(2 + uBytes.length + 4);
                    const headView = new DataView(headBuf);
                    headView.setUint16(0, uBytes.length);
                    new Uint8Array(headBuf).set(uBytes, 2);
                    headView.setUint32(2 + uBytes.length, v.mutations.length);
                    bduChunks.push(new Uint8Array(headBuf));
                    bduLen += headBuf.byteLength;

                    for (const m of v.mutations) {
                        const mBuf = new ArrayBuffer(m.type === 1 ? 7 : 8);
                        const mView = new DataView(mBuf);
                        mView.setUint16(0, m.nodeId);
                        mView.setUint8(2, m.type);
                        if (m.type === 1) {
                            mView.setUint32(3, m.data.length);
                        } else {
                            mView.setUint8(3, m.attrId);
                            mView.setUint32(4, m.data.length);
                        }
                        bduChunks.push(new Uint8Array(mBuf));
                        bduChunks.push(m.data);
                        bduLen += mBuf.byteLength + m.data.length;
                    }
                }
            }

            let bibData=new Uint8Array(0);
            let bibLen=0;
            if(extractedImages.length>0){
                const bibChunks=[new Uint8Array([0x42,0x49,0x42,0x01])];
                bibLen+=4;
                const dv4=new DataView(new ArrayBuffer(4));
                dv4.setUint32(0,extractedImages.length);
                bibChunks.push(new Uint8Array(dv4.buffer));
                bibLen+=4;
                for(const img of extractedImages){
                    const h=new DataView(new ArrayBuffer(22));
                    h.setUint32(0,img.id);
                    h.setUint16(4,img.w);
                    h.setUint16(6,img.h);
                    h.setUint8(8,1);
                    h.setUint8(9,1);
                    h.setUint16(16,0);
                    h.setUint32(18,img.data.length);
                    bibChunks.push(new Uint8Array(h.buffer));
                    bibChunks.push(img.data);
                    bibLen+=22+img.data.length;
                }
                bibData=new Uint8Array(bibLen);
                let offset=0;
                for(const chunk of bibChunks){bibData.set(chunk,offset);offset+=chunk.length;}
            }

            let secCount = 3;
            if (bibLen > 0) secCount++;
            if (bduLen > 0) secCount++;

            let bduData = new Uint8Array(bduLen);
            if (bduLen > 0) {
                let offset = 0;
                for (const chunk of bduChunks) {
                    bduData.set(chunk, offset);
                    offset += chunk.length;
                }
            }

            const totalSize=6 + 
                (1+4+bmlData.length) + 
                (1+4+bdtBuf.byteLength) + 
                (1+4+blbBuf.byteLength) + 
                (bibLen > 0 ? (1+4+bibLen) : 0) +
                (bduLen > 0 ? (1+4+bduLen) : 0);
                
            const out=new ArrayBuffer(totalSize);
            const ov=new DataView(out);
            const ou=new Uint8Array(out);
            let off=0;
            ou[off++]=0x42;ou[off++]=0x57;ou[off++]=0x45;ou[off++]=0x42;
            ou[off++]=1;
            ou[off++]=secCount;

            ou[off++]=1; // BML
            ov.setUint32(off,bmlData.length);off+=4;
            ou.set(bmlData,off);off+=bmlData.length;

            ou[off++]=2; // BDT
            ov.setUint32(off,bdtBuf.byteLength);off+=4;
            ou.set(new Uint8Array(bdtBuf),off);off+=bdtBuf.byteLength;

            ou[off++]=3; // BLB
            ov.setUint32(off,blbBuf.byteLength);off+=4;
            ou.set(new Uint8Array(blbBuf),off);off+=blbBuf.byteLength;

            if (bibLen > 0) {
                ou[off++]=4; // BIB
                ov.setUint32(off,bibLen);off+=4;
                ou.set(bibData,off);off+=bibLen;
            }
            
            if (bduLen > 0) {
                ou[off++]=0x0A; // BDU (Section 10)
                ov.setUint32(off,bduLen);off+=4;
                ou.set(bduData,off);off+=bduLen;
            }

            resolve(out);
        } catch(e) {
            reject(e);
        }
    });
}
