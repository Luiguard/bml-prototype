const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

    const html = fs.readFileSync('/home/benjamin/projects/mediclean-pro/index.html', 'utf8');
    const css1 = fs.readFileSync('/home/benjamin/projects/mediclean-pro/css/style.v3.css');
    
    let htmlContent = html.replace(
        /(["'\(])(?:\.\/|\/)?css\/style\.v3\.css(?:\?[^"'\)]*)?(?:#[^"'\)]*)?(["'\)])/g,
        `$1data:text/css;base64,${css1.toString('base64')}$2`
    );
    
    await page.setContent(`
        <html><body><script>
            const iframe = document.createElement('iframe');
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(${JSON.stringify(htmlContent)});
            doc.close();
        </script></body></html>
    `);
    
    await new Promise(r => setTimeout(r, 2000));
    
    const res = await page.evaluate(() => {
        const iframe = document.querySelector('iframe');
        const doc = iframe.contentWindow.document;
        const b = doc.body;
        return {
            color: iframe.contentWindow.getComputedStyle(b).color,
            bgColor: iframe.contentWindow.getComputedStyle(b).backgroundColor,
            linksCount: doc.querySelectorAll('link[rel="stylesheet"]').length
        };
    });
    
    console.log(res);
    await browser.close();
})();
