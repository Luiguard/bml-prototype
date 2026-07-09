# BWEB - Version 1.0 Reference Implementation

BWEB (Binary Web) ist ein vollständig determistisches, komprimiertes und DOM-freies Format für Web-Oberflächen. Dieser Ordner enthält die offizielle Referenz-Implementierung von BWEB 1.0.

## Komponenten

- **`bwebc.js`**: Der Headless BWEB-Compiler. Wandelt HTML/CSS/JS Layouts pixelgenau in das `.bweb` Binary Format um.
  - *Nutzung:* `node bwebc.js build src/index.html dist/app.bweb`

- **`bweb-engine.html`**: Das Polyfill / Die BWEB-Engine. Ein reines Canvas-basiertes Render-System, das `.bweb` Binaries in Echtzeit zeichnet und interaktive Events (Klick, Hover, Z-Index) auswertet.

- **`bweb-testsuite.js`**: Die Conformance- und Edge-Case-Testsuite. Prüft Abweichungen zwischen nativen DOM-Layouts und der BWEB-Auslieferung mittels Puppeteer und Pixelmatch.
  - *Nutzung:* `node bweb-testsuite.js`

- **`BWEB_SPEC_v1.0.md`**: Die formale Spezifikation des Dateiformats (BDT, BML, BLB, BIB, BVS, BMS). (Gepflegt in deinen Artifacts).

## Features

- **DOM-Less Rendering**: HTML und CSS existieren nicht mehr zur Laufzeit. Alles wird pixelgenau als Array über das Canvas gezeichnet.
- **Micro-Binaries**: Hochkomprimierte Datei-Größen.
- **Embedded Media (BIB)**: Bilder werden direkt in die Binary gelinkt.
- **Events & Z-Index (BMS)**: Interaktion (Hover, Click, Tabs, Modals) ist voll unterstützt. Die BWEB-Engine vererbt dynamisch Z-Indizes zur Laufzeit (Stacking Contexts).

BWEB V1.0 ist nun stabil (Freeze).
