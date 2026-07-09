const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    const cssContent = 'body { background-color: rgb(255, 0, 0) !important; } .test { font-size: 50px; color: rgb(0, 255, 0); }';
    const cssBase64 = Buffer.from(cssContent).toString('base64');
    
    // Test 1: data: URI in <link> tag inside iframe via doc.write
    await page.setContent('<html><body><div id="result"></div></body></html>');
    
    const result = await page.evaluate(async (b64) => {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.width = '800px';
            iframe.style.height = '600px';
            iframe.style.opacity = '0';
            document.body.appendChild(iframe);
            
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`<!DOCTYPE html><html><head><link rel="stylesheet" href="data:text/css;base64,${b64}"></head><body><div class="test">Hello</div></body></html>`);
            doc.close();
            
            setTimeout(() => {
                const div = doc.querySelector('.test');
                const body = doc.body;
                const cs = iframe.contentWindow.getComputedStyle(div);
                const bcs = iframe.contentWindow.getComputedStyle(body);
                
                // Also check stylesheets
                const sheets = doc.styleSheets.length;
                const links = doc.querySelectorAll('link[rel="stylesheet"]');
                
                resolve({
                    fontSize: cs.fontSize,
                    color: cs.color,
                    bodyBg: bcs.backgroundColor,
                    sheetCount: sheets,
                    linkCount: links.length,
                    linkHref: links[0]?.href?.substring(0, 40) || 'none'
                });
            }, 2000);
        });
    }, cssBase64);
    
    console.log('Test 1 - data: URI in <link> via doc.write:', JSON.stringify(result));
    
    // Test 2: inject CSS as <style> tag instead
    const result2 = await page.evaluate(async (css) => {
        return new Promise((resolve) => {
            const iframe = document.createElement('iframe');
            iframe.style.width = '800px';
            iframe.style.height = '600px';
            iframe.style.opacity = '0';
            document.body.appendChild(iframe);
            
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(`<!DOCTYPE html><html><head><style>${css}</style></head><body><div class="test">Hello</div></body></html>`);
            doc.close();
            
            setTimeout(() => {
                const div = doc.querySelector('.test');
                const body = doc.body;
                const cs = iframe.contentWindow.getComputedStyle(div);
                const bcs = iframe.contentWindow.getComputedStyle(body);
                
                resolve({
                    fontSize: cs.fontSize,
                    color: cs.color,
                    bodyBg: bcs.backgroundColor,
                    sheetCount: doc.styleSheets.length
                });
            }, 2000);
        });
    }, cssContent);
    
    console.log('Test 2 - inline <style> tag:', JSON.stringify(result2));
    
    await browser.close();
})();
