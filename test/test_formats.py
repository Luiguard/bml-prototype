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
    expected = 4 + 4 + count * 96
    assert len(blb) == expected, f"BLB size {len(blb)} != {expected} ({count} blocks)"
    print(f"  ✓ blb_block_size: {count} × 96 bytes (v2)")

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

def test_bvs_roundtrip():
    import os
    if not os.path.exists('dummy.mp4'):
        print("  ! bvs_roundtrip: skipped (no dummy.mp4)")
        return
    videos = [{'id': 7, 'path': 'dummy.mp4'}]
    bvs = bf.serialize_bvs(videos)
    if not bvs:
        print("  ! bvs_roundtrip: skipped (no av module)")
        return
        
    assert bvs[:3] == b'BVS', f"BVS magic: {bvs[:3]}"
    vid_count = struct.unpack('>I', bvs[4:8])[0]
    assert vid_count == 1
    
    vid_id = struct.unpack('>I', bvs[8:12])[0]
    assert vid_id == 7
    w = struct.unpack('>H', bvs[12:14])[0]
    h = struct.unpack('>H', bvs[14:16])[0]
    assert w > 0 and h > 0
    codec_len = bvs[16]
    codec = bvs[17:17+codec_len].decode('ascii')
    assert codec.startswith('avc1.')
    
    offset = 17 + codec_len
    chunk_count = struct.unpack('>I', bvs[offset:offset+4])[0]
    assert chunk_count > 0
    print(f"  ✓ bvs_roundtrip: 1 video, {w}x{h}, {codec}, {chunk_count} chunks")

def test_bas_roundtrip():
    import os
    if not os.path.exists('dummy.mp4'):
        print("  ! bas_roundtrip: skipped (no dummy.mp4)")
        return
    audios = [{'id': 8, 'path': 'dummy.mp4'}]
    bas = bf.serialize_bas(audios)
    if not bas:
        print("  ! bas_roundtrip: skipped (no av module or no audio track)")
        return
        
    assert bas[:3] == b'BAS', f"BAS magic: {bas[:3]}"
    aud_count = struct.unpack('>I', bas[4:8])[0]
    assert aud_count == 1
    
    aud_id = struct.unpack('>I', bas[8:12])[0]
    assert aud_id == 8
    
    codec_len = bas[12]
    codec = bas[13:13+codec_len].decode('ascii')
    offset = 13 + codec_len
    
    sample_rate = struct.unpack('>I', bas[offset:offset+4])[0]
    channels = bas[offset+4]
    chunk_count = struct.unpack('>I', bas[offset+5:offset+9])[0]
    
    assert chunk_count > 0
    print(f"  ✓ bas_roundtrip: 1 audio, {codec}, {sample_rate}Hz, {channels}ch, {chunk_count} chunks")

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
    off = 8 + 1 * 96
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

def test_blb_v2_extended():
    html = '<div style="text-decoration:underline; cursor:pointer; white-space:nowrap; min-width:100px; max-width:500px; flex-grow:2; box-shadow:2px 4px 6px black; font-style:italic">X</div>'
    dom = bf.html_to_dom(html)
    blb = bf.serialize_blb(dom)
    assert blb[:3] == b'BLB', f"BLB magic: {blb[:3]}"
    assert blb[3] == 0x02, f"BLB version: {blb[3]} (expected 2)"
    count = struct.unpack('>I', blb[4:8])[0]
    
    off = 8 + 1 * 96
    td = blb[off + 60]
    assert td == 1, f"text-decoration: {td} (expected 1=underline)"
    cur = blb[off + 61]
    assert cur == 1, f"cursor: {cur} (expected 1=pointer)"
    ws = blb[off + 62]
    assert ws == 1, f"white-space: {ws} (expected 1=nowrap)"
    
    min_w = struct.unpack('>H', blb[off+64:off+66])[0]
    assert min_w == 1000, f"min-width: {min_w} (expected 1000=100px×10)"
    max_w = struct.unpack('>H', blb[off+66:off+68])[0]
    assert max_w == 5000, f"max-width: {max_w} (expected 5000=500px×10)"
    
    fg = struct.unpack('>H', blb[off+72:off+74])[0]
    assert fg == 200, f"flex-grow: {fg} (expected 200=2.0×100)"
    
    shadow_color = struct.unpack('>I', blb[off+80:off+84])[0]
    assert shadow_color == 0x000000FF, f"box-shadow-color: {shadow_color:#010x}"
    shadow_x = struct.unpack('>h', blb[off+84:off+86])[0]
    assert shadow_x == 20, f"box-shadow-x: {shadow_x} (expected 20=2px×10)"
    
    fs = blb[off + 94]
    assert fs == 1, f"font-style: {fs} (expected 1=italic)"
    print(f"  ✓ blb_v2_extended: text-decoration, cursor, min/max, flex-grow, box-shadow, font-style")

