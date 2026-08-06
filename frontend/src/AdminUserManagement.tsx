// frontend/src/AdminUserManagement.tsx
import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, Badge, InputGroup, FormControl } from 'react-bootstrap';
import api from './api';
import { toast } from 'react-toastify';
import './AdminUserManagement.css';
import type { User } from './types';
import { Search, UserPlus, Edit2, Trash2 } from 'lucide-react';

const AdminUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<User['role']>('staff');

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
    setShowModal(true);
  };

  const handleShowEditModal = (user: User) => {
    setIsEditing(true);
    setCurrentUser(user);
    setUsername(user.username);
    setPassword(''); 
    setName(user.name);
    setRole(user.role);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Badge bg="danger">Admin</Badge>;
      case 'staff':
        return <Badge bg="primary">Staff</Badge>;
      case 'guru ra':
        return <Badge bg="success">Guru RA</Badge>;
      case 'guru mi akhwat':
        return <Badge bg="info">Guru MI Akhwat</Badge>;
      case 'guru mi ikhwan':
        return <Badge bg="warning" text="dark">Guru MI Ikhwan</Badge>;
      case 'guru tahfidz fase a':
        return <Badge bg="purple" style={{ backgroundColor: '#7c3aed' }}>Guru Tahfidz Fase A</Badge>;
      case 'guru tahfidz fase b & c':
        return <Badge bg="pink" style={{ backgroundColor: '#db2777' }}>Guru Tahfidz Fase B & C</Badge>;
      default:
        return <Badge bg="secondary">{role}</Badge>;
    }
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

      {filteredUsers.length > 0 ? (
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
                    <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                    <td className="px-4 py-3 text-end">
                      <div className="d-flex justify-content-end gap-2">
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
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Username</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="py-2"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!isEditing}
                placeholder={isEditing ? "Kosongkan jika tidak ingin mengubah password" : "Minimal 6 karakter"}
                className="py-2"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Nama Lengkap</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="py-2"
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label className="small fw-bold text-muted text-uppercase">Role</Form.Label>
              <Form.Select value={role} onChange={(e) => setRole(e.target.value as User['role'])} required className="py-2">
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
                <option value="petugas kebersihan">Petugas Kebersihan</option>
                <option value="guru ra">Guru RA</option>
                <option value="guru mi akhwat">Guru MI Akhwat</option>
                <option value="guru mi ikhwan">Guru MI Ikhwan</option>
                <option value="guru tahfidz fase a">Guru Tahfidz Fase A</option>
                <option value="guru tahfidz fase b & c">Guru Tahfidz Fase B & C</option>
              </Form.Select>
            </Form.Group>
            <div className="d-grid">
              <Button variant="primary" type="submit" className="py-2 fw-bold">
                {isEditing ? 'Simpan Perubahan' : 'Tambah Pengguna'}
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
    </div>
  );
};

export default AdminUserManagement;