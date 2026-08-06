  import React, { useEffect } from 'react';
  import { useNavigate, useLocation } from 'react-router-dom';

  import { User } from './types';

  interface AuthRedirectProps {
    user: User | null;
  }

  const AuthRedirect: React.FC<AuthRedirectProps> = ({ user }) => {
    const navigate = useNavigate();
    const location = useLocation(); // Dapatkan lokasi saat ini

    useEffect(() => {
      if (user) {
        if (user.role === 'admin') {
          // Hanya redirect ke /admin jika admin TIDAK sedang berada di halaman admin
          if (!location.pathname.startsWith('/admin')) {
            navigate('/admin');
          }
        } else { // Untuk role staff, guru, dll.
          // Jika mereka mencoba mengakses halaman admin, lempar kembali ke halaman utama
          if (location.pathname.startsWith('/admin')) {
            navigate('/');
          } else if (location.pathname === '/login') {
            navigate('/');
          }
        }
      } else {
        // Jika belum login dan tidak sedang di halaman login, paksa ke halaman login
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
    }, [user, navigate, location.pathname]); // Tambahkan location.pathname sebagai dependency

    return null; // Komponen ini tidak me-render apapun
  };

  export default AuthRedirect;