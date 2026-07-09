function buildBPGMulti(pagesData, globalBib, globalBff) {
    let bmlChunks = [], bdtChunks = [], blbChunks = [];
    let bmsChunks = []; // if needed
    let tocMap = {};
    let bmlOff=0, bdtOff=0, blbOff=0, bmsOff=0;

    for (let p of pagesData) {
        let bmlLen = p.bml.length;
        let bdtLen = p.bdt.length;
        let blbLen = p.blb.length; // Wait, blb has a countBuf at the start? No, countBuf is prepended later.
        let bmsLen = p.bms.length;

        tocMap[p.path] = {
            bml: [bmlOff, bmlLen],
            bdt: [bdtOff, bdtLen],
            blb: [blbOff, blbLen],
            bms: [bmsOff, bmsLen]
        };

        bmlChunks.push(p.bml); bmlOff += bmlLen;
        bdtChunks.push(p.bdt); bdtOff += bdtLen;
        blbChunks.push(p.blb); blbOff += blbLen;
        bmsChunks.push(p.bms); bmsOff += bmsLen;
    }

    const finalBml = concatBuffers(bmlChunks);
    const finalBdt = concatBuffers(bdtChunks);
    const rawBlb = concatBuffers(blbChunks);
    const finalBms = concatBuffers(bmsChunks);

    // we must prepend the overall block counts if necessary, or let content.js slice first.
    // In V2.0, countBuf for blb is 2 bytes. We can just put it per-page or globally?
    // Globally, if we slice, we don't need it because length / 50 is the count!
    // wait, content.js currently reads the count from the first 2 bytes of the BLB section.
}
