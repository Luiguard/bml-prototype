const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true, executablePath: '/home/benjamin/projects/bml-prototype/chrome/linux-149.0.7827.22/chrome-linux64/chrome'});
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://127.0.0.1:8080/converter.html', {waitUntil: 'networkidle2'});
  await browser.close();
})();
