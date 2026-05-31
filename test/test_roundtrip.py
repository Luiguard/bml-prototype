#!/usr/bin/env python3
"""Roundtrip Tests: HTML → BWEB → Unbundle → Verify"""
import sys, struct
sys.path.insert(0, '..')
import binary_formats as bf

def test_roundtrip_simple():
    html = '<div><h1>Test</h1><p>Hello World</p></div>'
    bweb = bf.html_to_bweb(html)

    assert bweb[:4] == b'BWEB', f"Wrong magic: {bweb[:4]}"
    assert bweb[4] == 1, f"Wrong version: {bweb[4]}"
    assert bweb[5] == 3, f"Expected 3 sections, got {bweb[5]}"

    sections = bf.unbundle_bweb(bweb)
    assert 1 in sections, "Missing BML section"
    assert 2 in sections, "Missing BDT section"
    assert 3 in sections, "Missing BLB section"

    bml = sections[1]
    assert bml[:3] == b'BML', f"BML magic wrong: {bml[:3]}"
    assert bml[3] == 2, f"BML version wrong: {bml[3]}"

    bdt = sections[2]
    assert bdt[:3] == b'BDT', f"BDT magic wrong: {bdt[:3]}"
    node_count = struct.unpack('>I', bdt[4:8])[0]
    assert node_count >= 3, f"Expected ≥3 BDT nodes, got {node_count}"

    blb = sections[3]
    assert blb[:3] == b'BLB', f"BLB magic wrong: {blb[:3]}"
    blb_count = struct.unpack('>I', blb[4:8])[0]
    assert blb_count == node_count, f"BLB count {blb_count} != BDT count {node_count}"

    blb_expected_size = 4 + 4 + blb_count * 60
    assert len(blb) == blb_expected_size, f"BLB size {len(blb)} != expected {blb_expected_size}"

    print(f"  ✓ roundtrip_simple: {len(bweb)} bytes, {node_count} nodes")

def test_roundtrip_empty():
    html = '<div></div>'
    bweb = bf.html_to_bweb(html)
    sections = bf.unbundle_bweb(bweb)
    bdt = sections[2]
    node_count = struct.unpack('>I', bdt[4:8])[0]
    assert node_count >= 1, "Empty div should produce at least 1 node"
    print(f"  ✓ roundtrip_empty: {node_count} nodes")

def test_roundtrip_attributes():
    html = '<a href="https://example.com" class="link" id="main-link">Click</a>'
    dom = bf.html_to_dom(html)
    bml = bf.serialize_bml(dom)
    assert b'https://example.com' in bml, "href not in BML"
    assert b'link' in bml, "class not in BML"
    assert b'main-link' in bml, "id not in BML"
    assert b'Click' in bml, "text not in BML"
    print("  ✓ roundtrip_attributes: all attrs preserved")

def test_roundtrip_unicode():
    html = '<p>Ünïcödé: 日本語 العربية 🚀</p>'
    bweb = bf.html_to_bweb(html)
    sections = bf.unbundle_bweb(bweb)
    bml = sections[1]
    assert 'Ünïcödé'.encode('utf-8') in bml, "Unicode not preserved"
    assert '日本語'.encode('utf-8') in bml, "Japanese not preserved"
    assert '🚀'.encode('utf-8') in bml, "Emoji not preserved"
    print("  ✓ roundtrip_unicode: UTF-8 preserved")

def test_roundtrip_deep_nesting():
    html = '<div>' * 50 + '<p>Deep</p>' + '</div>' * 50
    bweb = bf.html_to_bweb(html)
    sections = bf.unbundle_bweb(bweb)
    bdt = sections[2]
    node_count = struct.unpack('>I', bdt[4:8])[0]
    assert node_count >= 51, f"Deep nesting: expected ≥51 nodes, got {node_count}"

    last_node_offset = 8 + (node_count - 1) * 11
    depth = bdt[last_node_offset + 10]
    assert depth <= 255, f"Depth overflow: {depth}"
    print(f"  ✓ roundtrip_deep_nesting: {node_count} nodes, max depth {depth}")

def test_roundtrip_many_children():
    items = ''.join(f'<li>Item {i}</li>' for i in range(100))
    html = f'<ul>{items}</ul>'
    bweb = bf.html_to_bweb(html)
    sections = bf.unbundle_bweb(bweb)
    bdt = sections[2]
    node_count = struct.unpack('>I', bdt[4:8])[0]
    assert node_count >= 101, f"Expected ≥101 nodes, got {node_count}"
    print(f"  ✓ roundtrip_many_children: {node_count} nodes")

def test_bweb_with_bib():
    html = '<div>Test</div>'
    img_data = bytes([255, 0, 0, 255] * 4)
    img = {'id': 0, 'w': 2, 'h': 2, 'rgba_data': img_data}
    bib = bf.serialize_bib([img])
    bweb = bf.html_to_bweb(html, bib=bib)

    sections = bf.unbundle_bweb(bweb)
    assert 4 in sections, "Missing BIB section"
    assert bweb[5] == 4, f"Expected 4 sections, got {bweb[5]}"

    bib_sec = sections[4]
    assert bib_sec[:3] == b'BIB', f"BIB magic wrong: {bib_sec[:3]}"
    img_count = struct.unpack('>I', bib_sec[4:8])[0]
    assert img_count == 1, f"Expected 1 image, got {img_count}"
    print(f"  ✓ bweb_with_bib: {len(bib_sec)} bytes, {img_count} image(s)")

def test_stats():
    html = '<div><p>Stats test</p></div>'
    bweb = bf.html_to_bweb(html)
    stats = bf.bweb_stats(bweb)

    assert stats['total_bytes'] == len(bweb)
    assert stats['bml_bytes'] > 0
    assert stats['bdt_bytes'] > 0
    assert stats['blb_bytes'] > 0
    assert stats['bdt_nodes'] >= 2
    assert stats['blb_blocks'] == stats['bdt_nodes']
    print(f"  ✓ stats: {stats['total_bytes']} total, {stats['bdt_nodes']} nodes")

if __name__ == '__main__':
    print("Running BWEB Roundtrip Tests...\n")
    test_roundtrip_simple()
    test_roundtrip_empty()
    test_roundtrip_attributes()
    test_roundtrip_unicode()
    test_roundtrip_deep_nesting()
    test_roundtrip_many_children()
    test_bweb_with_bib()
    test_stats()
    print(f"\nAll tests passed ✓")
