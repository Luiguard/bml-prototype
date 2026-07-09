# CLI Reference

All CLI tools require [Node.js](https://nodejs.org) 18 or higher.

---

## `cli.js` — Main CLI

Located at `/home/benjamin/projects/cli.js`.

```bash
node cli.js <command> [options]
```

### Commands

#### `convert` — HTML to BWEB

```bash
node cli.js convert <input.html> <output.bweb>
```

Converts a single HTML file (with all locally referenced CSS and images) to `.bweb`.

**Examples:**
```bash
# Basic conversion
node cli.js convert index.html website.bweb

# With absolute paths
node cli.js convert /var/www/html/index.html /srv/bweb/website.bweb
```

---

#### `stats` — Show file statistics

```bash
node cli.js stats <file.bweb>
```

Prints the size of each section inside a `.bweb` file.

**Example output:**
```
BWEB File: website.bweb (214,832 bytes total)
  SEC 0 BML  :   12,440 bytes  (5.8%)
  SEC 1 BDT  :    3,200 bytes  (1.5%)
  SEC 2 BLB  :   18,600 bytes  (8.7%)
  SEC 4 BIB  :  178,400 bytes  (83.0%)
  SEC 9 TOC  :      192 bytes  (0.1%)
```

---

#### `validate` — Check file integrity

```bash
node cli.js validate <file.bweb>
```

Verifies:
- Magic bytes (`BWEB` at offset 0)
- Section count and offsets
- Section length consistency

Returns exit code 0 on success, 1 on failure.

---

## `build-bweb.js` — Multi-Page Site Builder

Located at `/home/benjamin/projects/build-bweb.js`.

```bash
node build-bweb.js <input-folder/> <output.bweb>
```

Recursively scans the input folder, converts all `.html` files, inlines CSS and images, and packages everything into a single multi-page `.bweb` with a VFS/TOC section.

**Examples:**
```bash
# Convert an entire website
node build-bweb.js ./my-website/ ./dist/website.bweb

# With a React build output
npm run build && node build-bweb.js ./build/ ./dist/app.bweb
```

**What gets included:**
- All `.html` files → separate BML/BDT/BLB sections in VFS
- All `.css` files → inlined and compiled into BLB
- All image files (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) → BIB section
- All font files (`.ttf`, `.woff`, `.woff2`) → BFF section
- All `.mp4`, `.webm` video files → BVS section (requires ffmpeg)

**What gets excluded:**
- `.js` files (not executed in BWEB)
- Server-side files (`.php`, `.py`, `.rb`, etc.)
- `node_modules/`, `.git/`

---

## `bweb-pack.js` — BPG Signer/Packager

Located at `/home/benjamin/projects/testordner/hello-bweb/bweb-pack.js`.

```bash
node bweb-pack.js pack <input.bweb> <output.bpg>
```

Wraps a `.bweb` file into a signed BPG container with:
- SHA-256 integrity hash (32 bytes)
- ECDSA key pair (secp256k1)
- Signature token

**Example:**
```bash
node testordner/hello-bweb/bweb-pack.js pack website.bweb website.bpg
```

**Output:**
```
[BPG Packager] Packed website.bweb into website.bpg
[BPG Packager] Integrity Check: a3f2c1...
[BPG Packager] Handshake Identity Length: 91 bytes
[BPG Packager] Handshake Token Length: 71 bytes
[BPG Packager] Handshake ready.
```

> [!NOTE]
> The key pair is generated fresh every time. In a production workflow, you'd want to use a fixed private key stored securely. The BPG format supports external key material — see SPEC.md for the exact header layout.

---

## `bwebc.js` — Full V2 Compiler

Located at `/home/benjamin/projects/testordner/hello-bweb/bwebc.js`.

The most capable single-file compiler, supporting all V2.0 sections.

```bash
node bwebc.js build <input.html> <output.bweb>
```

**Differences from `cli.js`:**
- Supports BVS (video), BAS (audio), BFF (fonts), BMS (event map), BEX (interaction)
- Generates 3 BLB breakpoints (desktop/tablet/mobile) per node
- More accurate CSS parsing (flexbox, grid, absolute positioning)

**Examples:**
```bash
# Build with all V2 features
node bwebc.js build mypage.html mypage.bweb

# Check what was compiled
node cli.js stats mypage.bweb
```

---

## Vite Plugin

For projects using [Vite](https://vitejs.dev/), a plugin is available that automatically compiles the output to BWEB on every build.

```javascript
// vite.config.js
const bwebPlugin = require('./testordner/hello-bweb/vite-plugin-bweb.js');

export default {
    plugins: [bwebPlugin()]
};
```

After `npm run build`, the `dist/` folder will contain both the standard HTML output and a `dist/index.bweb` file.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BWEB_FFMPEG` | `ffmpeg` | Path to ffmpeg binary (for video conversion) |
| `BWEB_QUALITY` | `85` | JPEG quality for image compression (0-100) |
| `BWEB_VERBOSE` | `0` | Set to `1` for detailed compile logs |

---

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Input file not found |
| `2` | Output path not writable |
| `3` | Invalid HTML (parse error) |
| `4` | Asset not found (broken image/font reference) |
| `5` | Validation failed (.bweb file corrupt) |
