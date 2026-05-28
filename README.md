# BWEB Engine (Binary Web)

BWEB is an experimental, ultra-fast binary web format designed to replace raw HTML, CSS, and base64-encoded media with highly optimized binary streams. It consists of multiple sections (BML, BDT, BLB, BIB, BVS) that skip the browser's traditional string-parsing pipeline and map directly to a zero-latency DOM and GPU-accelerated Canvas.

---

## ⚡ Formats

- **BML (Binary Markup Language) - `SEC 1`**: Shrinks raw text and properties drastically. Tags are mapped to 1-byte hex codes (e.g., `<div>` becomes `0x01`).
- **BDT (Binary DOM Tree) - `SEC 2`**: Replaces nested HTML structures with a flat, O(1) integer-pointer-based node hierarchy (11 bytes per node).
- **BLB (Binary Layout Blocks) - `SEC 3`**: Compresses CSS styling. Every layout instruction uses a fixed 60-byte block.
- **BIB (Binary Image Blocks) - `SEC 4`**: Natively streams pixel arrays (RGBA / WebP Bitstream) directly into `<canvas data-bind="ID">` elements using `ctx.putImageData`, skipping base64 overhead completely.
# BWEB (Binary Web) Prototyp

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Custom-green.svg)

BWEB ist ein experimentelles, **100% binäres Web-Format**. Es verabschiedet sich von textbasiertem HTML und CSS und packt den DOM-Baum (BML, BDT), das vorberechnete CSS-Layout (BLB) und die rohen Bildpixel (BIB) in ein einziges Binärpaket.

👉 **[BWEB Architecture Landing Page](https://mediclean-pro.at/bweb-converter/)**
👉 **[Open Online BWEB Converter Tool](https://mediclean-pro.at/bweb-converter/converter.html)**

*(Select entire website folders to instantly convert them into `.bweb` binary structures — no ZIP needed, no upload to any server).*

---

## Architektur & Formate

BWEB ist ein Container-Format (Magic: `BWEB`), das 4 Sektionen bündelt:

- **SEC 1: BML** (Binary Markup Language) — Struktur, Attribute, Text (UTF-8)
- **SEC 2: BDT** (Binary DOM Tree) — Flache Node-Hierarchie mit Parent/Child/Sibling-Pointern (11 Bytes/Node)
- **SEC 3: BLB** (Binary Layout Block) — Pre-computed CSS (60 Bytes/Node, fixed-point)
- **SEC 4: BIB** (Binary Image Block) — Raw RGBA Pixeldaten (22 Bytes Header + Pixel)
- *(SEC 6)* — Optionaler zlib-Deflate Layer für BML/BLB

> 📖 **[Vollständige Byte-Level Spezifikation (SPEC.md)](SPEC.md)**

---

## Installation (CLI)

BWEB bietet ein Node.js CLI-Tool, das den Python-Serializer ansteuert.

```bash
# Optional: Global installieren
npm link

# Oder direkt über Node
node cli.js help
```

### CLI Befehle

```bash
# 1. Konvertierung (HTML -> BWEB)
bweb convert input.html output.bweb

# 2. Statistik (zeigt Byte-Größen pro Sektion)
bweb stats output.bweb

# 3. Validierung (prüft Magic-Bytes und Offsets)
bweb validate output.bweb
```

---

## Test Suite

Eine vollständige Roundtrip-Testsuite für den Python-Serializer liegt unter `test/`.

```bash
# Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt # falls vorhanden

# Tests ausführen
cd test
python3 test_roundtrip.py
python3 test_formats.py
```

---

## Lizenz & Attribution

Bitte die `LICENSE` Datei beachten. **Jede kommerzielle Nutzung erfordert dieses Zitat im UI/Doku:**
> `"Incorporates RAG-NVMe architecture designed by Benjamin Leimer."`**

*For more information on the RAG-NVMe integration, visit the respective repository.*
