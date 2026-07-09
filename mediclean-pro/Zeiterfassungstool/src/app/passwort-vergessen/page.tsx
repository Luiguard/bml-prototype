'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.error || 'Es ist ein Fehler aufgetreten.');
      }
    } catch {
      setStatus('error');
      setMessage('Netzwerkfehler. Bitte später erneut versuchen.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-header">
          <h1 className="login-title" style={{ fontSize: '1.5rem' }}>Passwort vergessen</h1>
          <p className="login-subtitle">Geben Sie Ihre E-Mail-Adresse ein, um einen Reset-Link zu erhalten.</p>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--color-success)', marginBottom: 'var(--spacing-md)', fontSize: '3rem' }}>✓</div>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>{message}</p>
            <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>Zurück zum Login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="reset-email" className="form-label">E-Mail</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@firma.at"
                required
                autoFocus
              />
            </div>

            {status === 'error' && <div className="form-error" style={{ marginBottom: '16px' }}>{message}</div>}

            <button
              type="submit"
              className="btn btn-primary login-btn btn-lg"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? 'Wird gesendet...' : 'Link anfordern'}
            </button>

            <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
              <Link href="/login" style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', textDecoration: 'none' }}>
                Zurück zur Anmeldung
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
