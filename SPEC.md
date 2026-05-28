# BWEB Specification v1.0

**Author**: Benjamin Leimer
**Date**: 2026-05-28
**Status**: Draft

---

## 1. Overview

BWEB (Binary Web) is a container format that bundles multiple binary sections to represent a complete web document. It replaces text-based HTML, CSS, and image formats with compact binary equivalents designed for zero-parse rendering.

**Design Principles**:
- All multi-byte integers are **Big-Endian**
- No closing tags, no cascading — all values are pre-computed
- Each section is self-contained and independently parseable
- Versioned headers allow backwards-compatible evolution

---

## 2. BWEB Container

The outer container wraps all sections into a single file.

### 2.1 Header (6 Bytes)

| Offset | Size | Type   | Value       | Description          |
|--------|------|--------|-------------|----------------------|
| 0      | 4    | ASCII  | `BWEB`      | Magic bytes          |
| 4      | 1    | Uint8  | `0x01`      | Container version    |
| 5      | 1    | Uint8  | 3–N         | Number of sections   |

### 2.2 Section Table (repeating)

Immediately following the header, each section is stored sequentially:

| Offset | Size | Type   | Description              |
|--------|------|--------|--------------------------|
| 0      | 1    | Uint8  | Section Type ID          |
| 1      | 4    | Uint32 | Section length in bytes  |
| 5      | N    | Bytes  | Section payload          |

### 2.3 Section Type IDs

| ID | Name | Magic    | Description                    |
|----|------|----------|--------------------------------|
| 1  | BML  | `BML\x02`| Binary Markup Language         |
| 2  | BDT  | `BDT\x01`| Binary DOM Tree                |
| 3  | BLB  | `BLB\x01`| Binary Layout Blocks           |
| 4  | BIB  | `BIB\x01`| Binary Image Blocks            |
| 5  | BVS  | `BVS\x01`| Binary Video Streams           |
| 6  | BAS  | `BAS\x01`| Binary Audio Streams           |

MIME Type: `application/x-bweb`
File Extension: `.bweb`

---

## 3. BML — Binary Markup Language (Section 1)

Encodes document structure: tags, attributes, text content.

### 3.1 Section Header (4 Bytes)

| Offset | Size | Type  | Value       |
|--------|------|-------|-------------|
| 0      | 3    | ASCII | `BML`       |
| 3      | 1    | Uint8 | `0x02` (v2) |

### 3.2 Node Format (variable length)

Each node is serialized recursively (pre-order depth-first):

| Offset | Size | Type   | Description                     |
|--------|------|--------|---------------------------------|
| 0      | 1    | Uint8  | Tag byte (see Tag Table)        |
| 1      | 1    | Uint8  | Number of attributes            |
| 2      | 2    | Uint16 | Number of child elements        |
| 4      | 2    | Uint16 | Text content length in bytes    |
| 6      | var  | —      | Attribute blocks (see below)    |
| var    | var  | UTF-8  | Text content                    |
| var    | var  | —      | Child nodes (recursive)         |

### 3.3 Attribute Block (variable length)

| Offset | Size | Type   | Description            |
|--------|------|--------|------------------------|
| 0      | 1    | Uint8  | Attribute ID           |
| 1      | 2    | Uint16 | Value length in bytes  |
| 3      | var  | UTF-8  | Attribute value string |

### 3.4 Tag Table

