import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import BottomNav from './BottomNav';
import Footer from './Footer';
import './Layout.css';

import type { User } from './types';

interface LayoutProps {
  children?: React.ReactNode;
  onLogout: () => void;
  user: User | null;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout, user }) => {
  return (
    <div className="layout-wrapper">
      <Navbar onLogout={onLogout} user={user} />
      <main className="main-content animate-fade-in">
        {children || <Outlet />}
      </main>
      <BottomNav user={user} />
      <div className="d-none d-md-block">
        <Footer />
      </div>
    </div>
  );
};

export default Layout;