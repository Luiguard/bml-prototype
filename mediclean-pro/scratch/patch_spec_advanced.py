import re

with open('bweb-converter/SPEC.md', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add BDU to the table
text = re.sub(
    r'\\| 8  \\| BPG  \\| `BPG\\\\x01`\\| Binary Page Container \\(Routes\\) \\|',
    '| 8  | BPG  | `BPG\\\\x01`| Binary Page Container (Routes) |\\n| 9  | BTB  | `BTB\\\\x01`| Binary Theme Blocks            |\\n| 10 | BDU  | `BDU\\\\x01`| Binary Delta Updates           |',
    text
)

# 2. Append BDU section before Security section
bdu_spec = """
---

## 7. BDU — Binary Delta Updates (Section 10)

Speichert dynamische Zustände einer Webseite (z. B. nach Klick auf Links mit Query-Parametern wie `?type=buero`) als extrem kompakte Delta-Mutationen zum Basis-DOM. 
Nutzt eine O(1) Index-Tabelle (URL-Hash → Offset) für instantanes Parsing.

### 7.1 Section Header & Index Table

| Offset | Size | Type   | Description                                 |
|--------|------|--------|---------------------------------------------|
| 0      | 3    | ASCII  | `BDU`                                       |
| 3      | 1    | Uint8  | `0x01` (v1)                                 |
| 4      | 4    | Uint32 | Variant count (`V`)                         |
| 8      | V*8  | Array  | Index Entries (Hash + Offset)               |
| var    | var  | Data   | Variant Blocks                              |

**Index Entry Format (8 Bytes):**
- `4 Bytes (Uint32)`: URL Hash (djb2)
- `4 Bytes (Uint32)`: Absolute Offset to the Variant Block (from start of BDU Section payload)

### 7.2 Variant Record (Data Block)

| Offset | Size | Type   | Description                                       |
|--------|------|--------|---------------------------------------------------|
| 0      | 2    | Uint16 | URL string length (`L`)                           |
| 2      | L    | UTF-8  | URL (e.g. `service.html?type=buero`)              |
| 2+L    | 4    | Uint32 | Mutation count (`M`)                              |
| var    | var  | —      | Array of `M` Mutations (see below)                |

### 7.3 Mutation Records

Mutations referenzieren deterministische Node-IDs (Preorder-Index im Basis-DOM).

#### 0x01: Text Update
Aktualisiert den ersten Textknoten des Elements oder fügt einen ein.
| Size | Type   | Description |
|------|--------|-------------|
| 2    | Uint16 | Node-ID     |
| 1    | Uint8  | Type `0x01` |
| 4    | Uint32 | Data Len    |
| var  | UTF-8  | Text Data   |

#### 0x02: Attribute Update
| Size | Type   | Description |
|------|--------|-------------|
| 2    | Uint16 | Node-ID     |
| 1    | Uint8  | Type `0x02` |
| 1    | Uint8  | Attribute ID (from TAG_REV) |
| 4    | Uint32 | Data Len    |
| var  | UTF-8  | Attr Value  |

#### 0x03: Visibility Update
| Size | Type   | Description |
|------|--------|-------------|
| 2    | Uint16 | Node-ID     |
| 1    | Uint8  | Type `0x03` |
| 1    | Uint8  | `0` (Hidden/none) or `1` (Visible) |

#### 0x04: Replace-Node
Ersetzt den gesamten Node. Data ist ein valider BML-Stream für einen Node.
| Size | Type   | Description |
|------|--------|-------------|
| 2    | Uint16 | Node-ID     |
| 1    | Uint8  | Type `0x04` |
| 4    | Uint32 | BML Len     |
| var  | Bytes  | BML Stream  |

#### 0x05: Insert-Node
Fügt einen neuen BML-formatierten Node als Kind ein.
| Size | Type   | Description |
|------|--------|-------------|
| 2    | Uint16 | Parent Node-ID |
| 1    | Uint8  | Type `0x05`    |
| 2    | Uint16 | Sibling Index  |
| 4    | Uint32 | BML Len        |
| var  | Bytes  | BML Stream     |

#### 0x06: Remove-Node
Löscht den Node komplett.
| Size | Type   | Description |
|------|--------|-------------|
| 2    | Uint16 | Node-ID     |
| 1    | Uint8  | Type `0x06` |

"""

text = text.replace('## 6. Sicherheitsmodell', bdu_spec + '\\n\\n## 8. Sicherheitsmodell')

with open('bweb-converter/SPEC.md', 'w', encoding='utf-8') as f:
    f.write(text)

