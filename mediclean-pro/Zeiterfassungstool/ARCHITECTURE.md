# Zeiterfassungssystem – Architektur & Systemdokumentation

> **Projekt:** MediClean Pro Zeiterfassung  
> **Version:** 0.1.0-draft  
> **Erstellt:** 2026-06-10  
> **Status:** Planungsphase

---

## 1. Systemübersicht

### 1.1 Zweck
Plattformunabhängiges Zeiterfassungssystem als Web-App + PWA mit Rollenlogik (Mitarbeiter, Vorgesetzter, HR/Admin) und modularen Funktionen, die pro Benutzer/Gruppe aktivierbar sind.

### 1.2 Architekturprinzipien
| Prinzip | Beschreibung |
|---|---|
| API-first | Alle Funktionen über REST-API erreichbar, damit später Hardware-Stempeluhren, Terminals oder native Apps angebunden werden können |
| Mandantenfähig | Multi-Tenant-Architektur ab Tag 1 (Schema-basierte Isolation) |
| Revisionssicher | Append-only Audit-Log für alle zeit- und personalrelevanten Daten |
| Offline-fähig | PWA mit IndexedDB-Puffer für Check-in/Check-out ohne Internet |
| Modular | Funktionsmodule pro Benutzer/Gruppe aktivier-/deaktivierbar |
| DSGVO-konform | Datenschutz by Design, Löschfristen, Auskunftsrecht |

### 1.3 Rollen & Rechte
| Rolle | Berechtigungen |
|---|---|
| **Mitarbeiter** | Eigene Zeiten buchen, eigene Dokumente lesen, eigene Anträge stellen |
| **Vorgesetzter** | + Teamübersicht, Genehmigungen, einfache Auswertungen |
| **HR/Admin** | + Vollzugriff, Benutzerverwaltung, Rollen, globale Einstellungen, Dokumenten-Upload |
| **System-Admin** | + Mandantenverwaltung, Infrastruktur, API-Keys |

Feingranulare Rechte:
- Modul-Aktivierung pro Rolle/Benutzergruppe
- Dokumenten-Sichtbarkeit einschränkbar (z.B. Lohnzettel nur HR)
- Projekterfassung nur für bestimmte Abteilungen

---

## 2. Technologie-Stack

### 2.1 Frontend
| Komponente | Technologie | Begründung |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR/SSG, API Routes, PWA-Support |
| Sprache | TypeScript | Typsicherheit, Refactoring-Sicherheit |
| Styling | Vanilla CSS (Custom Properties) | Maximale Kontrolle, Theming via CSS-Variablen |
| State | Zustand | Leichtgewichtig, kein Boilerplate |
| Offline | Service Worker + IndexedDB | Check-in/out ohne Netz puffern, Background Sync |
| PWA | next-pwa / Workbox | Installierbar auf Android, iOS, Desktop |

### 2.2 Backend
| Komponente | Technologie | Begründung |
|---|---|---|
| Runtime | Node.js 22 LTS | Ecosystem, Performance |
| API | Next.js API Routes (REST) | Single Deployment, API-first |
| ORM | Prisma 6 | Typsichere Queries, Migrations |
| Auth | NextAuth.js v5 + JWT | Access/Refresh Tokens, OAuth2/SSO-fähig |
| Queue | BullMQ + Redis | Asynchrone Jobs (E-Mail, Push, Reports) |
| Scheduler | node-cron / BullMQ Repeatable | Erinnerungen, automatische Reports |

### 2.3 Datenbank & Storage
| Komponente | Technologie | Begründung |
|---|---|---|
| Primär-DB | PostgreSQL 16 | Relational, PostGIS für Geo, ACID |
| Cache | Redis 7 | Session-Cache, Dashboard-Aggregationen, Rate Limiting |
| Object Storage | S3-kompatibel (MinIO / AWS S3) | Dokumente, Arztbestätigungen |
| Suche | PostgreSQL Full-Text | Ausreichend für Dokumentensuche |

### 2.4 Infrastruktur
| Komponente | Technologie |
|---|---|
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Monitoring | Sentry (Error Tracking) |
| Logging | Pino (strukturiertes JSON) |
| Backup | pg_dump + S3 (täglich, 30 Tage Retention) |
| Security Scan | Snyk / npm audit |

