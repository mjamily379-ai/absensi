import React, { useState } from 'react';
import api from './api';
import './LoginPage.css';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Spinner, InputGroup, Card, Container } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { User, Lock, Eye, EyeOff, LogIn } from 'lucide-react';

interface LoginPageProps {
  onLogin: (user: { id: string; username: string; role: string; staffId?: string; name: string; mustChangePassword?: boolean }) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.warn('Masukkan username dan password Anda.');
      return;
    }
    setIsLoading(true);
    api.post('/api/login', { username, password })
      .then(response => {
        if (response.data.success) {
          toast.success('Selamat datang kembali!');
          onLogin(response.data.user);
          const role = response.data.user?.role;
          navigate(role === 'admin' ? '/admin' : '/', { replace: true });
        } else {
          toast.error(response.data.message);
        }
      })
      .catch(error => {
        toast.error(error.response?.data?.message || 'Gagal masuk ke sistem.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <div className="login-page-wrapper">
      <Container className="d-flex align-items-center justify-content-center h-100">
        <Card className="login-card border-0 shadow-lg animate-fade-in">
          <Card.Body className="p-4 p-md-5">
            <div className="text-center mb-4">
              <div className="login-logo-container mb-3">
                <img src="/LOGO1.png" alt="Logo" className="login-logo" />
              </div>
              <h2 className="fw-bold text-primary-green mb-1">Selamat Datang</h2>
              <p className="text-muted small">
                Silakan masuk dengan akun Anda untuk melanjutkan.
              </p>
            </div>

            <Form onSubmit={handleLogin}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold text-muted text-uppercase">Username</Form.Label>
                <InputGroup className="bg-light rounded-12 overflow-hidden border">
                  <InputGroup.Text className="bg-transparent border-0 ps-3">
                    <User size={18} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Masukkan username"
                    className="bg-transparent border-0 py-2 shadow-none"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </InputGroup>
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="small fw-bold text-muted text-uppercase">Password</Form.Label>
                <InputGroup className="bg-light rounded-12 overflow-hidden border">
                  <InputGroup.Text className="bg-transparent border-0 pe-0 ps-3">
                    <Lock size={18} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    className="bg-transparent border-0 py-2 shadow-none"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    variant="link"
                    className="text-muted border-0 pe-3"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </InputGroup>
              </Form.Group>

              <Button
                variant="primary"
                type="submit"
                className="w-100 py-3 fw-bold rounded-12 shadow-sm d-flex align-items-center justify-content-center gap-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Spinner animation="border" size="sm" />
                ) : (
                  <>Masuk ke Sistem <LogIn size={18} /></>
                )}
              </Button>

              <div className="text-center mt-4 pt-2">
                <p className="small text-muted mb-0">
                  Akun dibuat oleh Admin. Hubungi admin jika belum memiliki akun.
                </p>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default LoginPage;