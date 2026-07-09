const { exec } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

module.exports = function bwebPlugin() {
    return {
        name: 'vite-plugin-bweb',
        apply: 'build',
        closeBundle: async () => {
            console.log('\n[vite-plugin-bweb] Build finished, starting BWEB compilation...');
            
            const distDir = path.resolve(process.cwd(), 'dist');
            const outputFile = path.resolve(distDir, 'index.bweb');
            const bwebcPath = path.resolve(__dirname, 'bwebc.js');
            
            // Start a simple static server for the dist directory
            const server = http.createServer((req, res) => {
                let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url);
                
                const extname = String(path.extname(filePath)).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                };
                
                const contentType = mimeTypes[extname] || 'application/octet-stream';
                
                fs.readFile(filePath, (error, content) => {
                    if (error) {
                        res.writeHead(404);
                        res.end('Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(content, 'utf-8');
                    }
                });
            });
            
            server.listen(0, '127.0.0.1', async () => {
                const port = server.address().port;
                const url = `http://127.0.0.1:${port}/`;
                console.log(`[vite-plugin-bweb] Serving dist on ${url}`);
                
                try {
                    console.log(`[vite-plugin-bweb] Compiling to ${outputFile}...`);
                    await new Promise((resolve, reject) => {
                        exec(`node "${bwebcPath}" build "${url}" "${outputFile}"`, (error, stdout, stderr) => {
                            if (stdout) console.log(stdout);
                            if (stderr) console.error(stderr);
                            if (error) reject(error);
                            else resolve();
                        });
                    });
                    console.log(`\n✅ [vite-plugin-bweb] Successfully created index.bweb!`);
                } catch (e) {
                    console.error('\n❌ [vite-plugin-bweb] Compilation failed:', e.message);
                } finally {
                    server.close();
                }
            });
        }
    };
};
