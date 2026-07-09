# Extension Guide

The BWEB Browser Extension enables native rendering of `.bweb` and `.bpg` files directly in your browser — without the JavaScript polyfill overhead.

---

## What the extension does

When you navigate to a URL ending in `.bweb` or `.bpg`:

1. The extension intercepts the navigation before any content is rendered
2. It fetches the binary file directly
3. It replaces the page with a `<canvas>` + accessibility overlay
4. It parses and renders the BWEB binary natively

Without the extension, `.bweb` files fall back to the JavaScript polyfill (slower first load, but functionally identical).

---

## Installation

### Chrome, Edge, Brave (Chromium-based)

1. Download the extension package:
   - [bweb-extension-chrome.zip](https://github.com/Luiguard/bml-prototype/releases/latest/download/bweb-extension-chrome.zip)

2. Extract the ZIP to a permanent folder (don't delete it after installation)

3. Open your browser's extension page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

4. Enable **Developer Mode** using the toggle in the top-right corner

5. Click **"Load unpacked"**

6. Navigate to and select the extracted folder

7. The BWEB extension appears in your extension list ✅

> [!TIP]
> Pin the extension to your toolbar for easy access to the BWEB DevTools panel.

---

### Firefox

Firefox supports BWEB as a temporary extension (without Mozilla signing).

1. Download [bweb-extension-firefox.xpi](https://github.com/Luiguard/bml-prototype/releases/latest/download/bweb-extension-firefox.xpi)

2. Open `about:debugging` in Firefox

3. Click **"This Firefox"** in the left sidebar

4. Click **"Load Temporary Add-on..."**

5. Select the downloaded `.xpi` file ✅

> [!WARNING]
> Firefox temporary extensions are removed when the browser restarts. You'll need to re-install after every restart until the extension receives official signing.

---

### Safari (Experimental)

Safari support is available as a bundled `.app` extension:

1. Download [bweb-extension-safari.zip](https://github.com/Luiguard/bml-prototype/releases/latest/download/bweb-extension-safari.zip)
2. Extract and run the `.app` file
3. Go to Safari → **Settings → Extensions**
4. Enable BWEB

> [!NOTE]
> Safari extension support is experimental and may require allowing unsigned extensions in developer settings.

---

## What the extension shows

When visiting a `.bweb` page with the extension installed:

- A small **⚡ BWEB** badge appears in the address bar
- The page renders on a `<canvas>` element (you can verify this via right-click → Inspect)
- An invisible accessibility DOM overlay exists for screen readers and keyboard navigation

When visiting a standard HTML page:
- The extension is inactive
- No badge, no canvas — normal browser behavior

---

## DevTools Panel

The extension adds a **BWEB** tab to Chrome DevTools (F12):

| Panel | What it shows |
|---|---|
| **Tree** | The parsed BDT node tree — like the Elements panel but for binary nodes |
| **Layout** | BLB values per selected node (x, y, width, height, colors, padding) |
| **BML** | Tag ID, attributes, and text content per node |
| **Performance** | Render frame time, section parse time, canvas draw calls |
| **Sections** | Raw section sizes and offsets in the binary file |

---

## The Extension Prompt

When a visitor opens a `.bweb` page **without** the extension installed, a modal appears:

- Explains the benefits of installing the extension
- Shows the correct download link for their detected browser
- Has a "Continue in Polyfill mode" button to dismiss and keep using the JS renderer

The visitor only sees this once (preference is saved to `localStorage`).

---

## Permissions requested

| Permission | Why |
|---|---|
| `webNavigation` | Intercept navigation to `.bweb` URLs |
| `tabs` | Read the current tab URL to detect `.bweb` extension |
| `<all_urls>` | Needed to inject the content script on `.bweb` file URLs |

The extension does not collect any data, does not make network requests (except to fetch the `.bweb` file you navigated to), and does not modify regular HTML pages.

---

## Troubleshooting

**The extension is installed but the page still shows HTML**
→ Make sure the file URL ends in `.bweb` or `.bpg`. The extension only activates for these extensions.

**"BWEB Ladefehler" message appears**
→ The `.bweb` file may be corrupted or missing. Check the browser console for the specific error. Run `node cli.js validate yourfile.bweb` to verify the file.

**Blank white screen**
→ The BWEB file may have loaded but have zero renderable nodes. This usually happens when the converter output was empty. Try recompiling the source HTML.

**Extension disappeared after Firefox restart**
→ This is expected for temporary add-ons in Firefox. Re-install via `about:debugging`.
