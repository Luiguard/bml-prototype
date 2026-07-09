const fs = require('fs');

async function test() {
    let htmlContent = fs.readFileSync('index.html', 'utf8');
    
    // Read actual video base64
    const videoPath = 'images/Desk_Cleaning_Video_Generation.mp4';
    const videoData = fs.readFileSync(videoPath);
    const videoBase64 = videoData.toString('base64');
    const dataUrl = `data:video/mp4;base64,${videoBase64}`;
    
    const escapedPath = videoPath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(["'\\(])(?:\\.\\/|\\/)?${escapedPath}(?:\\?[^"'\\)]*)?(?:#[^"'\\)]*)?(["'\\)])`, 'g');
    
    htmlContent = htmlContent.replace(regex, `$1${dataUrl}$2`);
    
    fs.writeFileSync('cleaned_test2.html', htmlContent);
    console.log("Done.");
}
test();
