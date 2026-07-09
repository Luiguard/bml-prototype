const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class HtmlCssExtractor {
    constructor(logger) {
        this.logger = logger;
    }

    async extract(htmlFilePath, inputDir, outputJsonPath) {
        console.log(`[Extractor] Starting headless extraction for ${htmlFilePath}`);
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        await page.setJavaScriptEnabled(false);
        
        await page.setRequestInterception(true);
        page.on('request', request => {
            const url = new URL(request.url());
            if (url.protocol === 'file:' && url.pathname.startsWith('/')) {
                // If it's a root-relative path (e.g. /css/style.css) that Puppeteer resolved to file:///css/...
                // map it to the actual project inputDir.
                const projDir = path.resolve(inputDir);
                if (!url.pathname.startsWith(projDir)) {
                    const localPath = path.join(projDir, url.pathname);
                    try {
                        if (fs.existsSync(localPath)) {
                            console.log(`[Extractor] Intercepted and loaded: ${localPath}`);
                            const body = fs.readFileSync(localPath);
                            let contentType = 'text/plain';
                            if (localPath.endsWith('.css')) contentType = 'text/css';
                            else if (localPath.endsWith('.js')) contentType = 'application/javascript';
                            else if (localPath.endsWith('.png')) contentType = 'image/png';
                            else if (localPath.endsWith('.jpg') || localPath.endsWith('.jpeg')) contentType = 'image/jpeg';
                            else if (localPath.endsWith('.svg')) contentType = 'image/svg+xml';
                            
                            request.respond({
                                status: 200,
                                contentType,
                                body
                            });
                            return;
                        }
                    } catch(e) {}
                }
            }
            request.continue();
        });

        // We serve it directly from file for now, or via a simple local server if CORS is an issue.
        // For static AST extraction, file:// is fine.
        await page.goto(`file://${path.resolve(htmlFilePath)}`, { waitUntil: 'networkidle0', timeout: 15000 });
        await page.evaluateHandle('document.fonts.ready');

        const extracted = await page.evaluate(() => {
            let nodeIdCounter = 1;
            const nodes = [];

            function traverse(element, parentId = 0xFFFF, prevSiblingId = 0xFFFF) {
                if (element.nodeType !== 1 && element.nodeType !== 3) return 0xFFFF; // Only Elements and Text

                const id = nodeIdCounter++;
                const isText = element.nodeType === 3;
                let tag = isText ? '#text' : element.tagName.toLowerCase();
                if (tag === 'body') tag = 'body'; // Ensure standard mapping

                let textContent = '';
                if (isText) {
                    textContent = element.nodeValue.trim();
                    if (!textContent) {
                        nodeIdCounter--;
                        return 0xFFFF; // Ignore empty text nodes
                    }
                }

                // Attributes
                const attributes = {};
                if (!isText) {
                    for (const attr of element.attributes) {
                        attributes[attr.name] = attr.value;
                    }
                }

                // Layout (if element)
                let layout = null;
                if (!isText) {
                    const rect = element.getBoundingClientRect();
                    const style = window.getComputedStyle(element);
                    layout = {
                        left: style.left !== 'auto' ? style.left : undefined,
                        top: style.top !== 'auto' ? style.top : undefined,
                        width: style.width !== 'auto' ? style.width : undefined,
                        height: style.height !== 'auto' ? style.height : undefined,
                        display: style.display,
                        position: style.position,
                        boxSizing: style.boxSizing,
                        marginTop: style.marginTop,
                        marginRight: style.marginRight,
                        marginBottom: style.marginBottom,
                        marginLeft: style.marginLeft,
                        paddingTop: style.paddingTop,
                        paddingRight: style.paddingRight,
                        paddingBottom: style.paddingBottom,
                        paddingLeft: style.paddingLeft,
                        borderColor: (style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0) ? style.borderTopColor : null,
                        backgroundColor: style.backgroundColor,
                        backgroundImage: style.backgroundImage !== 'none' ? style.backgroundImage : undefined,
                        color: style.color,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        lineHeight: style.lineHeight,
                        textAlign: style.textAlign,
                        flexDirection: style.flexDirection,
                        flexWrap: style.flexWrap,
                        justifyContent: style.justifyContent,
                        alignItems: style.alignItems,
                        flexGrow: style.flexGrow,
                        flexShrink: style.flexShrink,
                        gap: style.gap,
                        borderRadius: style.borderRadius,
                        overflow: style.overflow,
                        fontFamily: style.fontFamily,
                        opacity: style.opacity,
                        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
                        filter: style.filter
                    };
                } else {
                    const range = document.createRange();
                    range.selectNodeContents(element);
                    const rect = range.getBoundingClientRect();
                    const style = window.getComputedStyle(element.parentElement);
                    layout = {
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
                        color: style.color,
                        fontSize: style.fontSize,
                        fontWeight: style.fontWeight,
                        fontFamily: style.fontFamily,
                        textAlign: style.textAlign
                    };
                }

                const nodeData = {
                    id,
                    parentId,
                    tag,
                    isText,
                    textContent,
                    attributes,
                    layout,
                    firstChild: 0xFFFF,
                    nextSibling: 0xFFFF
                };
                nodes.push(nodeData);

                if (!isText) {
                    let childId = 0xFFFF;
                    let lastChildId = 0xFFFF;
                    for (const child of element.childNodes) {
                        const cid = traverse(child, id, lastChildId);
                        if (cid !== 0xFFFF) {
                            if (childId === 0xFFFF) childId = cid;
                            if (lastChildId !== 0xFFFF) {
                                const lastNode = nodes.find(n => n.id === lastChildId);
                                if (lastNode) lastNode.nextSibling = cid;
                            }
                            lastChildId = cid;
                        }
                    }
                    nodeData.firstChild = childId;
                }

                return id;
            }

            // Start from documentElement (html)
            traverse(document.documentElement);
            return nodes;
        });

        await browser.close();

        fs.writeFileSync(outputJsonPath, JSON.stringify(extracted, null, 2));
        console.log(`[Extractor] Extracted ${extracted.length} nodes to AST.`);
        return extracted;
    }
}

module.exports = { HtmlCssExtractor };
