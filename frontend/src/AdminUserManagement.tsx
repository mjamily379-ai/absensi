// frontend/src/AdminUserManagement.tsx
import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Badge, InputGroup, FormControl } from 'react-bootstrap';
import api from './api';
import { toast } from 'react-toastify';
import './AdminUserManagement.css';
import type { User } from './types';
import { ROLE_LABELS, ROLE_OPTIONS, type Role } from './constants/roles';
import { SkeletonList } from './components/Skeleton';
import { Search, UserPlus, Edit2, Trash2, KeyRound, Copy } from 'lucide-react';

const ROLE_BADGE_STYLES: Record<Role, { bg?: string; backgroundColor?: string; text?: string }> = {
  admin: { bg: 'danger' },
  staff: { bg: 'primary' },
  'petugas kebersihan': { bg: 'secondary' },
  'guru ra': { bg: 'success' },
  'guru mi akhwat': { bg: 'info' },
  'guru mi ikhwan': { bg: 'warning', text: 'dark' },
  'guru tahfidz fase a': { bg: 'purple', backgroundColor: '#7c3aed' },
  'guru tahfidz fase b & c': { bg: 'pink', backgroundColor: '#db2777' },
  'guru asisten': { bg: 'teal', backgroundColor: '#0d9488' },
};

const AdminUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Reset password state
  const [showResetModal, setShowResetModal] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetTempPassword, setResetTempPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<User['role']>('staff');
  const [formErrors, setFormErrors] = useState<{ username?: string; password?: string; name?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: { username?: string; password?: string; name?: string } = {};
    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    if (!trimmedUsername) errors.username = 'Username wajib diisi.';
    else if (trimmedUsername.length < 3) errors.username = 'Username minimal 3 karakter.';
    else if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUsername)) errors.username = 'Username hanya boleh huruf, angka, titik, garis bawah, atau strip.';
    if (!trimmedName) errors.name = 'Nama lengkap wajib diisi.';
    else if (trimmedName.length < 2) errors.name = 'Nama lengkap minimal 2 karakter.';
    if (!isEditing) {
      if (!password) errors.password = 'Password wajib diisi.';
      else if (password.length < 6) errors.password = 'Password minimal 6 karakter.';
    } else if (password && password.length < 6) {
      errors.password = 'Password minimal 6 karakter.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getPasswordStrength = (pw: string): { label: string; score: number } => {
    if (!pw) return { label: '', score: 0 };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const clamped = Math.max(1, Math.min(score, 5));
    const labels = ['Sangat Lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat Kuat'];
    return { label: labels[clamped - 1], score: clamped };
  };
  const passwordStrength = getPasswordStrength(password);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      toast.error('Gagal mengambil data pengguna.');
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleShowAddModal = () => {
    setIsEditing(false);
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    setName('');
    setRole('staff');
    setFormErrors({});
    setShowModal(true);
  };

  const handleShowEditModal = (user: User) => {
    setIsEditing(true);
    setCurrentUser(user);
    setUsername(user.username);
    setPassword(''); 
    setName(user.name);
    setRole(user.role);
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      if (isEditing && currentUser) {
        const updateData: any = { username, name, role };
        if (password) updateData.password = password;
        const response = await api.put(`/api/users/${currentUser._id}`, updateData);
        toast.success(response.data.message);
      } else {
        const response = await api.post('/api/users', { username, password, name, role });
        toast.success(response.data.message);
      }
      fetchUsers();
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan data pengguna.');
      console.error('Error saving user:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const response = await api.delete(`/api/users/${userToDelete._id}`);
      toast.success(response.data.message);
      fetchUsers();
      setShowDeleteModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menghapus pengguna.');
      console.error('Error deleting user:', error);
    }
  };

  const handleConfirmReset = (user: User) => {
    setUserToReset(user);
    setResetTempPassword('');
    setShowResetModal(true);
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;
    setIsResetting(true);
    try {
      const response = await api.post(`/api/users/${userToReset._id}/reset-password`);
      setResetTempPassword(response.data?.temporaryPassword || '');
      toast.success(response.data?.message || 'Password berhasil direset.');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal mereset password pengguna.');
      console.error('Error resetting password:', error);
    } finally {
      setIsResetting(false);
    }
  };

  const copyTempPassword = () => {
    if (resetTempPassword) {
      navigator.clipboard.writeText(resetTempPassword)
        .then(() => toast.success('Password sementara disalin ke clipboard.'))
        .catch(() => toast.error('Gagal menyalin password.'));
    }
  };

  const getRoleBadge = (role: string) => {
    const normalized = role.toLowerCase() as Role;
    if (normalized in ROLE_BADGE_STYLES) {
      const style = ROLE_BADGE_STYLES[normalized];
      return (
        <Badge bg={style.bg as any} text={style.text as any} style={style.backgroundColor ? { backgroundColor: style.backgroundColor } : undefined}>
          {ROLE_LABELS[normalized]}
        </Badge>
      );
    }
    return <Badge bg="secondary">{role}</Badge>;
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="admin-user-container d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Memuat...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-user-container">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <h2>Manajemen Pengguna</h2>
        <Button variant="primary" className="d-flex align-items-center gap-2" onClick={handleShowAddModal}>
          <UserPlus size={18} />
          Tambah Pengguna Baru
        </Button>
      </div>

      <div className="mb-4">
        <InputGroup className="search-bar">
          <InputGroup.Text className="bg-white border-end-0">
            <Search size={18} className="text-muted" />
          </InputGroup.Text>
          <FormControl
            placeholder="Cari pengguna berdasarkan nama, username, atau role..."
            className="border-start-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      {isLoading ? (
        <div className="card border-0 shadow-sm overflow-hidden p-4">
          <SkeletonList rows={6} columns={4} />
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="user-table mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="align-middle">
                    <td className="px-4 py-3 font-monospace">{user.username}</td>
                    <td className="px-4 py-3 font-weight-bold">{user.name}</td>
                    <td className="px-4 py-3">
                      {getRoleBadge(user.role)}
                      {(user as any).mustChangePassword && (
                        <div className="mt-1">
                          <Badge bg="warning" text="dark" className="rounded-pill tiny">
                            Password Sementara
                          </Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <Button variant="outline-warning" size="sm" onClick={() => handleConfirmReset(user)} title="Reset Password">
                          <KeyRound size={16} />
                        </Button>
                        <Button variant="outline-info" size="sm" onClick={() => handleShowEditModal(user)} title="Edit">
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => handleConfirmDelete(user)} title="Hapus">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-5 bg-light rounded shadow-sm">
          <p className="text-muted mb-0">Tidak ada data pengguna yang ditemukan.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">{isEditing ? 'Edit Pengguna' : 'Tambah Pengguna Baru'}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-4">
          <Form onSubmit={handleSubmit} noValidate>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Username</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFormErrors(prev => prev.username ? { ...prev, username: undefined } : prev); }}
                isInvalid={!!formErrors.username}
                className="py-2"
              />
              <Form.Control.Feedback type="invalid">{formErrors.username}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFormErrors(prev => prev.password ? { ...prev, password: undefined } : prev); }}
                isInvalid={!!formErrors.password}
                placeholder={isEditing ? "Kosongkan jika tidak ingin mengubah password" : "Minimal 6 karakter"}
                aria-describedby="password-strength"
                className="py-2"
              />
              <Form.Control.Feedback type="invalid">{formErrors.password}</Form.Control.Feedback>
              {passwordStrength.score > 0 && (
                <div className="mt-2" id="password-strength">
                  <div className="d-flex align-items-center gap-2">
                    <div className="flex-grow-1 d-flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className="flex-grow-1 rounded-pill"
                          style={{
                            height: 5,
                            backgroundColor: i <= passwordStrength.score
                              ? (passwordStrength.score >= 4 ? 'var(--accent-green)' : passwordStrength.score === 3 ? 'var(--warning)' : 'var(--danger)')
                              : 'var(--bg-secondary)'
                          }}
                        />
                      ))}
                    </div>
                    <span className="small text-muted text-nowrap">{passwordStrength.label}</span>
                  </div>
                </div>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Nama Lengkap</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setFormErrors(prev => prev.name ? { ...prev, name: undefined } : prev); }}
                isInvalid={!!formErrors.name}
                className="py-2"
              />
              <Form.Control.Feedback type="invalid">{formErrors.name}</Form.Control.Feedback>
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label className="small fw-bold text-muted text-uppercase">Role</Form.Label>
              <Form.Select value={role} onChange={(e) => setRole(e.target.value as User['role'])} required className="py-2">
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <div className="d-grid">
              <Button variant="primary" type="submit" className="py-2 fw-bold" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : (isEditing ? 'Simpan Perubahan' : 'Tambah Pengguna')}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered size="sm">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold">Konfirmasi Hapus</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center pt-4">
          <div className="text-danger mb-3">
            <Trash2 size={48} />
          </div>
          <p>Apakah Anda yakin ingin menghapus pengguna <strong>{userToDelete?.name}</strong>?</p>
          <p className="small text-muted">Semua data terkait akan dihapus secara permanen.</p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-center pb-4">
          <Button variant="light" onClick={() => setShowDeleteModal(false)} className="px-4">
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteUser} className="px-4">
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reset Password Modal */}
      <Modal show={showResetModal} onHide={() => setShowResetModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h fw-bold d-flex align-items-center gap-2">
            <KeyRound size={20} className="text-warning" />
            Reset Password: {userToReset?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-4">
          {!resetTempPassword ? (
            <div>
              <p>
                Reset password akan <strong>mengganti password pengguna</strong> dengan password sementara baru.
              </p>
              <p className="small text-muted">
                Pengguna harus mengganti password saat login berikutnya. Seluruh sesi perangkat lain juga akan dicabut.
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-3">Password sementara baru untuk <strong>{userToReset?.name}</strong>:</p>
              <div className="d-flex align-items-center justify-content-center gap-2 bg-light p-3 rounded-12 mb-2">
                <code className="h5 mb-0 fw-bold font-monospace">{resetTempPassword}</code>
                <Button variant="outline-primary" size="sm" onClick={copyTempPassword} title="Salin" className="px-2">
                  <Copy size={16} />
                </Button>
              </div>
              <p className="small text-muted mb-0">
                Bagikan password ini kepada pengguna secara aman. Mereka wajib menggantinya sesaat setelah masuk.
              </p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-center pb-4">
          {!resetTempPassword ? (
            <>
              <Button variant="light" onClick={() => setShowResetModal(false)} className="px-4">
                Batal
              </Button>
              <Button variant="warning" onClick={handleResetPassword} disabled={isResetting} className="px-4 fw-bold">
                {isResetting ? 'Mereset...' : 'Ya, Reset Password'}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => setShowResetModal(false)} className="px-4 rounded-pill">
              Selesai
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminUserManagement;