# BWEB — Binary Web Format

> Replace HTML/CSS with a compact binary container.  
> Same websites. Up to 10× smaller. GPU-rendered. Zero DOM parsing.

[![Version](https://img.shields.io/badge/version-2.0-blue.svg)](https://github.com/Luiguard/bml-prototype/releases)
[![License](https://img.shields.io/badge/license-Custom-green.svg)](./LICENSE)
[![Format](https://img.shields.io/badge/format-.bweb%20%7C%20.bpg-purple.svg)](#file-format)

---

## Why BWEB?

Every time someone opens a webpage, a browser downloads megabytes of raw text (HTML, CSS, JavaScript), parses it character by character, builds a DOM tree, calculates layout, and only then renders pixels to your screen. This happens **every single page load, on every device, worldwide.**

BWEB skips all of that:

| | Classic HTML | BWEB |
|---|---|---|
| Transfer format | Plain text (verbose) | Binary (compact) |
| Average page size | ~2.1 MB | ~210 KB |
| Parsing required | Yes — CPU-intensive | No — direct to GPU |
| DOM tree build | Yes | Pre-computed (BDT) |
| CSS cascade calc | Yes | Pre-computed (BLB) |
| Cookie tracking | Possible | Architecturally blocked |

---

## Quick Start (5 minutes)

### Option 1: Browser Extension — Easiest

Install the extension and your browser can open `.bweb` files natively.

**Chrome / Edge / Brave:**
1. Download [`bweb-extension-chrome.zip`](https://github.com/Luiguard/bml-prototype/releases/latest/download/bweb-extension-chrome.zip)
2. Open `chrome://extensions` (or `edge://extensions`)
3. Enable **Developer Mode** (top right)
4. Click **Load unpacked** → select the extracted folder

**Firefox:**
1. Download [`bweb-extension-firefox.xpi`](https://github.com/Luiguard/bml-prototype/releases/latest/download/bweb-extension-firefox.xpi)
2. Open `about:debugging` → **This Firefox**
3. Click **Load Temporary Add-on** → select the `.xpi` file

→ [Full extension guide](./docs/extension-guide.md)

---

### Option 2: Drag & Drop Converter — No install needed

Open **[`bweb-converter.html`](https://mediclean-pro.at/bweb-converter/bweb-converter.html)** in any browser.

1. Click **"Ordner hochladen"** and select your website folder
2. Click **"Kompilieren"**
3. Download the resulting `.bweb` file

The converter runs entirely in your browser. Nothing is uploaded to any server.

→ [Full converter guide](./docs/converter-guide.md)

---

### Option 3: CLI — For developers

Requires [Node.js](https://nodejs.org) 18+.

```bash
# Clone the repo
git clone https://github.com/Luiguard/bml-prototype.git
cd bml-prototype

# Install dependencies
npm install

# Convert a single HTML file
node cli.js convert mypage.html output.bweb

# Convert an entire website folder
node build-bweb.js ./my-website/ ./output/website.bweb

# Check stats of a .bweb file
node cli.js stats output.bweb

# Validate a .bweb file (checks magic bytes & offsets)
node cli.js validate output.bweb

# Pack a .bweb into a signed .bpg container
node testordner/hello-bweb/bweb-pack.js pack output.bweb output.bpg
```

→ [Full CLI reference](./docs/cli-reference.md)

---

## How It Works

A `.bweb` file is a binary container with multiple sections. Each section replaces a part of the traditional HTML/CSS/image pipeline:

### Binary Sections

| Section | ID | Replaces | Description |
|---|---|---|---|
| **BML** | SEC 0 | HTML tags & text | Tags become 1-byte codes (`<div>` → `0x01`). Text stays UTF-8. |
| **BDT** | SEC 1 | DOM tree nesting | Flat array of 10-byte nodes with parent/child/sibling pointers. No recursion needed. |
| **BLB** | SEC 2 | CSS cascade | 50-byte fixed structs per node: x, y, width, height, colors, borders. Pre-computed. |
| **BIB** | SEC 4 | `<img>` + base64 | Raw image bytes (PNG/JPEG/WebP) stored inline. Streamed directly to `createImageBitmap`. |
| **BVS** | SEC 5 | `<video>` | Chunked video frames ready for `VideoDecoder`. Zero container overhead. |
| **BAS** | SEC 6 | `<audio>` | Raw audio samples for `AudioDecoder`. Synchronized via PTS with BVS. |
| **BFF** | SEC 7 | Web fonts | Font binary data embedded, loaded via `FontFace` API. |
| **BMS** | SEC 6 | Event handlers | Declarative interaction map: trigger → action. No JS execution needed. |
| **BEX** | SEC 8 | JS logic | Sandboxed event bindings (click, hover → DOM state changes). |
| **TOC** | SEC 9 | Multi-page routing | Virtual File System index for multi-page `.bweb` packages. |

### Rendering Pipeline

```
.bweb file
    ↓
Binary parser (DataView — no string ops)
    ↓
BDT → node tree in memory
BML → tag metadata + text per node
BLB → layout rectangles per node
    ↓
Canvas rendering loop (requestAnimationFrame)
    ↓  
BIB/BVS → GPU via createImageBitmap / VideoDecoder
    ↓
A11y overlay DOM (transparent, for screen readers)
```

The browser's HTML parser, CSS engine, and layout engine are **never involved.**

---

## File Format

Two container formats:

| Format | Extension | Use case |
|---|---|---|
| BWEB | `.bweb` | Raw binary package for development and local use |
| BPG | `.bpg` | Signed production package with SHA-256 integrity check and ECDSA handshake token |

File structure (BWEB):
```
[4 bytes]  Magic: "BWEB"
[1 byte]   Version
[1 byte]   Section count
[N × 9]    Section index (ID u8 + offset u32 + length u32 per section)
[...]      Section data
```

→ [Full byte-level specification](./SPEC.md)  
→ [Simplified format reference](./docs/file-format.md)

---

## Project Structure

```
bml-prototype/
├── index.html              ← BWEB landing page (mediclean-pro.at)
├── converter.html          ← Standalone polyfill viewer
├── content.js              ← Browser extension content script (V1)
├── build-bweb.js           ← Node.js multi-page compiler
├── cli.js                  ← CLI entry point
├── SPEC.md                 ← Full binary spec (byte-level)
├── docs/                   ← Human-readable guides
│   ├── getting-started.md
│   ├── why-bweb.md
│   ├── converter-guide.md
│   ├── cli-reference.md
│   ├── extension-guide.md
│   ├── file-format.md
│   ├── faq.md
│   └── troubleshooting.md
├── chrome-extension/       ← Packaged V1 extension
├── mediclean-pro/          ← Production website + V2 converter
│   └── bweb-converter.html ← Full-featured browser converter (no server)
├── testordner/hello-bweb/  ← Development test suite & step-by-step compilers
│   ├── bwebc.js            ← Full V2 compiler
│   ├── bweb-engine.html    ← Standalone BWEB renderer
│   ├── bweb-pack.js        ← BPG signer/packager
│   └── tests/              ← Edge case test pages
└── bml-prototype/v2.0/     ← V2.0 Chrome extension with full engine
```

---

## Supported Features

| Feature | Status |
|---|---|
| All standard HTML5 elements (113 tags mapped) | ✅ |
| CSS layout (flexbox, grid, absolute, fixed, sticky) | ✅ |
| CSS colors, gradients, shadows, borders, radius | ✅ |
| Images (PNG, JPEG, WebP, SVG) | ✅ |
| Web fonts (TTF, WOFF, WOFF2) | ✅ |
| Hover states | ✅ |
| Click events | ✅ |
| Form inputs (text, checkbox, select, textarea) | ✅ |
| Multi-page routing (VFS / TOC section) | ✅ |
| Video playback (VideoDecoder) | ✅ experimental |
| Audio playback (AudioDecoder) | ✅ experimental |
| Responsive design (3 BLB breakpoints: desktop/tablet/mobile) | ✅ |
| Accessibility (transparent A11y DOM overlay) | ✅ |
| Signed packages (BPG with ECDSA) | ✅ |
| JavaScript execution | ❌ by design |
| `<iframe>` embedding | ❌ by design |

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-feature`
2. Test your changes: open `testordner/hello-bweb/bweb-engine.html` in Chrome
3. Run the test suite: `node testordner/hello-bweb/bweb-testsuite.js`
4. Submit a pull request with a description of what changed

→ Found a bug? Open an [issue](https://github.com/Luiguard/bml-prototype/issues).

---

## FAQ

**Does BWEB work without the extension?**  
Yes. The JS polyfill (`content.js`) renders `.bweb` files in any modern browser using Canvas + `DataView`. The extension gives better performance via native file interception.

**Does my website need to be rebuilt?**  
No. The converter takes your existing HTML/CSS/images folder and produces a `.bweb` file. No changes to your source code.

**Can I use React / Vue / Angular?**  
Yes — build your app first (`npm run build`), then run the converter on the `dist/` folder.

**What happens to JavaScript in my site?**  
Client-side JS is not executed in BWEB. Interactivity is handled through the declarative BEX section (click/hover state changes). Server-side logic is unaffected.

→ [All 15 FAQ answers](./docs/faq.md)

---

## License

See [`LICENSE`](./LICENSE). Commercial use requires this attribution in your UI or documentation:

> *"Incorporates BWEB Binary Web Format by Benjamin Leimer."*
