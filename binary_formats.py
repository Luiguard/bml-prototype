#!/usr/bin/env python3
"""Binary Web Formats: BML, BDT, BLB, BIB, BVS, BAS, BWEB
Benjamin Leimer – 2026 – Custom Attribution License

Formate:
  BML  Binary Markup Language   – Inhalt (Tags, Attribute, Text)
  BDT  Binary DOM Tree          – Baumstruktur (Parent/Child/Sibling-Links)
  BLB  Binary Layout Blocks     – Layout/CSS (Box-Model, Flexbox, Farben)
  BIB  Binary Image Blocks      – Rohe Pixeldaten (RGBA)
  BVS  Binary Video Streams     – Demuxte I/P-Frames für WebCodecs
  BAS  Binary Audio Streams     – Demuxte Audiopakete für WebAudio
  BWEB Container                – Bündelt alle Sektionen in eine Datei
"""
import struct, sys, json
from pathlib import Path
from html.parser import HTMLParser

# ═══════════════════════════════════════════════════════════════
#  Konstantenregister
# ═══════════════════════════════════════════════════════════════

BML_MAGIC = b'BML\x02'
BDT_MAGIC = b'BDT\x01'
BLB_MAGIC = b'BLB\x02'
BLB_MAGIC_V1 = b'BLB\x01'
BWEB_MAGIC = b'BWEB'
BWEB_VERSION = 1

SEC_BML = 1
SEC_BDT = 2
SEC_BLB = 3
SEC_BIB = 4
SEC_BVS = 5
SEC_BAS = 6

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
    'data-bind-video':0x38,'data-bind-audio':0x39,
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
        first_child = node.children[0].node_id if node.children else 0xFFFF
        last_child = node.children[-1].node_id if node.children else 0xFFFF

        prev_sibling = 0xFFFF
        next_sibling = 0xFFFF
        if node.parent_id != 0xFFFF:
            parent_node = flat[node.parent_id]
            my_idx = parent_node.children.index(node)
            if my_idx > 0:
                prev_sibling = parent_node.children[my_idx-1].node_id
            if my_idx < len(parent_node.children) - 1:
                next_sibling = parent_node.children[my_idx+1].node_id

        depth = 0
        pid = node.parent_id
        while pid != 0xFFFF and depth < 255:
            depth += 1
            pid = flat[pid].parent_id

        buf += _u16(i)
        buf += _u16(node.parent_id)
        buf += _u16(first_child)
        buf += _u16(next_sibling)
        buf += _u16(last_child)
        buf += _u16(prev_sibling)
        buf.append(1)  # node_type=element
        buf.append(TAG.get(node.tag, 0x01))
        buf.append(depth)
        buf.append(0)  # padding 16-byte alignment

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
TEXTDECO_MAP = {'none':0,'underline':1,'line-through':2,'overline':3}
CURSOR_MAP = {'default':0,'auto':0,'pointer':1,'text':2,'move':3,'not-allowed':4,'grab':5,'crosshair':6,'wait':7,'help':8}
WHITESPACE_MAP = {'normal':0,'nowrap':1,'pre':2,'pre-wrap':3,'pre-line':4}
VISIBILITY_MAP = {'visible':0,'hidden':1,'collapse':2}
ALIGNSELF_MAP = {'auto':0,'flex-start':1,'start':1,'flex-end':2,'end':2,'center':3,'stretch':4,'baseline':5}
FONTSTYLE_MAP = {'normal':0,'italic':1,'oblique':2}


