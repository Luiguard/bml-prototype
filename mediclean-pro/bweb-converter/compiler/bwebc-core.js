const fs = require('fs');
const path = require('path');
const { LogWriter } = require('./log-writer');
const { VFSReader } = require('./vfs-reader');
const { HtmlCssExtractor } = require('./html-css-extractor');
const { BmlCompiler } = require('./bml-compiler');
const { BlbCompiler } = require('./blb-compiler');
const { AssetCompiler } = require('./asset-compiler');
const { BdtCompiler } = require('./bdt-compiler');
const { BpgPackager } = require('./bpg-packager');

async function buildBweb(inputDir, outputFile) {
    console.log(`[Core] Starting BWEB compilation (v1.0.0 normative)`);
    console.log(`[Core] Input: ${inputDir} | Output: ${outputFile}`);

    const logDir = path.dirname(outputFile);
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

    // 1. Initialize Logger
    const logger = new LogWriter(logDir);

    try {
        // 2. VFS Phase
        const vfsReader = new VFSReader(inputDir, logger);
        const vfsManifest = vfsReader.scan();

        // 3. Extraction Phase (HTML + CSS -> AST)
        const extractor = new HtmlCssExtractor(logger);
        
        // Find the main HTML entry point (e.g. index.html or first available)
        let mainHtmlRel = Object.keys(vfsManifest.files).find(f => f.endsWith('.html'));
        if (!mainHtmlRel) throw new Error("No HTML file found in input directory.");
        const mainHtmlPath = vfsManifest.files[mainHtmlRel].absolutePath;
        
        const tmpAstPath = path.join(logDir, '.bweb-ast.json');
        const astNodes = await extractor.extract(mainHtmlPath, tmpAstPath);

        // --- ID MAP EXTRACTION ---
        const idMap = {};
        for (const node of astNodes) {
            if (node.attributes && node.attributes.id) {
                idMap[node.attributes.id] = node.id;
            }
        }
        const idMapPath = path.join(path.dirname(outputFile), 'idMap.json');
        fs.writeFileSync(idMapPath, JSON.stringify(idMap, null, 2));
        console.log(`[Core] Extracted ID Map written to ${idMapPath}`);

        // 4. BML Phase
        const bmlCompiler = new BmlCompiler(logger, vfsManifest);
        const bmlBuffer = bmlCompiler.compile(astNodes);

        // 5. BLB Phase
        const blbCompiler = new BlbCompiler(logger);
        const blbBuffer = blbCompiler.compile(astNodes);

        // 6. BDT Phase
        const bdtCompiler = new BdtCompiler(logger);
        const bdtBuffer = bdtCompiler.compile(astNodes);

        // 7. Asset Phase
        const assetCompiler = new AssetCompiler(logger);
        const assetBuffers = assetCompiler.compile(vfsManifest);

        // 8. Packager Phase
        const packager = new BpgPackager(logger);
        const sections = {
            bml: bmlBuffer,
            bdt: bdtBuffer,
            blb: blbBuffer,
            bib: assetBuffers.bibBuffer,
            bvs: assetBuffers.bvsBuffer,
            vfsManifest: vfsManifest
        };
        const finalHash = packager.package(outputFile, sections);

        logger.logDone(finalHash);
        
        // Cleanup tmp AST if you want, but good for debug
        console.log(`[Core] Compilation successful! Hash: ${finalHash}`);
    } catch (e) {
        console.error(`[Core] Compilation failed!`);
        console.error(e);
        process.exit(1);
    }
}

module.exports = { buildBweb };
