const fs = require('fs');
let polyfillHtml = fs.readFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', 'utf-8');

polyfillHtml = polyfillHtml.replace(
    /if\(bdtBuf&&rootEl\)\{/,
    "if(bdtBuf){"
);

fs.writeFileSync('/home/benjamin/projects/mediclean-pro/polyfill.html', polyfillHtml);
console.log('Fixed if(bdtBuf) block condition');
