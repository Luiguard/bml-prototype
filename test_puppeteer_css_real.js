const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    const html = fs.readFileSync('/home/benjamin/projects/mediclean-pro/index.html', 'utf8');
    const css1 = fs.readFileSync('/home/benjamin/projects/mediclean-pro/css/style.v3.css');
    const css2 = fs.readFileSync('/home/benjamin/projects/mediclean-pro/css/accessibility.css');
    
    const filesData = {
        html: html,
        css1: css1.toString('base64'),
        css2: css2.toString('base64')
    };

    await page.evaluate((data) => {
        let htmlContent = data.html;
        
        // Emulate the exact regex from converter.html
        const fileDataMap = {
            'css/style.v3.css': 'data:text/css;base64,' + data.css1,
            'css/accessibility.css': 'data:text/css;base64,' + data.css2
        };
        
        for (const [p, dataUrl] of Object.entries(fileDataMap)) {
            const escapedPath = p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');
            htmlContent = htmlContent.replace(regex, `$1${dataUrl}$2`);
        }
        
        const iframe = document.createElement('iframe');
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(htmlContent);
        doc.close();
        
        window.testIframe = iframe;
    }, filesData);
    
    await new Promise(r => setTimeout(r, 2000));
    
    const res = await page.evaluate(() => {
        const iframe = window.testIframe;
        const doc = iframe.contentWindow.document;
        const b = doc.body;
        
        const linkHref = doc.querySelector('link[href*="style.v3.css"]')?.href || 'none';
        const skipLink = doc.querySelector('.skip-link');
        
        return {
            bodyColor: iframe.contentWindow.getComputedStyle(b).color,
            bodyBg: iframe.contentWindow.getComputedStyle(b).backgroundColor,
            linkFound: linkHref.substring(0, 30),
            skipLinkDisplay: skipLink ? iframe.contentWindow.getComputedStyle(skipLink).display : 'missing'
        };
    });
    
    console.log(res);
    await browser.close();
})();
