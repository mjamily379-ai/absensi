import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, NavDropdown, Container, Badge } from 'react-bootstrap';
import { LogOut, Sun, Moon } from 'lucide-react';
import { usePendingLeaveCount } from './hooks/usePendingLeaveCount';
import './Navbar.css';

import type { User } from './types';

interface NavbarProps {
  onLogout: () => void;
  user: User | null;
  darkMode?: boolean;
  toggleDarkMode?: () => void;
}

const CustomNavbar: React.FC<NavbarProps> = ({ onLogout, user, darkMode, toggleDarkMode }) => {
  const location = useLocation();
  const pendingLeaveCount = usePendingLeaveCount(!!user && user.role === 'admin');

  return (
    <Navbar expand="md" className="custom-navbar glass sticky-top" variant={darkMode ? 'dark' : 'light'}>
      <Container>
        <Navbar.Brand as={Link} to={user?.role === 'admin' ? '/admin' : '/'} className="navbar-brand-custom">
          <img src="/LOGO1.png" alt="School Logo" className="navbar-logo" />
          <div className="brand-text">
            <span className="brand-name">An Najiyah</span>
            <span className="brand-sub">Attendance System</span>
          </div>
        </Navbar.Brand>
        
        <div className="d-flex align-items-center gap-2">
          {/* Mobile Theme Toggle */}
          {toggleDarkMode && (
            <button 
              className="btn-theme-toggle d-md-none border-0 bg-transparent text-primary-green p-2 rounded-circle shadow-none"
              onClick={toggleDarkMode}
              title={darkMode ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
              aria-label="Toggle Theme"
            >
              {darkMode ? <Sun size={20} className="text-warning" /> : <Moon size={20} />}
            </button>
          )}

          {user && (
            <div className="user-profile-nav d-none d-md-flex align-items-center me-3">
              <div className="profile-info text-end me-2">
                <div className="profile-name">{user.name}</div>
                <div className="profile-role">{user.role}</div>
              </div>
            </div>
          )}

          <Navbar.Toggle aria-controls="basic-navbar-nav" className="border-0 shadow-none d-md-none" />
          
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto d-none d-md-flex align-items-center">
              {user && user.role === 'admin' && (
                <>
                  <Nav.Link as={Link} to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Dashboard</Nav.Link>
                  <Nav.Link as={Link} to="/admin/leave-requests" className={`d-flex align-items-center gap-1 ${location.pathname === '/admin/leave-requests' ? 'active' : ''}`}>
                    <span>Cuti</span>
                    {pendingLeaveCount > 0 && (
                      <Badge bg="danger" pill className="ms-1" style={{ fontSize: '0.7rem' }}>
                        {pendingLeaveCount}
                      </Badge>
                    )}
                  </Nav.Link>
                  <Nav.Link as={Link} to="/admin/announcements" className={location.pathname === '/admin/announcements' ? 'active' : ''}>Pengumuman</Nav.Link>
                  <Nav.Link as={Link} to="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''}>Users</Nav.Link>
                  <Nav.Link as={Link} to="/admin/audit-logs" className={location.pathname === '/admin/audit-logs' ? 'active' : ''}>Audit Log</Nav.Link>
                  <NavDropdown title="Pengaturan" id="admin-settings-dropdown" className="nav-settings-dropdown">
                    <NavDropdown.Item as={Link} to="/admin/holidays" active={location.pathname === '/admin/holidays'}>
                      Hari Libur
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/admin/workday-settings" active={location.pathname === '/admin/workday-settings'}>
                      Aturan Hari Kerja
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/admin/ramadan-settings" active={location.pathname === '/admin/ramadan-settings'}>
                      Pengaturan Ramadhan
                    </NavDropdown.Item>
                  </NavDropdown>
                  <Nav.Link as={Link} to="/admin/notification-settings" className={location.pathname === '/admin/notification-settings' ? 'active' : ''}>Notifikasi</Nav.Link>
                </>
              )}
              {user && user.role !== 'admin' && (
                <>
                  <Nav.Link as={Link} to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Nav.Link>
                  <Nav.Link as={Link} to="/pengajuan-cuti" className={location.pathname === '/pengajuan-cuti' ? 'active' : ''}>Cuti</Nav.Link>
                  <Nav.Link as={Link} to="/account" className={location.pathname === '/account' ? 'active' : ''}>Profil</Nav.Link>
                </>
              )}
            </Nav>
            
            <div className="ms-md-3 d-flex align-items-center gap-2">
              {/* Desktop Theme Toggle */}
              {toggleDarkMode && (
                <button 
                  className="btn-theme-toggle d-none d-md-flex align-items-center justify-content-center p-2 rounded-circle border shadow-xs"
                  onClick={toggleDarkMode}
                  title={darkMode ? 'Beralih ke Tema Terang' : 'Beralih ke Tema Gelap'}
                  style={{ width: '38px', height: '38px', cursor: 'pointer', background: 'transparent' }}
                  aria-label="Toggle Theme"
                >
                  {darkMode ? <Sun size={18} className="text-warning" /> : <Moon size={18} className="text-primary-green" />}
                </button>
              )}

              <button className="btn-logout" onClick={onLogout}>
                <LogOut size={18} className="me-2 d-none d-md-inline" />
                <span>Logout</span>
              </button>
            </div>
          </Navbar.Collapse>
        </div>
      </Container>
    </Navbar>
  );
};

export default CustomNavbar;