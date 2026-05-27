#!/usr/bin/env python3
"""Erzeugt eine Testdatei im Binary Markup Language (BML) Format."""
import struct
from pathlib import Path

TAG_MAP = {
    "div": 0x01,
    "span": 0x02,
    "p": 0x03,
    "a": 0x04,
    "h1": 0x05,
    "img": 0x06
}

ATTR_MAP = {
    "class": 0x10,
    "id": 0x11,
    "href": 0x12,
    "src": 0x13,
    "style": 0x14
}


def serialize_node(tag: str, attrs: dict | None = None, text: str = "", children: list | None = None) -> bytes:
    if attrs is None:
        attrs = {}
    if children is None:
        children = []

    tag_byte = TAG_MAP[tag]
    num_attrs = len(attrs)
    num_children = len(children)

    text_bytes = text.encode("utf-8")
    text_len = len(text_bytes)

    # Header: Tag (1B), NumAttrs (1B), NumChildren (1B), TextLen (2B, Big Endian)
    data = struct.pack(">BBBH", tag_byte, num_attrs, num_children, text_len)

    # Attributes
    for k, v in attrs.items():
        attr_id = ATTR_MAP[k]
        val_bytes = v.encode("utf-8")
        val_len = len(val_bytes)
        data += struct.pack(">BB", attr_id, val_len) + val_bytes

    # Text Content
    if text_len > 0:
        data += text_bytes

    # Children
    for child in children:
        data += child

    return data


def main():
    dest_dir = Path(__file__).resolve().parent
    output_path = dest_dir / "page.bml"

    print("⚡ Generiere binäre BML-Struktur…")

    # 1. Bild-Node
    node_img = serialize_node(
        tag="img",
        attrs={"src": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800"}
    )

    # 2. Link-Node
    node_link = serialize_node(
        tag="a",
        attrs={
            "href": "https://github.com/Luiguard",
            "style": "color: #38bdf8; text-decoration: underline;"
        },
        text="Entwickelt von Benjamin Leimer"
    )

    # 3. Absatz-Node
    node_p = serialize_node(
        tag="p",
        text="Dieses Dokument wurde vollkommen ohne textbasiertes HTML übertragen. Der Browser-Polyfill lädt die binären Bytes der page.bml-Datei und übersetzt die komprimierte Blockstruktur direkt in den DOM-Baum des Browsers. Das spart Bandbreite und CPU-Parsingzeit."
    )

    # 4. H1 Titel-Node
    node_h1 = serialize_node(
        tag="h1",
        text="Binary Markup Language (BML) Prototyp"
    )

    # 5. Root Container-Node
    node_root = serialize_node(
        tag="div",
        attrs={"style": "display: flex; flex-direction: column; gap: 1.5rem;"},
        children=[node_h1, node_p, node_img, node_link]
    )

    # Schreibvorgang
    output_path.write_bytes(node_root)
    print(f"✅ Datei erfolgreich erzeugt: {output_path.name} ({len(node_root)} Bytes)")


if __name__ == "__main__":
    main()
