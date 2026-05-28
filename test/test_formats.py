#!/usr/bin/env python3
"""Unit tests for individual binary format serializers"""
import sys, struct
sys.path.insert(0, '..')
import binary_formats as bf

def test_tag_consistency():
    for tag_name, tag_byte in bf.TAG.items():
        assert bf.TAG_REV[tag_byte] == tag_name, f"TAG_REV mismatch for {tag_name}"
    print(f"  ✓ tag_consistency: {len(bf.TAG)} tags bidirectional")

def test_attr_consistency():
    for attr_name, attr_byte in bf.ATTR.items():
        assert bf.ATTR_REV[attr_byte] == attr_name, f"ATTR_REV mismatch for {attr_name}"
    print(f"  ✓ attr_consistency: {len(bf.ATTR)} attrs bidirectional")

def test_bml_magic():
    dom = bf.html_to_dom('<p>x</p>')
    bml = bf.serialize_bml(dom)
    assert bml[:4] == bf.BML_MAGIC, f"BML magic: {bml[:4]}"
    print("  ✓ bml_magic")

def test_bdt_magic():
    dom = bf.html_to_dom('<p>x</p>')
    bdt = bf.serialize_bdt(dom)
    assert bdt[:4] == bf.BDT_MAGIC, f"BDT magic: {bdt[:4]}"
    print("  ✓ bdt_magic")

def test_blb_magic():
    dom = bf.html_to_dom('<p>x</p>')
    blb = bf.serialize_blb(dom)
    assert blb[:4] == bf.BLB_MAGIC, f"BLB magic: {blb[:4]}"
    print("  ✓ blb_magic")

def test_blb_block_size():
    html = '<div><p>A</p><p>B</p></div>'
    dom = bf.html_to_dom(html)
    blb = bf.serialize_blb(dom)
    count = struct.unpack('>I', blb[4:8])[0]
    expected = 4 + 4 + count * 60
    assert len(blb) == expected, f"BLB size {len(blb)} != {expected} ({count} blocks)"
    print(f"  ✓ blb_block_size: {count} × 60 bytes")

def test_bdt_node_size():
    html = '<div><span>X</span></div>'
    dom = bf.html_to_dom(html)
    bdt = bf.serialize_bdt(dom)
    count = struct.unpack('>I', bdt[4:8])[0]
    expected = 4 + 4 + count * 11
    assert len(bdt) == expected, f"BDT size {len(bdt)} != {expected}"
    print(f"  ✓ bdt_node_size: {count} × 11 bytes")

def test_bdt_parent_links():
    html = '<div><p>A</p><p>B</p></div>'
    dom = bf.html_to_dom(html)
    bdt = bf.serialize_bdt(dom)
    count = struct.unpack('>I', bdt[4:8])[0]

    nodes = []
    for i in range(count):
        off = 8 + i * 11
        nid = struct.unpack('>H', bdt[off:off+2])[0]
        pid = struct.unpack('>H', bdt[off+2:off+4])[0]
        nodes.append((nid, pid))

    assert nodes[0][1] == 0xFFFF, "Root parent should be 0xFFFF"
    for nid, pid in nodes[1:]:
        assert pid < count, f"Node {nid} has invalid parent {pid}"
    print(f"  ✓ bdt_parent_links: {count} nodes validated")

def test_bib_roundtrip():
    pixels = bytes([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 128, 128, 128, 255])
    img = {'id': 42, 'w': 2, 'h': 2, 'rgba_data': pixels}
    bib = bf.serialize_bib([img])

    assert bib[:3] == b'BIB', f"BIB magic: {bib[:3]}"
    img_count = struct.unpack('>I', bib[4:8])[0]
    assert img_count == 1

    img_id = struct.unpack('>I', bib[8:12])[0]
    assert img_id == 42, f"Image ID: {img_id}"
    w = struct.unpack('>H', bib[12:14])[0]
    h = struct.unpack('>H', bib[14:16])[0]
    assert w == 2 and h == 2
    data_len = struct.unpack('>I', bib[26:30])[0]
    assert data_len == 16, f"Data length: {data_len}"
    assert bib[30:30+16] == pixels, "Pixel data mismatch"
    print("  ✓ bib_roundtrip: 2×2 RGBA verified")

def test_parse_css_value():
    assert bf._parse_css_value('16px') == 160
    assert bf._parse_css_value('1.5rem') == 240
    assert bf._parse_css_value('auto') == 0xFFFF
    assert bf._parse_css_value('50%') == (500 | 0x8000)
    assert bf._parse_css_value('0') == 0
    assert bf._parse_css_value('') == 0
    assert bf._parse_css_value(None) == 0
    print("  ✓ parse_css_value: all formats")

def test_parse_color():
    assert bf._parse_color('#ff0000') == 0xFF0000FF
    assert bf._parse_color('#f00') == 0xFF0000FF
    assert bf._parse_color('rgb(0, 128, 255)') == 0x0080FFFF
    assert bf._parse_color('rgba(255, 0, 0, 0.5)') == 0xFF00007F
    assert bf._parse_color('transparent') == 0
    assert bf._parse_color('black') == 0x000000FF
    assert bf._parse_color('white') == 0xFFFFFFFF
    print("  ✓ parse_color: hex/rgb/rgba/named")

def test_negative_margins():
    html = '<div style="margin-top: -10px; margin-left: -5px">X</div>'
    dom = bf.html_to_dom(html)
    blb = bf.serialize_blb(dom)
    off = 8 + 1 * 60
    mt = struct.unpack('>h', blb[off+9:off+11])[0]
    ml = struct.unpack('>h', blb[off+15:off+17])[0]
    assert mt == -100, f"margin-top: {mt}"
    assert ml == -50, f"margin-left: {ml}"
    print("  ✓ negative_margins: Int16 correct")

def test_void_elements():
    html = '<div><br><hr><img src="x.png"><input type="text"></div>'
    dom = bf.html_to_dom(html)
    div = dom.children[0]
    assert len(div.children) == 4, f"Expected 4 children, got {len(div.children)}"
    assert div.children[0].tag == 'br'
    assert div.children[1].tag == 'hr'
    assert div.children[2].tag == 'img'
    assert div.children[3].tag == 'input'
    print("  ✓ void_elements: br, hr, img, input parsed correctly")

if __name__ == '__main__':
    print("Running BWEB Format Unit Tests...\n")
    test_tag_consistency()
    test_attr_consistency()
    test_bml_magic()
    test_bdt_magic()
    test_blb_magic()
    test_blb_block_size()
    test_bdt_node_size()
    test_bdt_parent_links()
    test_bib_roundtrip()
    test_parse_css_value()
    test_parse_color()
    test_negative_margins()
    test_void_elements()
    print(f"\nAll tests passed ✓")
