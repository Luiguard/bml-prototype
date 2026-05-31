# BWEB Inspector & Privacy Companion Listing Details

This document compiles all necessary metadata, permissions justifications, and store listing assets for publishing the **BWEB Inspector & Privacy Companion** extension to the Chrome Web Store.

---

## 📋 General Store Metadata

*   **Extension Name**: BWEB Inspector & Privacy Companion
*   **Version**: 1.0.0
*   **Detailed Description**:
    BWEB (Binary Web) bricht mit traditionellen, cookies-basierten Tracking-Mechanismen und lädt Webseiten als hochoptimierte Binärdaten direkt auf die GPU. Mit dieser Erweiterung können Entwickler und sicherheitsbewusste Nutzer die binäre Architektur live erforschen und verstehen.
    
    Kern-Features:
    - **Natives BWEB-Polyfill**: Ersetzt serverseitige Scripts und rendert BWEB-Ressourcen (.bml, .bdt, .blb, .bib, .bweb) direkt und nativ im Browser.
    - **Selektive Aktivität**: Wird ausschließlich bei BWEB-Dateitypen aktiv; klassische HTML-Webseiten bleiben unberührt.
    - **Live BWEB Status**: Erkenne sofort, ob die aktuelle Webseite im hochperformanten, cookie-freien BWEB-Format gerendert wird.
    - **1-Klick Konvertierung**: Lade die aktuelle Seite direkt in das BWEB-Converter-Tool, um Sektionsverteilungen (BML, BDT, BLB, BIB) zu analysieren.
    - **Cookie-freie Aufklärung**: Detaillierte Plain-Text Erläuterungen, warum BWEB keine DSGVO-Cookie-Banner benötigt.
    - **Zukunft der Werbung**: Entdecke, wie binary BIB Ad-Slices sichere und extrem schnelle Banner ohne Tracking ermöglichen.
*   **Category**: Developer Tools / Productivity
*   **Supported Languages**: German (de)

---

## 🔒 Permissions & Host Justification

Every permission used in `manifest.json` is strictly necessary to inspect and route active tabs:

| Permission / Host | Specific Justification for Reviewers |
| :--- | :--- |
| `activeTab` | Ermöglicht es der Erweiterung, temporär die URL und den Zustand des aktiven Tabs auszulesen, um zu prüfen, ob es sich um eine BWEB-Seite handelt. |
| `scripting` | Notwendig, um BWEB-Statusanalysen auf der geladenen Seite durchzuführen. |
| `tabs` | Wird benötigt, um bei Klick auf "aktuelle Seite konvertieren" einen neuen Tab mit der Quell-URL als Parameter im Online-Konverter zu öffnen. |
| `storage` | Speichert lokale Benutzereinstellungen bezüglich bevorzugter Konverter-Endpunkte. |
| `matches` (Content Scripts) | Registriert `content.js` ausschließlich für URLs, die auf BWEB-relevante Dateiendungen (.bml, .bdt, .blb, .bib, .bweb) enden, um diese nativ im Browser als Binärströme abzufangen und zu rendern. Klassische HTML-Webseiten werden nicht beeinflusst. |

---

## 📄 Privacy Policy & Data Use

*   **Data Collection Declaration**: The **BWEB Inspector & Privacy Companion** extension **does not collect, store, or transmit any user data**. All analysis is executed locally inside the browser. No data is sent to external servers.
*   **Link to Privacy Policy**: [https://mediclean-pro.at/bweb-converter/privacy-policy.html](https://mediclean-pro.at/bweb-converter/privacy-policy.html)

---

## 📦 Version History

### v1.0.0 (2026-05-29) - Initial Release
- **Description**: Erstveröffentlichung des BWEB Inspectors zur Analyse von binären BML-, BDT- und BLB-Strukturen sowie Bereitstellung von Cookie-freien und Werbe-Slices-Aufklärungen. Native Polyfill-Interzeption für BWEB-Ressourcen integriert.
