'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Die Passwörter stimmen nicht überein.');
      return;
    }

    if (password.length < 8) {
      setStatus('error');
      setMessage('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setMessage(data.error || 'Token ungültig oder abgelaufen.');
      }
    } catch {
      setStatus('error');
      setMessage('Netzwerkfehler.');
    }
  };

  if (!token) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-error)' }}>
        Ungültiger oder fehlender Token. Bitte fordern Sie einen neuen Link an.
        <br/><br/>
        <Link href="/passwort-vergessen" className="btn btn-secondary">Neuen Link anfordern</Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--color-success)', marginBottom: 'var(--spacing-md)', fontSize: '3rem' }}>✓</div>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
          Ihr Passwort wurde erfolgreich geändert. Sie können sich nun anmelden.
        </p>
        <Link href="/login" className="btn btn-primary" style={{ display: 'inline-block' }}>Zur Anmeldung</Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Neues Passwort</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoFocus
        />
      </div>

      <div className="form-group">
        <label className="form-label">Passwort wiederholen</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
      </div>

      {status === 'error' && <div className="form-error" style={{ marginBottom: '16px' }}>{message}</div>}

      <button
        type="submit"
        className="btn btn-primary login-btn btn-lg"
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Wird gespeichert...' : 'Passwort speichern'}
      </button>
    </form>
  );
}

export default function PasswortResetPage() {
  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-header">
          <h1 className="login-title" style={{ fontSize: '1.5rem' }}>Neues Passwort</h1>
          <p className="login-subtitle">Vergeben Sie ein neues sicheres Passwort.</p>
        </div>
        <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Laden...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
