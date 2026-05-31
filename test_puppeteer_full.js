const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // We will simulate dropping the mediclean-pro folder
    const html = fs.readFileSync('/home/benjamin/projects/mediclean-pro/index.html', 'utf8');
    const css1 = fs.readFileSync('/home/benjamin/projects/mediclean-pro/css/style.v3.css');
    const css2 = fs.readFileSync('/home/benjamin/projects/mediclean-pro/css/responsive_auth.css');
    const css3 = fs.readFileSync('/home/benjamin/projects/mediclean-pro/css/accessibility.css');
    
    const files = [
        { name: 'index.html', content: html.toString('utf8'), path: 'index.html' },
        { name: 'style.v3.css', content: 'data:text/css;base64,' + css1.toString('base64'), path: 'css/style.v3.css' },
        { name: 'responsive_auth.css', content: 'data:text/css;base64,' + css2.toString('base64'), path: 'css/responsive_auth.css' },
        { name: 'accessibility.css', content: 'data:text/css;base64,' + css3.toString('base64'), path: 'css/accessibility.css' }
    ];
    
    await page.goto('file:///home/benjamin/projects/bml-prototype/converter.html');
    
    const result = await page.evaluate(async (files) => {
        let htmlContent = files[0].content;
        const fileDataMap = {};
        for(let i=1; i<files.length; i++) {
            fileDataMap[files[i].path] = files[i].content;
        }
        
        for (const [p, dataUrl] of Object.entries(fileDataMap)) {
            const escapedPath = p.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');
            htmlContent = htmlContent.replace(regex, `$1${dataUrl}$2`);
        }
        
        return new Promise(resolve => {
            const iframe = document.createElement('iframe');
            iframe.style.width = '1200px';
            iframe.style.height = '800px';
            iframe.style.position = 'absolute';
            iframe.style.top = '-10000px';
            iframe.style.left = '-10000px';
            iframe.style.visibility = 'hidden';
            document.body.appendChild(iframe);

            const cleanHtml = htmlContent
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
                .replace(/<script\b[^>]*\/>/gi, '')
                .replace(/\son[a-z]+\s*=\s*(['"])(.*?)\1/gi, '')
                .replace(/\son[a-z]+\s*=\s*[^>\s]+/gi, '');

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(cleanHtml);
            doc.close();

            setTimeout(() => {
                const skipLink = doc.querySelector('.skip-link');
                const header = doc.querySelector('header');
                const body = doc.body;
                
                // Let's also check if the <link> tags were actually replaced in doc.head!
                const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
                
                resolve({
                    skipLinkDisplay: iframe.contentWindow.getComputedStyle(skipLink).display,
                    headerDisplay: header ? iframe.contentWindow.getComputedStyle(header).display : 'null',
                    bodyColor: iframe.contentWindow.getComputedStyle(body).color,
                    links: links
                });
            }, 2500);
        });
    }, files);
    
    console.log("Computed styles:", result);
    await browser.close();
})();
