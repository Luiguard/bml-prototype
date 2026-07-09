function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        // Fake measure
        if (testLine.length * 8 > maxWidth && n > 0) {
            y += lineHeight;
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
}