---

## 3. Datenmodell (Kernentitäten)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Tenant     │────<│    User       │────<│   TimeEntry      │
│              │     │              │     │ (Check-in/out)   │
│ id           │     │ id           │     │ id               │
│ name         │     │ tenantId     │     │ userId           │
│ slug         │     │ email        │     │ type (WORK/BREAK)│
│ config (JSON)│     │ role         │     │ start            │
│ theme (JSON) │     │ modules[]    │     │ end              │
│ createdAt    │     │ workModel    │     │ duration         │
└─────────────┘     │ locale       │     │ projectId?       │
                     │ passwordHash │     │ locationLat?     │
                     └──────────────┘     │ locationLon?     │
                           │              │ status           │
                           │              │ offlineSync      │
                           │              │ createdAt        │
                           │              └──────────────────┘
                           │
                           │         ┌──────────────────┐
                           │────────<│   Absence         │
                           │         │ id                │
                           │         │ userId            │
                           │         │ type (VACATION/   │
                           │         │  SICK/COMP/OTHER) │
                           │         │ startDate         │
                           │         │ endDate           │
                           │         │ status (PENDING/  │
                           │         │  APPROVED/DENIED) │
                           │         │ approverId?       │
                           │         │ escalatedAt?      │
                           │         │ comment           │
                           │         │ attachmentUrl?    │
                           │         └──────────────────┘
                           │
                           │         ┌──────────────────┐
                           │────────<│   Document        │
                           │         │ id                │
                           │         │ userId            │
                           │         │ uploadedBy        │
                           │         │ type (CONTRACT/   │
                           │         │  PAYSLIP/SCHEDULE)│
                           │         │ filename          │
                           │         │ s3Key             │
                           │         │ version           │
                           │         │ encryptionKey     │
                           │         │ readAt?           │
                           │         │ confirmedAt?      │
                           │         │ createdAt         │
                           │         └──────────────────┘
                           │
                           │         ┌──────────────────┐
                           │────────<│   Shift           │
                           │         │ id                │
                           │         │ userId            │
                           │         │ date              │
                           │         │ startTime         │
                           │         │ endTime           │
                           │         │ breakMinutes      │
                           │         │ type (NORMAL/     │
                           │         │  NIGHT/ONCALL)    │
                           │         │ location          │
                           │         │ locationLat?      │
                           │         │ locationLon?      │
                           │         │ createdAt         │
                           │         └──────────────────┘
                           │
                           │         ┌──────────────────┐
                           │────────<│ BusinessTrip      │
                           │         │ id                │
                           │         │ userId            │
                           │         │ destination       │
                           │         │ purpose           │
                           │         │ startDate         │
                           │         │ endDate           │
                           │         │ kilometers?       │
                           │         │ expenses?         │
                           │         │ status            │
                           │         └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│   AuditLog        │     │   Notification    │
│ id                │     │ id                │
│ tenantId          │     │ userId            │
│ userId            │     │ type              │
│ action            │     │ title             │
│ entity            │     │ body              │
│ entityId          │     │ channel (PUSH/    │
│ oldValue (JSON)   │     │  EMAIL/IN_APP)    │
│ newValue (JSON)   │     │ sentAt            │
│ ipAddress         │     │ readAt?           │
│ userAgent         │     └──────────────────┘
│ timestamp         │
└──────────────────┘     ┌──────────────────┐
                          │   Project         │
                          │ id                │
                          │ tenantId          │
                          │ name              │
                          │ costCenter        │
                          │ hourlyRate?       │
                          │ active            │
                          └──────────────────┘