def _parse_box_shadow(s):
    raw = s.get('box-shadow', '')
    if not raw or raw == 'none':
        return
    import re
    raw = re.sub(r',.*', '', raw.strip())
    parts = raw.split()
    nums = []
    color = None
    for p in parts:
        if re.match(r'^-?[\d.]+', p):
            nums.append(p)
        else:
            color = p
    if len(nums) >= 2:
        s['_shadow_x'] = nums[0]
        s['_shadow_y'] = nums[1]
    if len(nums) >= 3:
        s['_shadow_blur'] = nums[2]
    if len(nums) >= 4:
        s['_shadow_spread'] = nums[3]
    if color:
        s['_shadow_color'] = color
    elif len(nums) >= 2:
        s['_shadow_color'] = 'black'


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

    # === BLB v2 Extended (Offset 60–95) ===
    buf.append(TEXTDECO_MAP.get(s.get('text-decoration',''), 0))
    buf.append(CURSOR_MAP.get(s.get('cursor',''), 0))
    buf.append(WHITESPACE_MAP.get(s.get('white-space',''), 0))
    buf.append(VISIBILITY_MAP.get(s.get('visibility',''), 0))
    buf += _u16(_parse_css_value(s.get('min-width'), 0xFFFF))
    buf += _u16(_parse_css_value(s.get('max-width'), 0xFFFF))
    buf += _u16(_parse_css_value(s.get('min-height'), 0xFFFF))
    buf += _u16(_parse_css_value(s.get('max-height'), 0xFFFF))

    try: fg = int(float(s.get('flex-grow','0')) * 100)
    except: fg = 0
    buf += _u16(min(fg, 65535))
    try: fs = int(float(s.get('flex-shrink','1')) * 100)
    except: fs = 100
    buf += _u16(min(fs, 65535))
    buf += _u16(_parse_css_value(s.get('flex-basis'), 0xFFFF))

    try: order = int(s.get('order','0'))
    except: order = 0
    buf.append(max(-128, min(127, order)) & 0xFF)
    buf.append(ALIGNSELF_MAP.get(s.get('align-self',''), 0))

    _parse_box_shadow(s)
    buf += _u32(_parse_color(s.get('_shadow_color'), 0))
    buf += _i16(_parse_css_value(s.get('_shadow_x', '0'), 0))
    buf += _i16(_parse_css_value(s.get('_shadow_y', '0'), 0))
    buf += _u16(_parse_css_value(s.get('_shadow_blur', '0'), 0))
    buf += _u16(_parse_css_value(s.get('_shadow_spread', '0'), 0))

    buf += _u16(0xFFFF)  # font-family-id (placeholder, resolved by BFS)
    buf.append(FONTSTYLE_MAP.get(s.get('font-style',''), 0))
    buf.append(0xFF)  # animation-id (placeholder, resolved by BAM)

# ═══════════════════════════════════════════════════════════════
#  BIB Serializer
# ═══════════════════════════════════════════════════════════════

BIB_MAGIC = b'BIB\x01'

def serialize_bib(images: list) -> bytes:
    # images: list of dicts with 'id', 'w', 'h', 'rgba_data'
    if not images:
        return b''
    
    buf = bytearray(BIB_MAGIC)
    buf += _u32(len(images))
    
    for img in images:
        # Header (24 Bytes)
        buf += _u32(img['id'])
        buf += _u16(img['w'])
        buf += _u16(img['h'])
        buf.append(1) # RGBA
        buf.append(0) # Raw uncompressed
        buf += bytes(6) # Padding
        
        # Single Block (id=0)
        buf += _u16(0)
        payload = img['rgba_data']
        buf += _u32(len(payload))
        buf += payload

    return bytes(buf)

# ═══════════════════════════════════════════════════════════════
#  BVS Serializer
# ═══════════════════════════════════════════════════════════════

BVS_MAGIC = b'BVS\x01'

def _get_codec_string(video_stream):
    name = video_stream.codec_context.name
    if name == 'h264':
        extradata = video_stream.codec_context.extradata
        if extradata and len(extradata) >= 4 and extradata[0] == 1:
            return f"avc1.{extradata[1:4].hex()}"
        return "avc1.42E01E"
    elif name == 'vp8':
        return "vp8"
    elif name == 'vp9':
        return "vp09.00.10.08"
    return name

def serialize_bvs(videos: list) -> bytes:
    try:
        import av
        import io
    except ImportError:
        print("Warning: 'av' package not installed. BVS serialization skipped.")
        return b''
        
    if not videos:
        return b''
        
    buf = bytearray(BVS_MAGIC)
    count_offset = len(buf)
    buf += _u32(0)
    written = 0
    
    for vid in videos:
        if 'bytes' in vid:
            container = av.open(io.BytesIO(vid['bytes']))
        else:
            container = av.open(vid['path'])
            
        stream = next((s for s in container.streams if s.type == 'video'), None)
        if not stream:
            continue
        written += 1
            
        codec_str = _get_codec_string(stream).encode('ascii')
        width = stream.codec_context.width
        height = stream.codec_context.height
        
        chunks = []
        for packet in container.demux(stream):
            if packet.dts is None:
                continue
            is_key = packet.is_keyframe
            tb = packet.time_base
            pts = max(0, int(packet.pts * tb * 1000000)) if packet.pts is not None else 0
            dur = max(0, int(packet.duration * tb * 1000000)) if packet.duration is not None else 0
            data = bytes(packet)
            chunks.append((is_key, pts, dur, data))
            
        buf += _u32(vid['id'])
        buf += _u16(width)
        buf += _u16(height)
        buf.append(len(codec_str))
        buf += codec_str
        buf += _u32(len(chunks))
        
        for is_key, pts, dur, data in chunks:
            buf.append(1 if is_key else 0)
            buf += struct.pack('>Q', pts)
            buf += _u32(dur)
            buf += _u32(len(data))
            buf += data
    
    struct.pack_into('>I', buf, count_offset, written)
    return bytes(buf)

