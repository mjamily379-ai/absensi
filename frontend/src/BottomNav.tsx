import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, User, LayoutDashboard, Settings } from 'lucide-react';
import type { User as UserType } from './types';
import './BottomNav.css';

interface BottomNavProps {
  user: UserType | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ user }) => {
  if (!user) return null;

  const isAdmin = user.role === 'admin';

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
          <NavLink to="/admin/leave-requests" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={24} />
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
    </nav>
  );
};

export default BottomNav;