def test_bfs_roundtrip():
    fonts = [{
        'id': 0,
        'family': 'MyFont',
        'weight': 700,
        'style': 'italic',
        'format': 'woff2',
        'data': b'mock_woff2_data'
    }]
    bfs_data = bf.serialize_bfs(fonts)
    assert bfs_data[:4] == b'BFS\x01'
    
    count = struct.unpack('>I', bfs_data[4:8])[0]
    assert count == 1
    
    off = 8
    fid = struct.unpack('>H', bfs_data[off:off+2])[0]
    assert fid == 0
    off += 2
    
    fam_len = bfs_data[off]
    off += 1
    family = bfs_data[off:off+fam_len].decode('utf-8')
    assert family == 'MyFont'
    off += fam_len
    
    weight = struct.unpack('>H', bfs_data[off:off+2])[0]
    assert weight == 700
    off += 2
    
    style = bfs_data[off]
    assert style == 1  # 1 = italic
    off += 1
    
    fmt = bfs_data[off]
    assert fmt == 0  # 0 = woff2
    off += 1
    
    data_len = struct.unpack('>I', bfs_data[off:off+4])[0]
    assert data_len == len(b'mock_woff2_data')
    off += 4
    
    data = bfs_data[off:off+data_len]
    assert data == b'mock_woff2_data'
    print(f"  ✓ bfs_roundtrip: 1 font, {family}, 700 italic")

def test_bam_roundtrip():
    anims = [{
        'id': 0,
        'type': 1,
        'name': 'spin',
        'duration': 1000,
        'delay': 0,
        'timing': 'linear',
        'iterations': 'infinite',
        'direction': 'normal',
        'fill': 'none',
        'keyframes': [
            {'pct': 0, 'props': [{'name': 'transform:rotate', 'value': '0deg'}]},
            {'pct': 100, 'props': [{'name': 'transform:rotate', 'value': '360deg'}]}
        ]
    }]
    bam_data = bf.serialize_bam(anims)
    assert bam_data[:4] == b'BAM\x01'
    
    count = struct.unpack('>I', bam_data[4:8])[0]
    assert count == 1
    
    # 8 = id, 9 = type, 10 = nameLen
    off = 8
    assert bam_data[off] == 0  # id
    off += 1
    assert bam_data[off] == 1  # type
    off += 1
    nl = bam_data[off]
    assert nl == 4
    off += 1
    name = bam_data[off:off+nl].decode('ascii')
    assert name == 'spin'
    off += nl
    dur = struct.unpack('>I', bam_data[off:off+4])[0]
    assert dur == 1000
    off += 4
    del_ = struct.unpack('>I', bam_data[off:off+4])[0]
    assert del_ == 0
    off += 4
    timing = bam_data[off]
    assert timing == 1  # linear
    off += 1
    iters = struct.unpack('>H', bam_data[off:off+2])[0]
    assert iters == 0xFFFF  # infinite
    off += 2
    direction = bam_data[off]
    assert direction == 0  # normal
    off += 1
    fill = bam_data[off]
    assert fill == 0  # none
    off += 1
    
    kf_count = struct.unpack('>H', bam_data[off:off+2])[0]
    assert kf_count == 2
    off += 2
    
    pct0 = bam_data[off]
    assert pct0 == 0
    off += 1
    propC0 = bam_data[off]
    assert propC0 == 1
    off += 1
    pid0 = bam_data[off]
    assert pid0 == 4  # transform:rotate
    off += 1
    vlen0 = struct.unpack('>H', bam_data[off:off+2])[0]
    assert vlen0 == 4
    off += 2
    val0 = bam_data[off:off+vlen0].decode('utf-8')
    assert val0 == '0deg'
    print(f"  ✓ bam_roundtrip: 1 anim, spin, 2 keyframes, linear infinite")