# ═══════════════════════════════════════════════════════════════
#  BAS Serializer
# ═══════════════════════════════════════════════════════════════

BAS_MAGIC = b'BAS\x01'

def _get_audio_codec_string(stream):
    name = stream.codec_context.name
    if name == 'aac':
        return "mp4a.40.2"
    elif name == 'opus':
        return "opus"
    elif name == 'mp3':
        return "mp3"
    elif name == 'flac':
        return "flac"
    return name

def serialize_bas(audios: list) -> bytes:
    try:
        import av
        import io
    except ImportError:
        return b''
        
    if not audios:
        return b''
        
    buf = bytearray(BAS_MAGIC)
    count_offset = len(buf)
    buf += _u32(0)
    written = 0
    
    for aud in audios:
        if 'bytes' in aud:
            container = av.open(io.BytesIO(aud['bytes']))
        else:
            container = av.open(aud['path'])
            
        stream = next((s for s in container.streams if s.type == 'audio'), None)
        if not stream:
            continue
        written += 1
            
        codec_str = _get_audio_codec_string(stream).encode('ascii')
        sample_rate = stream.codec_context.sample_rate
        channels = stream.codec_context.channels
        
        chunks = []
        for packet in container.demux(stream):
            if packet.dts is None:
                continue
            is_key = packet.is_keyframe
            tb = packet.time_base
            pts = max(0, int(packet.pts * tb * 1000000)) if packet.pts is not None else 0
            dur = max(0, int(packet.duration * tb * 1000000)) if packet.duration is not None else 0
            data = bytes(packet)
            chunks.append((is_key, pts, dur, data))
            
        buf += _u32(aud['id'])
        buf.append(len(codec_str))
        buf += codec_str
        buf += _u32(sample_rate)
        buf.append(channels)
        buf += _u32(len(chunks))
        
        for is_key, pts, dur, data in chunks:
            buf.append(1 if is_key else 0)
            buf += struct.pack('>Q', pts)
            buf += _u32(dur)
            buf += _u32(len(data))
            buf += data
    
    struct.pack_into('>I', buf, count_offset, written)
    return bytes(buf)

# ═══════════════════════════════════════════════════════════════
#  BFS Serializer (Binary Font Streams)
# ═══════════════════════════════════════════════════════════════

BFS_MAGIC = b'BFS\x01'
SEC_BFS = 7
FONT_FORMAT = {'woff2': 0, 'woff': 1, 'ttf': 2, 'otf': 3}

def serialize_bfs(fonts: list) -> bytes:
    if not fonts:
        return b''
    buf = bytearray(BFS_MAGIC)
    buf += _u32(len(fonts))
    for font in fonts:
        buf += _u16(font['id'])
        family = font['family'].encode('utf-8')
        buf.append(min(len(family), 255))
        buf += family[:255]
        buf += _u16(font.get('weight', 400))
        buf.append({'normal': 0, 'italic': 1, 'oblique': 2}.get(font.get('style', 'normal'), 0))
        fmt = FONT_FORMAT.get(font.get('format', 'woff2'), 0)
        buf.append(fmt)
        data = font['data']
        buf += _u32(len(data))
        buf += data
    return bytes(buf)


def extract_fonts_from_html(html_path: str) -> list:
    import re
    base = Path(html_path).parent
    fonts = []
    html_text = Path(html_path).read_text(encoding='utf-8', errors='ignore')
    
    face_re = re.compile(
        r'@font-face\s*\{([^}]+)\}', re.IGNORECASE | re.DOTALL
    )
    for match in face_re.finditer(html_text):
        block = match.group(1)
        family_m = re.search(r"font-family\s*:\s*['\"]?([^;'\"]+)", block)
        src_m = re.search(r"url\(['\"]?([^)'\"]+'?)\)?", block)
        weight_m = re.search(r'font-weight\s*:\s*(\d+|bold|normal)', block)
        style_m = re.search(r'font-style\s*:\s*(normal|italic|oblique)', block)
        
        if not family_m or not src_m:
            continue
        
        family = family_m.group(1).strip()
        src_url = src_m.group(1).strip().rstrip("'\"")
        
        font_path = base / src_url
        if not font_path.exists():
            continue
        
        weight = 400
        if weight_m:
            w = weight_m.group(1)
            weight = 700 if w == 'bold' else 400 if w == 'normal' else int(w)
        
        style = style_m.group(1) if style_m else 'normal'
        ext = font_path.suffix.lower().lstrip('.')
        fmt = ext if ext in FONT_FORMAT else 'woff2'
        
        fonts.append({
            'id': len(fonts),
            'family': family,
            'weight': weight,
            'style': style,
            'format': fmt,
            'data': font_path.read_bytes()
        })
    
    return fonts


