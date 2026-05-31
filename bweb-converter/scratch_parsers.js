        class BASParser{
            constructor(buf,offset=0){this.v=new DataView(buf);this.o=offset;this.u8=new Uint8Array(buf)}
            parse(){
                if(this.o+4>this.v.byteLength)return {};
                const count=this.v.getUint32(this.o);this.o+=4;
                const audios={};
                for(let i=0;i<count;i++){
                    if(this.o+11>this.v.byteLength)break;
                    const id=this.v.getUint32(this.o);this.o+=4;
                    const codecLen=this.v.getUint8(this.o++);
                    if(this.o+codecLen>this.v.byteLength)break;
                    const codec=new TextDecoder('ascii').decode(this.u8.slice(this.o,this.o+codecLen));
                    this.o+=codecLen;
                    const sampleRate=this.v.getUint32(this.o);this.o+=4;
                    const channels=this.v.getUint8(this.o++);
                    const chunkCount=this.v.getUint32(this.o);this.o+=4;
                    const chunks=[];
                    for(let j=0;j<chunkCount;j++){
                        if(this.o+13>this.v.byteLength)break;
                        const flags=this.v.getUint8(this.o++);
                        const isKey=(flags&1)===1;
                        const ptsHigh=this.v.getUint32(this.o);this.o+=4;
                        const ptsLow=this.v.getUint32(this.o);this.o+=4;
                        const pts=Number((BigInt(ptsHigh)<<32n)|BigInt(ptsLow));
                        const dur=this.v.getUint32(this.o);this.o+=4;
                        const dataLen=this.v.getUint32(this.o);this.o+=4;
                        if(this.o+dataLen>this.v.byteLength)break;
                        const data=this.u8.slice(this.o,this.o+dataLen);
                        this.o+=dataLen;
                        chunks.push({type:isKey?'key':'delta',timestamp:pts,duration:dur,data});
                    }
                    audios[id]={codec,sampleRate,channels,chunks};
                }
                return audios;
            }
        }

        class BEXParser {
            constructor(buf, offset = 0) {
                this.v = new DataView(buf);
                this.d = new TextDecoder('utf-8');
                this.o = offset;
            }
            parse() {
                if (this.o + 4 > this.v.byteLength) return [];
                const count = this.v.getUint32(this.o); this.o += 4;
                const rules = [];
                for (let i = 0; i < count; i++) {
                    if (this.o + 14 > this.v.byteLength) break;
                    const triggerNode = this.v.getUint32(this.o); this.o += 4;
                    const eventType = this.v.getUint8(this.o++);
                    const actionType = this.v.getUint8(this.o++);
                    const targetNode = this.v.getUint32(this.o); this.o += 4;
                    const paramLen = this.v.getUint16(this.o); this.o += 2;
                    
                    if (this.o + paramLen > this.v.byteLength) break;
                    const paramStr = this.d.decode(new Uint8Array(this.v.buffer, this.o, paramLen));
                    this.o += paramLen;
                    
                    rules.push({ triggerNode, eventType, actionType, targetNode, paramStr });
                }
                return rules;
            }
        }