┌──────────────────┐
│ WorkModel         │
│ id                │
│ tenantId          │
│ name              │
│ type (FLEX/FIXED/ │
│  SHIFT)           │
│ weeklyHours       │
│ coreTimeStart?    │
│ coreTimeEnd?      │
│ maxDailyHours     │
│ minBreakMinutes   │
│ overtimeThreshold │
└──────────────────┘
```

---

## 4. Phasen – Vollständiger Umsetzungsplan

### Phase 1 – Basis (Infrastruktur & Core)

#### 1.1 Sichtbare Funktionen
| # | Feature | Beschreibung |
|---|---------|-------------|
| 1.1.1 | Authentifizierung | Login/Logout, Passwort-Reset, Session-Management |
| 1.1.2 | Zeiterfassung | Check-in/Check-out, Pause, manuelle Buchung |
| 1.1.3 | Schnellaktionen | Große Buttons: „Dienstbeginn", „Pause", „Dienstende" (mobile-optimiert) |
| 1.1.4 | Tages-/Wochenübersicht | Buchungsliste mit Status, Tages-/Wochenstunden, Überstunden |
| 1.1.5 | Dashboard Basis | Aktueller Tag, Woche, nächster Dienst |
| 1.1.6 | Nächster Dienst | Ort, Datum, Uhrzeit (von–bis), Diensttyp |
| 1.1.7 | PWA-Installation | Installierbar auf allen Plattformen |

#### 1.2 Unsichtbare Infrastruktur
| # | Baustein | Beschreibung | Priorität |
|---|---------|-------------|-----------|
| 1.2.1 | **Audit-Log** | Append-only Log für alle Zeitbuchungen und Änderungen (wer, wann, was, alter/neuer Wert). GoBD-konform. | KRITISCH |
| 1.2.2 | **Offline-Fallback** | Service Worker + IndexedDB puffert Check-in/Check-out. Background Sync bei Netzwerkrückkehr. Conflict Resolution (Server wins, User wird informiert). | KRITISCH |
| 1.2.3 | **Arbeitszeitmodelle** | Konfigurierbare Modelle: Gleitzeit, fixe Schichten, individuelle Wochenstunden, Kernzeiten, Überstunden-Schwellwerte. | KRITISCH |
| 1.2.4 | **Plausibilitätsprüfungen** | Automatische Validierung: Doppelte Buchungen, fehlende Pausen (> 6h → 30min), extrem lange Dienste (> 12h Warnung), Überlappungen. | KRITISCH |
| 1.2.5 | **Benutzer-/Rollenverwaltung** | CRUD für Benutzer, Rollenzuweisung, Modul-Aktivierung pro User/Gruppe. | KRITISCH |
| 1.2.6 | **Mandantenfähigkeit** | Schema-basierte Tenant-Isolation. Jeder Request wird gegen `tenantId` validiert. | HOCH |
| 1.2.7 | **Auth Security** | JWT Access/Refresh Token Lifecycle, Argon2 Password Hashing, Rate Limiting (Login: 5/min), CORS, Security Headers (CSP, HSTS). | KRITISCH |
| 1.2.8 | **DB-Migrationen** | Versionierte Prisma-Migrationen, Seed-Daten für Development. | HOCH |
| 1.2.9 | **CI/CD** | GitHub Actions: Lint → Test → Build → Docker Image → Deploy. | HOCH |
| 1.2.10 | **Observability** | Pino JSON-Logs, Sentry Error Tracking, `/health` Endpoint. | HOCH |
| 1.2.11 | **Onboarding-Assistent** | Geführter Wizard für neue Benutzer (3 Schritte: Profil, erste Buchung, Dashboard-Tour). | MITTEL |
| 1.2.12 | **Fehlererkennung** | Automatische Erkennung: fehlende Check-outs (nach 14h), ungewöhnlich lange Dienste, widersprüchliche Einträge. In-App-Warnung + Vorgesetzten-Benachrichtigung. | HOCH |

#### 1.3 API-Endpunkte Phase 1
```
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
POST   /api/auth/reset-password

GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id

POST   /api/time-entries              (Check-in)
PATCH  /api/time-entries/:id          (Check-out, Korrektur)
GET    /api/time-entries?from=&to=    (Eigene Buchungen)
GET    /api/time-entries/summary      (Tages-/Wochensummen)

GET    /api/shifts/next               (Nächster Dienst)
GET    /api/shifts?from=&to=          (Dienstplan-Ansicht)

GET    /api/dashboard                 (Aggregierte Daten)

GET    /api/audit-log?entity=&from=   (Nur Admin)