# ═══════════════════════════════════════════════════════════════
#  BAM Serializer (Binary Animation Map)
# ═══════════════════════════════════════════════════════════════

BAM_MAGIC = b'BAM\x01'
SEC_BAM = 8

BAM_TIMING = {'ease':0,'linear':1,'ease-in':2,'ease-out':3,'ease-in-out':4}
BAM_DIR = {'normal':0,'reverse':1,'alternate':2}
BAM_FILL = {'none':0,'forwards':1,'backwards':2,'both':3}
BAM_PROP = {
    'transform:translateX': 1, 'transform:translateY': 2, 'transform:translateZ': 3,
    'transform:rotate': 4, 'transform:rotateX': 5, 'transform:rotateY': 6,
    'transform:scaleX': 7, 'transform:scaleY': 8, 'transform:skewX': 9, 'transform:skewY': 10,
    'opacity': 16, 'background-color': 17, 'color': 18, 'width': 19, 'height': 20
}

def serialize_bam(animations: list) -> bytes:
    if not animations:
        return b''
    buf = bytearray(BAM_MAGIC)
    buf += _u32(len(animations))
    for anim in animations:
        buf.append(anim['id'])
        buf.append(anim['type']) # 0=transition, 1=keyframes
        name = anim['name'].encode('ascii')
        buf.append(min(len(name), 255))
        buf += name[:255]
        buf += _u32(anim.get('duration', 0))
        buf += _u32(anim.get('delay', 0))
        buf.append(BAM_TIMING.get(anim.get('timing', 'ease'), 0))
        iters = anim.get('iterations', 1)
        buf += _u16(0xFFFF if iters == 'infinite' else min(int(iters), 65534))
        buf.append(BAM_DIR.get(anim.get('direction', 'normal'), 0))
        buf.append(BAM_FILL.get(anim.get('fill', 'none'), 0))
        
        keyframes = anim.get('keyframes', [])
        buf += _u16(len(keyframes))
        for kf in keyframes:
            buf.append(min(100, max(0, int(kf['pct']))))
            props = kf.get('props', [])
            buf.append(min(len(props), 255))
            for p in props[:255]:
                pid = BAM_PROP.get(p['name'], 0)
                buf.append(pid)
                val = str(p['value']).encode('utf-8')
                buf += _u16(len(val))
                buf += val
    return bytes(buf)

def extract_animations_from_html(html_path: str) -> list:
    import re
    animations = []
    html_text = Path(html_path).read_text(encoding='utf-8', errors='ignore')
    
    # Very basic CSS keyframe parser for MVP
    kf_re = re.compile(r'@keyframes\s+([\w-]+)\s*\{([^}]+(?:\{[^}]+\}[^}]*)*)\}', re.IGNORECASE)
    for match in kf_re.finditer(html_text):
        name = match.group(1)
        body = match.group(2)
        
        anim = {
            'id': len(animations),
            'type': 1,
            'name': name,
            'keyframes': []
        }
        
        # Split body into frames by matching "XX% {" or "from {" or "to {"
        frame_re = re.compile(r'(?:([\d\.]+%)\s*|from\s*|to\s*)\{([^}]+)\}', re.IGNORECASE)
        for f_match in frame_re.finditer(body):
            pct_str = (f_match.group(1) or '').lower()
            if not pct_str:
                if 'from' in f_match.group(0).lower(): pct_str = '0%'
                elif 'to' in f_match.group(0).lower(): pct_str = '100%'
                else: continue
            
            pct = float(pct_str.replace('%', ''))
            props_str = f_match.group(2)
            
            props = []
            for p_str in props_str.split(';'):
                if ':' not in p_str: continue
                k, v = p_str.split(':', 1)
                k = k.strip().lower()
                v = v.strip()
                if k == 'transform':
                    t_re = re.finditer(r'(translateX|translateY|translateZ|rotate|rotateX|rotateY|scaleX|scaleY|skewX|skewY)\(([^)]+)\)', v)
                    for tm in t_re:
                        props.append({'name': f'transform:{tm.group(1)}', 'value': tm.group(2)})
                else:
                    props.append({'name': k, 'value': v})
                    
            if props:
                anim['keyframes'].append({'pct': pct, 'props': props})
                
        if anim['keyframes']:
            animations.append(anim)
            
    return animations

