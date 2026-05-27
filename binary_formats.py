#!/usr/bin/env python3
"""Binary Web Formats: BML, BDT, BLB, BWEB
Benjamin Leimer – 2026 – Custom Attribution License

Formate:
  BML  Binary Markup Language   – Inhalt (Tags, Attribute, Text)
  BDT  Binary DOM Tree          – Baumstruktur (Parent/Child/Sibling-Links)
  BLB  Binary Layout Blocks     – Layout/CSS (Box-Model, Flexbox, Farben)
  BWEB Container                – Bündelt BML+BDT+BLB in eine Datei
"""
import struct, sys, json
from pathlib import Path
from html.parser import HTMLParser

# ═══════════════════════════════════════════════════════════════
#  Konstantenregister
# ═══════════════════════════════════════════════════════════════

BML_MAGIC = b'BML\x02'
BDT_MAGIC = b'BDT\x01'
BLB_MAGIC = b'BLB\x01'
BWEB_MAGIC = b'BWEB'
BWEB_VERSION = 1

SEC_BML = 1
SEC_BDT = 2
SEC_BLB = 3

TAG = {
    'div':0x01,'span':0x02,'p':0x03,'a':0x04,
    'h1':0x05,'h2':0x06,'h3':0x07,'h4':0x08,'h5':0x09,'h6':0x0A,
    'img':0x0B,'ul':0x0C,'ol':0x0D,'li':0x0E,
    'table':0x0F,'tr':0x10,'td':0x11,'th':0x12,'thead':0x13,'tbody':0x14,
    'form':0x15,'input':0x16,'button':0x17,'textarea':0x18,
    'select':0x19,'option':0x1A,'label':0x1B,
    'header':0x1C,'footer':0x1D,'nav':0x1E,'main':0x1F,
    'section':0x20,'article':0x21,'aside':0x22,
    'strong':0x23,'em':0x24,'code':0x25,'pre':0x26,
    'br':0x27,'hr':0x28,'video':0x29,'audio':0x2A,
    'canvas':0x2B,'svg':0x2C,'iframe':0x2D,
    'figcaption':0x2E,'figure':0x2F,'blockquote':0x30,
    'small':0x31,'sub':0x32,'sup':0x33,
    'details':0x34,'summary':0x35,'dialog':0x36,
    'dl':0x37,'dt':0x38,'dd':0x39,'mark':0x3A,
    'time':0x3B,'abbr':0x3C,'cite':0x3D,'b':0x3E,'i':0x3F,'u':0x40,
    'body':0xFE,'html':0xFF,
}
TAG_REV = {v: k for k, v in TAG.items()}

ATTR = {
    'class':0x10,'id':0x11,'href':0x12,'src':0x13,
    'style':0x14,'type':0x15,'name':0x16,'value':0x17,
    'placeholder':0x18,'alt':0x19,'title':0x1A,
    'action':0x1B,'method':0x1C,'target':0x1D,
    'rel':0x1E,'role':0x1F,'aria-label':0x20,
    'data-bind':0x21,'onclick':0x22,'onsubmit':0x23,
    'width':0x24,'height':0x25,'disabled':0x26,
    'checked':0x27,'selected':0x28,'required':0x29,
    'autofocus':0x2A,'autocomplete':0x2B,
    'min':0x2C,'max':0x2D,'step':0x2E,
    'pattern':0x2F,'for':0x30,'tabindex':0x31,
    'content':0x32,'charset':0x33,'http-equiv':0x34,
    'lang':0x35,'dir':0x36,'hidden':0x37,
}
ATTR_REV = {v: k for k, v in ATTR.items()}

INLINE_TAGS = {'span','a','strong','em','code','small','sub','sup','b','i','u',
               'label','abbr','cite','mark','time','br'}

# BLB Block: 60 Bytes fix
BLB_BLOCK_SIZE = 60

# ═══════════════════════════════════════════════════════════════
#  DOMNode
# ═══════════════════════════════════════════════════════════════

