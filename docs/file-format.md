# File Format Reference

This is a human-readable summary of the BWEB binary format. For the complete byte-level specification, see [SPEC.md](../SPEC.md).

---

## Two Container Formats

### `.bweb` — Raw BWEB Package

Used for development, local testing, and direct serving.

```
Offset  Size  Field
0       4     Magic: "BWEB" (0x42 0x57 0x45 0x42)
4       1     Version (currently: 2)
5       1     Section count (N)
6       N×9   Section index (N entries, 9 bytes each)
...           Section data
```

**Section index entry (9 bytes):**
```
0  1  Section type ID (uint8)
1  4  Section offset from file start (uint32 BE)
5  4  Section length in bytes (uint32 BE)
```

---

### `.bpg` — Signed BPG Package

Production format with cryptographic integrity and authenticity.

```
Offset  Size    Field
0       4       Magic: "BPG1"
4       1       Major version
5       1       Minor version
6       2       Flags
8       4       Payload length (uint32 BE)
12      4       Index offset (uint32 BE)
16      32      SHA-256 integrity hash of payload
48      2       Identity (public key) length
50      N       Public key (SPKI DER format)
50+N    2       Token (signature) length
52+N    M       ECDSA signature (secp256k1)
52+N+M  ...     BWEB payload (the complete .bweb file)
```

---

## Section Type IDs

| ID | Name | Description |
|---|---|---|
| `0x00` | BML | Binary Markup Language (tag IDs, attributes, text) |
| `0x01` | BDT | Binary DOM Tree (node hierarchy with parent/child pointers) |
| `0x02` | BLB | Binary Layout Block (desktop layout, 50 bytes per node) |
| `0x03` | BLB-Tablet | Binary Layout Block for tablet viewport |
| `0x04` | BIB | Binary Image Blocks (raw image data) |
| `0x05` | BVS | Binary Video Streams |
| `0x06` | BMS | Binary Message/Event System |
| `0x07` | BFF | Binary Font Files |
| `0x08` | BEX | Binary Event Extensions (interaction definitions) |
| `0x09` | TOC | Table of Contents (VFS index for multi-page packages) |
| `0x0A` | BLB-Mobile | Binary Layout Block for mobile viewport |

---

## BML Section Format

Each node entry:

**Element node:**
```
1 byte  tagId (0x01–0xFD) — see tag map below
1 byte  attribute count
6 bytes padding
--- For each attribute: ---
1 byte  attribute ID (or 0xFE for custom name)
  If 0xFE: 1 byte name length + N bytes UTF-8 name
2 bytes value length
N bytes UTF-8 value
```

**Text node (tagId = 0xFD):**
```
1 byte  0xFD (text marker)
3 bytes padding
2 bytes text length
N bytes UTF-8 text
```

### Tag Map (selected)

| Byte | HTML tag | | Byte | HTML tag |
|---|---|---|---|---|
| `0x01` | `div` | | `0x10` | `canvas` |
| `0x02` | `p` | | `0x11` | `svg` |
| `0x03` | `span` | | `0x12` | `header` |
| `0x04` | `a` | | `0x13` | `footer` |
| `0x05` | `button` | | `0x14` | `section` |
| `0x06` | `img` | | `0x15` | `nav` |
| `0x07` | `input` | | `0x16` | `main` |
| `0x08` | `form` | | `0x17` | `aside` |
| `0x09` | `ul` | | `0x18` | `article` |
| `0x0A` | `li` | | `0x1C` | `table` |
| `0x0B` | `h1` | | `0x1D` | `thead` |
| `0x0C` | `h2` | | `0x1E` | `tbody` |
| `0x0D` | `h3` | | `0x1F` | `tr` |
| `0x0E` | `h4` | | `0x20` | `td` |
| `0x0F` | `h5` / `h6` | | `0x21` | `th` |

Full tag map: 113 tags defined, covering all HTML5 elements. Unknown tags fall back to `div`.

---

## BDT Section Format

```
2 bytes  Node count (uint16)
--- For each node (10 bytes): ---
2 bytes  Node ID (uint16)
2 bytes  Parent node ID (0xFFFF = no parent / root)
2 bytes  First child node ID (0xFFFF = no children)
2 bytes  Next sibling node ID (0xFFFF = last sibling)
1 byte   Node type (1 = element, 3 = text)
1 byte   Flags
```

---

## BLB Section Format

```
2 bytes  Node count (uint16)
--- For each node (50 bytes): ---
4 bytes  x (float32)
4 bytes  y (float32)
4 bytes  width (float32)
4 bytes  height (float32)
4 bytes  padding top (float32)
4 bytes  padding right (float32)
4 bytes  padding bottom (float32)
4 bytes  padding left (float32)
1 byte   border width top
1 byte   border width right
1 byte   border width bottom
1 byte   border width left
1 byte   border style
1 byte   background R
1 byte   background G
1 byte   background B
1 byte   background A
1 byte   foreground (text) R
1 byte   foreground G
1 byte   foreground B
1 byte   foreground A
2 bytes  border radius (uint16, pixels × 10)
2 bytes  z-index (int16)
1 byte   flags (visibility, overflow, etc.)
```

---

## BIB Section Format

```
2 bytes  Image count (uint16)
--- For each image: ---
2 bytes  Image ID (uint16)
4 bytes  Data offset within BIB section (uint32)
4 bytes  Data length in bytes (uint32)
3 bytes  padding
--- Image data (inline, at offsets above): ---
  Raw JPEG / PNG / WebP bytes
```

Images are referenced from BML via `src="bib://ID"`.

---

## TOC Section Format (Multi-page VFS)

```
3 bytes  Magic: "VFS"
1 byte   Version (0x01)
N bytes  JSON string: { "index.html": { "index": 0 }, "about.html": { "index": 1 }, ... }
```

The JSON maps URL paths to VFS entry indices. Each index corresponds to a BML/BDT/BLB group in the section array.

---

## Further Reading

- [Full byte-level specification (SPEC.md)](../SPEC.md) — complete, authoritative reference
- [CLI Reference](./cli-reference.md) — tools to inspect and validate files
- [Getting Started](./getting-started.md) — create your first .bweb file
