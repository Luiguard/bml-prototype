# Why BWEB?

## The Problem

Every time someone visits a website, their device runs through this pipeline:

```
Server sends text → Browser downloads text → Parser reads text character by character
→ Builds DOM tree → Parses CSS cascade → Calculates layout → Renders pixels
```

This pipeline exists for historical reasons — HTML was designed in 1991 as a document format for physicists sharing papers. It was never designed for the modern web's complexity.

Today, a typical webpage sends:
- **~2.1 MB** of HTML, CSS, and JavaScript text
- **Multiple round-trips** to load external resources (fonts, images, scripts)
- **~500ms of CPU time** just to parse and build the DOM
- **Megabytes of JavaScript** that runs on the user's device

**This costs real money, real energy, and real time — billions of times per day.**

---

## The Numbers

### File Size

| Content type | Classic web | BWEB |
|---|---|---|
| A typical landing page | 2.1 MB (HTML+CSS+images) | ~210 KB (.bweb) |
| Average compression | gzip: 60-70% reduction | binary: 85-95% reduction |
| Image format overhead | Base64 adds 33% size | Raw bytes, no overhead |

### Performance

| Metric | Classic web | BWEB |
|---|---|---|
| DOM parsing | 200-500ms per page | 0ms (no DOM) |
| CSS cascade calculation | 50-200ms | 0ms (pre-computed) |
| Layout reflow | On every change | Never |
| Time to first render | 400ms–2s | <50ms |
| CPU usage per render | 100% (main thread) | <5% (GPU) |

### Energy

A typical browser tab consumes about 100mW of CPU power just running idle. On a website with complex CSS and JavaScript, this spikes to 300-600mW.

BWEB delegates all rendering to the GPU via Canvas API. GPU rendering on a modern device consumes a fraction of the energy of software CPU rendering.

**Rough estimate:** A site that switches to BWEB can reduce its energy footprint by **70-90% per page view.**

At global scale — billions of page views per day — this represents a measurable reduction in CO₂ emissions from data centers and end-user devices.

---

## How BWEB Solves This

BWEB moves all the expensive work **out of the browser and into a build step.**

Instead of the browser calculating layout at load time, the converter calculates it once and stores the result in a binary file. The browser receives a file that says: "element 7 is at x=200, y=350, width=480, height=32, background is #1a1a2e" — no parsing, no cascade, no reflow.

```
Build time (once):          Load time (every visitor):
HTML + CSS + Images         .bweb binary
    ↓                           ↓
  BWEB Converter            Binary parser
    ↓                           ↓
  .bweb file              Canvas.drawRect()
                           Canvas.drawImage()
                           → Pixels on screen
```

---

## The Privacy Angle

Traditional websites rely on JavaScript for everything — including tracking. A typical news site loads 40-60 third-party JavaScript files, many of which are analytics and ad trackers.

BWEB's architecture makes this **physically impossible:**

1. **No JavaScript execution** — BWEB's rendering engine does not execute arbitrary JavaScript. There is no `<script>` tag that runs at page load.
2. **No third-party resources** — All assets are bundled into the `.bweb` file at compile time. There are no external CDN calls, no Google Fonts requests, no tracking pixel pings.
3. **No cookies** — The BWEB format is stateless. It has no mechanism to set, read, or transmit cookies.
4. **Cryptographic integrity** — When packed as `.bpg`, the file is signed with ECDSA. If any byte has been tampered with (e.g., injecting tracking code), the browser rejects the file before rendering.

**GDPR cookie consent banners become irrelevant for BWEB pages.**

---

## What BWEB is NOT

BWEB is not a JavaScript replacement for interactive apps. It is not React, Vue, or Angular.

BWEB is best suited for:
- **Marketing and landing pages** — highest traffic, benefit most from speed
- **Documentation sites** — mostly static content, large performance gains
- **News and media sites** — image-heavy, benefit from BIB compression
- **Company websites** — multiple pages, the multi-page VFS format handles this well

For highly interactive applications (dashboards, real-time data, user-generated content), a hybrid approach works best: serve the structural shell as BWEB, load dynamic data via API calls.

---

## The Polyfill Strategy

BWEB works today, without waiting for browser vendors to implement a new standard.

The JavaScript polyfill (`content.js`) is a complete BWEB rendering engine in ~1200 lines of JavaScript. It:
1. Fetches the `.bweb` binary
2. Parses the sections with `DataView`
3. Renders everything on a `<canvas>` element
4. Overlays a transparent accessibility DOM for screen readers

For visitors who have installed the browser extension, the polyfill is bypassed entirely and the binary is rendered natively.

This means BWEB sites work for **100% of visitors** today — with or without the extension.

---

## Next Steps

- [Getting Started](./getting-started.md) — Convert your first page
- [FAQ](./faq.md) — Common questions answered
