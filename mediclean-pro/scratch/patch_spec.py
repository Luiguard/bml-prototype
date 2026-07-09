import re

with open('bweb-converter/SPEC.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Update Section Table
text = re.sub(
    r'\\| 6  \\| BAS  \\| `BAS\\\\x01`\\| Binary Audio Streams           \\|',
    '| 6  | BAS  | `BAS\\\\x01`| Binary Audio Streams           |\\n| 10 | BDU  | `BDU\\\\x01`| Binary Delta Updates           |',
    text
)

bdu_spec = """
---

## 9. BDU — Binary Delta Updates (Section 10)

Speichert dynamische Zustände einer Webseite (z. B. nach Klick auf Links mit Query-Parametern wie `?type=buero`) als extrem kompakte Delta-Mutationen zum Basis-DOM. Ermöglicht blitzschnelles Umschalten von Views ohne Neu-Rendering oder JS-Ausführung.

### 9.1 Section Header

| Offset | Size | Type   | Value        |
|--------|------|--------|--------------|
| 0      | 3    | ASCII  | `BDU`        |
| 3      | 1    | Uint8  | `0x01` (v1)  |
| 4      | 4    | Uint32 | Variant count|

### 9.2 Variant Record (per URL)

| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 0      | 2    | Uint16 | URL string length (`L`)                           |
| 2      | L    | UTF-8  | URL (e.g. `service.html?type=buero`)              |
| 2+L    | 4    | Uint32 | Mutation count (`M`)                              |
| var    | var  | —      | Array of `M` Mutations (see below)                |

### 9.3 Mutation Record

| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 0      | 2    | Uint16 | Target Node ID (matches BDT nodeIdx)              |
| 2      | 1    | Uint8  | Mutation Type (1 = TextContent, 2 = Attribute)    |

**If Type = 1 (TextContent):**
| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 3      | 4    | Uint32 | Data length (`D`)                                 |
| 7      | D    | UTF-8  | New Text String                                   |

**If Type = 2 (Attribute):**
| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 3      | 1    | Uint8  | Attribute ID (from BML Tag Table, e.g. 0x10=class)|
| 4      | 4    | Uint32 | Data length (`D`)                                 |
| 8      | D    | UTF-8  | New Attribute Value                               |
"""

text = re.sub(
    r'---[\\s\\n]*## 9\\. Versioning',
    bdu_spec + '\\n\\n---\\n\\n## 10. Versioning',
    text
)

text = re.sub(r'## 10\\. Security', '## 11. Security', text)
text = re.sub(r'## 11\\. MIME Types', '## 12. MIME Types', text)

with open('bweb-converter/SPEC.md', 'w', encoding='utf-8') as f:
    f.write(text)