| Hex    | Tag          | Hex    | Tag          |
|--------|--------------|--------|--------------|
| `0x01` | `div`        | `0x21` | `article`    |
| `0x02` | `span`       | `0x22` | `aside`      |
| `0x03` | `p`          | `0x23` | `strong`     |
| `0x04` | `a`          | `0x24` | `em`         |
| `0x05` | `h1`         | `0x25` | `code`       |
| `0x06` | `h2`         | `0x26` | `pre`        |
| `0x07` | `h3`         | `0x27` | `br`         |
| `0x08` | `h4`         | `0x28` | `hr`         |
| `0x09` | `h5`         | `0x29` | `video`      |
| `0x0A` | `h6`         | `0x2A` | `audio`      |
| `0x0B` | `img`        | `0x2B` | `canvas`     |
| `0x0C` | `ul`         | `0x2C` | `svg`        |
| `0x0D` | `ol`         | `0x2D` | `iframe`     |
| `0x0E` | `li`         | `0x2E` | `figcaption` |
| `0x0F` | `table`      | `0x2F` | `figure`     |
| `0x10` | `tr`         | `0x30` | `blockquote` |
| `0x11` | `td`         | `0x31` | `small`      |
| `0x12` | `th`         | `0x32` | `sub`        |
| `0x13` | `thead`      | `0x33` | `sup`        |
| `0x14` | `tbody`      | `0x34` | `details`    |
| `0x15` | `form`       | `0x35` | `summary`    |
| `0x16` | `input`      | `0x36` | `dialog`     |
| `0x17` | `button`     | `0x37` | `dl`         |
| `0x18` | `textarea`   | `0x38` | `dt`         |
| `0x19` | `select`     | `0x39` | `dd`         |
| `0x1A` | `option`     | `0x3A` | `mark`       |
| `0x1B` | `label`      | `0x3B` | `time`       |
| `0x1C` | `header`     | `0x3C` | `abbr`       |
| `0x1D` | `footer`     | `0x3D` | `cite`       |
| `0x1E` | `nav`        | `0x3E` | `b`          |
| `0x1F` | `main`       | `0x3F` | `i`          |
| `0x20` | `section`    | `0x40` | `u`          |
| `0xFE` | `body`       | `0xFF` | `html`       |

Tags `0x41`–`0xFD` are reserved for future extensions.

### 3.5 Attribute Table

| Hex    | Attribute     | Hex    | Attribute     |
|--------|---------------|--------|---------------|
| `0x10` | `class`       | `0x24` | `width`       |
| `0x11` | `id`          | `0x25` | `height`      |
| `0x12` | `href`        | `0x26` | `disabled`    |
| `0x13` | `src`         | `0x27` | `checked`     |
| `0x14` | `style`       | `0x28` | `selected`    |
| `0x15` | `type`        | `0x29` | `required`    |
| `0x16` | `name`        | `0x2A` | `autofocus`   |
| `0x17` | `value`       | `0x2B` | `autocomplete`|
| `0x18` | `placeholder` | `0x2C` | `min`         |
| `0x19` | `alt`         | `0x2D` | `max`         |
| `0x1A` | `title`       | `0x2E` | `step`        |
| `0x1B` | `action`      | `0x2F` | `pattern`     |
| `0x1C` | `method`      | `0x30` | `for`         |
| `0x1D` | `target`      | `0x31` | `tabindex`    |
| `0x1E` | `rel`         | `0x32` | `content`     |
| `0x1F` | `role`        | `0x33` | `charset`     |
| `0x20` | `aria-label`  | `0x34` | `http-equiv`  |
| `0x21` | `data-bind`   | `0x35` | `lang`        |
| `0x22` | `onclick`     | `0x36` | `dir`         |
| `0x23` | `onsubmit`    | `0x37` | `hidden`      |
|        |               | `0x38` | `data-bind-video` |
|        |               | `0x39` | `data-bind-audio` |

Attributes `0x3A`–`0xFF` are reserved.

---

## 4. BDT — Binary DOM Tree (Section 2)

Flat pointer-based representation of the DOM hierarchy.

### 4.1 Section Header

| Offset | Size | Type   | Value       |
|--------|------|--------|-------------|
| 0      | 3    | ASCII  | `BDT`       |
| 3      | 1    | Uint8  | `0x01` (v1) |
| 4      | 4    | Uint32 | Node count  |