class DOMNode:
    __slots__ = ('tag','attrs','text','children','node_id','parent_id')
    def __init__(self, tag='div', attrs=None, text='', children=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.text = text
        self.children = children or []
        self.node_id = 0
        self.parent_id = 0xFFFF

# ═══════════════════════════════════════════════════════════════
#  HTML → DOMNode Parser
# ═══════════════════════════════════════════════════════════════

class _HTMLToDOMParser(HTMLParser):
    VOID = {'br','hr','img','input','meta','link','area','base','col','embed',
            'param','source','track','wbr'}

    def __init__(self):
        super().__init__()
        self.root = DOMNode('body')
        self._stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = DOMNode(tag, dict(attrs))
        self._stack[-1].children.append(node)
        if tag not in self.VOID:
            self._stack.append(node)

    def handle_endtag(self, tag):
        if len(self._stack) > 1 and self._stack[-1].tag == tag:
            self._stack.pop()

    def handle_data(self, data):
        text = data.strip()
        if text and self._stack:
            parent = self._stack[-1]
            if parent.children and not parent.text:
                parent.text = text
            elif not parent.children:
                parent.text = (parent.text + ' ' + text).strip() if parent.text else text
            else:
                span = DOMNode('span', text=text)
                parent.children.append(span)


def html_to_dom(html_str: str) -> DOMNode:
    parser = _HTMLToDOMParser()
    parser.feed(html_str)
    return parser.root

# ═══════════════════════════════════════════════════════════════
#  BML Serializer (v2)
# ═══════════════════════════════════════════════════════════════

def _u8(v):  return struct.pack('>B', v & 0xFF)
def _u16(v): return struct.pack('>H', v & 0xFFFF)
def _u32(v): return struct.pack('>I', v & 0xFFFFFFFF)
def _i16(v): return struct.pack('>h', max(-32768, min(32767, v)))


def serialize_bml(root: DOMNode) -> bytes:
    buf = bytearray(BML_MAGIC)
    _bml_node(buf, root)
    return bytes(buf)


def _bml_node(buf, node):
    tag_byte = TAG.get(node.tag, 0x01)
    filtered = [(ATTR.get(k), v) for k, v in node.attrs.items() if ATTR.get(k) is not None]
    text_b = node.text.encode('utf-8') if node.text else b''

    buf.append(tag_byte)
    buf.append(len(filtered))
    buf += _u16(len(node.children))
    buf += _u16(len(text_b))

    for attr_id, attr_val in filtered:
        val_b = str(attr_val).encode('utf-8') if attr_val is not None else b''
        buf.append(attr_id)
        buf += _u16(len(val_b))
        buf += val_b

    buf += text_b
    for child in node.children:
        _bml_node(buf, child)

# ═══════════════════════════════════════════════════════════════
#  BDT Serializer
# ═══════════════════════════════════════════════════════════════

def _flatten_tree(node, result, parent_id=0xFFFF):
    idx = len(result)
    node.node_id = idx
    node.parent_id = parent_id
    result.append(node)
    for child in node.children:
        _flatten_tree(child, result, idx)


def serialize_bdt(root: DOMNode) -> bytes:
    flat = []
    _flatten_tree(root, flat)

    buf = bytearray(BDT_MAGIC)
    buf += _u32(len(flat))

    for i, node in enumerate(flat):
        first_child = 0xFFFF
        next_sibling = 0xFFFF

        for j, n in enumerate(flat):
            if n.parent_id == i:
                first_child = j
                break

        found_self = False
        for j, n in enumerate(flat):
            if j == i:
                found_self = True
                continue
            if found_self and n.parent_id == node.parent_id:
                next_sibling = j
                break

        depth = 0
        pid = node.parent_id
        while pid != 0xFFFF and depth < 255:
            depth += 1
            pid = flat[pid].parent_id

        buf += _u16(i)
        buf += _u16(node.parent_id)
        buf += _u16(first_child)
        buf += _u16(next_sibling)
        buf.append(1)  # node_type=element
        buf.append(TAG.get(node.tag, 0x01))
        buf.append(depth)

    return bytes(buf)

# ═══════════════════════════════════════════════════════════════
#  BLB Serializer
# ═══════════════════════════════════════════════════════════════

def _parse_css_value(val, default=0):
    if not val: return default
    val = val.strip().lower()
    if val == 'auto': return 0xFFFF
    try:
        if val.endswith('px'): return int(float(val[:-2]) * 10)
        if val.endswith('rem'): return int(float(val[:-3]) * 160)
        if val.endswith('em'): return int(float(val[:-2]) * 160)
        if val.endswith('%'): return int(float(val[:-1]) * 10) | 0x8000
        return int(float(val) * 10)
    except: return default


def _parse_color(val, default=0x000000FF):
    if not val: return default
    val = val.strip()
    if val.startswith('#'):
        h = val[1:]
        if len(h) == 3: h = ''.join(c*2 for c in h) + 'ff'
        elif len(h) == 6: h += 'ff'
        elif len(h) != 8: return default
        try: return int(h, 16)
        except: return default
    if val.startswith('rgb'):
        import re
        nums = re.findall(r'[\d.]+', val)
        if len(nums) >= 3:
            r,g,b = int(float(nums[0])), int(float(nums[1])), int(float(nums[2]))
            a = int(float(nums[3])*255) if len(nums) >= 4 and float(nums[3]) <= 1 else 255
            return (r<<24)|(g<<16)|(b<<8)|a
    named = {'transparent':0,'black':0x000000FF,'white':0xFFFFFFFF,
             'red':0xFF0000FF,'green':0x008000FF,'blue':0x0000FFFF,
             'gray':0x808080FF,'grey':0x808080FF,'yellow':0xFFFF00FF,
             'orange':0xFFA500FF,'purple':0x800080FF,'pink':0xFFC0CBFF,
             'cyan':0x00FFFFFF,'navy':0x000080FF,'teal':0x008080FF,
             'inherit':default,'initial':default,'unset':default}
    return named.get(val.lower(), default)


def _parse_inline_style(style_str):
    if not style_str: return {}
    result = {}
    for part in style_str.split(';'):
        part = part.strip()
        if ':' in part:
            k, v = part.split(':', 1)
            result[k.strip().lower()] = v.strip()
    return result


def _expand_shorthand(style):
    for prop in ['margin', 'padding']:
        val = style.get(prop)
        if not val: continue
        parts = val.split()
        if len(parts) == 1:
            for side in ['top','right','bottom','left']:
                style.setdefault(f'{prop}-{side}', parts[0])
        elif len(parts) == 2:
            style.setdefault(f'{prop}-top', parts[0])
            style.setdefault(f'{prop}-bottom', parts[0])
            style.setdefault(f'{prop}-right', parts[1])
            style.setdefault(f'{prop}-left', parts[1])
        elif len(parts) == 3:
            style.setdefault(f'{prop}-top', parts[0])
            style.setdefault(f'{prop}-right', parts[1])
            style.setdefault(f'{prop}-left', parts[1])
            style.setdefault(f'{prop}-bottom', parts[2])
        elif len(parts) >= 4:
            style.setdefault(f'{prop}-top', parts[0])
            style.setdefault(f'{prop}-right', parts[1])
            style.setdefault(f'{prop}-bottom', parts[2])
            style.setdefault(f'{prop}-left', parts[3])
    return style


DISPLAY_MAP = {'block':0,'inline':1,'flex':2,'grid':3,'none':4,'inline-block':5,'inline-flex':6}
POSITION_MAP = {'static':0,'relative':1,'absolute':2,'fixed':3,'sticky':4}
TEXTALIGN_MAP = {'left':0,'center':1,'right':2,'justify':3}
FLEXDIR_MAP = {'row':0,'column':1,'row-reverse':2,'column-reverse':3}
JUSTIFY_MAP = {'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'space-between':3,'space-around':4,'space-evenly':5}
ALIGN_MAP = {'flex-start':0,'start':0,'flex-end':1,'end':1,'center':2,'stretch':3,'baseline':4}
OVERFLOW_MAP = {'visible':0,'hidden':1,'scroll':2,'auto':3}


def serialize_blb(root: DOMNode) -> bytes:
    flat = []
    _flatten_nodes(root, flat)

    buf = bytearray(BLB_MAGIC)
    buf += _u32(len(flat))

    for i, node in enumerate(flat):
        style = _parse_inline_style(node.attrs.get('style', ''))
        style = _expand_shorthand(style)
        default_display = 1 if node.tag in INLINE_TAGS else 0
        _write_blb_block(buf, i, style, default_display)

    return bytes(buf)


def _flatten_nodes(node, result):
    result.append(node)
    for child in node.children:
        _flatten_nodes(child, result)


def _write_blb_block(buf, node_id, s, default_display):
    buf += _u16(node_id)
    buf.append(DISPLAY_MAP.get(s.get('display',''), default_display))
    buf.append(POSITION_MAP.get(s.get('position',''), 0))
    buf.append(1 if s.get('box-sizing','') == 'border-box' else 0)
    buf += _u16(_parse_css_value(s.get('width'), 0xFFFF))
    buf += _u16(_parse_css_value(s.get('height'), 0xFFFF))

    for side in ['top','right','bottom','left']:
        buf += _i16(_parse_css_value(s.get(f'margin-{side}'), 0))
    for side in ['top','right','bottom','left']:
        buf += _u16(_parse_css_value(s.get(f'padding-{side}'), 0))
    for side in ['top','right','bottom','left']:
        buf.append(min(_parse_css_value(s.get(f'border-{side}-width'), 0), 255))

    buf += _u32(_parse_color(s.get('border-color')))
    buf += _u32(_parse_color(s.get('background-color', s.get('background')), 0))
    buf += _u32(_parse_color(s.get('color'), 0x000000FF))
    buf += _u16(_parse_css_value(s.get('font-size'), 160))

    fw = s.get('font-weight','400')
    fw = '700' if fw == 'bold' else '400' if fw == 'normal' else fw
    try: fw_int = int(fw)
    except: fw_int = 400
    buf += _u16(fw_int)

    buf += _u16(_parse_css_value(s.get('line-height'), 0))
    buf.append(TEXTALIGN_MAP.get(s.get('text-align',''), 0))
    buf.append(FLEXDIR_MAP.get(s.get('flex-direction',''), 0))
    buf.append(1 if s.get('flex-wrap') == 'wrap' else 0)
    buf.append(JUSTIFY_MAP.get(s.get('justify-content',''), 0))
    buf.append(ALIGN_MAP.get(s.get('align-items',''), 3))
    buf += _u16(_parse_css_value(s.get('gap'), 0))
    buf += _u16(_parse_css_value(s.get('border-radius'), 0))
    buf.append(OVERFLOW_MAP.get(s.get('overflow',''), 0))

    try: opacity = int(float(s.get('opacity','1')) * 255)
    except: opacity = 255
    buf.append(min(max(opacity, 0), 255))

    try: z = int(s.get('z-index','0'))
    except: z = 0
    buf += _i16(z)

# ═══════════════════════════════════════════════════════════════
#  BWEB Container
# ═══════════════════════════════════════════════════════════════

def bundle_bweb(bml: bytes, bdt: bytes, blb: bytes) -> bytes:
    buf = bytearray(BWEB_MAGIC)
    buf.append(BWEB_VERSION)
    buf.append(3)  # section_count

    for sec_type, data in [(SEC_BML, bml), (SEC_BDT, bdt), (SEC_BLB, blb)]:
        buf.append(sec_type)
        buf += _u32(len(data))
        buf += data

    return bytes(buf)


def unbundle_bweb(data: bytes) -> dict:
    if data[:4] != BWEB_MAGIC:
        raise ValueError('Ungültiges BWEB-Format')
    version = data[4]
    sec_count = data[5]
    offset = 6
    sections = {}
    for _ in range(sec_count):
        sec_type = data[offset]; offset += 1
        sec_len = struct.unpack('>I', data[offset:offset+4])[0]; offset += 4
        sections[sec_type] = data[offset:offset+sec_len]
        offset += sec_len
    return sections

# ═══════════════════════════════════════════════════════════════
#  HTML → BWEB Pipeline
# ═══════════════════════════════════════════════════════════════

def html_to_bweb(html_str: str) -> bytes:
    dom = html_to_dom(html_str)
    bml = serialize_bml(dom)
    bdt = serialize_bdt(dom)
    blb = serialize_blb(dom)
    return bundle_bweb(bml, bdt, blb)


def html_file_to_bweb(html_path: str, output_path: str = None) -> str:
    src = Path(html_path)
    out = Path(output_path) if output_path else src.with_suffix('.bweb')
    html = src.read_text('utf-8')
    bweb = html_to_bweb(html)
    out.write_bytes(bweb)
    return str(out)

# ═══════════════════════════════════════════════════════════════
#  Stats / Debug
# ═══════════════════════════════════════════════════════════════

def bweb_stats(data: bytes) -> dict:
    sections = unbundle_bweb(data)
    bml = sections.get(SEC_BML, b'')
    bdt = sections.get(SEC_BDT, b'')
    blb = sections.get(SEC_BLB, b'')

    bdt_nodes = struct.unpack('>I', bdt[4:8])[0] if len(bdt) >= 8 else 0
    blb_blocks = struct.unpack('>I', blb[4:8])[0] if len(blb) >= 8 else 0

    return {
        'total_bytes': len(data),
        'bml_bytes': len(bml),
        'bdt_bytes': len(bdt),
        'blb_bytes': len(blb),
        'bdt_nodes': bdt_nodes,
        'blb_blocks': blb_blocks,
    }

# ═══════════════════════════════════════════════════════════════
#  CLI
# ═══════════════════════════════════════════════════════════════

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Nutzung: python binary_formats.py <input.html> [output.bweb]')
        print('         python binary_formats.py --stats <file.bweb>')
        sys.exit(1)

    if sys.argv[1] == '--stats':
        data = Path(sys.argv[2]).read_bytes()
        stats = bweb_stats(data)
        for k, v in stats.items():
            print(f'  {k}: {v:,}')
    else:
        out = html_file_to_bweb(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
        data = Path(out).read_bytes()
        stats = bweb_stats(data)
        print(f'✅ {out} ({stats["total_bytes"]:,} Bytes)')
        print(f'   BML: {stats["bml_bytes"]:,} B | BDT: {stats["bdt_bytes"]:,} B ({stats["bdt_nodes"]} Nodes) | BLB: {stats["blb_bytes"]:,} B ({stats["blb_blocks"]} Blöcke)')
