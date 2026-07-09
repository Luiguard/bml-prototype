# Converter Guide

The BWEB Converter (`bweb-converter.html`) converts HTML websites into `.bweb` binary files — entirely in your browser. Nothing is uploaded to any server.

**Open it:** [`bweb-converter.html`](https://mediclean-pro.at/bweb-converter/bweb-converter.html)

---

## How to convert a website (step by step)

### 1. Open the converter

Open `bweb-converter.html` in Chrome, Edge, or Firefox. No installation required.

### 2. Upload your website folder

Click **"📁 Ordner hochladen"** (Upload Folder).

A file picker opens showing your file system. Navigate to your website's **root folder** — the one containing `index.html`.

> [!IMPORTANT]
> Select the **folder itself**, not individual files. The converter needs to see the full directory structure to resolve CSS imports and image paths correctly.

What the converter handles automatically:
- Reads all `.html` files in the folder (and subfolders)
- Resolves all `<link rel="stylesheet">` references
- Resolves all `<img src="...">` references
- Resolves all CSS `url(...)` references (background images, fonts)
- Inlines everything into a self-contained `.bweb`

### 3. Review the file list

After selecting the folder, the converter shows a tree of all detected files. Verify that your `index.html` and main CSS/image files appear in the list.

### 4. Click "Kompilieren" (Compile)

The compilation runs in your browser. A progress bar shows the current step:

```
Step 1/5 — Analyzing HTML structure...
Step 2/5 — Calculating CSS layout...
Step 3/5 — Embedding images...
Step 4/5 — Building binary sections...
Step 5/5 — Packaging .bweb file...
```

For a typical 10-page website with 20 images, this takes 3-10 seconds.

### 5. Download the result

When compilation is complete, you see:

| File | Description |
|---|---|
| `output.bweb` | The raw binary BWEB file. Use this for local testing or serving directly with the extension. |
| `index.html` (polyfill) | A self-contained HTML file that embeds the rendering engine and your BWEB binary. Upload this to your server for visitors without the extension. |

---

## Size comparison

After compilation, the converter shows a comparison badge:

```
✅ Compilation successful
   Original HTML:  2,140 KB
   BWEB output:      187 KB
   Reduction:         91%
```

---

## Multi-page websites

The converter handles multi-page sites automatically. When it detects multiple `.html` files, it creates a BWEB package with a TOC (Table of Contents) section that acts as a Virtual File System.

Navigation between pages (clicking links) is handled by the BWEB engine without any network requests — all pages are bundled in the single `.bweb` file.

---

## Advanced: HTML + CSS text input

For quick tests, you can paste HTML and CSS directly instead of uploading a folder:

1. Switch to **"Text-Eingabe"** mode using the tab at the top
2. Paste your HTML into the left panel
3. Paste your CSS into the right panel
4. Click "Kompilieren"

This mode is useful for:
- Testing small pages or components
- Experimenting with the binary output
- Debugging layout issues

---

## Supported input formats

| Type | Support | Notes |
|---|---|---|
| `.html` | ✅ Full | Including HTML5 semantic elements |
| `.css` | ✅ Full | Inlined from `<link>` tags |
| `.png` `.jpg` `.jpeg` `.webp` | ✅ Full | Embedded in BIB section |
| `.svg` | ✅ Full | Converted to PNG internally |
| `.ttf` `.woff` `.woff2` | ✅ Full | Embedded in BFF section |
| `.mp4` `.webm` | ✅ Experimental | Requires ffmpeg on server-side converter |
| `.js` | ❌ | Not executed — omitted from output |
| `<iframe>` | ❌ | Omitted from output |
| External CDN resources | ⚠️ | Fetched and inlined if accessible |

---

## Troubleshooting

**"Keine HTML-Datei gefunden"** — The selected folder contains no `.html` files. Make sure you selected the root folder of your website (where `index.html` lives).

**Images are missing in the output** — Check that your image paths are relative (e.g., `./images/logo.png`) not absolute (e.g., `/images/logo.png`). The converter resolves relative paths from each HTML file's location.

**Compilation takes more than 30 seconds** — Your site may have very large images (>5 MB each). Consider optimizing images before converting. The converter has no hard size limit but very large assets slow down the Base64 encoding step.

**CSS styles look different in BWEB** — The converter uses a CSS approximation engine. Complex features like CSS animations, `calc()` with viewport units, and very advanced selectors (`:has()`, `@container`) may not be fully supported. See [Troubleshooting](./troubleshooting.md) for workarounds.

---

## What the converter does NOT do

- It does not upload your files to any server
- It does not execute JavaScript (your site's JS is ignored)
- It does not handle server-side templating (Jinja, PHP, etc.) — convert the rendered HTML output
- It does not support `<iframe>` embeds