def test_brs_roundtrip():
    queries = [{
        'query': '(max-width: 600px)',
        'blocks': [{
            'id': 1,
            'style': 'background-color: red;',
            'default_display': 0
        }]
    }]
    brs_data = bf.serialize_brs(queries)
    assert brs_data[:4] == b'BRS\x01'
    
    count = struct.unpack('>I', brs_data[4:8])[0]
    assert count == 1
    
    off = 8
    qlen = brs_data[off]
    assert qlen == len('(max-width: 600px)')
    off += 1
    qstr = brs_data[off:off+qlen].decode('ascii')
    assert qstr == '(max-width: 600px)'
    off += qlen
    
    bcount = struct.unpack('>I', brs_data[off:off+4])[0]
    assert bcount == 1
    off += 4
    
    # Check block size = 96
    assert len(brs_data) - off == 96
    
    # bg_color is at offset 33 of block
    bg_color = struct.unpack('>I', brs_data[off+33:off+37])[0]
    assert bg_color == 0xFF0000FF
    print(f"  ✓ brs_roundtrip: 1 query, 1 block override")

def test_bsg_roundtrip():
    graphics = [{
        'id': 1,
        'width': 100,
        'height': 100,
        'paths': [
            {'fill': 'red', 'stroke': 'black', 'stroke_width': '2px', 'd': 'M10 10 L90 90 Z'}
        ]
    }]
    bsg_data = bf.serialize_bsg(graphics)
    assert bsg_data[:4] == b'BSG\x01'
    
    count = struct.unpack('>I', bsg_data[4:8])[0]
    assert count == 1
    
    off = 8
    gid = struct.unpack('>I', bsg_data[off:off+4])[0]
    assert gid == 1
    off += 4
    
    w = struct.unpack('>H', bsg_data[off:off+2])[0]
    assert w == 100
    off += 2
    
    h = struct.unpack('>H', bsg_data[off:off+2])[0]
    assert h == 100
    off += 2
    
    pcount = struct.unpack('>H', bsg_data[off:off+2])[0]
    assert pcount == 1
    off += 2
    
    fill = struct.unpack('>I', bsg_data[off:off+4])[0]
    assert fill == 0xFF0000FF
    off += 4
    
    stroke = struct.unpack('>I', bsg_data[off:off+4])[0]
    assert stroke == 0x000000FF
    off += 4
    
    sw = struct.unpack('>H', bsg_data[off:off+2])[0]
    assert sw == 20
    off += 2
    
    dlen = struct.unpack('>I', bsg_data[off:off+4])[0]
    assert dlen == 15
    off += 4
    
    d = bsg_data[off:off+dlen].decode('ascii')
    assert d == 'M10 10 L90 90 Z'
    print(f"  ✓ bsg_roundtrip: 1 graphic, 1 path, 100x100")

