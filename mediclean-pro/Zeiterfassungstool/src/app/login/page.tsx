'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, login, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Anmeldung fehlgeschlagen');
    }
    setLoading(false);
  };

  if (authLoading) return null;
  if (user) return null;

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-header">
          <div className="login-logo">Z</div>
          <h1 className="login-title">Zeiterfassung</h1>
          <p className="login-subtitle">Melden Sie sich an, um fortzufahren</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">E-Mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@firma.at"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="login-password" className="form-label">Passwort</label>
              <Link href="/passwort-vergessen" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-accent)', textDecoration: 'none' }}>
                Passwort vergessen?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && <div className="form-error" style={{ marginBottom: '16px' }}>{error}</div>}

          <button
            type="submit"
            className="btn btn-primary login-btn btn-lg"
            disabled={loading}
          >
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>

        <div style={{
          marginTop: 'var(--spacing-2xl)',
          padding: 'var(--spacing-lg)',
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
        }}>
          <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
            Demo-Zugänge
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div><span style={{ color: 'var(--color-accent)' }}>Admin:</span> admin@firma.at / admin123</div>
            <div><span style={{ color: 'var(--color-warning)' }}>Vorgesetzter:</span> vorgesetzt@firma.at / super123</div>
            <div><span style={{ color: 'var(--color-success)' }}>Mitarbeiter:</span> arbeiter@firma.at / user123</div>
          </div>
        </div>
      </div>
    </div>
  );
}
