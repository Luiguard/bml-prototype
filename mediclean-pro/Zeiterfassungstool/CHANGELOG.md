# Changelog

Alle Änderungen an diesem Projekt werden in dieser Datei dokumentiert.
Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

---

## [Unreleased]

### 2026-06-10 — Planungsphase

#### Added
- `ARCHITECTURE.md` erstellt: Vollständige Systemdokumentation mit:
  - Systemübersicht, Architekturprinzipien, Rollen- und Rechtekonzept
  - Technologie-Stack-Entscheidung (Next.js, PostgreSQL, Prisma, Redis, BullMQ)
  - Vollständiges Datenmodell (13 Kernentitäten)
  - Phase 1–4 mit sichtbaren Funktionen UND unsichtbarer Infrastruktur
  - Querschnittsthemen: Offline-Strategie, Plausibilitätsregeln, Sicherheitsmaßnahmen, Onboarding
  - API-Endpunkte pro Phase
  - Ziel-Verzeichnisstruktur
  - 5 Architecture Decision Records (ADR-001 bis ADR-005)
  - Nicht-funktionale Anforderungen (Performance, Verfügbarkeit, DSGVO)
- `CHANGELOG.md` erstellt: Dieses Dokument.
- `implementation_plan.md` (Artifact) erstellt: Kurzfassung des Plans zur Freigabe.

#### Entscheidungen (ADR)
- **ADR-001:** Next.js Full-Stack statt separatem Backend → Single Deployment, geteilte Types.
- **ADR-002:** PostgreSQL + Prisma → Relationale Zeitdaten, ACID, PostGIS für Geo.
- **ADR-003:** Row-Level Tenant-Isolation via `tenantId` → Einfach für MVP, skalierbar.
- **ADR-004:** Vanilla CSS mit Custom Properties → Theming pro Tenant, maximale Kontrolle.
- **ADR-005:** Offline-first mit Background Sync → Zuverlässiges Stempeln ohne Netz.

#### Fehlende Bausteine identifiziert und ergänzt
**Phase 1 (Basis):**
- Audit-Log (revisionssicher, append-only)
- Offline-Fallback (IndexedDB + Background Sync)
- Konfigurierbare Arbeitszeitmodelle (Gleitzeit, Schicht, Kernzeit)
- Automatische Plausibilitätsprüfungen (Überlappungen, Pausenregeln, Extremwerte)
- Benutzer-/Rollenverwaltung mit Modul-Aktivierung
- Mandantenfähigkeit (Row-Level Isolation)
- Auth-Security (Argon2, JWT Rotation, Rate Limiting)
- Onboarding-Assistent (3-Schritt-Wizard)
- Automatische Fehlererkennung (fehlende Check-outs, Anomalien)

**Phase 2 (Abwesenheiten & Dokumente):**
- Genehmigungs-Workflow mit Eskalation (48h-Timeout)
- Kalender-Sync (ICS-Feed)
- Dokumenten-Verschlüsselung (AES-256 at-rest)
- Dokumenten-Versionierung
- Upload-Security (MIME-Validation, ClamAV)
- Feingranulare Dokumenten-Rechte (Lohnzettel nur HR + betroffener MA)
- Async Queue (BullMQ für E-Mail/Push)

**Phase 3 (Erweiterte Module):**
- Mehrstufige Dienstplan-Rollen (Planer, Freigeber, Tausch)
- Projektkosten & Stundensätze
- Automatische Report-Generierung (monatlich per E-Mail)
- Lohnverrechnungs-API (BMD, RZL, DATEV, SAP)
- Benachrichtigungsregeln pro Benutzer (Self-Service)
- Redis Caching mit Invalidation
- Geofencing DSGVO-konform (kryptografischer Opt-in)

**Phase 4 (Skalierung):**
- Caching-Strategien (Redis, CDN, Rate Limits)
- Monitoring & Alerting (Sentry, Prometheus)
- Backup-Strategie (täglich, 30d Retention, Restore-Tests)
- DSGVO-Datenlebenszyklus (Löschfristen, Auskunftsrecht, Datenexport)
- Theming-System (CSS Vars pro Tenant, Logo-Upload)
- High Availability (Stateless, PgBouncer, Read-Replicas)
- Daten-Archivierung (Archiv-Tabellen)

### 2026-06-10 — Phase 1 Implementierung (Frontend + Infrastruktur)

#### Added — Infrastruktur
- `docker-compose.yml`: PostgreSQL 16 + Redis 7 mit Health Checks
- `.env.local`: Environment-Variablen für lokale Entwicklung
- `prisma/schema.prisma`: 13 Entitäten (Tenant, User, TimeEntry, Shift, Absence, SickReport, BusinessTrip, Document, Project, WorkModel, AuditLog, Notification)
- `next.config.ts`: Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- `public/manifest.json`: PWA Manifest
- `public/sw.js`: Service Worker mit Offline-Queue (IndexedDB) und Background Sync
- `public/icons/`: PWA App-Icon (192px + 512px)

#### Added — Bibliotheken
- `src/lib/auth-context.tsx`: Auth Context Provider (React Context) mit `RequireAuth` Route Guard
- `src/lib/db.ts`: Prisma Client Singleton
- `src/lib/auth.ts`: JWT, Passwort-Hashing (SHA-256), Rate Limiting, Session-Extraktion
- `src/lib/audit.ts`: Append-only Audit-Log Service mit Diff-Utility
- `src/lib/validation.ts`: Plausibilitätsprüfungen (Überlappungen, Pausen, Extremwerte, Abwesenheits-Konflikte)
- `src/types/index.ts`: Shared TypeScript Types (Dashboard, TimeEntry, User, API-Responses)

#### Added — UI / Pages
- `src/app/globals.css`: Design System (Dark Theme, CSS Custom Properties, 600+ LOC)
- `src/app/layout.tsx`: Root Layout mit AuthProvider Wrapper
- `src/components/layout/Sidebar.tsx`: Navigation mit rollenbasierter Sichtbarkeit, Logout, echtem User-Namen
- `src/components/layout/Header.tsx`: Sticky Header mit mobilem Menu-Toggle
- `src/components/layout/AppShell.tsx`: Wrapper mit `RequireAuth` (Auto-Redirect zur Login-Seite) und SW Registration
- `src/app/login/page.tsx`: Eigene Login-Seite mit Formular, Error-Handling, Demo-Logins und Link zu "Passwort vergessen"
- `src/app/passwort-vergessen/page.tsx`: Formular zur Anforderung des Reset-Links
- `src/app/passwort-reset/page.tsx`: Formular zur Vergabe des neuen Passworts inkl. Token-Validierung
- `src/app/benutzerverwaltung/page.tsx`: Benutzerverwaltung (nur für Admins) - Listenansicht mit Stats und Erstell-Formular (Rollen, Module)
- `src/app/page.tsx`: Dashboard (Quick Actions, Stats Cards, nächster Dienst/Dienstreise, Buchungstabelle)
- `src/app/zeiterfassung/page.tsx`: Zeiterfassung (manuelle Buchung, Tages-/Wochenansicht, Summenkarten)
- `src/app/abwesenheiten/page.tsx`: Abwesenheiten (Kontingent-Karten, Antrags-Tabelle)
- `src/app/dokumente/page.tsx`: Dokumente (Ungelesen-Status, Download, Bestätigung)
- `src/app/dienstplan/page.tsx`: Dienstplan (Wochenkalender-Grid)
- `src/app/einstellungen/page.tsx`: Einstellungen (Profil, Benachrichtigungen, Passwort)

#### Added — API
- `src/app/api/auth/login/route.ts`: Login-Endpunkt (In-Memory Demo-User) mit JWT Cookie
- `src/app/api/auth/logout/route.ts`: Logout-Endpunkt (Löscht Cookie)
- `src/app/api/auth/me/route.ts`: Session-Validierung / Aktueller Benutzer
- `src/app/api/auth/forgot-password/route.ts`: API für Passwort-Reset-Link (generiert Token, loggt Link in Konsole)
- `src/app/api/auth/reset-password/route.ts`: API für Vergabe des neuen Passworts
- `src/app/api/users/route.ts`: GET/POST Benutzerverwaltung (Demo-Implementation für Admins)
- `src/app/api/health/route.ts`: Health-Check Endpoint

#### Status / Architektur-Anpassungen
- **Datenbank:** Auf SQLite umgestellt (`dev.db`), da Docker in der lokalen Umgebung für den ersten Prototyp nicht verfügbar war. Schema (`schema.prisma`) wurde angepasst (Entfernung von PostgreSQL-spezifischen Enums und `Json`-Typen). Prisma CLI Version auf `v6` fixiert, um Kompatibilität mit Offline-Entwicklung zu gewährleisten.
- **Seeding:** `prisma/seed.ts` erstellt und ausgeführt (Demo-Firma, Admin, Supervisor, Mitarbeiter generiert).
- **Authentication:** Flow funktioniert vollständig über Datenbankabfragen statt statischem Mock.
- **Benutzerverwaltung:** API liest/schreibt nun direkt in die SQLite-Datenbank.
- Dev-Server läuft auf http://localhost:3000
