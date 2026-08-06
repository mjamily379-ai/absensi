// frontend/src/AdminAnnouncements.tsx
import React, { useState, useEffect } from 'react';
import { Button, Modal, Form, InputGroup, FormControl, Card } from 'react-bootstrap';
import api from './api';
import { toast } from 'react-toastify';
import './AdminAnnouncements.css';
import type { Announcement } from './types';
import { Search, PlusCircle, Edit2, Trash2, Megaphone } from 'lucide-react';

const AdminAnnouncements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentAnnouncement, setCurrentAnnouncement] = useState<Announcement | null>(null);
  const [announcementToDelete, setAnnouncementToDelete] = useState<Announcement | null>(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

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
    setShowModal(true);
  };

  const handleShowEditModal = (announcement: Announcement) => {
    setIsEditing(true);
    setCurrentAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && currentAnnouncement) {
        const response = await api.put(`/api/announcements/${currentAnnouncement._id}`, { title, content });
        toast.success(response.data.message);
      } else {
        const response = await api.post('/api/announcements', { title, content });
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

  const filteredAnnouncements = announcements.filter(ann => 
    ann.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ann.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h2 className="d-flex align-items-center gap-2">
          <Megaphone size={28} className="text-primary" />
          Manajemen Pengumuman
        </h2>
        <Button variant="primary" className="d-flex align-items-center gap-2" onClick={handleShowAddModal}>
          <PlusCircle size={18} />
          Buat Pengumuman Baru
        </Button>
      </div>

      <div className="mb-4">
        <InputGroup className="search-bar shadow-sm">
          <InputGroup.Text className="bg-white border-end-0">
            <Search size={18} className="text-muted" />
          </InputGroup.Text>
          <FormControl
            placeholder="Cari pengumuman berdasarkan judul atau isi..."
            className="border-start-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      {filteredAnnouncements.length > 0 ? (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="announcement-table mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="px-4 py-3">Judul</th>
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
                    <td className="px-4 py-3">
                      <div className="text-truncate" style={{ maxWidth: '300px' }}>
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
                        <Button variant="outline-info" size="sm" onClick={() => handleShowEditModal(announcement)} title="Edit">
                          <Edit2 size={16} />
                        </Button>
                        <Button variant="outline-danger" size="sm" onClick={() => handleConfirmDelete(announcement)} title="Hapus">
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
        <div className="text-center py-5 bg-light rounded shadow-sm">
          <Megaphone size={48} className="text-muted mb-3 opacity-25" />
          <p className="text-muted mb-0">Tidak ada pengumuman yang ditemukan.</p>
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
                placeholder="Masukkan judul yang menarik..."
                className="py-2"
              />
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
                className="py-2"
              />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="light" onClick={handleCloseModal} className="px-4 py-2">
                Batal
              </Button>
              <Button variant="primary" type="submit" className="px-4 py-2 fw-bold">
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
          <Button variant="light" onClick={() => setShowDeleteModal(false)} className="px-4">
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteAnnouncement} className="px-4">
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminAnnouncements;