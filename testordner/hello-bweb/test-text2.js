const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.setContent('<div style="width: 50px">Hello world this is a long text</div>');
    const result = await page.evaluate(() => {
        const element = document.querySelector('div').firstChild;
        const originalText = element.nodeValue;
        const range = document.createRange();
        let lines = [];
        let currentLineText = "";
        let currentLineRect = null;
        let lastY = null;

        for (let i = 0; i < originalText.length; i++) {
            range.setStart(element, i);
            range.setEnd(element, i + 1);
            const rects = range.getClientRects();
            if (rects.length === 0) continue;
            const rect = rects[0];
            
            if (lastY === null) {
                lastY = rect.y;
                currentLineText = originalText[i];
                currentLineRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
            } else if (Math.abs(rect.y - lastY) > rect.height * 0.5) {
                lines.push({ text: currentLineText.trim(), rect: currentLineRect });
                lastY = rect.y;
                currentLineText = originalText[i];
                currentLineRect = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
            } else {
                currentLineText += originalText[i];
                currentLineRect.w = (rect.x + rect.width) - currentLineRect.x;
                currentLineRect.h = Math.max(currentLineRect.h, rect.height);
            }
        }
        if (currentLineText.trim()) {
            lines.push({ text: currentLineText.trim(), rect: currentLineRect });
        }
        return lines;
    });
    console.log(result);
    await browser.close();
})();
