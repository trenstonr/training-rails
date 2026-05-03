import { useEffect, useRef } from 'react';
import { Icon } from './Icons.jsx';

const PAGE_NAMES = {
  dashboard: 'Dashboard',
  defect: 'Defect · DEF-2026-04891',
  track: 'Track · Corvallis–Albany'
};

export default function Topbar({ page, onTriggerCritical }) {
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        <span>Training Rails</span>
        <span className="sep">/</span>
        <strong>{PAGE_NAMES[page] || page}</strong>
      </div>
      <div className="topbar-spacer" />
      <span className="live-pill mono">LIVE · 2 jets streaming</span>
      <div className="search">
        <Icon name="i-search" />
        <input ref={inputRef} placeholder="Search defect ID, MP, line..." />
        <span className="kbd">⌘K</span>
      </div>
      <button
        className="demo-btn"
        title="Trigger critical alert (Ctrl+Shift+A)"
        onClick={onTriggerCritical}
      >
        <Icon name="i-zap" />
        Trigger critical
      </button>
      <button className="icon-btn">
        <Icon name="i-bell" />
      </button>
    </header>
  );
}
