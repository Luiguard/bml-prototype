# BWEB Engine (Binary Web)

BWEB is an experimental, ultra-fast binary web format designed to replace raw HTML, CSS, and base64-encoded media with highly optimized binary streams. It consists of multiple sections (BML, BDT, BLB, BIB, BVS) that skip the browser's traditional string-parsing pipeline and map directly to a zero-latency DOM and GPU-accelerated Canvas.

---

## ⚡ Formats

- **BML (Binary Markup Language) - `SEC 1`**: Shrinks raw text and properties drastically. Tags are mapped to 1-byte hex codes (e.g., `<div>` becomes `0x01`).
- **BDT (Binary DOM Tree) - `SEC 2`**: Replaces nested HTML structures with a flat, O(1) integer-pointer-based node hierarchy (15 bytes per node).
- **BLB (Binary Layout Blocks) - `SEC 3`**: Compresses CSS styling. Every layout instruction uses a fixed 60-byte block.
- **BIB (Binary Image Blocks) - `SEC 4`**: Streams original encoded image bytes (JPEG, PNG, SVG, WebP) with an 8-byte header directly into `<canvas>` elements.
- **BVS (Binary Video Streams) - `SEC 5`**: Streams native video bitstreams (MP4, WebM) directly into rendering pipelines for zero-reflow video playback.
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
- **SEC 2: BDT** (Binary DOM Tree) — Flache Node-Hierarchie mit Parent/Child/Sibling-Pointern (15 Bytes/Node)
- **SEC 3: BLB** (Binary Layout Block) — Pre-computed CSS (60 Bytes/Node, fixed-point)
- **SEC 4: BIB** (Binary Image Block) — Bilddaten (8 Bytes Header + Raw Payload)
- **SEC 5: BVS** (Binary Video Stream) — Videodaten (8 Bytes Header + Raw Payload)
- **SEC 9: TOC** (Table of Contents) — Einstiegspunkte und Metadaten

> 📖 **[Vollständige Byte-Level Spezifikation (SPEC.md)](SPEC.md)**

---

## Installation (CLI)

BWEB bietet ein Node.js CLI-Tool (`bwebc.js`), das die gesamte Extraktion (mittels headless Puppeteer) und Kompilierung durchführt.

```bash
# Abhängigkeiten installieren
npm install
```

### CLI Befehle

```bash
# 1. Konvertierung (HTML Projekt-Ordner -> BWEB)
node bwebc.js build src/ output.bweb

# 2. Entwicklung (Dev Server)
node bwebc.js serve src/ 8080
```

---

## Test Suite

Eine Testsuite und Sandbox für den Node.js-Compiler liegt unter `tests/` und `showcase/`.

```bash
# Showcase kompilieren und testen
node bwebc.js build src/ ../showcase/showcase.bweb
```

## 🔒 Privatsphäre & Cookie-freie Architektur

### Warum BWEB keine Cookies nutzt
BWEB (Binary Web) bricht grundlegend mit der traditionellen, Cookie-basierten Architektur des klassischen Internets, um absolute Privatsphäre standardmäßig (Privacy by Design) zu garantieren:
1. **Stateless Binary Container**: BWEB ist ein kompilierter, rein statischer Binär-Container. Das Format selbst ist vollkommen zustandsfrei. Es benötigt keinen Session-Cookie-Zustand auf Client-Seite für das Laden oder GPU-Rendern.
2. **Zero Tracking Overheads**: Da BWEB das CPU-Parsing von Text-HTML und das Ausführen von verstecktem Javascript blockiert, können Tracker keine heimlichen Tracking-Pixel oder Third-Party-Cookies im Hintergrund platzieren. DSGVO-Cookie-Banner entfallen vollständig!
3. **Kryptografische Session-Tokens**: Statt Session-IDs in Cookies zu speichern, validiert BWEB Anfragen mittels kryptografischer Einweg-Tokens auf Transaktionsbasis, wodurch Nutzeridentitäten vollständig geschützt bleiben.

---

## 📢 Die Zukunft der Werbung in BWEB

Klassische Web-Werbung bremst das Laden aus, verbraucht CPU-Strom und spioniert Nutzer aus. In BWEB wird Werbung revolutioniert, um die Ladezeiten von unter 1ms und die Privatsphäre zu sichern:

1. **BIB Ad-Slices (Binäre Werbe-Slices)**: Werbebanner in BWEB sind keine tonnenschweren Tracking-Scripts, sondern **statische binäre BIB-Slices (Binary Image Blocks)**. Sie werden direkt von der GPU gezeichnet, was Zero-Latenz und minimalen Stromverbrauch (Akku-Schonung) sichert.
2. **Kryptografische Verifikation**: Jedes Werbe-Slice wird kryptografisch vom Werbenetzwerk signiert. Der Browser validiert die Signatur lokal, ohne Nutzerdaten oder Profile an externe Ad-Server zu senden (Zero-Knowledge Ad Delivery).
3. **Malvertising-Schutz**: Da BWEB keine beliebige JS-Code-Ausführung erlaubt, ist das Einschleusen von Schadcode über Banner (Malvertising) physikalisch unmöglich.

---

## Lizenz & Attribution

Bitte die `LICENSE` Datei beachten. **Jede kommerzielle Nutzung erfordert dieses Zitat im UI/Doku:**
> `"Incorporates BWEB architecture designed by Benjamin Leimer."`**

*For more information on the RAG-NVMe integration, visit the respective repository.*
