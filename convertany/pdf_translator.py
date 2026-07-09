import os
import sys
import json
import urllib.request
import fitz
import io

try:
    import pytesseract
    from PIL import Image
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

in_pdf = sys.argv[1] if len(sys.argv) > 1 else ""
out_pdf = sys.argv[2] if len(sys.argv) > 2 else ""
src_lang = sys.argv[3] if len(sys.argv) > 3 else "de"
tgt_lang = sys.argv[4] if len(sys.argv) > 4 else "sk"

status_file = out_pdf + ".status" if out_pdf else ""

LANG_NAMES = {
    'de': 'German', 'en': 'English', 'es': 'Spanish',
    'fr': 'French', 'it': 'Italian', 'sk': 'Slovak',
    'cs': 'Czech', 'pl': 'Polish', 'pt': 'Portuguese',
    'nl': 'Dutch', 'hu': 'Hungarian', 'ro': 'Romanian',
    'tr': 'Turkish', 'ru': 'Russian', 'uk': 'Ukrainian',
}

src_name = LANG_NAMES.get(src_lang, src_lang)
tgt_name = LANG_NAMES.get(tgt_lang, tgt_lang)

FONT_PATH = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"
FONT_NAME = "NotoSans"

def write_status(msg):
    print(msg, file=sys.stderr)
    if status_file:
        try:
            with open(status_file, "w") as f:
                f.write(msg)
        except:
            pass

write_status(f"Verbinde mit lokaler KI für {src_name} → {tgt_name}...")

translation_cache = {}

def translate_text(text):
    stripped = text.strip()
    if not stripped or len(stripped) < 3:
        return text

    if all(c.isdigit() or c in '.,;:!?/-–—()[]{}@#$%&*+=<>|\\\'"™®©€£$ \t\n' for c in stripped):
        return text

    if stripped in translation_cache:
        return translation_cache[stripped]

    prompt = (
        f"Translate the following text from {src_name} to {tgt_name}.\n"
        f"CRITICAL RULES:\n"
        f"- Return ONLY the translated text, nothing else.\n"
        f"- NEVER translate brand names, product names, or proper nouns. Keep them exactly as-is.\n"
        f"- Examples of names to KEEP unchanged: Dior, Chanel, Gucci, YSL, Paco Rabanne, "
        f"Thierry Mugler, Lancôme, Kenzo, Narciso Rodriguez, Issey Miyake, Dolce & Gabbana, "
        f"Hugo Boss, Calvin Klein, Versace, Burberry, Tom Ford, Giorgio Armani, Givenchy, "
        f"Miss Dior, Alien, Angel, Light Blue, Flower, Trésor, La Vie Est Belle, "
        f"Hypnotic Poison, Hypnose, Lady Million, Manifesto, Opium, J'adore, Coco, "
        f"Chance, Guilty, L'eau d'issey, Good Girl, Sí, Black Orchid, Bleu, Sauvage.\n"
        f"- YOU MUST TRANSLATE descriptive and catalog words like: 'Frisch', 'Würzig', 'Blumig', 'Fruchtig', 'Süß', 'Holzig', 'Kühl', 'Pudrig', 'Orientalisch', 'Zitrisch', 'Herren', 'Damen', 'Preisliste' into {tgt_name}.\n"
        f"- No quotes, no markdown, no explanations.\n\n"
        f"{text}"
    )

    data = {
        "model": "gemma4:e4b",
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
            "num_predict": max(len(text) * 3, 256)
        }
    }

    req = urllib.request.Request(
        'http://localhost:11434/api/generate',
        json.dumps(data).encode('utf-8')
    )
    req.add_header('Content-Type', 'application/json')

    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read().decode('utf-8'))
            translation = result.get('response', '').strip()

            # Strip wrapping quotes
            for ch in ['"', "'", '`']:
                if translation.startswith(ch) and translation.endswith(ch):
                    translation = translation[1:-1].strip()

            # Strip common noise prefixes
            noise_prefixes = [
                'Here is the translation:', 'Translation:', 'Translated text:',
                f'{tgt_name}:', 'Output:', 'Result:', 'Answer:',
                'Hier ist die Übersetzung:', 'Übersetzung:', 'Die Übersetzung lautet:',
                'Preklad:', 'Překlad:',
            ]
            for prefix in noise_prefixes:
                if translation.lower().startswith(prefix.lower()):
                    translation = translation[len(prefix):].strip()

            if not translation or len(translation) < 2:
                return text
            if len(translation) > len(text) * 5:
                return text

            translation_cache[stripped] = translation
            return translation

    except Exception as e:
        write_status(f"Übersetzungsfehler: {e}")
        return text


