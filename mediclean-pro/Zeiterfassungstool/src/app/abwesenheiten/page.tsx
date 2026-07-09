'use client';

import AppShell from '@/components/layout/AppShell';

const MOCK_ABSENCES = [
  { id: '1', type: 'Urlaub', from: '14.07.2026', to: '25.07.2026', days: 10, status: 'approved', comment: 'Sommerurlaub' },
  { id: '2', type: 'Zeitausgleich', from: '30.06.2026', to: '30.06.2026', days: 1, status: 'pending', comment: 'Überstundenabbau' },
  { id: '3', type: 'Krankenstand', from: '20.05.2026', to: '22.05.2026', days: 3, status: 'closed', comment: 'Grippe' },
];

const QUOTA = {
  totalVacation: 25,
  usedVacation: 5,
  plannedVacation: 10,
  remainingVacation: 10,
  sickDays: 3,
  compDays: 2.5,
};

export default function AbwesenheitenPage() {
  return (
    <AppShell
      title="Abwesenheiten"
      actions={<button className="btn btn-primary">+ Neuer Antrag</button>}
    >
      <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card animate-in">
          <div className="card-label">Resturlaub</div>
          <div className="card-value" style={{ color: 'var(--color-success)' }}>{QUOTA.remainingVacation}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
            von {QUOTA.totalVacation} Tagen
          </div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '50ms' }}>
          <div className="card-label">Konsumiert</div>
          <div className="card-value">{QUOTA.usedVacation}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Tage</div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '100ms' }}>
          <div className="card-label">Geplant</div>
          <div className="card-value" style={{ color: 'var(--color-warning)' }}>{QUOTA.plannedVacation}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Tage</div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '150ms' }}>
          <div className="card-label">Krankenstand</div>
          <div className="card-value">{QUOTA.sickDays}</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>Tage dieses Jahr</div>
        </div>
      </div>

      <div className="card animate-in" style={{ animationDelay: '200ms' }}>
        <div className="card-header">
          <span className="card-title">Meine Abwesenheiten</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Art</th>
                <th>Von</th>
                <th>Bis</th>
                <th>Tage</th>
                <th>Kommentar</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ABSENCES.map((a) => (
                <tr key={a.id}>
                  <td>{a.type}</td>
                  <td>{a.from}</td>
                  <td>{a.to}</td>
                  <td>{a.days}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{a.comment}</td>
                  <td>
                    <span
                      className={`badge ${
                        a.status === 'approved' ? 'badge-success' :
                        a.status === 'pending' ? 'badge-warning' :
                        a.status === 'denied' ? 'badge-error' :
                        'badge-neutral'
                      }`}
                    >
                      {a.status === 'approved' ? 'Genehmigt' :
                       a.status === 'pending' ? 'Offen' :
                       a.status === 'denied' ? 'Abgelehnt' :
                       'Abgeschlossen'}
                    </span>
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