### 4.2 Node Record (11 Bytes per node)

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 2    | Uint16 | Node ID                                        |
| 2      | 2    | Uint16 | Parent ID (`0xFFFF` = root)                    |
| 4      | 2    | Uint16 | First Child ID (`0xFFFF` = no children)        |
| 6      | 2    | Uint16 | Next Sibling ID (`0xFFFF` = last sibling)      |
| 8      | 1    | Uint8  | Node type (1 = element)                        |
| 9      | 1    | Uint8  | Tag byte (from BML Tag Table)                  |
| 10     | 1    | Uint8  | Depth (0 = root, max 255)                      |

---

## 5. BLB — Binary Layout Blocks (Section 3)

Pre-computed CSS layout as fixed-size blocks. Eliminates CSS cascade computation.

### 5.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BLB`        |
| 3      | 1    | Uint8  | `0x02` (v2)  |
| 4      | 4    | Uint32 | Block count  |

### 5.2 Layout Block (96 Bytes per node)

All dimensional values are stored as **fixed-point × 10** (e.g., `16px` → `160`).
Special value `0xFFFF` = `auto`.
Percentage values use bit 15 as flag: `value | 0x8000` (e.g., `50%` → `500 | 0x8000` = `0x81F4`).

| Offset | Size | Type   | Field                | Notes                           |
|--------|------|--------|----------------------|---------------------------------|
| 0      | 2    | Uint16 | Node ID              | Matches BDT node ID             |
| 2      | 1    | Uint8  | display              | 0=block,1=inline,2=flex,3=grid,4=none,5=inline-block,6=inline-flex |
| 3      | 1    | Uint8  | position             | 0=static,1=relative,2=absolute,3=fixed,4=sticky |
| 4      | 1    | Uint8  | box-sizing           | 0=content-box, 1=border-box     |
| 5      | 2    | Uint16 | width                | ×10, 0xFFFF=auto                |
| 7      | 2    | Uint16 | height               | ×10, 0xFFFF=auto                |
| 9      | 2    | Int16  | margin-top           | ×10 (can be negative)           |
| 11     | 2    | Int16  | margin-right         | ×10                             |
| 13     | 2    | Int16  | margin-bottom        | ×10                             |
| 15     | 2    | Int16  | margin-left          | ×10                             |
| 17     | 2    | Uint16 | padding-top          | ×10                             |
| 19     | 2    | Uint16 | padding-right        | ×10                             |
| 21     | 2    | Uint16 | padding-bottom       | ×10                             |
| 23     | 2    | Uint16 | padding-left         | ×10                             |
| 25     | 1    | Uint8  | border-top-width     | ×10, max 255                    |
| 26     | 1    | Uint8  | border-right-width   | ×10                             |
| 27     | 1    | Uint8  | border-bottom-width  | ×10                             |
| 28     | 1    | Uint8  | border-left-width    | ×10                             |
| 29     | 4    | Uint32 | border-color         | RGBA packed                     |
| 33     | 4    | Uint32 | background-color     | RGBA packed                     |
| 37     | 4    | Uint32 | color                | RGBA packed                     |
| 41     | 2    | Uint16 | font-size            | ×10 (default 160 = 16px)        |
| 43     | 2    | Uint16 | font-weight          | 100–900 (default 400)           |
| 45     | 2    | Uint16 | line-height          | ×10 (0 = normal)                |
| 47     | 1    | Uint8  | text-align           | 0=left,1=center,2=right,3=justify |
| 48     | 1    | Uint8  | flex-direction       | 0=row,1=column,2=row-reverse,3=column-reverse |
| 49     | 1    | Uint8  | flex-wrap            | 0=nowrap, 1=wrap                |
| 50     | 1    | Uint8  | justify-content      | 0=flex-start,1=flex-end,2=center,3=space-between,4=space-around,5=space-evenly |
| 51     | 1    | Uint8  | align-items          | 0=flex-start,1=flex-end,2=center,3=stretch,4=baseline |
| 52     | 2    | Uint16 | gap                  | ×10                             |
| 54     | 2    | Uint16 | border-radius        | ×10                             |
| 56     | 1    | Uint8  | overflow             | 0=visible,1=hidden,2=scroll,3=auto |
| 57     | 1    | Uint8  | opacity              | 0–255 (255 = fully opaque)      |
| 58     | 2    | Int16  | z-index              | −32768 to 32767 (0 = auto)      |
| 60     | 1    | Uint8  | text-decoration      | 0=none,1=underline,2=line-through,3=overline |
| 61     | 1    | Uint8  | cursor               | 0=default,1=pointer,2=text,3=move,4=not-allowed,5=grab,6=crosshair,7=wait,8=help |
| 62     | 1    | Uint8  | white-space          | 0=normal,1=nowrap,2=pre,3=pre-wrap,4=pre-line |
| 63     | 1    | Uint8  | visibility           | 0=visible,1=hidden,2=collapse   |
| 64     | 2    | Uint16 | min-width            | ×10, 0xFFFF=none                |
| 66     | 2    | Uint16 | max-width            | ×10, 0xFFFF=none                |
| 68     | 2    | Uint16 | min-height           | ×10, 0xFFFF=none                |
| 70     | 2    | Uint16 | max-height           | ×10, 0xFFFF=none                |
| 72     | 2    | Uint16 | flex-grow            | ×100 (z.B. 1.0 → 100)           |
| 74     | 2    | Uint16 | flex-shrink          | ×100                            |
| 76     | 2    | Uint16 | flex-basis           | ×10, 0xFFFF=auto                |
| 78     | 1    | Int8   | order                | -128 bis 127                    |
| 79     | 1    | Uint8  | align-self           | 0=auto,1=flex-start,2=flex-end,3=center,4=stretch,5=baseline |
| 80     | 4    | Uint32 | box-shadow-color     | RGBA packed                     |
| 84     | 2    | Int16  | box-shadow-x         | ×10                             |
| 86     | 2    | Int16  | box-shadow-y         | ×10                             |
| 88     | 2    | Uint16 | box-shadow-blur      | ×10                             |
| 90     | 2    | Uint16 | box-shadow-spread    | ×10                             |
| 92     | 2    | Uint16 | font-family-id       | Matches BFS ID (0xFFFF=default) |
| 94     | 1    | Uint8  | font-style           | 0=normal,1=italic,2=oblique     |
| 95     | 1    | Uint8  | animation-id         | Matches BAM ID (0xFF=none)      |

