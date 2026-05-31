const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("[Roundtrip Test] Starte Compiler Pipeline...");

const inputHtml = path.resolve(__dirname, '../src/index.html');
const outputBweb = path.resolve(__dirname, '../dist/website.bweb');
const goldenBweb = path.resolve(__dirname, 'website.golden.bweb');

// 1. Compile
try {
    execSync('node bwebc.js build src dist/website.bweb', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
} catch (e) {
    console.error("[Roundtrip] Compiler Fehler!");
    process.exit(1);
}

if (!fs.existsSync(outputBweb)) {
    console.error("[Roundtrip] Keine .bweb generiert!");
    process.exit(1);
}

const currentBuffer = fs.readFileSync(outputBweb);
console.log(`[Roundtrip] Neu kompilierte BWEB: ${currentBuffer.length} Bytes`);

// 2. Validate Magic Header
if (currentBuffer.readUInt32BE(0) !== 0x42574542) {
    console.error("[Roundtrip] Fehler: Ungültiger Magic Header!");
    process.exit(1);
}

// 3. Freeze / Drift Check
if (!fs.existsSync(goldenBweb)) {
    console.log("[Roundtrip] Kein Golden File gefunden. Friere aktuelle Version als Golden File ein...");
    fs.writeFileSync(goldenBweb, currentBuffer);
    console.log("[Roundtrip] ❄️ Golden File eingefroren!");
    process.exit(0);
}

const goldenBuffer = fs.readFileSync(goldenBweb);

if (currentBuffer.equals(goldenBuffer)) {
    console.log("[Roundtrip] ✅ Erfolgreich! Byte-genau identisch mit Golden File.");
} else {
    const diff = Math.abs(currentBuffer.length - goldenBuffer.length);
    console.error(`[Roundtrip] ⚠️ DRIFT ALARM! Die Datei weicht vom Golden File ab (Größendifferenz: ${diff} Bytes).`);
    console.log("Falls das erwartet war (weil du am Compiler gearbeitet hast), lösche tests/website.golden.bweb und starte den Test neu, um das neue Format einzufrieren.");
    process.exit(1);
}
