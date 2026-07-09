'use client';

export default function Header({
  title,
  onMenuToggle,
  children,
}: {
  title: string;
  onMenuToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="mobile-menu-toggle btn-ghost btn-icon"
          onClick={onMenuToggle}
          aria-label="Menü öffnen"
        >
          ☰
        </button>
        <h1 className="page-title">{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}