**Color Encoding** (Uint32 RGBA):
```
Bits 31–24: Red   (0–255)
Bits 23–16: Green (0–255)
Bits 15–8:  Blue  (0–255)
Bits 7–0:   Alpha (0–255, 255 = opaque)
```

## 6. BCS — Binary Class Styles (Section 13)

Introduced as a higher-efficiency alternative to BLB (Section 3). Instead of storing a 96-byte layout block for every single BDT node, BCS deduplicates blocks. Many DOM nodes share identical styles. BCS drastically reduces file size and network transmission by mapping node indices to a dictionary of unique 96-byte blocks.

### 6.1 Section Header

| Offset | Size | Type   | Value       |
|--------|------|--------|-------------|
| 0      | 3    | ASCII  | `BCS`       |
| 3      | 1    | Uint8  | `0x01` (v1) |
| 4      | 4    | Uint32 | Unique Block Count (`U`) |
| 8      | 4    | Uint32 | Node Mapping Count (`N`) |

### 6.2 Data Layout

Following the header, the section contains two arrays sequentially:

1. **Unique Blocks Array**: `U` contiguous blocks of 96 bytes each (identical to BLB v2 format).
   - *Size:* `U * 96` bytes.
2. **Node Mapping Array**: `N` indices mapping each sequential BDT Node to a Unique Block.
   - *Size:* `N * 2` bytes (Array of `Uint16`).
   - If Node `i` has Style ID `S`, then the block at index `S` from the Unique Blocks Array is applied to Node `i`.

