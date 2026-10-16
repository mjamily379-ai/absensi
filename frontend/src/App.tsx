import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import api from './api';
import './App.css';
import AuthRedirect from './AuthRedirect';
import ProtectedRoute from './ProtectedRoute';
import Layout from './Layout';
import MainApp from './MainApp';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import type { User } from './types';
import { readStoredUser } from './types';
import { subscribeUser } from './subscription';
import { STAFF_ROLES } from './constants/roles';
import NotFoundPage from './NotFoundPage';

// Lazy loaded components
const LoginPage = lazy(() => import('./LoginPage'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const HolidaySettings = lazy(() => import('./HolidaySettings'));
const LeaveRequestPage = lazy(() => import('./LeaveRequestPage'));
const AdminLeaveRequests = lazy(() => import('./AdminLeaveRequests'));
const AdminUserManagement = lazy(() => import('./AdminUserManagement'));
const AdminAnnouncements = lazy(() => import('./AdminAnnouncements'));
const AdminAuditLog = lazy(() => import('./AdminAuditLog'));
const NotificationSettings = lazy(() => import('./NotificationSettings'));
const PersonalAccountPage = lazy(() => import('./PersonalAccountPage'));
const WorkDaySettings = lazy(() => import('./WorkDaySettings'));
const RamadanSettings = lazy(() => import('./RamadanSettings'));

function App() {
  const [user, setUser] = useState<User | null>(() => readStoredUser());

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('themechange'));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  useEffect(() => {
    if (user && user._id && user.role) {
      subscribeUser(user.role, user._id).catch(err => {
        console.warn('Subscription error on app start:', err);
      });
    }
  }, [user]);

  // Re-sync the user in memory when profile details change (e.g. PersonalAccountPage).
  useEffect(() => {
    const handleProfileUpdated = () => {
      const parsedUser = readStoredUser();
      if (parsedUser) setUser(parsedUser);
    };
    window.addEventListener('profileupdated', handleProfileUpdated);
    return () => window.removeEventListener('profileupdated', handleProfileUpdated);
  }, []);

  const handleLogin = (loggedInUser: { id: string, username: string, role: string, staffId?: string, name: string, mustChangePassword?: boolean }) => {
    const userToStore: User = { 
      _id: loggedInUser.id,
      username: loggedInUser.username,
      role: loggedInUser.role as User['role'],
      staffId: loggedInUser.staffId, 
      name: loggedInUser.name,
      mustChangePassword: !!loggedInUser.mustChangePassword
    };
    localStorage.setItem('user', JSON.stringify(userToStore));
    setUser(userToStore);
    if (userToStore._id && userToStore.role) {
      subscribeUser(userToStore.role, userToStore._id).catch(err => {
        console.warn('Subscription error on login:', err);
      });
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  return (
    <Router>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        theme={darkMode ? 'dark' : 'light'}
      />
      <AuthRedirect user={user} />
      <Suspense fallback={<div className="d-flex justify-content-center mt-5"><div className="spinner-border" role="status"></div></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute user={user}><Layout user={user!} onLogout={handleLogout} darkMode={darkMode} toggleDarkMode={toggleDarkMode} /></ProtectedRoute>}>
            <Route
              path="/"
              element={
                <ProtectedRoute user={user} allowedRoles={STAFF_ROLES}>
                  <MainApp user={user!} onLogout={handleLogout} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/holidays"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <HolidaySettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/leave-requests"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <AdminLeaveRequests />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <AdminUserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/announcements"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <AdminAnnouncements />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <AdminAuditLog />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notification-settings"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <NotificationSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/workday-settings"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <WorkDaySettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ramadan-settings"
              element={
                <ProtectedRoute user={user} allowedRoles={['admin']}>
                  <RamadanSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pengajuan-cuti"
              element={
                <ProtectedRoute user={user} allowedRoles={STAFF_ROLES}>
                  <LeaveRequestPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={<PersonalAccountPage />}
            />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
