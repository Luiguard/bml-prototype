'use client';

import AppShell from '@/components/layout/AppShell';

const MOCK_DOCS = [
  { id: '1', name: 'Dienstvertrag_2026.pdf', type: 'Vertrag', uploaded: '01.01.2026', size: '245 KB', read: true, confirmed: true },
  { id: '2', name: 'Lohnzettel_Mai_2026.pdf', type: 'Lohnzettel', uploaded: '01.06.2026', size: '89 KB', read: false, confirmed: false },
  { id: '3', name: 'Lohnzettel_Apr_2026.pdf', type: 'Lohnzettel', uploaded: '01.05.2026', size: '87 KB', read: true, confirmed: false },
  { id: '4', name: 'Sicherheitsunterweisung_2026.pdf', type: 'Belehrung', uploaded: '15.01.2026', size: '1.2 MB', read: true, confirmed: true },
  { id: '5', name: 'Dienstplan_KW24.pdf', type: 'Dienstplan', uploaded: '07.06.2026', size: '156 KB', read: false, confirmed: false },
];

export default function DokumentePage() {
  return (
    <AppShell title="Dokumente">
      <div className="grid grid-3" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card animate-in">
          <div className="card-label">Gesamt</div>
          <div className="card-value">{MOCK_DOCS.length}</div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '50ms' }}>
          <div className="card-label">Ungelesen</div>
          <div className="card-value" style={{ color: 'var(--color-accent)' }}>
            {MOCK_DOCS.filter((d) => !d.read).length}
          </div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '100ms' }}>
          <div className="card-label">Bestätigung ausstehend</div>
          <div className="card-value" style={{ color: 'var(--color-warning)' }}>
            {MOCK_DOCS.filter((d) => !d.confirmed).length}
          </div>
        </div>
      </div>

      <div className="card animate-in" style={{ animationDelay: '150ms' }}>
        <div className="card-header">
          <span className="card-title">Meine Dokumente</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Dateiname</th>
                <th>Typ</th>
                <th>Hochgeladen</th>
                <th>Größe</th>
                <th>Status</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DOCS.map((doc) => (
                <tr key={doc.id}>
                  <td style={{ fontWeight: !doc.read ? 'var(--font-weight-semibold)' : 'inherit' }}>
                    {!doc.read && <span style={{ color: 'var(--color-accent)', marginRight: '6px' }}>●</span>}
                    {doc.name}
                  </td>
                  <td><span className="badge badge-neutral">{doc.type}</span></td>
                  <td>{doc.uploaded}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{doc.size}</td>
                  <td>
                    {doc.confirmed
                      ? <span className="badge badge-success">Bestätigt</span>
                      : <span className="badge badge-warning">Offen</span>
                    }
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                      <button className="btn btn-secondary" style={{ height: '32px', fontSize: 'var(--font-size-xs)' }}>
                        ⬇ Download
                      </button>
                      {!doc.confirmed && (
                        <button className="btn btn-primary" style={{ height: '32px', fontSize: 'var(--font-size-xs)' }}>
                          ✓ Bestätigen
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
