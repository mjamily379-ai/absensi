import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'react-bootstrap';
import { AlertTriangle, Home } from 'lucide-react';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="admin-page-container d-flex flex-column align-items-center justify-content-center text-center" style={{ minHeight: '60vh' }}>
      <AlertTriangle size={64} className="text-warning mb-4" style={{ opacity: 0.7 }} />
      <h1 className="fw-bold mb-2" style={{ fontSize: '3rem' }}>404</h1>
      <h2 className="fw-bold mb-3">Halaman Tidak Ditemukan</h2>
      <p className="text-muted mb-4" style={{ maxWidth: 400 }}>
        Sepertinya halaman yang kamu cari sudah dipindahkan atau tidak tersedia.
      </p>
      <Button
        variant="primary"
        className="rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
        onClick={() => navigate('/')}
      >
        <Home size={18} /> Kembali ke Beranda
      </Button>
    </div>
  );
};

export default NotFoundPage;