GET    /api/health
```

---

### Phase 2 – Abwesenheiten & Dokumente

#### 2.1 Sichtbare Funktionen
| # | Feature | Beschreibung |
|---|---------|-------------|
| 2.1.1 | Urlaubsantrag | Formular: Zeitraum, Art, Kommentar → Genehmigungsworkflow |
| 2.1.2 | Krankenstandsmeldung | Schnellformular: Beginn, Dauer, Upload Arztbestätigung |
| 2.1.3 | Fehlzeiten-Übersicht | Kontingente: Resturlaub, konsumiert, geplant |
| 2.1.4 | Dokumentenordner | Download-Bereich: Verträge, Lohnzettel, Dienstpläne |
| 2.1.5 | Dokumenten-Upload (Admin) | Upload-Interface am PC für HR/Admin |
| 2.1.6 | Kalender-Integration | Abwesenheiten im Wochenkalender |

#### 2.2 Unsichtbare Infrastruktur
| # | Baustein | Beschreibung | Priorität |
|---|---------|-------------|-----------|
| 2.2.1 | **Genehmigungs-Workflow mit Eskalation** | Status-Machine: PENDING → APPROVED/DENIED. Wenn Vorgesetzter 48h nicht reagiert → automatische Eskalation an HR. Konfigurierbare Eskalationsketten. | KRITISCH |
| 2.2.2 | **Kalender-Sync (ICS)** | ICS-Feed-Endpoint pro User (Urlaub, Krankenstand, Dienste). Abonnierbar in Outlook/Google Calendar. | HOCH |
| 2.2.3 | **Dokumenten-Verschlüsselung** | AES-256 at-rest Verschlüsselung für Lohnzettel & Verträge. Key-Management via Environment-Variablen. Pre-signed URLs mit 15min TTL. | KRITISCH |
| 2.2.4 | **Dokumenten-Versionierung** | Jedes Update erzeugt neue Version. Alte Versionen bleiben abrufbar. Versions-History mit Diff-Anzeige. | HOCH |
| 2.2.5 | **Benachrichtigungen (Basis)** | In-App Notifications: „Urlaub genehmigt", „Dokument hochgeladen", „Krankenstand bestätigt". Glocken-Icon mit Badge. | KRITISCH |
| 2.2.6 | **Upload-Security** | Serverseitige MIME-Type-Validierung (nur PDF, JPG, PNG). Max 10MB. ClamAV Virenscan. | KRITISCH |
| 2.2.7 | **Async Queue** | BullMQ für E-Mail-Versand, Push-Notifications, Eskalations-Timer. | HOCH |
| 2.2.8 | **Datenintegrität** | ACID-Transaktionen für Genehmigungsflows. Soft-Deletes für alle Entitäten. | KRITISCH |
| 2.2.9 | **Dokumenten-Rechte** | Feingranulare Sichtbarkeit: Lohnzettel nur HR + betroffener MA. Nicht jeder Admin darf alles sehen. | KRITISCH |

#### 2.3 API-Endpunkte Phase 2
```
POST   /api/absences                  (Antrag stellen)
GET    /api/absences?status=&type=    (Eigene Abwesenheiten)
PATCH  /api/absences/:id/approve      (Vorgesetzter)
PATCH  /api/absences/:id/deny         (Vorgesetzter)
GET    /api/absences/quota            (Resturlaub etc.)

POST   /api/sick-reports              (Krankmeldung)
GET    /api/sick-reports              (Historie)
PATCH  /api/sick-reports/:id          (Update/Abschluss)

POST   /api/documents                 (Upload, Admin)
GET    /api/documents                 (Eigene Dokumente)
GET    /api/documents/:id/download    (Pre-signed URL)
GET    /api/documents/:id/versions    (Versionshistorie)
PATCH  /api/documents/:id/confirm     (Gelesen-Bestätigung)

GET    /api/calendar/ics              (ICS-Feed)

GET    /api/notifications             (In-App)
PATCH  /api/notifications/:id/read    (Als gelesen markieren)
```

---

### Phase 3 – Erweiterte Module

#### 3.1 Sichtbare Funktionen
| # | Feature | Beschreibung |
|---|---------|-------------|
| 3.1.1 | Projektzeiterfassung | Projektwahl bei Buchung, Stunden pro Projekt/Kostenstelle |
| 3.1.2 | Dienstplan/Schichtplanung | Monats-/Wochenplan, Tausch-Anfragen, Wunschdienste |
| 3.1.3 | Reports & Exporte | Überstunden, Fehlzeiten, Dienstreisen pro Zeitraum |
| 3.1.4 | Push-Benachrichtigungen | Erinnerung vor Dienstbeginn, fehlendes Check-out |
| 3.1.5 | Teamübersicht | Anwesenheit heute, wer im Krankenstand/Urlaub |
| 3.1.6 | Geofencing (optional) | Standortprüfung bei Check-in |
| 3.1.7 | Dienstreisen-Erfassung | Ort, Zweck, Zeitraum, Kilometer/Spesen |

#### 3.2 Unsichtbare Infrastruktur
| # | Baustein | Beschreibung | Priorität |
|---|---------|-------------|-----------|
| 3.2.1 | **Mehrstufige Dienstplan-Rollen** | Planer (erstellt), Freigeber (genehmigt), Ersatzsuche (bei Ausfall), Tausch-Anfragen (Mitarbeiter untereinander). | HOCH |
| 3.2.2 | **Projektkosten & Stundensätze** | Hinterlegbare Stundensätze pro Projekt/Mitarbeiter. Automatische Kostenberechnung. Kostenstellen-Zuordnung. | MITTEL |
| 3.2.3 | **Automatische Report-Generierung** | Monatliche Stundenberichte per E-Mail (PDF). Konfigurierbar: Empfänger, Zeitpunkt, Inhalt. Stream-basiert für große Datenmengen. | HOCH |
| 3.2.4 | **Lohnverrechnungs-API** | Export-Formate: BMD, RZL, DATEV, SAP. CSV/XML-Export mit konfigurierbarem Mapping. Webhook-Option für Echtzeit-Push. | HOCH |
| 3.2.5 | **Benachrichtigungsregeln pro User** | Jeder Benutzer konfiguriert selbst: welche Events (Dienstplan-Änderung, Urlaubs-Status, Check-out-Erinnerung), welcher Kanal (Push/E-Mail/In-App). | HOCH |
| 3.2.6 | **Redis Caching** | Dashboard-Aggregationen (TTL 5min), Dienstplan-Cache, Session-Management. Cache-Invalidation bei Datenänderung. | HOCH |
| 3.2.7 | **Task Scheduler** | BullMQ Repeatable Jobs: Erinnerungen, Eskalationen, Report-Generierung, Cleanup. | HOCH |
| 3.2.8 | **Geofencing & DSGVO** | PostGIS für Koordinatenvalidierung. Kryptografisch gesicherter Opt-in mit Timestamp. Nur für explizit aktivierte Benutzer. Standortdaten werden nicht dauerhaft gespeichert. | MITTEL |

#### 3.3 API-Endpunkte Phase 3
```
GET    /api/projects                  (Projektliste)
POST   /api/projects                  (Projekt anlegen)
GET    /api/projects/:id/report       (Projektstunden)

GET    /api/schedule?week=            (Dienstplan)
POST   /api/schedule                  (Dienst zuweisen)
POST   /api/schedule/:id/swap        (Tausch-Anfrage)
PATCH  /api/schedule/:id/approve     (Tausch genehmigen)

GET    /api/reports/overtime?from=&to=
GET    /api/reports/absences?from=&to=
GET    /api/reports/team-overview
POST   /api/reports/export            (CSV/Excel/PDF)
POST   /api/reports/payroll-export    (BMD/DATEV etc.)

GET    /api/notifications/settings    (Eigene Regeln)
PUT    /api/notifications/settings    (Regeln speichern)

POST   /api/business-trips            (Dienstreise erfassen)
GET    /api/business-trips?from=&to=

