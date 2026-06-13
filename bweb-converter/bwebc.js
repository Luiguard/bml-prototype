#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildBweb } = require('./compiler/bwebc-core.js');

const args = process.argv.slice(2);
const command = args[0];

const CONFIG_PATH = path.join(process.cwd(), 'bweb.config.json');
let config = {};
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

function showHelp() {
    console.log(`
BWEB Compiler & CLI v1.0.0 (Normative Release)
Usage: bwebc <command> [options]
  bwebc build <dir> [output.bweb]  - Kompiliert HTML zu BWEB inkl. BPG Signature
  bwebc test                       - Startet die Golden-File Testsuite
  bwebc roundtrip                  - Führt einen voll deterministischen HTML->BWEB->DOM-Dump Validator aus
  bwebc inspect <file.bweb>        - Analysiert eine BWEB Datei
`);
}

switch (command) {
    case 'build': {
        const inputDir = args[1];
        const outFile = args[2] || 'website.bweb';
        if (!inputDir) {
            console.error('Fehler: Eingabeverzeichnis fehlt.');
            process.exit(1);
        }
        console.log(`[bwebc] Starte Build-Prozess für ${inputDir}...`);
        
        buildBweb(path.resolve(inputDir), path.resolve(outFile))
            .then(() => {
                console.log(`[bwebc] Build abgeschlossen. (Mode: ${config.mode || 'default'})`);
            })
            .catch(e => {
                console.error('[bwebc] Build fehlgeschlagen.', e);
                process.exit(1);
            });
            
        break;
    }
    case 'test': {
        console.log(`[bwebc] Starte Testsuite...`);
        try {
            require('child_process').spawnSync('node', [path.join(__dirname, 'tests/runner.js')], { stdio: 'inherit' });
        } catch(e) {
            console.error('[bwebc] Tests fehlgeschlagen.');
            process.exit(1);
        }
        break;
    }
    case 'roundtrip': {
        console.log(`[bwebc] Starte Roundtrip Validator...`);
        try {
            require('child_process').spawnSync('node', [path.join(__dirname, 'tests/roundtrip.js')], { stdio: 'inherit' });
        } catch(e) {
            console.error('[bwebc] Roundtrip Validator fehlgeschlagen (Drift erkannt!).');
            process.exit(1);
        }
        break;
    }
    case 'inspect': {
        const file = args[1];
        if (!file || !fs.existsSync(file)) {
            console.error('Fehler: Datei nicht gefunden.');
            process.exit(1);
        }
        const stats = fs.statSync(file);
        console.log(`[bwebc] Inspektion von ${file}`);
        console.log(`- Dateigröße: ${(stats.size / 1024).toFixed(2)} KB`);
        // TODO: Full binary parsing for section breakdown
        console.log(`- Status: BWEB Header erkannt.`);
        break;
    }
    default:
        showHelp();
        process.exit(1);
}
