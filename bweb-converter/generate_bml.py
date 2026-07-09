#!/usr/bin/env python3
"""Generiert eine Demo page.bml und page.bweb mit der aktuellen binary_formats API."""
from pathlib import Path
import binary_formats as bf

def main():
    dest = Path(__file__).resolve().parent

    html = '''
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 30px; background: #1e293b; color: #f1f5f9; border-radius: 16px;">
        <h1 style="color: #3b82f6; border-bottom: 2px solid #334155; padding-bottom: 10px;">Binary Markup Language (BML) Prototyp</h1>
        <p style="font-size: 1.1rem; line-height: 1.6; color: #cbd5e1;">
            Dieses Dokument wurde vollkommen ohne textbasiertes HTML übertragen.
            Der Browser-Polyfill lädt die binären Bytes der page.bml-Datei und übersetzt
            die komprimierte Blockstruktur direkt in den DOM-Baum des Browsers.
            Das spart Bandbreite und CPU-Parsingzeit.
        </p>
        <a href="https://github.com/Luiguard" style="color: #38bdf8; text-decoration: underline;">Entwickelt von Benjamin Leimer</a>
    </div>
    '''

    dom = bf.html_to_dom(html)
    bml = bf.serialize_bml(dom)
    bml_path = dest / 'page.bml'
    bml_path.write_bytes(bml)
    print(f"✅ {bml_path.name}: {len(bml)} Bytes")

    bweb = bf.html_to_bweb(html)
    bweb_path = dest / 'page.bweb'
    bweb_path.write_bytes(bweb)
    print(f"✅ {bweb_path.name}: {len(bweb)} Bytes")

    bweb_compressed = bf.html_to_bweb(html, compress=True)
    bweb_c_path = dest / 'page_compressed.bweb'
    bweb_c_path.write_bytes(bweb_compressed)
    ratio = len(bweb_compressed) / len(bweb) * 100
    print(f"✅ {bweb_c_path.name}: {len(bweb_compressed)} Bytes ({ratio:.0f}% of uncompressed)")

if __name__ == '__main__':
    main()