def ocr_page(page, src_lang_code):
    """OCR a page that has no extractable text (image-only pages)."""
    if not HAS_OCR:
        return []

    # Map language codes to tesseract codes
    tess_map = {'de': 'deu', 'en': 'eng', 'sk': 'slk', 'cs': 'ces', 'pl': 'pol',
                'fr': 'fra', 'it': 'ita', 'es': 'spa', 'pt': 'por', 'nl': 'nld',
                'hu': 'hun', 'ro': 'ron', 'tr': 'tur', 'ru': 'rus', 'uk': 'ukr'}
    tess_lang = tess_map.get(src_lang_code, 'deu')

    # Render page to high-res image
    mat = fitz.Matrix(3, 3)  # 3x zoom for better OCR
    pix = page.get_pixmap(matrix=mat)
    img = Image.open(io.BytesIO(pix.tobytes("png")))

    # Run OCR with bounding box data
    ocr_data = pytesseract.image_to_data(img, lang=tess_lang, output_type=pytesseract.Output.DICT)

    results = []
    scale = 1.0 / 3.0  # reverse the 3x zoom
    n = len(ocr_data['text'])
    for i in range(n):
        text = ocr_data['text'][i].strip()
        conf = int(ocr_data['conf'][i])
        if not text or len(text) < 3 or conf < 40:
            continue
        x = ocr_data['left'][i] * scale
        y = ocr_data['top'][i] * scale
        w = ocr_data['width'][i] * scale
        h = ocr_data['height'][i] * scale
        results.append({
            'text': text,
            'bbox': (x, y, x + w, y + h),
            'origin': (x, y + h * 0.85),  # baseline approximation
            'fontsize': max(h * 0.7, 8),
            'conf': conf
        })
    return results


def translate_pdf(input_pdf, output_pdf):
    write_status("Öffne PDF und analysiere Struktur...")

    try:
        doc = fitz.open(input_pdf)
    except Exception as e:
        write_status(f"Fehler beim Öffnen: {e}")
        return False

    total_pages = len(doc)

    # Count total translatable lines
    total_lines = 0
    for page in doc:
        text_blocks = [b for b in page.get_text("dict")["blocks"] if b.get("type") == 0]
        if text_blocks:
            for block in text_blocks:
                for line in block.get("lines", []):
                    line_text = "".join(s.get("text", "") for s in line.get("spans", []))
                    if line_text.strip() and len(line_text.strip()) >= 3:
                        total_lines += 1
        elif HAS_OCR:
            total_lines += 5  # estimate for OCR pages

    write_status(f"Gefunden: {total_pages} Seiten, {total_lines} Textzeilen")

    line_counter = 0
    for page_num in range(total_pages):
        page = doc[page_num]
        blocks = page.get_text("dict")["blocks"]
        text_blocks = [b for b in blocks if b.get("type") == 0]

        replacements = []
        is_ocr_page = False

        # Check if page has extractable text or needs OCR
        has_text = any(
            "".join(s.get("text", "") for s in line.get("spans", [])).strip()
            for b in text_blocks for line in b.get("lines", [])
        )

        if has_text:
            # Normal text extraction path
            for block in text_blocks:
                for line in block.get("lines", []):
                    spans = line.get("spans", [])
                    if not spans:
                        continue

                    line_text = "".join(s.get("text", "") for s in spans)
                    if not line_text.strip() or len(line_text.strip()) < 3:
                        continue

                    line_counter += 1
                    pct = int(line_counter / max(total_lines, 1) * 100)
                    write_status(f"Übersetze Seite {page_num+1}/{total_pages} ({pct}%)")

                    translated = translate_text(line_text)
                    if translated == line_text:
                        continue

                    first_span = spans[0]
                    font_size = first_span.get("size", 11)
                    color_int = first_span.get("color", 0)
                    r = ((color_int >> 16) & 0xFF) / 255.0
                    g = ((color_int >> 8) & 0xFF) / 255.0
                    b = (color_int & 0xFF) / 255.0

                    origin = fitz.Point(first_span["origin"][0], first_span["origin"][1])
                    cover_rects = [fitz.Rect(s["bbox"]) for s in spans]

                    replacements.append({
                        "cover_rects": cover_rects,
                        "origin": origin,
                        "text": translated,
                        "fontsize": font_size,
                        "color": (r, g, b),
                    })
        elif HAS_OCR:
            # OCR path for image-only pages
            is_ocr_page = True
            write_status(f"OCR-Scan Seite {page_num+1}/{total_pages}...")
            ocr_results = ocr_page(page, src_lang)

            for item in ocr_results:
                line_counter += 1
                pct = int(line_counter / max(total_lines, 1) * 100)
                write_status(f"Übersetze Seite {page_num+1}/{total_pages} (OCR, {pct}%)")

                translated = translate_text(item['text'])
                if translated == item['text']:
                    continue

                rect = fitz.Rect(item['bbox'])
                replacements.append({
                    "cover_rects": [rect],
                    "origin": fitz.Point(item['origin'][0], item['origin'][1]),
                    "text": translated,
                    "fontsize": item['fontsize'],
                    "color": (0, 0, 0),
                })

        # Phase 1: Redact old text to preserve background images
        for rep in replacements:
            for rect in rep["cover_rects"]:
                page.add_redact_annot(rect, text="", fill=None)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)

        # Phase 2: Insert translated text
        for rep in replacements:
            try:
                page.insert_text(
                    rep["origin"],
                    rep["text"],
                    fontsize=rep["fontsize"],
                    color=rep["color"],
                    fontname=FONT_NAME,
                    fontfile=FONT_PATH,
                    overlay=True,
                )
            except Exception:
                pass

    write_status("Speichere übersetzte PDF...")
    try:
        doc.save(output_pdf, garbage=4, deflate=True)
        doc.close()
        write_status("Abgeschlossen!")
        return True
    except Exception as e:
        write_status(f"Fehler beim Speichern: {e}")
        doc.close()
        return False


if __name__ == "__main__":
    if not in_pdf or not out_pdf:
        write_status("Fehler: Zu wenige Argumente.")
        sys.exit(1)

    success = translate_pdf(in_pdf, out_pdf)
    sys.exit(0 if success else 1)
