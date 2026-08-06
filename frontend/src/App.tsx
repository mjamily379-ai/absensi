import React, { useState, Suspense, lazy } from 'react';
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

// Lazy loaded components
const LoginPage = lazy(() => import('./LoginPage'));
const AdminDashboard = lazy(() => import('./AdminDashboard'));
const HolidaySettings = lazy(() => import('./HolidaySettings'));
const LeaveRequestPage = lazy(() => import('./LeaveRequestPage'));
const AdminLeaveRequests = lazy(() => import('./AdminLeaveRequests'));
const AdminUserManagement = lazy(() => import('./AdminUserManagement'));
const AdminAnnouncements = lazy(() => import('./AdminAnnouncements'));
const PersonalAccountPage = lazy(() => import('./PersonalAccountPage'));

const STAFF_ROLES = ['staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c'];

function App() {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      return { ...parsedUser, _id: parsedUser.id || parsedUser._id };
    }
    return null;
  });

  const handleLogin = (loggedInUser: { id: string, username: string, role: string, staffId?: string, name: string }) => {
    const userToStore: User = { 
      _id: loggedInUser.id,
      username: loggedInUser.username,
      role: loggedInUser.role as User['role'],
      staffId: loggedInUser.staffId, 
      name: loggedInUser.name
    };
    localStorage.setItem('user', JSON.stringify(userToStore));
    setUser(userToStore);
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
        theme="light"
      />
      <AuthRedirect user={user} />
      <Suspense fallback={<div className="d-flex justify-content-center mt-5"><div className="spinner-border" role="status"></div></div>}>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute user={user}><Layout user={user!} onLogout={handleLogout} /></ProtectedRoute>}>
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
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
