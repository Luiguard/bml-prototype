# BWEB Engine (Binary Web)

BWEB is an experimental, ultra-fast binary web format designed to replace raw HTML, CSS, and base64-encoded media with highly optimized binary streams. It consists of multiple sections (BML, BDT, BLB, BIB, BVS) that skip the browser's traditional string-parsing pipeline and map directly to a zero-latency DOM and GPU-accelerated Canvas.

---

## ⚡ Formats

- **BML (Binary Markup Language) - `SEC 1`**: Shrinks raw text and properties drastically. Tags are mapped to 1-byte hex codes (e.g., `<div>` becomes `0x01`).
- **BDT (Binary DOM Tree) - `SEC 2`**: Replaces nested HTML structures with a flat, O(1) integer-pointer-based node hierarchy (11 bytes per node).
- **BLB (Binary Layout Blocks) - `SEC 3`**: Compresses CSS styling. Every layout instruction uses a fixed 60-byte block.
- **BIB (Binary Image Blocks) - `SEC 4`**: Natively streams pixel arrays (RGBA / WebP Bitstream) directly into `<canvas data-bind="ID">` elements using `ctx.putImageData`, skipping base64 overhead completely.
- **BVS (Binary Video Streams) - `SEC 5`**: Interleaved chunks of I/P-Frames and Audio via the WebCodecs API, removing heavy container metadata (like MP4 atoms).

---

## 🛠️ Usage

1. Start the BWEB Python Server:
   ```bash
   python3 server.py
   ```
2. Navigate to `http://127.0.0.1:8080`.
3. Use the BWEB Converter UI or the **AI Website Generator**.
4. The frontend (`index.html`) intercepts the binary `.bweb` stream and instantly paints the DOM structure and Canvas graphics.

---

## ⚖️ License & Attribution

Copyright (c) 2026 **Benjamin Leimer**. All rights reserved.

This architecture and codebase are released under a **Custom Attribution License**.

- **Individuals & Open-Source**: Free to use, modify, and distribute for non-commercial purposes.
- **Corporations & Commercial Entities**: Free to deploy on the strict condition that **Benjamin Leimer** is credited prominently in the UI:
  > **"Incorporates RAG-NVMe architecture designed by Benjamin Leimer."**

*For more information on the RAG-NVMe integration, visit the respective repository.*
