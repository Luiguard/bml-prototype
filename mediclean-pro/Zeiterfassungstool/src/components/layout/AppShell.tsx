'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { RequireAuth } from '@/lib/auth-context';

export default function AppShell({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <RequireAuth>
      <div className="app-layout">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">
          <Header title={title} onMenuToggle={() => setSidebarOpen(!sidebarOpen)}>
            {actions}
          </Header>
          <div className="page-body">{children}</div>
        </main>
      </div>
    </RequireAuth>
  );
}
