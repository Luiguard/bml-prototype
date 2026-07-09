'use client';

import { useState } from 'react';
import AppShell from '@/components/layout/AppShell';

const MOCK_ENTRIES = [
  { id: '1', date: 'Di 10.06.', start: '07:00', end: null, hours: '4:30', status: 'active', type: 'Arbeit', project: '–' },
  { id: '2', date: 'Mo 09.06.', start: '07:00', end: '15:30', hours: '8:00', status: 'confirmed', type: 'Arbeit', project: '–' },
  { id: '3', date: 'Mo 09.06.', start: '12:00', end: '12:30', hours: '0:30', status: 'confirmed', type: 'Pause', project: '–' },
  { id: '4', date: 'Fr 06.06.', start: '06:45', end: '15:15', hours: '8:00', status: 'confirmed', type: 'Arbeit', project: '–' },
  { id: '5', date: 'Fr 06.06.', start: '12:00', end: '12:30', hours: '0:30', status: 'confirmed', type: 'Pause', project: '–' },
  { id: '6', date: 'Do 05.06.', start: '07:00', end: '15:30', hours: '8:00', status: 'confirmed', type: 'Arbeit', project: '–' },
  { id: '7', date: 'Mi 04.06.', start: '07:00', end: '15:30', hours: '8:00', status: 'corrected', type: 'Arbeit', project: '–' },
];

const WEEK_SUMMARY = {
  totalHours: 22.5,
  targetHours: 38.5,
  overtime: 0,
  workDays: 3,
  breakTotal: '1:00',
};

type ViewMode = 'day' | 'week';

export default function ZeiterfassungPage() {
  const [view, setView] = useState<ViewMode>('week');
  const [showForm, setShowForm] = useState(false);

  return (
    <AppShell
      title="Zeiterfassung"
      actions={
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Manuelle Buchung
        </button>
      }
    >
      {showForm && (
        <div className="card animate-in" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div className="card-header">
            <span className="card-title">Neue Buchung</span>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-lg)' }}>
            <div className="form-group">
              <label className="form-label">Typ</label>
              <select defaultValue="WORK">
                <option value="WORK">Arbeit</option>
                <option value="BREAK">Pause</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Datum</label>
              <input type="date" defaultValue="2026-06-10" />
            </div>
            <div className="form-group">
              <label className="form-label">Beginn</label>
              <input type="time" defaultValue="07:00" />
            </div>
            <div className="form-group">
              <label className="form-label">Ende</label>
              <input type="time" />
            </div>
            <div className="form-group">
              <label className="form-label">Notiz</label>
              <input type="text" placeholder="Optional" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button className="btn btn-primary" style={{ width: '100%' }}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xl)' }}>
        <button
          className={`btn ${view === 'day' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setView('day')}
        >
          Tag
        </button>
        <button
          className={`btn ${view === 'week' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setView('week')}
        >
          Woche
        </button>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card">
          <div className="card-label">Arbeitsstunden</div>
          <div className="card-value">{WEEK_SUMMARY.totalHours}h</div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
            von {WEEK_SUMMARY.targetHours}h Soll
          </div>
        </div>
        <div className="card">
          <div className="card-label">Überstunden</div>
          <div className="card-value" style={{ color: 'var(--color-success)' }}>
            {WEEK_SUMMARY.overtime > 0 ? '+' : ''}{WEEK_SUMMARY.overtime}h
          </div>
        </div>
        <div className="card">
          <div className="card-label">Arbeitstage</div>
          <div className="card-value">{WEEK_SUMMARY.workDays}</div>
        </div>
        <div className="card">
          <div className="card-label">Pausen gesamt</div>
          <div className="card-value">{WEEK_SUMMARY.breakTotal}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Buchungen</span>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                <th>Typ</th>
                <th>Beginn</th>
                <th>Ende</th>
                <th>Dauer</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ENTRIES.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.date}</td>
                  <td>
                    <span className={`badge ${entry.type === 'Pause' ? 'badge-warning' : 'badge-neutral'}`}>
                      {entry.type}
                    </span>
                  </td>
                  <td>{entry.start}</td>
                  <td>{entry.end ?? '–'}</td>
                  <td>{entry.hours}</td>
                  <td>
                    <span
                      className={`badge ${
                        entry.status === 'active'
                          ? 'badge-success'
                          : entry.status === 'confirmed'
                            ? 'badge-info'
                            : entry.status === 'corrected'
                              ? 'badge-warning'
                              : 'badge-neutral'
                      }`}
                    >
                      {entry.status === 'active'
                        ? 'Aktiv'
                        : entry.status === 'confirmed'
                          ? 'Bestätigt'
                          : entry.status === 'corrected'
                            ? 'Korrigiert'
                            : entry.status}
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
