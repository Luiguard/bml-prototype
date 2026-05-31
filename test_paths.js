const files = [
    { name: 'index.html', webkitRelativePath: 'mediclean-pro/index.html' },
    { name: 'service.html', webkitRelativePath: 'mediclean-pro/service.html' },
    { name: 'test.html', webkitRelativePath: 'mediclean-pro/docs/test.html' }
];

for (const file of files) {
    let url = file.customRelativePath || file.webkitRelativePath || file.name;
    if (url && url.includes('/')) {
        const pathParts = url.split('/');
        pathParts.shift();
        url = pathParts.join('/');
    }
    console.log(url);
}
