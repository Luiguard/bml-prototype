# BWEB (Binary Web) Engine

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-Custom-green.svg)

BWEB ist ein experimentelles, **100% binäres Web-Format**. Es verabschiedet sich von textbasiertem HTML und CSS und packt den DOM-Baum (BML, BDT), das vorberechnete CSS-Layout (BLB), Bilder (BIB) sowie Audio/Video-Streams (BVS, BAS) in ein einziges, extrem optimiertes Binärpaket.

Das Ziel: Zero-Parsing, direkte GPU-Beschleunigung und Privacy by Design.

👉 **[BWEB Architecture Landing Page](https://mediclean-pro.at/bweb-converter/)**
👉 **[Open Online BWEB Converter Tool](https://mediclean-pro.at/bweb-converter/converter.html)**

*(Wähle lokale HTML-Ordner aus, um sie in Sekundenbruchteilen in `.bweb`-Binärstrukturen zu konvertieren — rein lokal, kein Upload auf externe Server!)*

---

## ⚡ Formate & Architektur

BWEB ist ein Container-Format (Magic: `BWEB`), das 6 Sektionen bündelt. Jede Sektion wird ohne String-Parsing direkt in den Speicher geladen.

- **SEC 1: BML (Binary Markup Language)** — Stark komprimierte Struktur, Attribute und UTF-8 Text. Tags sind 1-Byte Hex-Codes (z.B. `<div>` = `0x01`).
- **SEC 2: BDT (Binary DOM Tree)** — Flache Node-Hierarchie mit Parent/Child-Pointern (11 Bytes/Node). Ersetzt verschachteltes HTML durch O(1) Zugriffe.
- **SEC 3: BLB (Binary Layout Blocks)** — Pre-computed CSS-Styling. Jede Layout-Anweisung verwendet einen festen 60-Byte Block.
- **SEC 4: BIB (Binary Image Blocks)** — Raw RGBA oder WebP Bitstreams, die direkt in `<canvas>` via `putImageData` gezeichnet werden.
- **SEC 5: BVS (Binary Video Streams)** — Nativ eingebettete Videodaten für Frame-by-Frame Canvas-Rendering.
- **SEC 6: BAS (Binary Audio Streams)** — Eingebettete Audio-Buffer, abspielbar über die Web Audio API.

> 📖 **[Vollständige Byte-Level Spezifikation (SPEC.md)](SPEC.md)**

---

## 🧩 Browser Extension & Fallback (Polyfill)

Da Browser `.bweb`-Dateien nativ (noch) nicht verstehen, nutzt das BWEB-Ökosystem eine duale Strategie:

1. **Native Chrome/Firefox Extension (Empfohlen)**:
   - Die Extension fängt `.bweb`, `.bml`, `.bdt` etc. Anfragen ab.
   - Rendert die Binärdaten isoliert in einem sauberen Canvas/DOM-Target.
   - Sendet den Header `X-BWEB-Native: true` an den Server.
2. **JS-Polyfill Fallback**:
   - Ruft ein Nutzer ohne Extension eine BWEB-Seite auf, erkennt der Server (via `.htaccess`) das Fehlen des `X-BWEB-Native`-Headers.
   - Die Anfrage wird nahtlos an `polyfill.html?file=...` umgeleitet.
   - Die `polyfill.html` lädt die Binärdatei via Fetch (`?raw=true`) und rendert sie clientseitig über Vanilla JS. Klassische Websites bleiben unberührt.

---

## 🔒 Privatsphäre & Cookie-freie Architektur

BWEB bricht grundlegend mit der traditionellen, Tracker-verseuchten Architektur des Internets, um **Privacy by Design** zu garantieren:

1. **Stateless Binary Container**: BWEB ist ein kompilierter, statischer Container. Es gibt keinen Session-Zustand, keine versteckten LocalStorage-Schreibzugriffe beim Laden.
2. **Zero Tracking Overheads**: CPU-Parsing von Text-HTML und Third-Party-Skript-Injektionen sind nicht möglich. Tracker können keine heimlichen Pixel oder Third-Party-Cookies platzieren. **DSGVO-Cookie-Banner sind obsolet!**
3. **Sicheres Rendering**: Die Ausführung erfolgt streng limitiert. Es gibt keine unkontrollierten `<script>`-Tags oder dynamischen Event-Listener aus dem Binärcode.

---

## 📢 Die Zukunft der Werbung in BWEB

Werbung im modernen Web ist träge, datenhungrig und unsicher. In BWEB wird Werbung revolutioniert:

1. **BIB Ad-Slices (Binäre Werbe-Slices)**: Ads sind keine blockierenden Javascript-Blobs, sondern statische **BIB-Slices**. Sie werden direkt von der GPU gezeichnet – Zero-Latenz und minimaler Stromverbrauch (Akku-Schonung für Mobile).
2. **Zero-Knowledge Krypto-Verifikation**: Jedes Ad-Slice kann kryptografisch signiert werden. Der Browser validiert die Anzeige lokal, ohne Nutzerprofile an externe Ad-Server zu senden.
3. **Malvertising-Schutz**: Das Einschleusen von Schadcode über Werbebanner (Malvertising) ist physikalisch unmöglich, da Ads reine Bild/Video-Puffer ohne Logik-Kontext sind.

---

## 🛡️ Sicherheit (Security Hardening)

Die BWEB-Engine (sowohl Polyfill als auch Extension) ist gegen typische Web-Angriffe gehärtet:
- **XSS-Schutz**: Gefährliche Tags (`<iframe>`, `<script>`) und Event-Handler (`onclick`, `onsubmit`) werden vom Parser ignoriert oder bereinigt.
- **Memory Safety (OOM)**: Strikte Limits für Canvas-Dimensionen (max 8192px) und Buffer-Bounds-Checks verhindern Tab-Crashes.
- **Stack-Overflow-Schutz**: Rekursive DOM-Aufbauten (BML) sind auf eine maximale Tiefe (z.B. 256) limitiert.
- **Path-Traversal-Schutz**: Der Fallback-Server validiert alle Dateipfade strikt.

---

## 💻 Installation & Usage

**Lokaler Python-Konverter / Pipeline**
In `binary_formats.py` befindet sich der Core-Serializer. Er wandelt DOM-Strukturen in die BWEB Byte-Arrays um.

**Online Konverter**
Nutze `converter.html` für eine interaktive Konvertierung direkt im Browser via File-System Access API.

---

## 📜 Lizenz & Attribution

Bitte die `LICENSE` Datei beachten. **Jede kommerzielle Nutzung erfordert dieses Zitat im UI/Doku:**
> `"Incorporates RAG-NVMe architecture designed by Benjamin Leimer."`

*For more information on the RAG-NVMe integration, visit the respective repository.*
