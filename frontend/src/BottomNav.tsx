import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, User, LayoutDashboard, Settings, Download } from 'lucide-react';
import { usePendingLeaveCount } from './hooks/usePendingLeaveCount';
import useInstallPrompt from './hooks/useInstallPrompt';
import type { User as UserType } from './types';
import './BottomNav.css';

interface BottomNavProps {
  user: UserType | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ user }) => {
  const pendingLeaveCount = usePendingLeaveCount(!!user && user.role === 'admin');
  const { canInstall, install } = useInstallPrompt();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  const handleInstall = async () => {
    const outcome = await install();
    console.log('Install prompt result:', outcome);
  };

  return (
    <nav className="bottom-nav d-flex d-md-none glass">
      <NavLink to={isAdmin ? "/admin" : "/"} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Home size={24} />
        <span>Home</span>
      </NavLink>
      
      {!isAdmin && (
        <NavLink to="/pengajuan-cuti" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <CalendarDays size={24} />
          <span>Cuti</span>
        </NavLink>
      )}

      {isAdmin && (
        <>
          <NavLink to="/admin/leave-requests" className={({ isActive }) => `nav-item position-relative ${isActive ? 'active' : ''}`}>
            <div className="position-relative d-inline-block">
              <LayoutDashboard size={24} />
              {pendingLeaveCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.65rem' }}>
                  {pendingLeaveCount}
                </span>
              )}
            </div>
            <span>Persetujuan</span>
          </NavLink>
          <NavLink to="/admin/holidays" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Settings size={24} />
            <span>Settings</span>
          </NavLink>
        </>
      )}

      <NavLink to={isAdmin ? "/admin/users" : "/account"} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>{isAdmin ? 'Users' : 'Profil'}</span>
      </NavLink>

      {canInstall && (
        <button
          type="button"
          className="nav-item install-nav-btn"
          onClick={handleInstall}
          aria-label="Pasang Aplikasi"
          title="Pasang Aplikasi"
        >
          <Download size={24} />
          <span>Install</span>
        </button>
      )}
    </nav>
  );
};

export default BottomNav;