*Parser Note:* If a BWEB container provides a `BCS` section, modern parsers MUST use it for styling and MAY ignore the `BLB` section if present. When converting HTML to BWEB, it is highly recommended to ONLY include `BCS` to maximize CO2 savings.

---

## 7. Media and Asset Sections (Sections 4-12)

Raw pixel data for images, rendered via Canvas API.

### 6.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BIB`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Image count  |

### 6.2 Image Record (22 Bytes header + pixel data)

| Offset | Size | Type   | Description                    |
|--------|------|--------|--------------------------------|
| 0      | 4    | Uint32 | Image ID                       |
| 4      | 2    | Uint16 | Width in pixels                |
| 6      | 2    | Uint16 | Height in pixels               |
| 8      | 1    | Uint8  | Color space (1 = RGBA)         |
| 9      | 1    | Uint8  | Compression (0 = raw)          |
| 10     | 6    | —      | Reserved (padding, must be 0)  |
| 16     | 2    | Uint16 | Block ID                       |
| 18     | 4    | Uint32 | Pixel data length in bytes     |
| 22     | N    | Bytes  | Raw pixel data (RGBA, 4 bytes/pixel) |

Image binding: `<canvas data-bind="IMAGE_ID">` in BML links to BIB image.

---

## 7. BVS — Binary Video Streams (Section 5)

Interleaved chunks of I/P-Frames (Video-only) optimized for WebCodecs `VideoDecoder`.

### 7.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BVS`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Video count  |

### 7.2 Video Record

Each video is stored consecutively.

| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 0      | 4    | Uint32 | Video ID                                          |
| 4      | 2    | Uint16 | Width in pixels                                   |
| 6      | 2    | Uint16 | Height in pixels                                  |
| 8      | 1    | Uint8  | Codec string length (`L`)                         |
| 9      | L    | ASCII  | Codec string (e.g. `avc1.64000c`)                 |
| 9+L    | 4    | Uint32 | Chunk count (`C`)                                 |
| var    | var  | —      | Array of `C` Chunks (see below)                   |

### 7.3 Chunk Record

Chunks represent `EncodedVideoChunk` units for WebCodecs.

| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 0      | 1    | Uint8  | Flags (Bit 0: `1` = Keyframe, `0` = Delta frame)  |
| 1      | 8    | Uint64 | Presentation Timestamp (PTS) in microseconds      |
| 9      | 4    | Uint32 | Duration in microseconds                          |
| 13     | 4    | Uint32 | Data length in bytes (`D`)                        |
| 17     | D    | Bytes  | Raw chunk data (e.g., NAL units)                  |

Video binding: `<canvas data-bind-video="VIDEO_ID">` in BML links to BVS video.

---

## 8. BAS — Binary Audio Streams (Section 6)

Optimierte Audiostreams für `WebCodecs AudioDecoder` und synchronisierte `Web Audio API` Wiedergabe.

### 8.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BAS`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Audio count  |

### 8.2 Audio Record

| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 0      | 4    | Uint32 | Audio ID                                          |
| 4      | 1    | Uint8  | Codec string length (`L`)                         |
| 5      | L    | ASCII  | Codec string (z.B. `mp4a.40.2` oder `opus`)       |
| 5+L    | 4    | Uint32 | Sample Rate (in Hz, z.B. 44100)                   |
| 9+L    | 1    | Uint8  | Channel Count (z.B. 2 für Stereo)                 |
| 10+L   | 4    | Uint32 | Chunk count (`C`)                                 |
| var    | var  | —      | Array of `C` Chunks (see 7.3 Chunk Record)        |

Audio binding: `<canvas data-bind-audio="AUDIO_ID">` für synchronisierte Wiedergabe zusammen mit Video, oder auf verstecktem Canvas für Standalone-Audio.

---

## 9. BFS — Binary Font Streams (Section 7)

Embedded font files (WOFF2/TTF) loaded via FontFace API.

### 9.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BFS`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Font count   |