# ═══════════════════════════════════════════════════════════════
#  BRS Serializer (Binary Responsive Specs)
# ═══════════════════════════════════════════════════════════════

BRS_MAGIC = b'BRS\x01'
SEC_BRS = 9

def serialize_brs(queries: list) -> bytes:
    if not queries:
        return b''
    buf = bytearray(BRS_MAGIC)
    buf += _u32(len(queries))
    for mq in queries:
        qstr = mq['query'].encode('ascii')
        buf.append(min(len(qstr), 255))
        buf += qstr[:255]
        
        blocks = mq.get('blocks', [])
        buf += _u32(len(blocks))
        for b in blocks:
            style_dict = _parse_inline_style(b.get('style', ''))
            style_dict = _expand_shorthand(style_dict)
            _write_blb_block(buf, b['id'], style_dict, b.get('default_display', 0))
    return bytes(buf)

def extract_brs_from_html(html_path: str, dom) -> list:
    return []

# ═══════════════════════════════════════════════════════════════
#  BSG Serializer (Binary SVG Graphics)
# ═══════════════════════════════════════════════════════════════

BSG_MAGIC = b'BSG\x01'
SEC_BSG = 10

def serialize_bsg(graphics: list) -> bytes:
    if not graphics:
        return b''
    buf = bytearray(BSG_MAGIC)
    buf += _u32(len(graphics))
    for g in graphics:
        buf += _u32(g['id'])
        buf += _u16(g.get('width', 0))
        buf += _u16(g.get('height', 0))
        paths = g.get('paths', [])
        buf += _u16(len(paths))
        for p in paths:
            buf += _u32(_parse_color(p.get('fill'), 0))
            buf += _u32(_parse_color(p.get('stroke'), 0))
            buf += _u16(_parse_css_value(p.get('stroke_width'), 0))
            
            d_str = p.get('d', '').encode('ascii')
            buf += _u32(len(d_str))
            buf += d_str
    return bytes(buf)

def extract_bsg_from_html(html_path: str, dom) -> list:
    return []

# ═══════════════════════════════════════════════════════════════
#  BJS Serializer (Binary JavaScript Source)
# ═══════════════════════════════════════════════════════════════

BJS_MAGIC = b'BJS\x01'
SEC_BJS = 11

def serialize_bjs(scripts: list) -> bytes:
    if not scripts:
        return b''
    buf = bytearray(BJS_MAGIC)
    buf += _u32(len(scripts))
    for s in scripts:
        buf += _u32(s['id'])
        c_str = s.get('content', '').encode('utf-8')
        buf += _u32(len(c_str))
        buf += c_str
    return bytes(buf)

def extract_bjs_from_html(html_path: str, dom) -> list:
    return []

# ═══════════════════════════════════════════════════════════════
#  BPR Serializer (Binary Page Routes)
# ═══════════════════════════════════════════════════════════════

BPR_MAGIC = b'BPR\x01'
SEC_BPR = 12

def serialize_bpr(routes: list) -> bytes:
    if not routes:
        return b''
    buf = bytearray(BPR_MAGIC)
    buf += _u32(len(routes))
    for r in routes:
        buf += _u16(r['id'])
        p_str = r.get('path', '/').encode('ascii')
        buf.append(min(len(p_str), 255))
        buf += p_str[:255]
        buf += _u16(r.get('node_id', 0))
    return bytes(buf)

def extract_bpr_from_html(html_path: str, dom) -> list:
    return []

# ═══════════════════════════════════════════════════════════════
#  BCS Serializer (Binary Class Styles / Deduplication)
# ═══════════════════════════════════════════════════════════════

BCS_MAGIC = b'BCS\x01'
SEC_BCS = 13

