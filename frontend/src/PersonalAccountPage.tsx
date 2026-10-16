import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';
import { Form, Button, Card, Container, Row, Col, Alert, Badge, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { User as UserIcon, KeyRound, ShieldAlert, Save, IdCard, BadgeCheck } from 'lucide-react';
import { extractStaffId, readStoredUser } from './types';
import { ROLE_LABELS, type Role } from './constants/roles';

interface ProfileData {
  _id: string;
  username: string;
  name: string;
  role: Role;
  mustChangePassword?: boolean;
  staffId?: { _id: string; name: string } | string | null;
}

const PersonalAccountPage: React.FC = () => {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Nama form
  const [name, setName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const navigateTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (navigateTimerRef.current !== null) window.clearTimeout(navigateTimerRef.current);
  }, []);

  useEffect(() => {
    api.get('/api/users/me/profile')
      .then(res => {
        const data = res.data as ProfileData;
        setProfile(data);
        setName(data.name || '');
      })
      .catch(err => {
        console.error('Error fetching profile:', err);
      })
      .finally(() => setIsLoadingProfile(false));
  }, []);

  const mustChangePassword = !!(profile?.mustChangePassword || readStoredUser()?.mustChangePassword);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Nama minimal 2 karakter.');
      return;
    }
    setIsSavingName(true);
    try {
      const response = await api.put('/api/users/me/profile', { name: name.trim() });
      toast.success(response.data.message || 'Profil berhasil diperbarui.');

      const stored = readStoredUser();
      if (stored) {
        stored.name = name.trim();
        localStorage.setItem('user', JSON.stringify(stored));
        window.dispatchEvent(new Event('profileupdated'));
      }
      setProfile(prev => prev ? { ...prev, name: name.trim() } : prev);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal memperbarui profil.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }

    setIsSavingPassword(true);
    try {
      const response = await api.put('/api/users/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success(response.data.message || 'Password berhasil diubah.');

      // Session token is revoked after a password change — force re-login.
      localStorage.removeItem('user');
      navigateTimerRef.current = window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal mengganti password.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const staffIdRef = profile?.staffId || readStoredUser()?.staffId;
  const staffIdStr = staffIdRef ? extractStaffId(staffIdRef) : null;
  const roleLabel = (profile?.role || readStoredUser()?.role)
    ? (ROLE_LABELS[((profile?.role || readStoredUser()?.role) as Role)] || (profile?.role || readStoredUser()?.role))
    : '';

  if (isLoadingProfile) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="primary" />
        <p className="text-muted mt-2">Memuat profil...</p>
      </Container>
    );
  }

  const username = profile?.username || readStoredUser()?.username || '';

  return (
    <Container className="py-4 animate-fade-in">
      <div className="mb-4">
        <h2 className="fw-bold text-primary-green d-flex align-items-center gap-2 mb-1">
          <UserIcon size={28} />
          Akun Saya
        </h2>
        <p className="text-muted small mb-0">Kelola identitas dan keamanan akun Anda.</p>
      </div>

      {mustChangePassword && (
        <Alert variant="warning" className="rounded-16 d-flex align-items-center gap-3 shadow-sm mb-4 border-0">
          <ShieldAlert className="flex-shrink-0 text-warning" size={28} />
          <div>
            <strong>Password sementara!</strong>
            <p className="mb-0 small">
              Anda masuk menggunakan password sementara. Silakan ganti password Anda sekarang agar sesi Anda tetap aman.
            </p>
          </div>
        </Alert>
      )}

      <Row className="g-4">
        <Col lg={5}>
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
            <Card.Body className="p-4 text-center">
              <div className="avatar-circle-large bg-primary-green text-white mb-3 mx-auto d-flex align-items-center justify-content-center rounded-circle shadow">
                <span className="h2 mb-0 font-weight-bold">{(profile?.name || readStoredUser()?.name || username || 'U').charAt(0).toUpperCase()}</span>
              </div>
              <h4 className="fw-bold mb-1">{profile?.name || readStoredUser()?.name || '-'}</h4>
              <div className="d-flex justify-content-center gap-2 mb-3 flex-wrap">
                <Badge bg="info" className="rounded-pill px-3 text-uppercase">{roleLabel}</Badge>
                {mustChangePassword && <Badge bg="warning" text="dark" className="rounded-pill px-3">Password Sementara</Badge>}
              </div>

              <div className="text-start bg-light p-3 rounded-12 mb-3">
                <div className="d-flex justify-content-between py-1">
                  <span className="small text-muted d-flex align-items-center gap-1"><IdCard size={14} /> NIP / Staff ID</span>
                  <span className="small fw-bold font-monospace">{staffIdStr || '-'}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="small text-muted">Username</span>
                  <span className="small fw-bold font-monospace">{username || '-'}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="small text-muted">Peran</span>
                  <span className="small fw-bold text-capitalize">{roleLabel || '-'}</span>
                </div>
              </div>

              <div className="bg-emerald-light p-3 rounded-12">
                <p className="small fw-bold mb-1 d-flex align-items-center gap-1">
                  <BadgeCheck size={14} className="text-primary-green" /> Informasi Akun
                </p>
                <p className="tiny text-muted mb-0">
                  Gunakan menu "Ubah Nama" untuk memperbarui identitas, dan menu di samping untuk mengamankan password Anda.
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden mb-4">
            <Card.Header className="bg-white py-3 border-bottom">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <UserIcon size={18} className="text-primary-green" /> Ubah Nama Tampilan
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleNameSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Nama Lengkap</Form.Label>
                  <Form.Control
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    className="py-2"
                    placeholder="Nama lengkap Anda"
                  />
                </Form.Group>
                <Button
                  variant="primary-green"
                  type="submit"
                  className="px-4 rounded-pill d-inline-flex align-items-center gap-2"
                  disabled={isSavingName}
                >
                  {isSavingName ? <><Spinner as="span" animation="border" size="sm" /> Menyimpan...</> : <><Save size={16} /> Simpan Nama</>}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
            <Card.Header className="bg-white py-3 border-bottom">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <KeyRound size={18} className="text-primary-green" /> Ganti Password
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handlePasswordSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Password Saat Ini</Form.Label>
                  <Form.Control
                    type="password"
                    className="py-2"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </Form.Group>
                <Row className="g-3 mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted text-uppercase">Password Baru</Form.Label>
                      <Form.Control
                        type="password"
                        className="py-2"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted text-uppercase">Konfirmasi Password Baru</Form.Label>
                      <Form.Control
                        type="password"
                        className="py-2"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        isInvalid={confirmNewPassword.length > 0 && confirmNewPassword !== newPassword}
                        required
                      />
                      <Form.Control.Feedback type="invalid">Konfirmasi password tidak cocok.</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
                <p className="tiny text-muted mb-3">
                  Setelah mengganti password, Anda akan diminta masuk kembali karena sesi lama otomatis dicabut.
                </p>
                <Button
                  variant="primary"
                  type="submit"
                  className="px-4 rounded-pill d-inline-flex align-items-center gap-2"
                  disabled={isSavingPassword}
                >
                  {isSavingPassword ? <><Spinner as="span" animation="border" size="sm" /> Mengubah...</> : <><KeyRound size={16} /> Ganti Password</>}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default PersonalAccountPage;