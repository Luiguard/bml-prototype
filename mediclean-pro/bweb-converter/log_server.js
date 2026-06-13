const http = require('http');
const fs = require('fs');
const path = require('path');

const logFile = '/tmp/bweb_compile.log';

// Clear log on startup
fs.writeFileSync(logFile, '--- BWEB Build Log Server Started ---\n');

http.createServer((req, res) => {
    // Enable CORS so the browser can send logs
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if(req.method === 'POST' && req.url === '/log') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            fs.appendFileSync(logFile, body + '\n');
            res.writeHead(200);
            res.end('ok');
        });
    } else {
        res.writeHead(404);
        res.end();
    }
}).listen(8099, () => {
    console.log(`Log server listening on port 8099. Logs will be written to ${logFile}`);
});
