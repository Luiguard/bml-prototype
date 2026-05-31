# BWEB (Binary Web) Specification
**Version:** 1.0.0 (Normative)
**Status:** Frozen / Reference Implementation Active

BWEB ist ein präkompiliertes, binäres Webformat. Es ersetzt HTML, CSS und manuelles DOM-Handling durch eine statisch berechnete, deterministische Pointer-Struktur für WASM/WebGL-Engines.

## 1. BWEB Container (`BWEB`)
Ein BWEB-Container bündelt alle Sektionen (BML, BDT, BLB, etc.).

### 1.1 Header
- **Magic**: `0x42 0x57 0x45 0x42` (`BWEB`)
- **Version**: `uint8` (Aktuell `0x01`)
- **Section Count**: `uint8`

### 1.2 Section Table (pro Sektion)
- **Section Type**: `uint8` (Bit 7 = Compressed Flag)
  - `0x01`: BML
  - `0x02`: BDT
  - `0x03`: BLB
  - `0x04`: BIB
  - `0x05`: BVS
  - `0x06`: BAS
- **Length**: `uint32` (Länge der Payload)
- **Payload**: `N Bytes` (Zlib-komprimiert, falls Bit 7 gesetzt)

### 1.3 BPG (BWEB Package Group / Update Manifest)
Magic: `0x42 0x50 0x47 0x01` (`BPG\x01`)
Definiert das Paketformat für inkrementelle Updates und Erweiterungen.
- **Header**: `4 Bytes` (`BPG\x01`)
- **Signature Length**: `uint16`
- **Signature (ECDSA)**: `N Bytes` (zur Verifizierung)
- **Public Key Length**: `uint16`
- **Public Key (SPKI)**: `N Bytes`
- **Hash (SHA-256)**: `32 Bytes`
- **Manifest Payload Length**: `uint32`
- **Manifest Payload**: `N Bytes` (JSON oder BML kodiert)

---

## 2. BML (Binary Markup Language)
Magic: `0x42 0x4D 0x4C 0x02` (`BML\x02`)

### 2.1 BML-Tag-Tabelle (Opcodes)
| Tag | Opcode | Tag | Opcode | Tag | Opcode | Tag | Opcode |
|---|---|---|---|---|---|---|---|
| div | 0x01 | form | 0x15 | canvas | 0x2B | time | 0x3B |
| span | 0x02 | input | 0x16 | svg | 0x2C | abbr | 0x3C |
| p | 0x03 | button | 0x17 | iframe | 0x2D | figcaption | 0x2E |
| a | 0x04 | textarea | 0x18 | figure | 0x2F | b | 0x3E |
| h1 | 0x05 | select | 0x19 | blockquote | 0x30 | i | 0x3F |
| h2 | 0x06 | option | 0x1A | small | 0x31 | u | 0x40 |
| h3 | 0x07 | label | 0x1B | sub | 0x32 | body | 0xFE |
| h4 | 0x08 | header | 0x1C | sup | 0x33 | html | 0xFF |
| h5 | 0x09 | footer | 0x1D | details | 0x34 | | |
| h6 | 0x0A | nav | 0x1E | summary | 0x35 | | |
| img | 0x0B | main | 0x1F | dialog | 0x36 | | |
| ul | 0x0C | section | 0x20 | dl | 0x37 | | |
| ol | 0x0D | article | 0x21 | dt | 0x38 | | |
| li | 0x0E | aside | 0x22 | dd | 0x39 | | |
| table | 0x0F | strong | 0x23 | mark | 0x3A | | |
| tr | 0x10 | em | 0x24 | code | 0x25 | | |
| td | 0x11 | pre | 0x26 | br | 0x27 | hr | 0x28 |

### 2.2 Attribute-Tabelle
| Attribut | ID | Attribut | ID | Attribut | ID |
|---|---|---|---|---|---|
| class | 0x10 | onsubmit | 0x23 | dir | 0x36 |
| id | 0x11 | width | 0x24 | hidden | 0x37 |
| href | 0x12 | height | 0x25 | data-bind-video | 0x38 |
| src | 0x13 | disabled | 0x26 | data-bind-audio | 0x39 |
| style | 0x14 | checked | 0x27 | | |
| type | 0x15 | selected | 0x28 | | |
| name | 0x16 | required | 0x29 | | |
| value | 0x17 | autofocus | 0x2A | | |
| placeholder | 0x18 | autocomplete | 0x2B | | |
| alt | 0x19 | min | 0x2C | | |
| title | 0x1A | max | 0x2D | | |
| action | 0x1B | step | 0x2E | | |
| method | 0x1C | pattern | 0x2F | | |
| target | 0x1D | for | 0x30 | | |
| rel | 0x1E | tabindex | 0x31 | | |
| role | 0x1F | content | 0x32 | | |
| aria-label | 0x20 | charset | 0x33 | | |
| data-bind | 0x21 | http-equiv | 0x34 | | |
| onclick | 0x22 | lang | 0x35 | | |