def serialize_bcs(root) -> bytes:
    flat = []
    _flatten_tree(root, flat)
    
    unique_blocks = {}
    unique_list = []
    node_mapping = []
    
    for i, node in enumerate(flat):
        style = _parse_inline_style(node.attrs.get('style', ''))
        style = _expand_shorthand(style)
        default_display = 1 if node.tag in INLINE_TAGS else 0
        
        temp_buf = bytearray()
        _write_blb_block(temp_buf, 0, style, default_display)
        block = bytes(temp_buf)
        
        if block not in unique_blocks:
            style_id = len(unique_list)
            unique_blocks[block] = style_id
            unique_list.append(block)
        else:
            style_id = unique_blocks[block]
            
        node_mapping.append(style_id)
        
    if not unique_list:
        return b''
        
    buf = bytearray(BCS_MAGIC)
    buf += _u32(len(unique_list))
    buf += _u32(len(node_mapping))
    
    for block in unique_list:
        buf += block
        
    for sid in node_mapping:
        buf += _u16(sid)
        
    return bytes(buf)

# ═══════════════════════════════════════════════════════════════
#  BWA Serializer (Binary WebAssembly)
# ═══════════════════════════════════════════════════════════════

BWA_MAGIC = b'BWA\x01'
SEC_BWA = 14

def serialize_bwa(wasms: list) -> bytes:
    if not wasms:
        return b''
    buf = bytearray(BWA_MAGIC)
    buf.append(min(len(wasms), 255))
    for w in wasms:
        buf.append(w['id'] & 0xFF)
        name = w.get('name', '').encode('ascii')
        buf.append(min(len(name), 255))
        buf += name[:255]
        buf += _u32(len(w['data']))
        buf += w['data']
    return bytes(buf)

def extract_bwa_from_html(html_path: str, dom) -> list:
    # MVP: Empty extractor, could be populated from <script type="application/wasm">
    return []

# ═══════════════════════════════════════════════════════════════
#  B3D Serializer (Binary 3D Shaders)
# ═══════════════════════════════════════════════════════════════

B3D_MAGIC = b'B3D\x01'
SEC_B3D = 15

def serialize_b3d(shaders: list) -> bytes:
    if not shaders:
        return b''
    buf = bytearray(B3D_MAGIC)
    buf.append(min(len(shaders), 255))
    for s in shaders:
        buf.append(s['id'] & 0xFF)
        buf.append(s.get('type', 0) & 0xFF) # 0=Vertex, 1=Fragment, 2=Compute
        data = s['data'] if isinstance(s['data'], bytes) else s['data'].encode('utf-8')
        buf += _u32(len(data))
        buf += data
    return bytes(buf)

def extract_b3d_from_html(html_path: str, dom) -> list:
    # MVP: Empty extractor, could be populated from <script type="x-shader/x-vertex">
    return []

# ═══════════════════════════════════════════════════════════════
#  BWEB Container
# ═══════════════════════════════════════════════════════════════

def bundle_bweb(bml: bytes, bdt: bytes, blb: bytes, bib: bytes = b'', bvs: bytes = b'', bas: bytes = b'', bfs: bytes = b'', bam: bytes = b'', brs: bytes = b'', bsg: bytes = b'', bjs: bytes = b'', bpr: bytes = b'', bcs: bytes = b'', bwa: bytes = b'', b3d: bytes = b'', compress: bool = False) -> bytes:
    import zlib
    buf = bytearray(BWEB_MAGIC)
    buf.append(BWEB_VERSION)
    
    sections = []
    if bml: sections.append((SEC_BML, bml, compress))
    if bdt: sections.append((SEC_BDT, bdt, False))
    if blb: sections.append((SEC_BLB, blb, compress))
    if bib: sections.append((SEC_BIB, bib, False))
    if bvs: sections.append((SEC_BVS, bvs, False))
    if bas: sections.append((SEC_BAS, bas, False))
    if bfs: sections.append((SEC_BFS, bfs, False))
    if bam: sections.append((SEC_BAM, bam, False))
    if brs: sections.append((SEC_BRS, brs, False))
    if bsg: sections.append((SEC_BSG, bsg, False))
    if bjs: sections.append((SEC_BJS, bjs, False))
    if bpr: sections.append((SEC_BPR, bpr, False))
    if bcs: sections.append((SEC_BCS, bcs, False))
    if bwa: sections.append((SEC_BWA, bwa, False))
    if b3d: sections.append((SEC_B3D, b3d, False))
    
    buf.append(len(sections))

    for sec_type, data, can_compress in sections:
        if compress and can_compress:
            compressed = zlib.compress(data, level=6)
            if len(compressed) < len(data):
                buf.append(sec_type | 0x80)
                buf += _u32(len(compressed))
                buf += compressed
                continue
        buf.append(sec_type)
        buf += _u32(len(data))
        buf += data

    return bytes(buf)


