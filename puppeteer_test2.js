const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // Wir bauen einen kleinen Server, um das Frontend aufzurufen
    const express = require('express');
    const app = express();
    app.use(express.static('/home/benjamin/projects'));
    const server = app.listen(0, async () => {
        const port = server.address().port;
        console.log("Listening on " + port);
        
        await page.goto(`http://localhost:${port}/mediclean-pro/bweb-converter/converter.html`);
        
        // Let's inject a script to manually trigger conversion with local files
        const result = await page.evaluate(async () => {
            return new Promise((resolve) => {
                // mock the handleFiles logic
                resolve("test");
            });
        });
        
        console.log(result);
        server.close();
        await browser.close();
    });
})();
