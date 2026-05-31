const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    await page.setContent(`
        <html>
        <body>
            <script>
                async function run() {
                    const iframe = document.createElement('iframe');
                    iframe.style.width = '1200px';
                    iframe.style.height = '800px';
                    iframe.style.position = 'absolute';
                    iframe.style.top = '-10000px';
                    iframe.style.left = '-10000px';
                    iframe.style.visibility = 'hidden';
                    document.body.appendChild(iframe);
                    
                    const cssBase64 = btoa('body { background-color: rgb(255, 0, 0); } .test { font-size: 50px; }');
                    const cleanHtml = '<!DOCTYPE html><html><head><link rel="stylesheet" href="data:text/css;base64,' + cssBase64 + '"></head><body><div class="test">Hello</div></body></html>';
                    
                    const doc = iframe.contentWindow.document;
                    doc.open();
                    doc.write(cleanHtml);
                    doc.close();
                    
                    return new Promise(resolve => {
                        setTimeout(() => {
                            const div = doc.querySelector('.test');
                            const cs = iframe.contentWindow.getComputedStyle(div);
                            resolve({
                                fontSize: cs.fontSize,
                                bodyBg: iframe.contentWindow.getComputedStyle(doc.body).backgroundColor
                            });
                        }, 500);
                    });
                }
            </script>
        </body>
        </html>
    `);
    
    const res = await page.evaluate(() => window.run());
    console.log(res);
    await browser.close();
})();
