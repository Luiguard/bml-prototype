'use client';

import AppShell from '@/components/layout/AppShell';

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DATES = ['09', '10', '11', '12', '13', '14', '15'];

const MOCK_SHIFTS = [
  { day: 0, start: '07:00', end: '15:30', type: 'NORMAL', location: 'Wien-Mitte' },
  { day: 1, start: '07:00', end: '15:30', type: 'NORMAL', location: 'Wien-Mitte' },
  { day: 2, start: '07:00', end: '15:30', type: 'NORMAL', location: 'Wien-Mitte' },
  { day: 3, start: '06:00', end: '14:30', type: 'NORMAL', location: 'Wien-Nord' },
  { day: 4, start: '06:00', end: '14:30', type: 'NORMAL', location: 'Wien-Nord' },
];

export default function DienstplanPage() {
  return (
    <AppShell title="Dienstplan">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <button className="btn btn-secondary btn-icon">←</button>
          <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-md)' }}>
            KW 24 · 09.–15. Juni 2026
          </span>
          <button className="btn btn-secondary btn-icon">→</button>
        </div>
        <button className="btn btn-secondary">ICS Export</button>
      </div>

      <div className="card animate-in">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {DAYS.map((day, i) => {
            const shift = MOCK_SHIFTS.find((s) => s.day === i);
            const isToday = i === 1;
            return (
              <div
                key={i}
                style={{
                  background: isToday ? 'var(--color-accent-subtle)' : 'var(--color-bg-card)',
                  padding: 'var(--spacing-lg)',
                  minHeight: 140,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', fontWeight: 'var(--font-weight-semibold)' }}>
                    {day}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-bold)',
                      color: isToday ? 'var(--color-accent)' : 'var(--color-text-primary)',
                      ...(isToday ? {
                        background: 'var(--color-accent)',
                        color: '#fff',
                        width: 24,
                        height: 24,
                        borderRadius: 'var(--radius-full)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      } : {}),
                    }}
                  >
                    {DATES[i]}
                  </span>
                </div>
                {shift ? (
                  <div
                    style={{
                      background: 'var(--color-accent-subtle)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 'var(--spacing-sm)',
                      fontSize: 'var(--font-size-xs)',
                      flex: 1,
                    }}
                  >
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-accent)' }}>
                      {shift.start}–{shift.end}
                    </div>
                    <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {shift.location}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', fontStyle: 'italic' }}>
                    Frei
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