def test_bjs_roundtrip():
    scripts = [{
        'id': 1,
        'content': 'console.log("hello");'
    }]
    bjs_data = bf.serialize_bjs(scripts)
    assert bjs_data[:4] == b'BJS\x01'
    
    count = struct.unpack('>I', bjs_data[4:8])[0]
    assert count == 1
    
    off = 8
    sid = struct.unpack('>I', bjs_data[off:off+4])[0]
    assert sid == 1
    off += 4
    
    clen = struct.unpack('>I', bjs_data[off:off+4])[0]
    assert clen == len('console.log("hello");')
    off += 4
    
    c = bjs_data[off:off+clen].decode('utf-8')
    assert c == 'console.log("hello");'
    print(f"  ✓ bjs_roundtrip: 1 script, {clen} bytes")

def test_bpr_roundtrip():
    routes = [{
        'id': 1,
        'path': '/about',
        'node_id': 5
    }]
    bpr_data = bf.serialize_bpr(routes)
    assert bpr_data[:4] == b'BPR\x01'
    
    count = struct.unpack('>I', bpr_data[4:8])[0]
    assert count == 1
    
    off = 8
    rid = struct.unpack('>H', bpr_data[off:off+2])[0]
    assert rid == 1
    off += 2
    
    plen = bpr_data[off]
    assert plen == len('/about')
    off += 1
    
    p = bpr_data[off:off+plen].decode('ascii')
    assert p == '/about'
    off += plen
    
    nid = struct.unpack('>H', bpr_data[off:off+2])[0]
    assert nid == 5
    print(f"  ✓ bpr_roundtrip: 1 route, /about -> node 5")

def test_bcs_roundtrip():
    # Simulate a DOM structure where 2 nodes share the same style
    class DummyDOM:
        def __init__(self):
            self.tag = 'div'
            self.attrs = {'style': 'color: red;'}
            self.children = [
                type('Child', (), {'tag': 'span', 'attrs': {'style': 'color: red;'}, 'children': []})(),
                type('Child', (), {'tag': 'span', 'attrs': {'style': 'color: blue;'}, 'children': []})()
            ]
    dom = DummyDOM()
    bcs_data = bf.serialize_bcs(dom)
    
    assert bcs_data[:4] == b'BCS\x01'
    unique_count = struct.unpack('>I', bcs_data[4:8])[0]
    map_count = struct.unpack('>I', bcs_data[8:12])[0]
    
    print("BCS Data length:", len(bcs_data), "Unique count:", unique_count)
    assert unique_count == 3
    assert map_count == 3
    print(f"  ✓ bcs_roundtrip: {unique_count} unique blocks, {map_count} mapped nodes")

def test_bwa_roundtrip():
    wasms = [{'id': 1, 'name': 'math', 'data': b'\x00asm\x01\x00\x00\x00'}]
    bwa_data = bf.serialize_bwa(wasms)
    assert bwa_data[:4] == b'BWA\x01'
    assert bwa_data[4] == 1 # count
    assert bwa_data[5] == 1 # id
    print(f"  ✓ bwa_roundtrip: 1 wasm module, {len(wasms[0]['data'])} bytes")

def test_b3d_roundtrip():
    shaders = [{'id': 2, 'type': 1, 'data': 'void main() {}'}]
    b3d_data = bf.serialize_b3d(shaders)
    assert b3d_data[:4] == b'B3D\x01'
    assert b3d_data[4] == 1 # count
    assert b3d_data[5] == 2 # id
    assert b3d_data[6] == 1 # type (fragment)
    print(f"  ✓ b3d_roundtrip: 1 shader, fragment type")

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
    test_bvs_roundtrip()
    test_bas_roundtrip()
    test_bfs_roundtrip()
    test_bam_roundtrip()
    test_brs_roundtrip()
    test_bsg_roundtrip()
    test_bjs_roundtrip()
    test_bpr_roundtrip()
    test_bcs_roundtrip()
    test_bwa_roundtrip()
    test_b3d_roundtrip()
    test_parse_css_value()
    test_parse_color()
    test_negative_margins()
    test_void_elements()
    test_blb_v2_extended()
    print(f"\nAll tests passed ✓")