### 2.3 A11y-Semantikmodell & ARIA-Mapping
BML bietet natives Mapping für Barrierefreiheit durch feste Rollen und Zustände, welche als Attribute (ID 0x1F - role, 0x20 - aria-label) kodiert werden.
- **Rollen (Role - 0x1F):**
  - `0x01` = button
  - `0x02` = link
  - `0x03` = heading
  - `0x04` = nav
  - `0x05` = main
  - `0x06` = form
  - `0x07` = textbox
  - `0x08` = checkbox
- **Zustände (States):**
  - `0x26` = disabled (Boolean)
  - `0x27` = checked (Boolean)
  - `0x28` = selected (Boolean)
  - *Custom-States:* expanded, pressed via standard Attribute IDs oder `data-` (0xFE) Mappings.
- **Shadow-DOM Strategie:** Clients müssen für screen reader ein unsichtbares DOM erzeugen, dessen Bounding-Boxes strikt mit den berechneten BLB-Koordinaten synchron gehalten werden.

### 2.4 Node-Serialisierung
- Tag (`uint8`)
- Attribut-Anzahl (`uint8`)
- Children-Anzahl (`uint16`)
- Text-Länge (`uint16`)
- Attribute (pro Attribut):
  - ID (`uint8`)
  - Wert-Länge (`uint16`)
  - Wert (`N Bytes` UTF-8)
- Text (`N Bytes` UTF-8)

---

## 3. BDT (Binary DOM Tree)
Magic: `0x42 0x44 0x54 0x01` (`BDT\x01`)

Struktur eines BDT-Knotens (fest 13 Bytes):
- Node ID (`uint16`)
- Parent ID (`uint16`, `0xFFFF` = Root)
- First Child ID (`uint16`, `0xFFFF` = None)
- Next Sibling ID (`uint16`, `0xFFFF` = None)
- Node Type (`uint8`, `1` = Element)
- Tag Byte (`uint8`, referenziert BML-Tag-Tabelle)
- Depth (`uint8`)

---

## 4. BLB (Binary Layout Blocks)
Magic: `0x42 0x4C 0x42 0x01` (`BLB\x01`)

## 2. Grobstruktur einer .bweb Datei
Die Datei besteht aus einem globalen Header und aufeinanderfolgenden Sections (Blöcken).

```
[BWEB Global Header]
[Section 1: BML - Binary Markup Language]
[Section 2: BDT - Binary Document Tree]
[Section 3: BLB - Binary Layout Block]
[Section 4: BIB - Binary Image Block] (optional)
[Section 5: BVS - Binary Video Stream] (optional)
```

Jeder BLB-Block repräsentiert genau einen DOM-Knoten in derselben Reihenfolge wie der BDT und ist **exakt 60 Bytes** groß.

### 4.1 Block-Struktur
1. `uint16` Node ID
2. `uint8` Display (0=block, 1=inline, 2=flex, 3=grid, 4=none, 5=inline-block, 6=inline-flex)
3. `uint8` Position (0=static, 1=relative, 2=absolute, 3=fixed, 4=sticky)
4. `uint8` Box-Sizing (1=border-box, 0=content-box)
5. `uint16` Width (Faktor 10, Bit 15 = %-Flag)
6. `uint16` Height (Faktor 10, Bit 15 = %-Flag)
7. `int16 x 4` Margin (Top, Right, Bottom, Left)
8. `uint16 x 4` Padding (Top, Right, Bottom, Left)
9. `uint8 x 4` Border-Width (Top, Right, Bottom, Left)
10. `uint32` Border-Color (RGBA)
11. `uint32` Background-Color (RGBA)
12. `uint32` Text-Color (RGBA)
13. `uint16` Font-Size (Faktor 10)
14. `uint16` Font-Weight (z.B. 400, 700)
15. `uint16` Line-Height (Faktor 10)
16. `uint8` Text-Align (0=left, 1=center, 2=right, 3=justify)
17. `uint8` Flex-Direction (0=row, 1=column, 2=row-rev, 3=col-rev)
18. `uint8` Flex-Wrap (1=wrap, 0=nowrap)
19. `uint8` Justify-Content (0=start, 1=end, 2=center, 3=space-between, 4=space-around, 5=space-evenly)
20. `uint8` Align-Items (0=start, 1=end, 2=center, 3=stretch, 4=baseline)
21. `uint16` Gap (Faktor 10)
22. `uint16` Border-Radius (Faktor 10)
23. `uint8` Overflow (0=visible, 1=hidden, 2=scroll, 3=auto)
24. `uint8` Opacity (0-255)
25. `int16` Z-Index

