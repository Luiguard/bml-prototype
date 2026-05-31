const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class HtmlCssExtractor {
    constructor(logger) {
        this.logger = logger;
    }

    async extract(htmlFilePath, outputJsonPath) {
        console.log(`[Extractor] Starting headless extraction for ${htmlFilePath}`);
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // We serve it directly from file for now, or via a simple local server if CORS is an issue.
        // For static AST extraction, file:// is fine.
        await page.goto(`file://${path.resolve(htmlFilePath)}`, { waitUntil: 'networkidle0' });
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
                        left: rect.left,
                        top: rect.top,
                        width: rect.width,
                        height: rect.height,
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
