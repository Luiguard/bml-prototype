#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON_SCRIPT = path.join(__dirname, 'binary_formats.py');
const VERSION = '1.0.0';

const args = process.argv.slice(2);
const cmd = args[0];

function usage() {
    console.log(`
  bweb v${VERSION} — Binary Web Engine CLI

  Usage:
    bweb convert <input.html> [output.bweb]   Convert HTML to BWEB
    bweb stats <file.bweb>                     Show section statistics
    bweb validate <file.bweb>                  Validate BWEB integrity
    bweb version                               Show version
    bweb help                                  Show this help

  Examples:
    bweb convert index.html
    bweb convert site.html dist/site.bweb
    bweb stats dist/site.bweb
    bweb validate dist/site.bweb
`);
}

function findPython() {
    for (const cmd of ['python3', 'python']) {
        try {
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            return cmd;
        } catch (e) {}
    }
    console.error('Error: Python 3 is required but not found in PATH.');
    process.exit(1);
}

function convert(input, output) {
    if (!fs.existsSync(input)) {
        console.error(`Error: File not found: ${input}`);
        process.exit(1);
    }
    const py = findPython();
    const outArg = output ? ` "${output}"` : '';
    try {
        const result = execSync(`${py} "${PYTHON_SCRIPT}" "${input}"${outArg}`, {
            encoding: 'utf-8',
            cwd: __dirname
        });
        console.log(result.trim());
    } catch (e) {
        console.error('Conversion failed:', e.stderr || e.message);
        process.exit(1);
    }
}

function stats(file) {
    if (!fs.existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
    }
    const py = findPython();
    try {
        const result = execSync(`${py} "${PYTHON_SCRIPT}" --stats "${file}"`, {
            encoding: 'utf-8',
            cwd: __dirname
        });
        console.log(result.trim());
    } catch (e) {
        console.error('Stats failed:', e.stderr || e.message);
        process.exit(1);
    }
}

function validate(file) {
    if (!fs.existsSync(file)) {
        console.error(`Error: File not found: ${file}`);
        process.exit(1);
    }
    const buf = fs.readFileSync(file);

    if (buf.length < 6) {
        console.error('FAIL: File too small (< 6 bytes)');
        process.exit(1);
    }

    const magic = buf.toString('ascii', 0, 4);
    if (magic !== 'BWEB') {
        console.error(`FAIL: Invalid magic bytes: ${magic} (expected BWEB)`);
        process.exit(1);
    }

    const version = buf[4];
    const secCount = buf[5];
    console.log(`  Magic:    BWEB ✓`);
    console.log(`  Version:  ${version}`);
    console.log(`  Sections: ${secCount}`);

    let offset = 6;
    const sectionNames = { 1: 'BML', 2: 'BDT', 3: 'BLB', 4: 'BIB', 5: 'BVS' };
    const magicBytes = {
        1: [0x42, 0x4D, 0x4C],
        2: [0x42, 0x44, 0x54],
        3: [0x42, 0x4C, 0x42],
        4: [0x42, 0x49, 0x42]
    };

    let ok = true;
    for (let i = 0; i < secCount; i++) {
        if (offset + 5 > buf.length) {
            console.error(`  FAIL: Truncated section table at section ${i + 1}`);
            process.exit(1);
        }
        const secType = buf[offset++];
        const secLen = buf.readUInt32BE(offset); offset += 4;

        if (offset + secLen > buf.length) {
            console.error(`  FAIL: Section ${sectionNames[secType] || secType} declares ${secLen} bytes but only ${buf.length - offset} remain`);
            ok = false;
            break;
        }

        const expected = magicBytes[secType];
        let magicOk = true;
        if (expected) {
            for (let j = 0; j < expected.length; j++) {
                if (buf[offset + j] !== expected[j]) {
                    magicOk = false;
                    break;
                }
            }
        }

        const status = magicOk ? '✓' : '✗ WRONG MAGIC';
        console.log(`  SEC ${secType} (${sectionNames[secType] || '???'}): ${secLen.toLocaleString()} bytes ${status}`);
        offset += secLen;
    }

    if (offset !== buf.length) {
        console.error(`  WARNING: ${buf.length - offset} trailing bytes after last section`);
    }

    if (ok) {
        console.log('\n  Result: VALID ✓');
    } else {
        console.log('\n  Result: INVALID ✗');
        process.exit(1);
    }
}

switch (cmd) {
    case 'convert':
        if (!args[1]) { console.error('Error: Missing input file'); usage(); process.exit(1); }
        convert(args[1], args[2]);
        break;
    case 'stats':
        if (!args[1]) { console.error('Error: Missing input file'); usage(); process.exit(1); }
        stats(args[1]);
        break;
    case 'validate':
        if (!args[1]) { console.error('Error: Missing input file'); usage(); process.exit(1); }
        validate(args[1]);
        break;
    case 'version':
        console.log(`bweb v${VERSION}`);
        break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
        usage();
        break;
    default:
        console.error(`Unknown command: ${cmd}`);
        usage();
        process.exit(1);
}