### 4.2 Dynamische Properties (Tags)
Zusätzlich zur festen Basis-Struktur (oder als Alternative im dynamischen Parsing-Modell) können Layout-Blöcke dynamische Eigenschaften via Tags erhalten:
- **Tag 21 = Font-Family** (`UTF-8 String`, max 64 Bytes). Fallback-Regel: Wenn Font nicht geladen → sans-serif.
- **Tag 38 = Backdrop-Filter** (`uint8`, Glassmorphism-Flag).
- **Tag 39 = CSS Filter** (nur `blur(px)` für v1.0). Format: `uint16` blurRadiusPx.
- **Tag 46/47/48/49** = Absolute Positionierung (`left`, `top`, `right`, `bottom`).

---

## 6. Section 4: BIB (Binary Image Block)
Bilder werden in BWEB nicht base64-encodiert im Markup gespeichert, sondern als eigenständige Binärblöcke. Die src-Property eines BML Image-Knotens referenziert das Bild über `bib://<id>`.

**Header-Struktur (pro Bild):**
| Byte-Offset | Datentyp | Beschreibung |
| :--- | :--- | :--- |
| `0x00` | `uint16` | BIB Asset ID (entspricht `<id>` in `bib://<id>`) |
| `0x02` | `uint8` | Mime-Type Enum (1=JPEG, 2=PNG, 3=SVG, 4=WebP, 5=GIF) |
| `0x03` | `uint32` | Payload-Length `L` (Größe des Bildes in Bytes) |
| `0x07` | `bytes` | Raw Image Bytes (Länge `L`) |

## 7. Section 5: BVS (Binary Video Stream)
Videos werden in BWEB gestreamed bzw. sequenziell als Binärblock abgelegt. Die src-Property eines BML Video-Knotens referenziert das Video über `bvs://<id>`.

**Header-Struktur (pro Video):**
| Byte-Offset | Datentyp | Beschreibung |
| :--- | :--- | :--- |
| `0x00` | `uint16` | BVS Asset ID (entspricht `<id>` in `bvs://<id>`) |
| `0x02` | `uint8` | Format Enum (1=MP4, 2=WebM) |
| `0x03` | `uint32` | Total Length `L` (Größe des Videos in Bytes) |
| `0x07` | `bytes` | Raw Video Bytes (Länge `L`) |

*(Hinweis: Für BWEB 1.0 werden Videos als kompletter Block (ohne dediziertes internes Chunking auf BWEB-Ebene) eingebunden, die Verarbeitung übernimmt der Browser/Offscreen-Canvas asynchron.)*

## 8. Performance Characteristics (Benchmarks)
Der BWEB-Standard wurde auf 10.000 generierte, verschachtelte Boxen im Headless-Modus (Chromium) gebenchmarkt, um den reinen Layout- und Paint-Overhead gegenüber nativem DOM zu evaluieren.

| Metrik | DOM (Native) | BWEB (JS/Canvas Prototype) |
| --- | --- | --- |
| **Node Count** | 10.000 | 10.000 |
| **Render-Zeit (Layout + Paint)** | ~91.90 ms | ~93.60 ms |
| **Speicher-Footprint** | Hoch (JS/C++ DOM Objekte) | Minimal (Float32Arrays, BDT Structs) |

**Fazit:** Der JS-Fallback-Renderer arbeitet annähernd so schnell wie die native, C++ basierte Rendering-Engine des Browsers. Sobald die Layout-Engine und Rendering-Pipeline nach WASM (Rust) verlagert werden, ist ein massiver Performance-Vorsprung (10x-50x) zu erwarten, da sämtliche JS-Garbage-Collection entfällt und der Speicherzugriff direkt via linearem WASM-Memory erfolgt.

---

## 7. Security Model
BWEB vertraut dem Client bei Code-Ausführung absolut nicht (Zero-Trust VM-Limiter).
- **Time-Out:** Die BDT-VM stoppt Execution nach max. 500ms pro Frame (Hard Limit).
- **Max-Instructions:** Limitiert auf 5.000 Operationen pro Node, danach Kill-Signal.
- **Memory-Access:** Lineares Array (8MB fixed), Sandbox. Kein Heap-Escape.
