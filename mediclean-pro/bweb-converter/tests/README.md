# BWEB Test-Suite & Validator

Dieses Verzeichnis enthält die offizielle Test-Suite für BWEB 1.0. 
Um Determinismus über alle Browser und Endgeräte hinweg zu garantieren, testen wir Änderungen an der Engine mit einem Roundtrip-Verfahren.

## Konzepte

### 1. Golden-Files
Golden-Files sind "eingefrorene" korrekte Versionen des erwarteten Outputs.
Beim Ausführen von `bwebc test` wird das generierte BWEB/Visual-DOM mit den hinterlegten Golden-Files (`golden_layout.json`, `test1_golden.png`) verglichen.

### 2. Roundtrip Validator
Der Roundtrip-Validator (`roundtrip.js`) simuliert den vollständigen Lebenszyklus eines DOM-Elements:
1. Eine HTML-Source wird über `bwebc` in das BWEB-Format kompiliert.
2. Die Payload wird in einen Headless-Browser (Puppeteer) geladen.
3. Die `bweb-engine` interpretiert die Payload und generiert den virtuellen Layout-Baum (DOM-Dump).
4. Der Dump wird mit dem Golden-File verglichen.

### 3. Der "Drift-Alarm"
Jede Regression in der Layout-Engine (z.B. ein Rundungsfehler bei Flexbox) oder im Compiler wird durch den Drift-Alarm abgefangen. 
**Regel:** Schlägt der Drift-Alarm an, muss der PR abgelehnt werden, es sei denn, die Änderung war beabsichtigt und das Golden-File wird offiziell erneuert.

## Usage

```bash
# Führt Golden-File Tests aus
node bwebc.js test

# Führt den tiefen Roundtrip Validator aus
node bwebc.js roundtrip
```
