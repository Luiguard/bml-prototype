const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

walkDir('/home/benjamin/projects/mediclean-pro', (filePath) => {
    try {
        const data = fs.readFileSync(filePath);
        const b64 = data.toString('base64');
        if (b64.includes('Kr3T0L')) {
            console.log("FOUND IN:", filePath);
        }
    } catch(e) {}
});