def unbundle_bweb(data: bytes) -> dict:
    import zlib
    if data[:4] != BWEB_MAGIC:
        raise ValueError('Ungültiges BWEB-Format')
    version = data[4]
    sec_count = data[5]
    offset = 6
    sections = {}
    for _ in range(sec_count):
        raw_type = data[offset]; offset += 1
        sec_len = struct.unpack('>I', data[offset:offset+4])[0]; offset += 4
        payload = data[offset:offset+sec_len]
        offset += sec_len
        is_compressed = bool(raw_type & 0x80)
        sec_type = raw_type & 0x7F
        if is_compressed:
            payload = zlib.decompress(payload)
        sections[sec_type] = payload
    return sections

# ═══════════════════════════════════════════════════════════════
#  HTML → BWEB Pipeline
# ═══════════════════════════════════════════════════════════════

def html_to_bweb(html_str: str, bib: bytes = b'', bvs: bytes = b'', bas: bytes = b'', bfs: bytes = b'', bam: bytes = b'', brs: bytes = b'', bsg: bytes = b'', bjs: bytes = b'', bpr: bytes = b'', bcs_enabled: bool = False, bwa: bytes = b'', b3d: bytes = b'', compress: bool = False) -> bytes:
    dom = html_to_dom(html_str)
    bml = serialize_bml(dom)
    bdt = serialize_bdt(dom)
    
    blb = b''
    bcs = b''
    if bcs_enabled:
        bcs = serialize_bcs(dom)
    else:
        blb = serialize_blb(dom)
        
    return bundle_bweb(bml, bdt, blb, bib=bib, bvs=bvs, bas=bas, bfs=bfs, bam=bam, brs=brs, bsg=bsg, bjs=bjs, bpr=bpr, bcs=bcs, bwa=bwa, b3d=b3d, compress=compress)


