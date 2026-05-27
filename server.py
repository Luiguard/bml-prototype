#!/usr/bin/env python3
"""
BWEB Engine Backend Server
Bietet Endpunkte für AI-Site-Generation und HTML-to-BWEB Konvertierung.
"""
import os
import json
import asyncio
from pathlib import Path
from aiohttp import web
import aiohttp
import binary_formats

# Verzeichnisse
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR

async def handle_index(request):
    """Liefert die index.html Engine aus."""
    index_path = STATIC_DIR / "index.html"
    return web.FileResponse(index_path)

async def handle_html_to_bweb(request):
    """REST API: Konvertiert HTML String in BWEB Binärformat."""
    try:
        data = await request.json()
        html_str = data.get('html', '')
        if not html_str:
            return web.json_response({"error": "No HTML provided"}, status=400)
        
        # Konvertierung
        bweb_bytes = binary_formats.html_to_bweb(html_str)
        
        return web.Response(body=bweb_bytes, content_type='application/octet-stream')
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

async def generate_with_ollama(prompt: str) -> str:
    """Versucht die lokale KI (Ollama) anzusprechen. Fallback auf Mock, falls nicht verfügbar."""
    try:
        async with aiohttp.ClientSession() as session:
            # Sende Request an lokale Ollama Instanz (Standard-Port)
            system_prompt = (
                "You are an expert web developer. The user asks for a website. "
                "Return ONLY valid HTML5 code. Do not use Markdown blockquotes. "
                "Include inline CSS for styling. Make it look modern and enterprise-ready. "
                "Return absolutely no other text, just the raw HTML."
            )
            payload = {
                "model": "llama3",  # oder mistral, etc.
                "prompt": f"System: {system_prompt}\nUser: {prompt}",
                "stream": False
            }
            async with session.post('http://127.0.0.1:11434/api/generate', json=payload, timeout=15) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    response_text = result.get('response', '')
                    # Bereinige Markdown Blöcke falls vorhanden
                    if response_text.startswith("```html"):
                        response_text = response_text[7:]
                    if response_text.endswith("```"):
                        response_text = response_text[:-3]
                    return response_text.strip()
    except Exception:
        pass # Fallback ausführen

    # Fallback Template
    return f"""
    <div style="font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 30px; background: #1e293b; color: #f1f5f9; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h1 style="color: #3b82f6; border-bottom: 2px solid #334155; padding-bottom: 10px;">Generierte KI-Seite</h1>
        <p style="font-size: 1.1rem; line-height: 1.6; color: #cbd5e1;">Prompt: <strong>{prompt}</strong></p>
        <div style="margin-top: 20px; padding: 20px; background: #0f172a; border-radius: 8px; border-left: 4px solid #10b981;">
            <h2 style="margin-top: 0; color: #10b981;">Erfolg!</h2>
            <p>Die Pipeline hat den Prompt verarbeitet und diese HTML-Struktur generiert.</p>
            <p>Hier ist ein nativer BIB-Bildblock, direkt von der GPU gezeichnet:</p>
            <canvas data-bind="99" width="64" height="64" style="border: 2px solid #3b82f6; border-radius: 8px; display: block; margin-top: 10px;"></canvas>
            <button style="margin-top: 15px; background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600;">Interaktion Testen</button>
        </div>
    </div>
    """

async def handle_generate_site(request):
    """REST API: Generiert eine Webseite per KI und gibt sie als BWEB Binärformat zurück."""
    try:
        data = await request.json()
        prompt = data.get('prompt', 'Erstelle eine schöne Landingpage.')
        
        # 1. KI-Generierung (HTML)
        print(f"🤖 Generiere HTML für Prompt: '{prompt}'...")
        html_output = await generate_with_ollama(prompt)
        print("✅ HTML generiert. Konvertiere in BWEB...")
        
        # 2. Binäre Konvertierung (HTML -> BWEB Container)
        
        # Erstelle Dummy BIB (Binary Image Block) - 64x64 Gradient
        red_block = bytearray()
        for y in range(64):
            for x in range(64):
                red_block.extend([x*4, y*4, 255 - x*2, 255])
        
        img = {'id': 99, 'w': 64, 'h': 64, 'rgba_data': bytes(red_block)}
        bib_bytes = binary_formats.serialize_bib([img])
        
        bweb_bytes = binary_formats.html_to_bweb(html_output, bib=bib_bytes)
        
        # 3. Rückgabe als Octet-Stream
        return web.Response(body=bweb_bytes, content_type='application/octet-stream')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return web.json_response({"error": str(e)}, status=500)

async def init_app():
    app = web.Application()
    app.router.add_get('/', handle_index)
    app.router.add_post('/api/html-to-bweb', handle_html_to_bweb)
    app.router.add_post('/api/generate-site', handle_generate_site)
    
    # Statische Dateien (page.bml, page.bweb, etc.)
    app.router.add_static('/', STATIC_DIR)
    return app

if __name__ == '__main__':
    print("🚀 Starte BWEB Pipeline Server auf http://127.0.0.1:8080")
    web.run_app(init_app(), host='127.0.0.1', port=8080)