POST   /api/geofence/validate         (Standortprüfung)
```

---

### Phase 4 – Feinschliff & Skalierung

#### 4.1 Sichtbare Funktionen
| # | Feature | Beschreibung |
|---|---------|-------------|
| 4.1.1 | Mehrsprachigkeit | Deutsch, Englisch, weitere pro Benutzer |
| 4.1.2 | Theming | Firmenlogo, Farben, Custom Branding |
| 4.1.3 | Erweiterte Auswertungen | Grafische Dashboards, Trends, Vergleiche |
| 4.1.4 | Digitale Bestätigungen | „Gelesen & verstanden"-Workflows |

#### 4.2 Unsichtbare Infrastruktur
| # | Baustein | Beschreibung | Priorität |
|---|---------|-------------|-----------|
| 4.2.1 | **Caching-Strategien** | Redis-Layer, Edge-Caches (CDN), API Rate-Limits (100/min pro User, 1000/min pro Tenant). | HOCH |
| 4.2.2 | **Monitoring & Logging** | Sentry (Errors), Pino (structured Logs), Prometheus Metrics (optional). Alerting bei kritischen Fehlern. | KRITISCH |
| 4.2.3 | **Backup-Strategie** | Tägliche DB-Backups (pg_dump → S3). Dokumenten-Backups (S3 Cross-Region). Monatliche Restore-Tests. 30 Tage Retention. | KRITISCH |
| 4.2.4 | **DSGVO-Datenlebenszyklus** | Automatische Löschfristen (z.B. Zeitdaten nach 7 Jahren). Datenexport-API (Art. 20 DSGVO). Auskunftsanfragen-Workflow (Art. 15). Lösch-Requests mit Audit-Trail. | KRITISCH |
| 4.2.5 | **Theming-System** | CSS Custom Properties pro Tenant. Logo-Upload, Primary/Accent-Farben, Dark/Light Mode. Tenant-Config in DB. | MITTEL |
| 4.2.6 | **High Availability** | Stateless Backend (kein Server-State). PgBouncer (Connection Pooling). Read-Replicas für Reports. | HOCH |
| 4.2.7 | **DevSecOps** | Automatisches Dependency-Scanning (Snyk). Strikte CSP. Regelmäßige Penetration-Tests. | HOCH |
| 4.2.8 | **i18n-Delivery** | JSON-basierte Übersetzungsdateien. Serverseitiges Fallback (de → en). Lazy-Loading pro Sprache. | MITTEL |
| 4.2.9 | **Daten-Archivierung** | Automatische Migration alter Daten in Archiv-Tabellen. Archivierte Daten bleiben lesbar, werden aber aus aktiven Queries ausgeschlossen. | MITTEL |

---

## 5. Querschnittsthemen

### 5.1 Offline-Strategie (PWA)
```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  User klickt     │────>│ IndexedDB     │────>│ Background   │
│  "Check-in"      │     │ Queue         │     │ Sync API     │
│  (offline)       │     │              │     │              │
└─────────────────┘     └──────────────┘     └──────┬───────┘
                                                      │
                                                      │ Netzwerk verfügbar
                                                      ▼
                                              ┌──────────────┐
                                              │ Server API    │
                                              │ Conflict      │
                                              │ Resolution    │
                                              └──────────────┘
```
- **Puffer:** Check-in/Check-out, Pausenbuchung
- **Sync:** Bei Netzwerkrückkehr automatisch
- **Konflikte:** Server-Timestamp gewinnt, User wird informiert
- **Cache:** Letzte 7 Tage Buchungen, Dienstplan, Dashboard-Snapshot

### 5.2 Plausibilitätsregeln
| Regel | Aktion |
|-------|--------|
| Doppelte Buchung (Überlappung) | Ablehnung mit Hinweis |
| Arbeitszeit > 6h ohne Pause | Warnung, automatische 30min-Pause vorschlagen |
| Arbeitszeit > 10h | Warnung an User + Vorgesetzten |
| Arbeitszeit > 12h | Blockierung (manuelles Override durch Admin) |
| Check-out fehlt nach 14h | Automatische Warnung, Vorgesetzter wird benachrichtigt |
| Urlaub + Zeitbuchung am gleichen Tag | Ablehnung des Antrags oder der Buchung |
| Krankenstand + Check-in | Warnung, ggf. Krankenstand-Ende setzen |

### 5.3 Sicherheitsmaßnahmen
| Schicht | Maßnahme |
|---------|----------|
| Transport | HTTPS everywhere, HSTS Preload |
| Auth | Argon2id, JWT RS256, Refresh Token Rotation |
| API | Rate Limiting, Input Validation (Zod), CORS Whitelist |
| DB | Parameterized Queries (Prisma), Row-Level Security via tenantId |
| Storage | AES-256 at-rest, Pre-signed URLs (15min TTL) |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options |
| Audit | Unveränderliches Append-only Log |
| Dependencies | Automatisiertes Scanning (Snyk), Lock-File Pinning |

### 5.4 Onboarding-Assistent
```
Schritt 1: Profil vervollständigen
  → Name, Abteilung, Arbeitszeitmodell bestätigen

Schritt 2: Erste Buchung simulieren
  → Interaktives Tutorial: Check-in → Pause → Check-out

Schritt 3: Dashboard-Tour
  → Highlights: Nächster Dienst, Stundenkonto, Dokumentenordner

Optional: Erneut aufrufbar unter Einstellungen → Hilfe
```

---

## 6. Verzeichnisstruktur (Ziel)

```
Zeiterfassungstool/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    (Dashboard)
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── time-entries/
│   │   │   ├── absences/
│   │   │   ├── documents/
│   │   │   ├── shifts/
│   │   │   ├── notifications/
│   │   │   └── reports/
│   │   ├── zeiterfassung/
│   │   ├── abwesenheiten/
│   │   ├── dokumente/
│   │   ├── dienstplan/
│   │   └── einstellungen/
│   ├── components/
│   │   ├── ui/                         (Buttons, Cards, Tables)
│   │   ├── layout/                     (Nav, Sidebar, Header)
│   │   ├── dashboard/
│   │   ├── time-tracking/
│   │   └── documents/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── audit.ts
│   │   ├── validation.ts
│   │   ├── offline.ts
│   │   └── s3.ts
│   ├── hooks/
│   ├── stores/
│   ├── types/
│   └── i18n/
│       ├── de.json
│       └── en.json
├── docker-compose.yml
├── Dockerfile
├── ARCHITECTURE.md
├── CHANGELOG.md
├── package.json
└── tsconfig.json
```

---

## 7. Architektur-Entscheidungen (ADR)

### ADR-001: Next.js statt separatem Backend
**Kontext:** Separates Frontend + Backend vs. Full-Stack Framework.  
**Entscheidung:** Next.js mit API Routes.  
**Begründung:** Single Deployment, geteilte Types, weniger Infrastruktur, SSR/SSG für Performance.  
**Konsequenz:** API-Routes werden bei Skalierung ggf. in eigenständige Services extrahiert.

### ADR-002: PostgreSQL + Prisma
**Kontext:** NoSQL vs. Relational.  
**Entscheidung:** PostgreSQL mit Prisma ORM.  
**Begründung:** Zeitdaten sind hochrelational. ACID-Transaktionen für Genehmigungsflows. PostGIS für Geofencing. Prisma bietet typsichere Queries und versionierte Migrationen.

### ADR-003: Schema-basierte Mandantentrennung
**Kontext:** Shared DB vs. DB-per-Tenant vs. Schema-per-Tenant.  
**Entscheidung:** Row-Level Isolation via `tenantId` (Phase 1), Migration zu Schema-per-Tenant optional (Phase 4).  
**Begründung:** Row-Level ist einfacher für MVP, Schema-Isolation bietet stärkere Trennung bei Bedarf.

### ADR-004: Vanilla CSS statt Framework
**Kontext:** TailwindCSS vs. Vanilla CSS.  
**Entscheidung:** Vanilla CSS mit Custom Properties.  
**Begründung:** Maximale Kontrolle, Theming via CSS-Variablen pro Tenant, kein Build-Overhead, einfacher zu debuggen.

### ADR-005: Offline-first mit Background Sync
**Kontext:** Online-only vs. Offline-Fallback.  
**Entscheidung:** Offline-Puffer für zeitkritische Aktionen (Check-in/out).  
**Begründung:** Mitarbeiter im Außendienst oder in Bereichen mit schlechtem Empfang müssen zuverlässig stempeln können.

---

## 8. Nicht-funktionale Anforderungen

| Anforderung | Zielwert |
|---|---|
| Ladezeit (LCP) | < 2.5s |
| API Response (P95) | < 200ms |
| Verfügbarkeit | 99.5% |
| Backup RPO | 24h |
| Backup RTO | 4h |
| Max. gleichzeitige User | 500 (Phase 1), 5000 (Phase 4) |
| Offline-Puffer | 7 Tage Buchungen |
| DSGVO-Löschfrist | Automatisiert nach Konfiguration |
| Barrierefreiheit | WCAG 2.1 AA |

---

*Dieses Dokument wird mit jeder Phase aktualisiert. Änderungen werden im CHANGELOG.md protokolliert.*
