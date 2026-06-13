const { Buffer } = require('buffer');

class BlbCompiler {
    constructor(logger) {
        this.logger = logger;
    }

    compile(astNodes) {
        // BLB Header (BLB\x01 + length placeholder 4 bytes)
        // Aber hier geben wir nur den Body zurück, der Packager macht den Header.
        // Node Count 4 bytes:
        const countBuf = Buffer.alloc(4);
        countBuf.writeUInt32BE(astNodes.length, 0);

        const bufs = [countBuf];
        let totalProps = 0;

        for (const node of astNodes) {
            // Node ID (2 bytes)
            const idBuf = Buffer.alloc(2);
            idBuf.writeUInt16BE(node.id, 0);
            bufs.push(idBuf);

            if (!node.layout) {
                // 0 properties
                bufs.push(Buffer.from([0x00]));
                continue;
            }

            const l = node.layout;
            const props = [];

            const addDim = (tag, val) => {
                if (!val) return;
                const match = val.toString().match(/([-\d.]+)(px|%|em|rem|vh|vw|auto)?/);
                if (!match) return;
                const num = Math.round(parseFloat(match[1]) * 100);
                const unitStr = match[2] || 'px';
                let unit = 0; // px
                if (unitStr === '%') unit = 1;
                else if (unitStr === 'em' || unitStr === 'rem') unit = 2;
                else if (unitStr === 'vw' || unitStr === 'vh') unit = 3;
                else if (unitStr === 'auto') unit = 4;
                
                const b = Buffer.alloc(7);
                b.writeUInt8(tag, 0);
                b.writeUInt8(0, 1); // type 0 = dimension
                b.writeUInt8(unit, 2);
                b.writeInt32BE(num, 3);
                props.push(b);
            };

            const addEnum = (tag, val, map) => {
                if (val && map[val] !== undefined) {
                    const b = Buffer.alloc(3);
                    b.writeUInt8(tag, 0);
                    b.writeUInt8(1, 1); // type 1 = enum/u8
                    b.writeUInt8(map[val], 2);
                    props.push(b);
                }
            };

            const parseColor = (c) => {
                if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return 0;
                const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                if (m) {
                    const a = m[4] ? Math.round(parseFloat(m[4])*255) : 255;
                    return (((parseInt(m[1])<<24) | (parseInt(m[2])<<16) | (parseInt(m[3])<<8) | a) >>> 0);
                }
                return 0;
            };

            const addColor = (tag, val) => {
                const c32 = parseColor(val);
                if (c32 !== 0) {
                    const b = Buffer.alloc(6);
                    b.writeUInt8(tag, 0);
                    b.writeUInt8(2, 1); // type 2 = color
                    b.writeUInt32BE(c32, 2);
                    props.push(b);
                }
            };

            const addString = (tag, val) => {
                if (!val) return;
                const strBytes = Buffer.from(val, 'utf-8');
                const len = Math.min(strBytes.length, 64);
                const b = Buffer.alloc(4 + len);
                b.writeUInt8(tag, 0);
                b.writeUInt8(3, 1); // type 3 = string
                b.writeUInt16BE(len, 2);
                strBytes.copy(b, 4, 0, len);
                props.push(b);
            };

            // Mapping definitions
            const displayMap = {'none':0,'block':1,'flex':2,'inline':3,'inline-block':4,'grid':5};
            const posMap = {'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4};

            addDim(1, l.width);
            addDim(2, l.height);
            addEnum(5, l.display, displayMap);
            addEnum(6, l.position, posMap);
            
            addDim(8, l.marginTop);
            addDim(10, l.marginBottom);
            addDim(11, l.marginLeft);
            addDim(9, l.marginRight);

            addDim(12, l.paddingTop);
            addDim(14, l.paddingBottom);
            addDim(15, l.paddingLeft);
            addDim(13, l.paddingRight);

            addColor(17, l.backgroundColor);
            addColor(18, l.color);
            addColor(36, l.borderColor);

            addDim(19, l.fontSize);
            addDim(35, l.borderRadius);
            
            if (l.backdropFilter && l.backdropFilter !== 'none') {
                const b = Buffer.alloc(3);
                b.writeUInt8(38, 0); // Tag 38 for backdrop-filter/glassmorphism
                b.writeUInt8(1, 1);
                b.writeUInt8(1, 2);
                props.push(b);
            }
            
            if (l.filter && l.filter.includes('blur')) {
                const m = l.filter.match(/blur\(([\d.]+)px\)/);
                if (m) {
                    const num = Math.round(parseFloat(m[1]));
                    const b = Buffer.alloc(4);
                    b.writeUInt8(39, 0); // Tag 39 for blur(px)
                    b.writeUInt8(4, 1); // type 4 = uint16
                    b.writeUInt16BE(num, 2);
                    props.push(b);
                }
            }
            
            addString(21, l.fontFamily);
            
            if (l.fontWeight) {
                const fw = parseInt(l.fontWeight) || 400;
                const b = Buffer.alloc(4);
                b.writeUInt8(22, 0); // Tag 22 for fontWeight
                b.writeUInt8(4, 1); // type 4 = uint16
                b.writeUInt16BE(fw, 2);
                props.push(b);
            }
            
            // Absolut Position (Rect) - Tag 46,47,48,49
            if (l.left !== undefined) addDim(46, l.left + 'px');
            if (l.top !== undefined) addDim(47, l.top + 'px');
            // ... omitting explicit w/h if already set, but rect guarantees accuracy

            const countProp = Buffer.alloc(1);
            countProp.writeUInt8(props.length, 0);
            bufs.push(countProp);
            for (const p of props) bufs.push(p);

            totalProps += props.length;
        }

        const finalBuffer = Buffer.concat(bufs);
        if (this.logger) this.logger.logEmitBlock('BLB', finalBuffer.length, astNodes.length);
        return finalBuffer;
    }
}

module.exports = { BlbCompiler };
