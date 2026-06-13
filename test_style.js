const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: 'new'});
    const page = await browser.newPage();
    await page.goto('file:///home/benjamin/projects/mediclean-pro/index.html', { waitUntil: 'networkidle0' });
    const styles = await page.evaluate(() => {
        const el = document.querySelector('.container');
        if (!el) return null;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return { styleWidth: style.width, rectWidth: rect.width };
    });
    console.log(styles);
    await browser.close();
})();
