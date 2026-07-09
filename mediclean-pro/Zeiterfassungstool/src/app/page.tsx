'use client';

import AppShell from '@/components/layout/AppShell';

const MOCK_DATA = {
  today: {
    workedHours: 4.5,
    breakMinutes: 30,
    isCheckedIn: true,
    shiftStart: '07:00',
  },
  week: { totalHours: 22.5, overtimeHours: 0, target: 38.5 },
  month: { totalHours: 142, overtimeHours: 3.5, absenceDays: 2 },
  nextShift: {
    date: '11',
    dayName: 'Mi',
    month: 'Jun',
    startTime: '07:00',
    endTime: '15:30',
    location: 'Standort Wien-Mitte',
    type: 'Normaldienst',
  },
  nextTrip: {
    destination: 'Linz',
    dates: '16.–17. Jun 2026',
    purpose: 'Kundentermin',
  },
  recentEntries: [
    { date: 'Heute', start: '07:00', end: '–', hours: '4:30', status: 'active' },
    { date: 'Mo 09.06.', start: '07:00', end: '15:30', hours: '8:00', status: 'confirmed' },
    { date: 'Fr 06.06.', start: '06:45', end: '15:15', hours: '8:00', status: 'confirmed' },
    { date: 'Do 05.06.', start: '07:00', end: '15:30', hours: '8:00', status: 'confirmed' },
  ],
  unreadDocs: 2,
  pendingRequests: 1,
};

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="quick-actions animate-in">
        <button className="quick-action check-in">
          <span className="quick-action-icon">▶</span>
          <span className="quick-action-label">Dienstbeginn</span>
        </button>
        <button className="quick-action pause">
          <span className="quick-action-icon">⏸</span>
          <span className="quick-action-label">Pause</span>
        </button>
        <button className="quick-action check-out">
          <span className="quick-action-icon">⏹</span>
          <span className="quick-action-label">Dienstende</span>
        </button>
      </div>

      <div className="grid grid-4" style={{ marginTop: 'var(--spacing-xl)' }}>
        <div className="card animate-in" style={{ animationDelay: '50ms' }}>
          <div className="card-header">
            <div>
              <div className="card-label">Heute</div>
              <div className="card-value">{MOCK_DATA.today.workedHours}h</div>
            </div>
            <div className="card-icon accent">⏱</div>
          </div>
          <div className="stat-row">
            <span className="badge badge-success">● Eingecheckt</span>
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
              seit {MOCK_DATA.today.shiftStart}
            </span>
          </div>
        </div>

        <div className="card animate-in" style={{ animationDelay: '100ms' }}>
          <div className="card-header">
            <div>
              <div className="card-label">Diese Woche</div>
              <div className="card-value">{MOCK_DATA.week.totalHours}h</div>
            </div>
            <div className="card-icon info">📊</div>
          </div>
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div
              style={{
                height: 4,
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(MOCK_DATA.week.totalHours / MOCK_DATA.week.target) * 100}%`,
                  background: 'var(--color-accent)',
                  borderRadius: 'var(--radius-full)',
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
              {MOCK_DATA.week.totalHours} / {MOCK_DATA.week.target}h Soll
            </div>
          </div>
        </div>

        <div className="card animate-in" style={{ animationDelay: '150ms' }}>
          <div className="card-header">
            <div>
              <div className="card-label">Überstunden (Monat)</div>
              <div className="card-value">
                <span style={{ color: MOCK_DATA.month.overtimeHours > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                  +{MOCK_DATA.month.overtimeHours}h
                </span>
              </div>
            </div>
            <div className="card-icon warning">⚡</div>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-sm)' }}>
            {MOCK_DATA.month.totalHours}h gesamt · {MOCK_DATA.month.absenceDays} Fehltage
          </div>
        </div>

        <div className="card animate-in" style={{ animationDelay: '200ms' }}>
          <div className="card-header">
            <div>
              <div className="card-label">Offenes</div>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-accent)' }}>
                    {MOCK_DATA.unreadDocs}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Dokumente</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-warning)' }}>
                    {MOCK_DATA.pendingRequests}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Anträge</div>
                </div>
              </div>
            </div>
            <div className="card-icon error">📬</div>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: 'var(--spacing-xl)' }}>
        <div className="card animate-in" style={{ animationDelay: '250ms' }}>
          <div className="card-header">
            <span className="card-title">Nächster Dienst</span>
            <span className="badge badge-info">{MOCK_DATA.nextShift.type}</span>
          </div>
          <div className="next-shift">
            <div className="next-shift-time">
              <div className="next-shift-date">{MOCK_DATA.nextShift.date}</div>
              <div className="next-shift-day">{MOCK_DATA.nextShift.dayName} {MOCK_DATA.nextShift.month}</div>
            </div>
            <div className="next-shift-details">
              <div className="next-shift-hours">
                {MOCK_DATA.nextShift.startTime} – {MOCK_DATA.nextShift.endTime}
              </div>
              <div className="next-shift-location">
                📍 {MOCK_DATA.nextShift.location}
              </div>
            </div>
          </div>
        </div>

        <div className="card animate-in" style={{ animationDelay: '300ms' }}>
          <div className="card-header">
            <span className="card-title">Nächste Dienstreise</span>
            <span className="badge badge-warning">Geplant</span>
          </div>
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
              📍 {MOCK_DATA.nextTrip.destination}
            </div>
            <div style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
              {MOCK_DATA.nextTrip.dates}
            </div>
            <div style={{ color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)' }}>
              {MOCK_DATA.nextTrip.purpose}
            </div>
          </div>
        </div>
      </div>

      <div className="card animate-in" style={{ marginTop: 'var(--spacing-xl)', animationDelay: '350ms' }}>
        <div className="card-header">
          <span className="card-title">Letzte Buchungen</span>
          <a href="/zeiterfassung" className="btn btn-ghost" style={{ fontSize: 'var(--font-size-sm)' }}>
            Alle anzeigen →
          </a>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Beginn</th>
                <th>Ende</th>
                <th>Stunden</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_DATA.recentEntries.map((entry, i) => (
                <tr key={i}>
                  <td>{entry.date}</td>
                  <td>{entry.start}</td>
                  <td>{entry.end}</td>
                  <td>{entry.hours}</td>
                  <td>
                    <span
                      className={`badge ${
                        entry.status === 'active'
                          ? 'badge-success'
                          : entry.status === 'confirmed'
                            ? 'badge-info'
                            : 'badge-warning'
                      }`}
                    >
                      {entry.status === 'active' ? 'Aktiv' : entry.status === 'confirmed' ? 'Bestätigt' : 'Offen'}
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
