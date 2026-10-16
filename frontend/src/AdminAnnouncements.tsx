// frontend/src/AdminAnnouncements.tsx
import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, InputGroup, FormControl, Card, Badge, Row, Col } from 'react-bootstrap';
import api from './api';
import { toast } from 'react-toastify';
import './AdminAnnouncements.css';
import type { Announcement } from './types';
import { ROLE_OPTIONS } from './constants/roles';
import { SkeletonList } from './components/Skeleton';
import { Search, PlusCircle, Edit2, Trash2, Megaphone, Users, Filter } from 'lucide-react';

const ROLES_LIST = [
  { value: 'all', label: 'Semua Role (Semua Pengguna)' },
  ...ROLE_OPTIONS,
];

const getRoleLabel = (role?: string) => {
  if (!role || role === 'all') return 'Semua Role';
  const found = ROLES_LIST.find(r => r.value === role.toLowerCase());
  return found ? found.label.replace(' (Semua Pengguna)', '') : role;
};

const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState('all');

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get('/api/announcements');
      setAnnouncements(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      toast.error('Gagal mengambil data pengumuman.');
      console.error('Error fetching announcements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleShowAddModal = () => {
    setIsEditing(false);
    setCurrentAnnouncement(null);
    setTitle('');
    setContent('');
    setTargetRole('all');
    setShowModal(true);
  };

  const handleShowEditModal = (announcement: Announcement) => {
    setIsEditing(true);
    setCurrentAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setTargetRole(announcement.targetRole || 'all');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && currentAnnouncement) {
        const response = await api.put(`/api/announcements/${currentAnnouncement._id}`, { 
          title, 
          content,
          targetRole 
        });
        toast.success(response.data.message);
      } else {
        const response = await api.post('/api/announcements', { 
          title, 
          content,
          targetRole 
        });
        toast.success(response.data.message);
      }
      fetchAnnouncements();
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan pengumuman.');
      console.error('Error saving announcement:', error);
    }
  };

  const handleConfirmDelete = (announcement: Announcement) => {
    setAnnouncementToDelete(announcement);
    setShowDeleteModal(true);
  };

  const handleDeleteAnnouncement = async () => {
    if (!announcementToDelete) return;
    try {
      const response = await api.delete(`/api/announcements/${announcementToDelete._id}`);
      toast.success(response.data.message);
      fetchAnnouncements();
      setShowDeleteModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal menghapus pengumuman.');
      console.error('Error deleting announcement:', error);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const filteredAnnouncements = announcements.filter(ann => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = ann.title.toLowerCase().includes(q) || ann.content.toLowerCase().includes(q);
    const annRole = (ann.targetRole || 'all').toLowerCase();
    const matchesRole = filterRole === 'all' || annRole === filterRole.toLowerCase();
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return (
      <div className="admin-announcements-container d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Memuat...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-announcements-container">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="d-flex align-items-center gap-2 mb-1">
            <Megaphone size={28} className="text-primary" />
            Manajemen Pengumuman
          </h2>
          <p className="text-muted small mb-0">Kirim dan kelola siaran pengumuman untuk semua atau role tertentu</p>
        </div>
        <Button variant="primary" className="d-flex align-items-center gap-2 rounded-pill px-4 shadow-sm" onClick={handleShowAddModal}>
          <PlusCircle size={18} />
          Buat Pengumuman Baru
        </Button>
      </div>

      <Card className="border-0 shadow-sm rounded-16 mb-4">
        <Card.Body className="p-3">
          <Row className="g-3 align-items-center">
            <Col md={8}>
              <InputGroup className="shadow-none">
                <InputGroup.Text className="bg-light border-end-0">
                  <Search size={18} className="text-muted" />
                </InputGroup.Text>
                <FormControl
                  placeholder="Cari pengumuman berdasarkan judul atau isi..."
                  className="bg-light border-start-0 py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={4}>
              <div className="d-flex align-items-center gap-2">
                <Filter size={16} className="text-muted flex-shrink-0" />
                <Form.Select 
                  className="bg-light py-2"
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                >
                  <option value="all">Semua Target Role</option>
                  {ROLES_LIST.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoading ? (
        <Card className="border-0 shadow-sm rounded-16 overflow-hidden p-4">
          <SkeletonList rows={5} columns={4} />
        </Card>
      ) : filteredAnnouncements.length > 0 ? (
        <Card className="border-0 shadow-sm overflow-hidden rounded-16">
          <div className="table-responsive">
            <table className="announcement-table mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Target Role</th>
                  <th className="px-4 py-3">Isi Pengumuman</th>
                  <th className="px-4 py-3 text-nowrap">Dibuat Oleh</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredAnnouncements.map((announcement) => (
                  <tr key={announcement._id} className="align-middle">
                    <td className="px-4 py-3 fw-bold">{announcement.title}</td>
                    <td className="px-4 py-3 text-nowrap">
                      {(!announcement.targetRole || announcement.targetRole === 'all') ? (
                        <Badge bg="primary" className="rounded-pill px-3 py-1 fw-normal">
                          <Users size={12} className="me-1" /> Semua Role
                        </Badge>
                      ) : (
                        <Badge bg="info" text="dark" className="rounded-pill px-3 py-1 fw-normal">
                          {getRoleLabel(announcement.targetRole)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-truncate" style={{ maxWidth: '280px' }} title={announcement.content}>
                        {announcement.content}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-nowrap">
                      <span className="text-muted small">{announcement.createdBy?.name || 'Sistem'}</span>
                    </td>
                    <td className="px-4 py-3 text-nowrap small text-muted">
                      {formatDate(announcement.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <Button variant="outline-info" size="sm" className="rounded-circle p-2 border-0" onClick={() => handleShowEditModal(announcement)} title="Edit">
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="outline-danger" size="sm" className="rounded-circle p-2 border-0" onClick={() => handleConfirmDelete(announcement)} title="Hapus">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="text-center py-5 bg-light rounded-16 shadow-sm">
          <Megaphone size={48} className="text-muted mb-3 opacity-25" />
          <p className="text-muted mb-0 fw-bold">Tidak ada pengumuman yang cocok.</p>
          <p className="text-muted small">Coba ubah kata kunci pencarian atau target role yang dipilih.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold">
            {isEditing ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-4">
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Judul Pengumuman</Form.Label>
              <Form.Control
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Masukkan judul pengumuman..."
                className="py-2 rounded-12"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase d-flex align-items-center gap-1">
                <Users size={14} /> Target Role (Penerima Siaran)
              </Form.Label>
              <Form.Select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="py-2 rounded-12"
              >
                {ROLES_LIST.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted">
                {targetRole === 'all' 
                  ? 'Pengumuman ini akan terlihat oleh seluruh staf dan guru.' 
                  : `Pengumuman ini hanya akan terlihat oleh pengguna dengan role "${getRoleLabel(targetRole)}".`}
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label className="small fw-bold text-muted text-uppercase">Isi Pengumuman</Form.Label>
              <Form.Control
                as="textarea"
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                placeholder="Tuliskan detail pengumuman di sini..."
                className="py-2 rounded-12"
              />
            </Form.Group>

            <div className="d-flex justify-content-end gap-2">
              <Button variant="light" onClick={handleCloseModal} className="px-4 py-2 rounded-pill">
                Batal
              </Button>
              <Button variant="primary" type="submit" className="px-4 py-2 fw-bold rounded-pill">
                {isEditing ? 'Simpan Perubahan' : 'Siarkan Pengumuman'}
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
          <p>Apakah Anda yakin ingin menghapus pengumuman ini?</p>
          <p className="small text-muted fw-bold">{announcementToDelete?.title}</p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-center pb-4">
          <Button variant="light" onClick={() => setShowDeleteModal(false)} className="px-4 rounded-pill">
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteAnnouncement} className="px-4 rounded-pill">
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminAnnouncements;