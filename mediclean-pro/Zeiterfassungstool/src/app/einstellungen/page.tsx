'use client';

import AppShell from '@/components/layout/AppShell';

export default function EinstellungenPage() {
  return (
    <AppShell title="Einstellungen">
      <div className="grid grid-2">
        <div className="card animate-in">
          <div className="card-header">
            <span className="card-title">Profil</span>
          </div>
          <div className="form-group">
            <label className="form-label">Vorname</label>
            <input type="text" defaultValue="Max" />
          </div>
          <div className="form-group">
            <label className="form-label">Nachname</label>
            <input type="text" defaultValue="Arbeiter" />
          </div>
          <div className="form-group">
            <label className="form-label">E-Mail</label>
            <input type="email" defaultValue="m.arbeiter@firma.at" />
          </div>
          <div className="form-group">
            <label className="form-label">Sprache</label>
            <select defaultValue="de">
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
          <button className="btn btn-primary">Speichern</button>
        </div>

        <div className="card animate-in" style={{ animationDelay: '50ms' }}>
          <div className="card-header">
            <span className="card-title">Benachrichtigungen</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {[
              { label: 'Erinnerung vor Dienstbeginn', defaultChecked: true },
              { label: 'Fehlendes Check-out', defaultChecked: true },
              { label: 'Urlaub genehmigt/abgelehnt', defaultChecked: true },
              { label: 'Neues Dokument', defaultChecked: true },
              { label: 'Dienstplan-Änderung', defaultChecked: false },
            ].map((item) => (
              <label
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-sm) 0',
                  borderBottom: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)' }}>{item.label}</span>
                <input
                  type="checkbox"
                  defaultChecked={item.defaultChecked}
                  style={{ width: 'auto', accentColor: 'var(--color-accent)' }}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card animate-in" style={{ marginTop: 'var(--spacing-xl)', animationDelay: '100ms' }}>
        <div className="card-header">
          <span className="card-title">Sicherheit</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--spacing-lg)' }}>
          <div className="form-group">
            <label className="form-label">Aktuelles Passwort</label>
            <input type="password" />
          </div>
          <div className="form-group">
            <label className="form-label">Neues Passwort</label>
            <input type="password" />
          </div>
          <div className="form-group">
            <label className="form-label">Passwort bestätigen</label>
            <input type="password" />
          </div>
        </div>
        <button className="btn btn-secondary" style={{ marginTop: 'var(--spacing-md)' }}>Passwort ändern</button>
      </div>
    </AppShell>
  );
}
