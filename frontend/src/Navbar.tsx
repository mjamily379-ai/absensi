import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { LogOut } from 'lucide-react';
import './Navbar.css';

import type { User } from './types';

interface NavbarProps {
  onLogout: () => void;
  user: User | null;
}

const CustomNavbar: React.FC<NavbarProps> = ({ onLogout, user }) => {
  const location = useLocation();

  return (
    <Navbar expand="md" className="custom-navbar glass sticky-top" variant="light">
      <Container>
        <Navbar.Brand as={Link} to={user?.role === 'admin' ? '/admin' : '/'} className="navbar-brand-custom">
          <img src="/LOGO1.png" alt="School Logo" className="navbar-logo" />
          <div className="brand-text">
            <span className="brand-name">An Najiyah</span>
            <span className="brand-sub">Attendance System</span>
          </div>
        </Navbar.Brand>
        
        <div className="d-flex align-items-center">
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
            <Nav className="ms-auto d-none d-md-flex">
              {user && user.role === 'admin' && (
                <>
                  <Nav.Link as={Link} to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Dashboard</Nav.Link>
                  <Nav.Link as={Link} to="/admin/leave-requests" className={location.pathname === '/admin/leave-requests' ? 'active' : ''}>Cuti</Nav.Link>
                  <Nav.Link as={Link} to="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''}>Users</Nav.Link>
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
            
            <div className="ms-md-3">
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