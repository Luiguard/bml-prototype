'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth, RequireAuth } from '@/lib/auth-context';
import type { Role } from '@/types';

interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  roleLabel: string;
  modules: string[];
  active: boolean;
  onboarded: boolean;
  createdAt: string;
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'EMPLOYEE', label: 'Mitarbeiter' },
  { value: 'SUPERVISOR', label: 'Vorgesetzter' },
  { value: 'HR_ADMIN', label: 'HR/Admin' },
  { value: 'SYSTEM_ADMIN', label: 'System-Admin' },
];

const MODULE_OPTIONS = [
  { value: 'projects', label: 'Projektzeiterfassung' },
  { value: 'schedule', label: 'Dienstplanung' },
  { value: 'geofencing', label: 'Standortprüfung' },
  { value: 'reports', label: 'Auswertungen' },
  { value: 'notifications', label: 'Push-Benachrichtigungen' },
];

function BenutzerverwaltungContent() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'EMPLOYEE' as Role,
    modules: [] as string[],
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch { /* */ }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    const data = await res.json();
    if (data.success) {
      setFormSuccess(`Benutzer ${formData.firstName} ${formData.lastName} angelegt.`);
      setFormData({ email: '', firstName: '', lastName: '', role: 'EMPLOYEE', modules: [] });
      setShowForm(false);
      fetchUsers();
    } else {
      setFormError(data.error || 'Fehler beim Anlegen');
    }
  };

  const toggleModule = (mod: string) => {
    setFormData((prev) => ({
      ...prev,
      modules: prev.modules.includes(mod)
        ? prev.modules.filter((m) => m !== mod)
        : [...prev.modules, mod],
    }));
  };

  if (!user) return null;

  return (
    <AppShell
      title="Benutzerverwaltung"
      actions={
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          + Benutzer anlegen
        </button>
      }
    >
      {formSuccess && (
        <div className="card animate-in" style={{ marginBottom: 'var(--spacing-xl)', borderColor: 'rgba(34,197,94,0.3)', background: 'var(--color-success-subtle)' }}>
          <div style={{ color: 'var(--color-success)', fontWeight: 'var(--font-weight-medium)' }}>✓ {formSuccess}</div>
        </div>
      )}

      {showForm && (
        <div className="card animate-in" style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div className="card-header">
            <span className="card-title">Neuen Benutzer anlegen</span>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--spacing-lg)' }}>
              <div className="form-group">
                <label className="form-label">Vorname *</label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Nachname *</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">E-Mail *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rolle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 'var(--spacing-lg)' }}>
              <label className="form-label">Optionale Module</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
                {MODULE_OPTIONS.map((mod) => (
                  <button
                    key={mod.value}
                    type="button"
                    className={`btn ${formData.modules.includes(mod.value) ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ height: 32, fontSize: 'var(--font-size-xs)' }}
                    onClick={() => toggleModule(mod.value)}
                  >
                    {formData.modules.includes(mod.value) ? '✓ ' : ''}{mod.label}
                  </button>
                ))}
              </div>
            </div>

            {formError && <div className="form-error" style={{ marginTop: 'var(--spacing-md)' }}>{formError}</div>}

            <div style={{ marginTop: 'var(--spacing-xl)', display: 'flex', gap: 'var(--spacing-md)' }}>
              <button type="submit" className="btn btn-primary">Anlegen</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div className="card animate-in">
          <div className="card-label">Gesamt</div>
          <div className="card-value">{users.length}</div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '50ms' }}>
          <div className="card-label">Aktiv</div>
          <div className="card-value" style={{ color: 'var(--color-success)' }}>
            {users.filter((u) => u.active).length}
          </div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '100ms' }}>
          <div className="card-label">Inaktiv</div>
          <div className="card-value" style={{ color: 'var(--color-text-tertiary)' }}>
            {users.filter((u) => !u.active).length}
          </div>
        </div>
        <div className="card animate-in" style={{ animationDelay: '150ms' }}>
          <div className="card-label">Onboarding offen</div>
          <div className="card-value" style={{ color: 'var(--color-warning)' }}>
            {users.filter((u) => !u.onboarded).length}
          </div>
        </div>
      </div>

      <div className="card animate-in" style={{ animationDelay: '200ms' }}>
        <div className="card-header">
          <span className="card-title">Alle Benutzer</span>
        </div>
        {loading ? (
          <div className="empty-state"><div>Laden...</div></div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>E-Mail</th>
                  <th>Rolle</th>
                  <th>Module</th>
                  <th>Status</th>
                  <th>Onboarding</th>
                  <th>Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 'var(--font-weight-medium)' }}>
                      {u.firstName} {u.lastName}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${
                        u.role === 'HR_ADMIN' || u.role === 'SYSTEM_ADMIN'
                          ? 'badge-error'
                          : u.role === 'SUPERVISOR'
                            ? 'badge-warning'
                            : 'badge-info'
                      }`}>
                        {u.roleLabel}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {u.modules.length > 0
                          ? u.modules.map((m) => (
                              <span key={m} className="badge badge-neutral">{m}</span>
                            ))
                          : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>Standard</span>
                        }
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.active ? 'badge-success' : 'badge-neutral'}`}>
                        {u.active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.onboarded ? 'badge-success' : 'badge-warning'}`}>
                        {u.onboarded ? 'Abgeschlossen' : 'Offen'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      {new Date(u.createdAt).toLocaleDateString('de-AT')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function BenutzerverwaltungPage() {
  return (
    <RequireAuth roles={['HR_ADMIN', 'SYSTEM_ADMIN']}>
      <BenutzerverwaltungContent />
    </RequireAuth>
  );
}
