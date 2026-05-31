const { Buffer } = require('buffer');

class BmlCompiler {
    constructor(logger) {
        this.logger = logger;
        this.tagMap = {
            'div': 0x01, 'span': 0x02, 'p': 0x03, 'a': 0x04,
            'h1': 0x05, 'h2': 0x06, 'h3': 0x07, 'h4': 0x08,
            'h5': 0x09, 'h6': 0x0A, 'img': 0x0B, 'button': 0x0C,
            'input': 0x0D, 'form': 0x0E, 'ul': 0x0F, 'li': 0x10,
            'header': 0x11, 'footer': 0x12, 'nav': 0x13, 'section': 0x14,
            'article': 0x15, 'aside': 0x16, 'main': 0x17, '#text': 0xFF
        };
        this.attrMap = {
            'class': 0x10, 'id': 0x11, 'src': 0x12, 'href': 0x13,
            'alt': 0x14, 'type': 0x15, 'value': 0x16, 'placeholder': 0x17,
            'name': 0x18, 'disabled': 0x19, 'checked': 0x1A, 'role': 0x1F,
            'aria-label': 0x20
        };
    }

    compile(astNodes) {
        const bufs = [];
        // BML Section Header
        bufs.push(Buffer.from([0x42, 0x4D, 0x4C, 0x01]));
        
        let nodeCount = 0;

        for (const node of astNodes) {
            nodeCount++;
            const tagByte = this.tagMap[node.tag] || 0x01; // fallback to div

            if (node.isText) {
                const textBuf = Buffer.from(node.textContent, 'utf-8');
                const header = Buffer.alloc(3);
                header.writeUInt8(0xFF, 0); // Text opcode
                header.writeUInt16BE(textBuf.length, 1);
                bufs.push(header, textBuf);
            } else {
                const attrKeys = Object.keys(node.attributes);
                const validAttrs = attrKeys.filter(k => this.attrMap[k]);
                
                const header = Buffer.alloc(2);
                header.writeUInt8(tagByte, 0);
                header.writeUInt8(validAttrs.length, 1);
                bufs.push(header);

                for (const key of validAttrs) {
                    const attrOpcode = this.attrMap[key];
                    const valBuf = Buffer.from(node.attributes[key], 'utf-8');
                    const attrHeader = Buffer.alloc(3);
                    attrHeader.writeUInt8(attrOpcode, 0);
                    attrHeader.writeUInt16BE(valBuf.length, 1);
                    bufs.push(attrHeader, valBuf);
                }
            }
        }

        const bmlBuffer = Buffer.concat(bufs);
        if (this.logger) this.logger.logEmitBlock('BML', bmlBuffer.length, nodeCount);
        return bmlBuffer;
    }
}

module.exports = { BmlCompiler };
