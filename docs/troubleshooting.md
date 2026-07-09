# Troubleshooting

---

## Converter Issues

### "Keine HTML-Datei gefunden" (No HTML file found)

**Cause:** You selected a file instead of a folder, or the folder contains no `.html` files.

**Fix:** Click "Ordner hochladen" again and select the root folder of your website — the one that contains `index.html` directly.

---

### Images are missing in the BWEB output

**Cause:** Image paths that are absolute (starting with `/`) or use external URLs may not resolve correctly in the browser converter.

**Fix 1:** Make all image paths relative in your HTML/CSS:
```html
<!-- Instead of: -->
<img src="/images/logo.png">
<!-- Use: -->
<img src="./images/logo.png">
```

**Fix 2:** For external images (e.g., from a CDN), the converter will attempt to fetch them. If they are blocked by CORS, they will be missing. Download the images locally and reference them relatively.

---

### CSS styles look wrong (missing layout, wrong colors)

**Cause:** The BWEB converter uses an approximation of the browser's CSS engine. Some advanced CSS features are not fully supported.

**Known limitations:**
- `calc()` with mixed units (e.g., `calc(100% - 2rem)`) — simplified to a fixed pixel value
- CSS custom properties (`var()`) — supported only if defined in `:root`
- CSS animations and transitions — not supported (static snapshot only)
- `@container` queries — not supported
- `clip-path`, `mask` — not supported
- Very complex `:nth-child()` / `:has()` selectors — may not apply

**Fix:** Simplify complex CSS for BWEB-targeted builds, or use inline styles for critical layout elements.

---

### Compilation freezes or takes very long

**Cause:** Very large images (>5 MB each) or a very large number of files.

**Fix:**
- Optimize images before converting (use tools like [Squoosh](https://squoosh.app))
- Remove unused assets from the folder before selecting it
- For large sites, use the CLI instead: `node build-bweb.js ./my-site/ output.bweb`

---

### The output .bweb file is very large

**Cause:** Uncompressed images are embedded raw. A single 8 MP photo can be several MB.

**Fix:** Resize and compress images before converting. For photos, JPEG at 80% quality is usually sufficient. The converter re-encodes images internally, but starts from the quality of your source files.

---

## Engine / Rendering Issues

### Blank canvas (nothing renders)

**Cause:** The BWEB file loaded but has no renderable nodes, or the rendering loop threw an error silently.

**Fix:**
1. Open the browser console (F12) — look for JavaScript errors
2. Check if the file is valid: `node cli.js validate yourfile.bweb`
3. If using the polyfill, check that `window.BWEB_PAYLOAD_BASE64` is set

---

### Text appears with wrong font

**Cause:** Web fonts are only embedded if referenced via `@font-face` and the font files are included in the uploaded folder. Google Fonts CDN links are fetched at compile time — if the network request fails, the system font fallback is used.

**Fix:** Download fonts locally and include them in your website folder before converting:
```
/my-website/
  ├── index.html
  ├── fonts/
  │   └── inter.woff2
  └── style.css   ← @font-face { src: url('./fonts/inter.woff2') }
```

---

### Page navigation doesn't work (links do nothing)

**Cause:** Links point to pages that are not included in the BWEB VFS, or the click handler is not properly bound.

**Fix:**
- Make sure you converted the entire website folder (not just `index.html`)
- Internal links must use relative paths that match the filenames in the VFS
- External links (to other domains) open in a new tab — this is correct behavior

---

### Videos don't play

**Cause:** Video support (`VideoDecoder`) requires Chrome 94+ or Edge 94+. Firefox and Safari have limited `VideoDecoder` support.

**Fix:**
- Test in Chrome or Edge
- Ensure the video was compiled with a supported codec (`VP8`, `VP9`, `H.264`)
- The converter requires ffmpeg to be available for video transcoding — verify with `ffmpeg -version`

---

## Extension Issues

### Extension installed but not activating

**Cause:** The extension only activates for URLs ending in `.bweb` or `.bpg`.

**Fix:** Verify the URL ends in `.bweb`. A file served as `index.html` (even if it renders BWEB) will not trigger the extension.

---

### "BWEB Ladefehler" (Load Error) message

The error box shows a specific message. Common causes:

| Error message | Cause | Fix |
|---|---|---|
| "Invalid BWEB magic string" | File is not a valid BWEB file | Re-compile the source HTML |
| "HTTP Fehler 404" | The `.bweb` file was not found on the server | Check the file path and server configuration |
| "Handshake Verification FAILED" | `.bpg` file was tampered with or corrupted | Re-sign with `bweb-pack.js` |

---

### Blank page after extension loads `.bweb`

**Cause:** The BDT section has zero nodes, or all nodes have `display: none` in BLB.

**Fix:**
1. Run `node cli.js stats yourfile.bweb` — check that BDT and BLB sections are not empty
2. Open the BWEB DevTools panel to inspect the parsed tree

---

## CLI Issues

### "Cannot find module 'puppeteer'"

```bash
npm install puppeteer --save-dev
```

### "command not found: node"

Install Node.js from [nodejs.org](https://nodejs.org). Requires version 18 or higher.

Check your version:
```bash
node --version  # Should show v18.x.x or higher
```

### Build fails with "ENOENT: no such file or directory"

The input path doesn't exist or the output directory doesn't exist.

```bash
# Create output directory first
mkdir -p ./dist
node build-bweb.js ./my-site/ ./dist/website.bweb
```

---

## Still stuck?

Open an issue on GitHub with:
- Your OS and browser version
- The exact error message from the console
- The source HTML (or a minimal reproduction)
- The command you ran (for CLI issues)

**GitHub Issues:** [github.com/Luiguard/bml-prototype/issues](https://github.com/Luiguard/bml-prototype/issues)
