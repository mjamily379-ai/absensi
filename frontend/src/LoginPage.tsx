import React, { useState } from 'react';
import api from './api';
import './LoginPage.css';
import { Form, Button, Spinner, InputGroup, Card, Container } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { User, Lock, Eye, EyeOff, UserPlus, LogIn, ChevronLeft, Briefcase } from 'lucide-react';

const REGISTER_ROLES = [
  { value: 'staff', label: 'Staff' },
  { value: 'petugas kebersihan', label: 'Petugas Kebersihan' },
  { value: 'guru ra', label: 'Guru RA' },
  { value: 'guru mi akhwat', label: 'Guru MI Akhwat' },
  { value: 'guru mi ikhwan', label: 'Guru MI Ikhwan' },
  { value: 'guru tahfidz fase a', label: 'Guru Tahfidz Fase A' },
  { value: 'guru tahfidz fase b & c', label: 'Guru Tahfidz Fase B & C' },
];

interface LoginPageProps {
  onLogin: (user: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('staff');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !password) {
      toast.error('Semua kolom wajib diisi.');
      return;
    }
    setIsLoading(true);
    api.post('/api/register', { username, password, name: fullName, role: selectedRole })
      .then(response => {
        if (response.data.success) {
          toast.success('Pendaftaran berhasil! Silakan masuk.');
          setIsRegistering(false);
          setUsername('');
          setPassword('');
          setFullName('');
          setSelectedRole('staff');
        } else {
          toast.error(response.data.message);
        }
      })
      .catch(error => {
        toast.error(error.response?.data?.message || 'Gagal mendaftarkan akun.');
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
              <h2 className="fw-bold text-primary-green mb-1">
                {isRegistering ? 'Daftar Akun' : 'Selamat Datang'}
              </h2>
              <p className="text-muted small">
                {isRegistering 
                  ? 'Lengkapi data di bawah untuk membuat akun baru.' 
                  : 'Silakan masuk dengan akun Anda untuk melanjutkan.'}
              </p>
            </div>

            {!isRegistering ? (
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
                    <InputGroup.Text className="bg-transparent border-0 ps-3">
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
                    Belum punya akun?{' '}
                    <Button variant="link" className="text-primary-green fw-bold p-0 small" onClick={() => setIsRegistering(true)}>
                      Daftar Sekarang
                    </Button>
                  </p>
                </div>
              </Form>
            ) : (
              <Form onSubmit={handleRegister}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Nama Lengkap</Form.Label>
                  <InputGroup className="bg-light rounded-12 overflow-hidden border">
                    <InputGroup.Text className="bg-transparent border-0 ps-3">
                      <User size={18} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Masukkan nama lengkap"
                      className="bg-transparent border-0 py-2 shadow-none"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Username</Form.Label>
                  <InputGroup className="bg-light rounded-12 overflow-hidden border">
                    <InputGroup.Text className="bg-transparent border-0 ps-3">
                      <UserPlus size={18} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Buat username"
                      className="bg-transparent border-0 py-2 shadow-none"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Password</Form.Label>
                  <InputGroup className="bg-light rounded-12 overflow-hidden border">
                    <InputGroup.Text className="bg-transparent border-0 ps-3">
                      <Lock size={18} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Buat password minimal 6 karakter"
                      className="bg-transparent border-0 py-2 shadow-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button 
                      variant="link" 
                      className="text-muted border-0 pe-3" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Role / Jabatan</Form.Label>
                  <InputGroup className="bg-light rounded-12 overflow-hidden border">
                    <InputGroup.Text className="bg-transparent border-0 ps-3">
                      <Briefcase size={18} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Select
                      className="bg-transparent border-0 py-2 shadow-none"
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                    >
                      {REGISTER_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </Form.Select>
                  </InputGroup>
                </Form.Group>

                <Button 
                  variant="success" 
                  type="submit" 
                  className="w-100 py-3 fw-bold rounded-12 shadow-sm d-flex align-items-center justify-content-center gap-2" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>Daftar Akun Baru <UserPlus size={18} /></>
                  )}
                </Button>

                <div className="text-center mt-4 pt-2">
                  <Button variant="link" className="text-muted text-decoration-none small d-flex align-items-center justify-content-center gap-1 mx-auto" onClick={() => setIsRegistering(false)}>
                    <ChevronLeft size={16} /> Kembali ke Halaman Masuk
                  </Button>
                </div>
              </Form>
            )}
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default LoginPage;