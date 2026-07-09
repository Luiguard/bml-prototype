# FAQ — Frequently Asked Questions

---

### 1. What exactly is BWEB?

BWEB (Binary Web) is a file format that replaces the HTML/CSS/image files of a website with a single compact binary file (`.bweb`). Instead of sending text that the browser has to parse and interpret, BWEB sends pre-computed layout data that can be drawn directly to screen.

Think of it like the difference between sending someone a recipe (HTML) vs. sending them a ready-made meal (BWEB).

---

### 2. Do visitors need to install the extension?

**No.** Visitors without the extension see your page through the JavaScript polyfill, which renders BWEB files in any modern browser using the Canvas API. The experience is identical — the polyfill just has a slightly higher initial load time than the native extension.

A banner appears suggesting they install the extension for better performance.

---

### 3. How much smaller is a BWEB file compared to HTML?

Typically **75-95% smaller** than the equivalent HTML + CSS + images. The exact ratio depends on:

- How many images your site has (BIB compression is very efficient for photos)
- How complex your CSS is (complex layouts benefit most from pre-computation)
- How much repeated text your HTML has (binary is more compact for structure)

A landing page that weighs 2 MB in HTML form will typically be 100-300 KB as `.bweb`.

---

### 4. Does JavaScript work in BWEB?

**Not in the traditional sense.** BWEB does not execute `<script>` tags. This is intentional — it's what enables the tracking-free guarantee.

Interactivity is handled through the **BEX section** (Binary Event Extension), which is a declarative system: "when node 7 is clicked, toggle class 'active' on node 12." This covers most standard UI patterns (menus, tabs, accordions, modals).

For applications that genuinely need JavaScript logic, the recommended pattern is: render the structural shell as BWEB, load dynamic data from an API.

---

### 5. How do I convert a WordPress site?

WordPress generates HTML pages. You can convert them the same way as any HTML page:

1. Export your WordPress site as static HTML (plugins like [Simply Static](https://wordpress.org/plugins/simply-static/) or [WP2Static](https://wp2static.com/) do this)
2. Open `bweb-converter.html`
3. Upload the exported HTML folder
4. Download the `.bweb` file

Alternatively, point the CLI at the live URL:

```bash
node build-bweb.js https://mywordpresssite.com output.bweb
```

---

### 6. What happens to my images and videos?

- **Images** (PNG, JPEG, WebP, SVG): Embedded directly into the `.bweb` file in the BIB section. They are decoded and rendered via `createImageBitmap` on the GPU.
- **Videos**: Stored in the BVS section as chunked video frames ready for `VideoDecoder`. The converter uses ffmpeg for transcoding if available.
- **Web fonts**: Embedded in the BFF section, loaded via the `FontFace` API.

Nothing is fetched from external servers at runtime. All assets are self-contained in the `.bweb` file.

---

### 7. How do I secure my BWEB site?

Two layers of security:

**Transport security:** Serve `.bweb` files over HTTPS like any other file. Standard TLS applies.

**Content integrity (BPG):** Pack your `.bweb` into a `.bpg` container:

```bash
node testordner/hello-bweb/bweb-pack.js pack website.bweb website.bpg
```

The BPG container adds:
- SHA-256 hash of the payload (tamper detection)
- ECDSA signature (authenticity proof)

The browser extension verifies this signature before rendering. If any byte has been modified, the file is rejected.

---

### 8. Can I use BWEB with React / Vue / Angular?

Yes. Build your app with your framework as normal, then convert the output:

```bash
# React
npm run build
node build-bweb.js ./build/ ./output/app.bweb

# Vue
npm run build
node build-bweb.js ./dist/ ./output/app.bweb

# Angular
ng build --prod
node build-bweb.js ./dist/my-app/ ./output/app.bweb
```

> [!NOTE]
> The JavaScript bundle from your framework will NOT be executed in BWEB. The converter captures the rendered DOM state of your app's HTML output. For dynamic data, use API calls from a thin BWEB-compatible shim.

---

### 9. What does BWEB cost?

BWEB is **free and open source** under a custom license (see [LICENSE](../LICENSE)). Commercial use requires attribution.

The converter, polyfill, and CLI are all free. There is no SaaS, no subscription, no usage limits.

---

### 10. Does BWEB support responsive design?

Yes. The BWEB format stores **three separate BLB layout blocks** per node:
- Desktop (≥ 1024px)
- Tablet (≥ 768px)
- Mobile (< 768px)

The renderer selects the appropriate layout block based on the current viewport width. Changes resize-aware in real time.

---

### 11. Can BWEB handle multi-page websites?

Yes, via the **TOC (Table of Contents) section**. A multi-page `.bweb` file is a Virtual File System (VFS) that contains multiple pages.

When a user clicks a link, the BWEB engine intercepts it, looks up the target page in the TOC, and renders it — no network request needed. Navigation is instant.

```bash
# Build a multi-page site
node build-bweb.js ./my-website/ ./output/website.bweb
```

---

### 12. Is there a size limit for projects?

Technically no. In practice:
- The browser converter works well for sites up to ~50 pages and ~200 MB of assets
- The CLI has no practical size limit — it streams large assets
- The largest tested single `.bweb` file: ~44 MB (the full mediclean-pro.at website)

---

### 13. How do I debug a BWEB page?

The browser extension adds a DevTools panel that shows:
- The parsed BDT tree (like a DOM inspector but for binary nodes)
- BLB values per node (layout rectangles, colors)
- BML attributes per node
- Canvas render call timing

Without the extension, open the browser console — the polyfill logs detailed parsing information.

For compiler-side debugging, check the `.log` file generated alongside each `.bweb` compilation.

---

### 14. Does BWEB work offline?

Yes. Once a `.bweb` file is loaded, it contains everything needed to render the page. No network calls are made during rendering. If the user navigates between pages in a multi-page `.bweb`, that's also handled locally via the VFS.

---

### 15. Where do I report bugs?

- **GitHub Issues:** [github.com/Luiguard/bml-prototype/issues](https://github.com/Luiguard/bml-prototype/issues)
- **Include in your report:**
  - Browser and version
  - The `.bweb` file or the source HTML that caused the issue (or a minimal reproduction)
  - Console error messages
  - Screenshot of the unexpected behavior
