# Getting Started with BWEB

This guide takes you from zero to a working BWEB page in under 10 minutes.

---

## What you need

- A modern browser (Chrome, Edge, Firefox, Brave)
- An existing HTML website **or** just curiosity to try the demo

No account. No upload. No server. Everything runs locally.

---

## Step 1 — Understand what BWEB is (2 minutes)

BWEB converts your website from **text-based HTML** into a **compact binary file** (`.bweb`).

When a visitor opens a classic website, their browser:
1. Downloads a large HTML file (text)
2. Parses every character one by one
3. Builds a DOM tree
4. Calculates all CSS styles
5. Lays out every element
6. Finally renders pixels

With BWEB, steps 2–5 are pre-computed by the converter. The browser receives a binary file where every element already has its exact position, size and color. It draws directly to screen — skipping the parsing pipeline entirely.

**Result:** Smaller files. Faster rendering. No tracking. No cookies.

---

## Step 2 — Install the browser extension

The extension lets your browser open `.bweb` files natively, just like it opens `.html` files.

### Chrome / Edge / Brave

1. Go to the [latest release](https://github.com/Luiguard/bml-prototype/releases/latest)
2. Download `bweb-extension-chrome.zip`
3. Extract the ZIP to a folder on your computer
4. Open `chrome://extensions` in your browser
5. Toggle **Developer Mode** on (top-right corner)
6. Click **Load unpacked**
7. Select the folder you extracted in step 3
8. You'll see "BWEB Inspector" appear in your extensions list ✅

### Firefox

1. Download `bweb-extension-firefox.xpi`
2. Open `about:debugging` in Firefox
3. Click **This Firefox** in the left sidebar
4. Click **Load Temporary Add-on...**
5. Select the downloaded `.xpi` file ✅

> [!NOTE]
> Firefox requires re-installing the extension each time you restart the browser (temporary add-ons). For permanent installation, the extension needs to be signed by Mozilla.

---

## Step 3 — Open a BWEB demo page

Once the extension is installed, open a `.bweb` file directly in your browser.

The fastest way: open the BWEB landing page which is itself served as a BWEB file:

```
https://mediclean-pro.at/index.bweb
```

You should see the page render instantly on a canvas — no HTML, no DOM. If it looks identical to the HTML version, the extension is working correctly.

**Without the extension**, the page falls back to the JavaScript polyfill automatically. It still works, just slightly slower on the first load.

---

## Step 4 — Convert your own website

### Option A: Browser Converter (Recommended — no install)

1. Open [`bweb-converter.html`](https://mediclean-pro.at/bweb-converter/bweb-converter.html) in your browser
2. Click **"Ordner hochladen"** (Upload folder)
3. Select the root folder of your website (the one with `index.html`)
4. Click **"Kompilieren"** (Compile)
5. Wait a few seconds — the progress bar shows each step
6. Click **"Download .bweb"** when done

> [!TIP]
> The converter reads your CSS files, inlines all images as base64, resolves all relative paths, and produces a single self-contained `.bweb` file. Nothing leaves your browser.

### Option B: CLI

```bash
# Single page
node cli.js convert my-website/index.html output.bweb

# Full multi-page site
node build-bweb.js ./my-website/ ./output/website.bweb
```

See [CLI Reference](./cli-reference.md) for all options.

---

## Step 5 — Serve the .bweb file

A `.bweb` file can be served like any static file. Your web server just needs to send the correct MIME type.

### Apache (`.htaccess`)
```apache
AddType application/bweb .bweb
AddType application/bpg .bpg
```

### nginx
```nginx
types {
    application/bweb  bweb;
    application/bpg   bpg;
}
```

### Node.js / Express
```javascript
res.set('Content-Type', 'application/bweb');
res.sendFile('website.bweb');
```

> [!IMPORTANT]
> If visitors don't have the extension installed, they need the **polyfill** to see your page. See Step 6.

---

## Step 6 — Make it work for visitors without the extension

When the converter generates your `.bweb` file, it also generates a **self-contained `index.html`** polyfill wrapper. This is what visitors without the extension see.

The polyfill file:
- Contains the full BWEB rendering engine as JavaScript
- Embeds the `.bweb` binary as Base64
- Renders your page on a `<canvas>` element
- Shows a banner inviting the user to install the extension for better performance

**Deploy both files:**
```
/your-server/
  ├── index.html        ← Polyfill wrapper (for browsers without extension)
  └── index.bweb        ← Binary file (for browsers with extension)
```

The polyfill's `index.html` automatically detects if the BWEB extension is installed and switches to native rendering when available.

---

## Step 7 — Pack into a signed .bpg (optional, for production)

For production deployments, wrap your `.bweb` in a signed BPG container. This adds:
- SHA-256 integrity verification (tamper detection)
- ECDSA handshake token (authenticity proof)

```bash
node testordner/hello-bweb/bweb-pack.js pack website.bweb website.bpg
```

The engine verifies the signature automatically when loading a `.bpg` file. If verification fails, the file is rejected before rendering.

---

## What's next?

- [Why BWEB?](./why-bweb.md) — Deep dive into the problem BWEB solves
- [Converter Guide](./converter-guide.md) — All converter options and settings
- [FAQ](./faq.md) — Answers to the most common questions
- [Troubleshooting](./troubleshooting.md) — If something doesn't work
