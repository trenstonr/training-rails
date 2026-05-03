import { Icon } from './Icons.jsx';

export default function Sidebar({ page, setPage, line, setLine }) {
  const navItem = (id, icon, label, badge) => (
    <button
      className={`nav-item ${page === id ? 'active' : ''}`}
      onClick={() => setPage(id)}
    >
      <Icon name={icon} />
      {label}
      {badge}
    </button>
  );

  const lineItem = (id, color, name, count) => (
    <div
      className={`line-item ${line === id ? 'active' : ''}`}
      onClick={() => setLine(id)}
    >
      <div className="line-color" style={{ background: color }} />
      <div className="line-name">{name}</div>
      <div className="line-count">{count}</div>
    </div>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">TR</div>
        <div className="brand-text">
          <strong>Training Rails</strong>
          <small>v1.0 · Beta</small>
        </div>
      </div>

      <nav className="nav">
        {/* <div className="nav-section">Operations</div> */}
        {/* {navItem('dashboard', 'i-dash', 'Dashboard')}
        {navItem('track', 'i-track', 'Track view')}
        {navItem('defect', 'i-alert', 'Defect detail', <span className="badge crit">!</span>)} */}

        <div className="nav-section" style={{ marginTop: 14 }}>Lines</div>
        <div className="lines-list">
          {lineItem('all', 'var(--text-1)', 'All lines', '42')}
          {lineItem('1', 'var(--route-1)', 'Corvallis–Albany', '12')}
          {lineItem('2', 'var(--route-2)', 'Portland–Eugene', '15')}
          {lineItem('3', 'var(--route-3)', 'Salem–Bend', '9')}
          {lineItem('4', 'var(--route-4)', 'Seattle–Tacoma', '6')}
        </div>

        <div className="nav-section" style={{ marginTop: 14 }}>Devices</div>
        <button className="nav-item">
          <Icon name="i-target" />
          JET-TX2-001
          <span className="badge" style={{ color: 'var(--ok)', background: 'rgba(74,222,128,0.1)' }}>●</span>
        </button>
        <button className="nav-item">
          <Icon name="i-target" />
          JET-TX2-002
          <span className="badge" style={{ color: 'var(--ok)', background: 'rgba(74,222,128,0.1)' }}>●</span>
        </button>
        <button className="nav-item">
          <Icon name="i-target" />
          JET-TX2-003
          <span className="badge">○</span>
        </button>
      </nav>

      <div className="user-card">
        <div className="avatar">KS</div>
        <div>
          <strong>K. Savkin</strong>
          <small>Inspector · OSU</small>
        </div>
      </div>
    </aside>
  );
}