### 9.2 Font Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 2    | Uint16 | Font ID (matches BLB `font-family-id`)         |
| 2      | 1    | Uint8  | Family Name Length (N)                         |
| 3      | N    | UTF-8  | Family Name (e.g., "Open Sans")                |
| 3+N    | 2    | Uint16 | Font Weight (e.g., 400, 700)                   |
| 5+N    | 1    | Uint8  | Font Style (0=normal,1=italic,2=oblique)       |
| 6+N    | 1    | Uint8  | Format (0=woff2, 1=woff, 2=ttf, 3=otf)         |
| 7+N    | 4    | Uint32 | Data Length (D)                                |
| 11+N   | D    | Bytes  | Raw Font binary data                           |

---

## 10. BAM — Binary Animation Map (Section 8)

CSS Animations and Transitions.

### 10.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BAM`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Anim count   |

### 10.2 Animation Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 1    | Uint8  | Anim ID (matches BLB `animation-id`)           |
| 1      | 1    | Uint8  | Type (0=transition, 1=keyframes)               |
| 2      | 1    | Uint8  | Name Length (N)                                |
| 3      | N    | ASCII  | Name (e.g., "fade-in")                         |
| 3+N    | 4    | Uint32 | Duration (ms)                                  |
| 7+N    | 4    | Uint32 | Delay (ms)                                     |
| 11+N   | 1    | Uint8  | Timing (0=ease,1=linear,2=ease-in,3=ease-out,4=ease-in-out) |
| 12+N   | 2    | Uint16 | Iterations (0xFFFF=infinite)                   |
| 14+N   | 1    | Uint8  | Direction (0=normal,1=reverse,2=alternate)     |
| 15+N   | 1    | Uint8  | Fill Mode (0=none,1=forwards,2=backwards,3=both) |
| 16+N   | 2    | Uint16 | Keyframe Count (K)                             |
| 18+N   | var  | —      | Array of K Keyframes                           |

### 10.3 Keyframe Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 1    | Uint8  | Percentage (0–100)                             |
| 1      | 1    | Uint8  | Property Count (P)                             |
| 2      | var  | —      | Array of P Properties                          |

### 10.4 Property Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 1    | Uint8  | Property ID (e.g., 1=translateX, 16=opacity)   |
| 1      | 2    | Uint16 | Value Length (V)                               |
| 3      | V    | UTF-8  | Value (e.g., "100px", "0")                     |

---

## 11. BRS — Binary Responsive Specs (Section 9)

Media Queries and conditional layout overrides.

### 11.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BRS`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Query count  |

### 11.2 Query Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 1    | Uint8  | Query Length (Q)                               |
| 1      | Q    | ASCII  | Query String (e.g., "(max-width: 600px)")      |
| 1+Q    | 4    | Uint32 | Block count (B)                                |
| 5+Q    | B*96 | Bytes  | Array of `B` BLB v2 blocks (96 bytes each)     |

---

## 12. BSG — Binary SVG Graphics (Section 10)

Vector graphics parsed into a binary path format and rendered via `CanvasRenderingContext2D` or `<svg>`.

### 12.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BSG`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Graphic count|

### 12.2 Graphic Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 4    | Uint32 | Graphic ID (binds to `<canvas data-bind-svg="ID">`) |
| 4      | 2    | Uint16 | Canvas Width                                   |
| 6      | 2    | Uint16 | Canvas Height                                  |
| 8      | 2    | Uint16 | Path Count (P)                                 |
| 10     | var  | —      | Array of P Path Records                        |

### 12.3 Path Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 4    | Uint32 | Fill Color (RGBA)                              |
| 4      | 4    | Uint32 | Stroke Color (RGBA)                            |
| 8      | 2    | Uint16 | Stroke Width (px * 10)                         |
| 10     | 4    | Uint32 | Data Length (D)                                |
| 14     | D    | ASCII  | SVG Path Data (e.g., "M10 10 L90 90 Z")        |

## 13. BJS — Binary JavaScript Source (Section 11)