def html_file_to_bweb(html_path: str, output_path: str = None, compress: bool = False) -> str:
    src = Path(html_path)
    out = Path(output_path) if output_path else src.with_suffix('.bweb')
    html = src.read_text('utf-8')
    dom = html_to_dom(html)
    
    videos = []
    audios = []
    vid_id = 0
    aud_id = 0
    def process_node(node):
        nonlocal vid_id, aud_id
        if node.tag == 'video':
            src_attr = node.attrs.get('src')
            if src_attr:
                vid_path = src.parent / src_attr
                if vid_path.exists():
                    videos.append({'id': vid_id, 'path': str(vid_path)})
                    audios.append({'id': aud_id, 'path': str(vid_path)})
                    node.tag = 'canvas'
                    node.attrs['data-bind-video'] = str(vid_id)
                    node.attrs['data-bind-audio'] = str(aud_id)
                    vid_id += 1
                    aud_id += 1
        elif node.tag == 'audio':
            src_attr = node.attrs.get('src')
            if src_attr:
                aud_path = src.parent / src_attr
                if aud_path.exists():
                    audios.append({'id': aud_id, 'path': str(aud_path)})
                    node.tag = 'canvas'
                    node.attrs['data-bind-audio'] = str(aud_id)
                    aud_id += 1
        for child in node.children:
            process_node(child)
            
    process_node(dom)
    
    fonts = extract_fonts_from_html(html_path)
    animations = extract_animations_from_html(html_path)
    queries = extract_brs_from_html(html_path, dom)
    graphics = extract_bsg_from_html(html_path, dom)
    scripts = extract_bjs_from_html(str(html_path), dom)
    routes = extract_bpr_from_html(str(html_path), dom)
    wasms = extract_bwa_from_html(str(html_path), dom)
    shaders = extract_b3d_from_html(str(html_path), dom)
    
    bvs_data = serialize_bvs(videos) if videos else b''
    bas_data = serialize_bas(audios) if audios else b''
    bfs_data = serialize_bfs(fonts) if fonts else b''
    bam_data = serialize_bam(animations) if animations else b''
    brs_data = serialize_brs(queries) if queries else b''
    bsg_data = serialize_bsg(graphics) if graphics else b''
    bjs_data = serialize_bjs(scripts) if scripts else b''
    bpr_data = serialize_bpr(routes) if routes else b''
    bwa_data = serialize_bwa(wasms) if wasms else b''
    b3d_data = serialize_b3d(shaders) if shaders else b''
    
    bml = serialize_bml(dom)
    bdt = serialize_bdt(dom)
    
    # We enforce BCS by default to maximize CO2 savings
    blb = b''
    bcs_data = serialize_bcs(dom)
    
    bweb = bundle_bweb(bml, bdt, blb, bib=b'', bvs=bvs_data, bas=bas_data, bfs=bfs_data, bam=bam_data, brs=brs_data, bsg=bsg_data, bjs=bjs_data, bpr=bpr_data, bcs=bcs_data, bwa=bwa_data, b3d=b3d_data, compress=compress)
    
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
    bib = sections.get(SEC_BIB, b'')

    bdt_nodes = struct.unpack('>I', bdt[4:8])[0] if len(bdt) >= 8 else 0
    blb_blocks = struct.unpack('>I', blb[4:8])[0] if len(blb) >= 8 else 0
    bib_images = struct.unpack('>I', bib[4:8])[0] if len(bib) >= 8 else 0
    
    bvs = sections.get(SEC_BVS, b'')
    bvs_videos = struct.unpack('>I', bvs[4:8])[0] if len(bvs) >= 8 else 0
    
    bas = sections.get(SEC_BAS, b'')
    bas_audios = struct.unpack('>I', bas[4:8])[0] if len(bas) >= 8 else 0

    bfs = sections.get(SEC_BFS, b'')
    bfs_fonts = struct.unpack('>I', bfs[4:8])[0] if len(bfs) >= 8 else 0

    bam = sections.get(SEC_BAM, b'')
    bam_anims = struct.unpack('>I', bam[4:8])[0] if len(bam) >= 8 else 0

    brs = sections.get(SEC_BRS, b'')
    brs_queries = struct.unpack('>I', brs[4:8])[0] if len(brs) >= 8 else 0

    bsg = sections.get(SEC_BSG, b'')
    bsg_graphics = struct.unpack('>I', bsg[4:8])[0] if len(bsg) >= 8 else 0

    bjs = sections.get(SEC_BJS, b'')
    bjs_scripts = struct.unpack('>I', bjs[4:8])[0] if len(bjs) >= 8 else 0

    bpr = sections.get(SEC_BPR, b'')
    bpr_routes = struct.unpack('>I', bpr[4:8])[0] if len(bpr) >= 8 else 0

    bcs = sections.get(SEC_BCS, b'')
    bcs_blocks = struct.unpack('>I', bcs[4:8])[0] if len(bcs) >= 8 else 0

    bwa = sections.get(SEC_BWA, b'')
    bwa_modules = bwa[4] if len(bwa) >= 5 else 0

    b3d = sections.get(SEC_B3D, b'')
    b3d_shaders = b3d[4] if len(b3d) >= 5 else 0

    return {
        'total_bytes': len(data),
        'bml_bytes': len(bml),
        'bdt_bytes': len(bdt),
        'blb_bytes': len(blb),
        'bib_bytes': len(bib),
        'bvs_bytes': len(bvs),
        'bas_bytes': len(bas),
        'bfs_bytes': len(bfs),
        'bam_bytes': len(bam),
        'brs_bytes': len(brs),
        'bsg_bytes': len(bsg),
        'bjs_bytes': len(bjs),
        'bpr_bytes': len(bpr),
        'bcs_bytes': len(bcs),
        'bwa_bytes': len(bwa),
        'b3d_bytes': len(b3d),
        'bdt_nodes': bdt_nodes,
        'blb_blocks': blb_blocks,
        'bib_images': bib_images,
        'bvs_videos': bvs_videos,
        'bas_audios': bas_audios,
        'bfs_fonts': bfs_fonts,
        'bam_anims': bam_anims,
        'brs_queries': brs_queries,
        'bsg_graphics': bsg_graphics,
        'bjs_scripts': bjs_scripts,
        'bpr_routes': bpr_routes,
        'bcs_blocks': bcs_blocks,
        'bwa_modules': bwa_modules,
        'b3d_shaders': b3d_shaders,
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
        out = html_file_to_bweb(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None, compress=True)
        data = Path(out).read_bytes()
        stats = bweb_stats(data)
        print(f'✅ {out} ({stats["total_bytes"]:,} Bytes)')
        print(f'   BML: {stats["bml_bytes"]:,} B | BDT: {stats["bdt_bytes"]:,} B ({stats["bdt_nodes"]} Nodes) | BLB: {stats["blb_bytes"]:,} B ({stats["blb_blocks"]} Blöcke)')
        print(f'   BIB: {stats["bib_bytes"]:,} B ({stats["bib_images"]} Images) | BVS: {stats["bvs_bytes"]:,} B ({stats["bvs_videos"]} Videos) | BAS: {stats["bas_bytes"]:,} B ({stats["bas_audios"]} Audios)')
