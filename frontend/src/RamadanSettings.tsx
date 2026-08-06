import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Button, Form, Container, Table, Card, Spinner, Row, Col, Modal, Badge } from 'react-bootstrap';
import api from './api';
import type { RamadanPeriod } from './types';
import { Moon, Calendar, Plus, Trash2, Info, Clock } from 'lucide-react';

const RamadanSettings: React.FC = () => {
  const [periods, setPeriods] = useState<RamadanPeriod[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newEndDate, setNewEndDate] = useState<string>('');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [periodToDelete, setPeriodToDelete] = useState<RamadanPeriod | null>(null);

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/ramadan');
      setPeriods(response.data);
    } catch (error) {
      toast.error('Gagal memuat data Ramadhan.');
      console.error('Error fetching Ramadan periods:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddOrUpdatePeriod = async () => {
    if (!newYear || !newStartDate || !newEndDate) {
      toast.warning('Semua field harus diisi.');
      return;
    }

    setIsSaving(true);
    try {
      await api.post('/api/ramadan', {
        year: newYear,
        startDate: newStartDate,
        endDate: newEndDate
      });
      toast.success('Periode Ramadhan berhasil disimpan.');
      fetchPeriods();
      setNewStartDate('');
      setNewEndDate('');
    } catch (error) {
      toast.error('Gagal menyimpan periode Ramadhan.');
      console.error('Error saving Ramadan period:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = (period: RamadanPeriod) => {
    setPeriodToDelete(period);
    setShowDeleteModal(true);
  };

  const handleDeletePeriod = async () => {
    if (!periodToDelete || !periodToDelete._id) return;
    
    try {
      await api.delete(`/api/ramadan/${periodToDelete._id}`);
      toast.success('Periode Ramadhan berhasil dihapus.');
      fetchPeriods();
      setShowDeleteModal(false);
    } catch (error) {
      toast.error('Gagal menghapus periode Ramadhan.');
      console.error('Error deleting Ramadan period:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <Container fluid className="py-4">
      <div className="mb-4">
        <h1 className="h3 mb-1 fw-bold text-dark d-flex align-items-center gap-2">
          <Moon className="text-primary" size={32} />
          Pengaturan Periode Ramadhan
        </h1>
        <p className="text-muted">Tentukan rentang tanggal bulan Ramadhan setiap tahunnya untuk penyesuaian jam kerja otomatis.</p>
      </div>

      <Row className="g-4">
        <Col lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 border-0">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <Plus size={20} className="text-primary" />
                Tambah / Update Periode
              </h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Tahun</Form.Label>
                  <Form.Control 
                    type="number" 
                    value={newYear} 
                    onChange={(e) => setNewYear(parseInt(e.target.value))} 
                    className="py-2"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Tanggal Mulai</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={newStartDate} 
                    onChange={(e) => setNewStartDate(e.target.value)} 
                    className="py-2"
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Tanggal Selesai</Form.Label>
                  <Form.Control 
                    type="date" 
                    value={newEndDate} 
                    onChange={(e) => setNewEndDate(e.target.value)} 
                    className="py-2"
                  />
                </Form.Group>
                <div className="d-grid">
                  <Button variant="primary" onClick={handleAddOrUpdatePeriod} disabled={isSaving} className="py-2 fw-bold">
                    {isSaving ? (
                      <><Spinner as="span" animation="border" size="sm" className="me-2" /> Menyimpan...</>
                    ) : (
                      'Simpan Periode'
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>

          <Card className="border-0 shadow-sm mt-4 bg-info text-white">
            <Card.Body className="d-flex gap-3">
              <Clock size={24} className="flex-shrink-0" />
              <div>
                <h6 className="fw-bold mb-1">Jam Kerja Khusus</h6>
                <p className="small mb-0 opacity-75">
                  Sistem akan secara otomatis menggunakan "Jam Masuk Ramadhan" yang telah diatur di menu Pengaturan Hari Kerja selama periode ini berlangsung.
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={8}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-3 border-0">
              <h5 className="mb-0 fw-bold">Riwayat Periode Ramadhan</h5>
            </Card.Header>
            <Card.Body className="p-0">
              {isLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="text-muted mt-2">Memuat data...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="bg-light">
                      <tr>
                        <th className="px-4 py-3 border-0">Tahun</th>
                        <th className="px-4 py-3 border-0">Rentang Tanggal</th>
                        <th className="px-4 py-3 border-0 text-end">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.length > 0 ? periods.map((p) => (
                        <tr key={p._id} className="align-middle">
                          <td className="px-4 py-3 fw-bold h5 mb-0 text-primary">{p.year}</td>
                          <td className="px-4 py-3">
                            <div className="d-flex align-items-center gap-2">
                              <Calendar size={16} className="text-muted" />
                              <span className="fw-bold">{formatDate(p.startDate)}</span>
                              <span className="text-muted px-2">-</span>
                              <span className="fw-bold">{formatDate(p.endDate)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-end">
                            <Button variant="outline-danger" size="sm" onClick={() => handleConfirmDelete(p)} className="border-0 p-2">
                              <Trash2 size={18} />
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={3} className="text-center py-5 text-muted">
                            <Moon size={48} className="mb-3 opacity-25" />
                            <p>Belum ada periode Ramadhan yang didefinisikan.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered size="sm">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold">Hapus Periode?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center pt-4">
          <div className="text-danger mb-3">
            <Trash2 size={48} />
          </div>
          <p>Hapus periode Ramadhan tahun <strong>{periodToDelete?.year}</strong>?</p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-center pb-4">
          <Button variant="light" onClick={() => setShowDeleteModal(false)} className="px-4">
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeletePeriod} className="px-4">
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default RamadanSettings;
