/**
 * Collapsible section with clickable header.
 */
import { useState } from 'react';

export default function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="rounded-lg mb-6 overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer text-left"
        style={{ color: 'var(--color-text)' }}
      >
        <span className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