JavaScript payload for interactivity.

### 13.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BJS`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Script count |

### 13.2 Script Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 4    | Uint32 | Script ID (binds to `<script data-bind-js="ID">`) |
| 4      | 4    | Uint32 | Data Length (D)                                |
| 8      | D    | UTF-8  | JS Source Code                                 |

---

## 14. BPR — Binary Page Routes (Section 12)

Client-side router paths mapped to BDT nodes.
### 14.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BPR`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Route count  |

### 14.2 Route Record

| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 2    | Uint16 | Route ID                                       |
| 2      | 1    | Uint8  | Path Length (P)                                |
| 3      | P    | ASCII  | Route Path (e.g., "/about")                    |
| 3+P    | 2    | Uint16 | Target BDT Node ID (displayed when active)     |

---

## 15. BWA — Binary WebAssembly (Section 14)

Embeds compiled WebAssembly bytecode directly within the BWEB container. Allows high-performance computing without separate network requests.

### 15.1 Section Header
| Offset | Size | Type   | Value       |
|--------|------|--------|-------------|
| 0      | 3    | ASCII  | `BWA`       |
| 3      | 1    | Uint8  | `0x01` (v1) |
| 4      | 1    | Uint8  | Module Count|

### 15.2 Module Record
| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 1    | Uint8  | Module ID                                      |
| 1      | 1    | Uint8  | Name Length (`L`)                              |
| 2      | L    | ASCII  | Module Name                                    |
| 2+L    | 4    | Uint32 | Bytecode Length (`C`)                          |
| 6+L    | C    | Bytes  | WASM Bytecode                                  |

---

## 16. B3D — Binary 3D Shaders (Section 15)

Embeds WebGL/WebGPU shader source code for instant 3D rendering.

### 16.1 Section Header
| Offset | Size | Type   | Value       |
|--------|------|--------|-------------|
| 0      | 3    | ASCII  | `B3D`       |
| 3      | 1    | Uint8  | `0x01` (v1) |
| 4      | 1    | Uint8  | Shader Count|

### 16.2 Shader Record
| Offset | Size | Type   | Description                                    |
|--------|------|--------|------------------------------------------------|
| 0      | 1    | Uint8  | Shader ID                                      |
| 1      | 1    | Uint8  | Type (0=Vertex, 1=Fragment, 2=Compute)         |
| 2      | 4    | Uint32 | Data Length (`D`)                              |
| 6      | D    | Bytes  | Shader Source (UTF-8 GLSL)                     |

---

## 17. Versioning

### 17.1 Rules

- **Container version** (`BWEB[version]`): Incremented when the section table format changes.
- **Section version** (per magic, e.g., `BML\x02`): Incremented when that section's internal layout changes.
- Parsers MUST reject versions they don't understand.
- Unknown section type IDs SHOULD be silently skipped (forward compatibility).

### 17.2 Extension

New sections can be added with type IDs `7`–`127` without breaking existing parsers. Existing parsers skip unknown section types by reading their length and advancing the offset. Bit 7 (`0x80`) of the type ID is reserved for the compression flag.

---

## 18. Security

- BML text content MUST be treated as plain text, never as HTML.
- `onclick`, `onsubmit` attributes (`0x22`, `0x23`) MUST be sanitized or ignored by security-conscious renderers.
- BIB pixel data MUST be validated: `width × height × 4 == data_length`.
- WebAudio Autoplay erfordert einen initialen User-Click vor der ersten BAS Wiedergabe.

---

## 19. MIME Types

| Extension | MIME Type            |
|-----------|----------------------|
| `.bweb`   | `application/x-bweb` |
| `.bml`    | `application/x-bml`  |

---

## 20. Attribution

Every commercial usage of BWEB or its parsers must include the following attribution string in their documentation or about page:

> "Incorporates RAG-NVMe architecture designed by Benjamin Leimer."

---

*BWEB Specification © 2026 Benjamin Leimer. All rights reserved.*
