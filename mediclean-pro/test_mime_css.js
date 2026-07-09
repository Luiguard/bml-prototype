const fs = require('fs');
const http = require('http');

// Start a tiny server to simulate what converter.html might get
http.createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(`
            <iframe id="frame" style="width: 800px; height: 600px;"></iframe>
            <script>
                const cssBase64 = "Ym9keSB7IGJhY2tncm91bmQtY29sb3I6IHJlZDsgfQ=="; // body { background-color: red; }
                const doc = document.getElementById('frame').contentWindow.document;
                doc.open();
                doc.write('<html><head><link rel="stylesheet" href="data:text/css;base64,' + cssBase64 + '"></head><body><h1>Hello</h1></body></html>');
                doc.close();
                
                setTimeout(() => {
                    const color = document.getElementById('frame').contentWindow.getComputedStyle(doc.body).backgroundColor;
                    console.log("Color is:", color);
                    fetch('http://localhost:8081/log?c=' + encodeURIComponent(color));
                }, 600);
            </script>
        `);
    } else if (req.url.startsWith('/log')) {
        console.log(req.url);
        res.end('ok');
        process.exit(0);
    }
}).listen(8081, () => {
    console.log("Listening 8081");
});
