import React, { useState, useEffect } from 'react';
import api from './api';
import { toast } from 'react-toastify';
import { Button, Form, Table, Container, Row, Col, Card, Spinner, Badge, Modal } from 'react-bootstrap';
import { Calendar, RefreshCw, Trash2, Plus, Info, Globe } from 'lucide-react';
import { ROLE_OPTIONS } from './constants/roles';

interface Holiday {
  _id: string;
  date: string;
  name: string;
  isNationalHoliday: boolean;
  role: string;
}

const HolidaySettings: React.FC = () => {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState<string>('');
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [newHolidayRole, setNewHolidayRole] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<Holiday | null>(null);

  const ROLES = [
    { value: 'all', label: 'Semua Role' },
    ...ROLE_OPTIONS.filter(r => r.value !== 'admin'),
  ];

  const fetchHolidays = async (currentYear: number) => {
    setIsLoading(true);
    try {
      const response = await api.get(`/api/holidays?year=${currentYear}`);
      setHolidays(response.data);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Gagal memuat data hari libur.';
      toast.error(message);
      console.error('Error fetching holidays:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays(year);
  }, [year]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setYear(Number(e.target.value));
  };

  const handleSyncHolidays = async () => {
    setIsSyncing(true);
    try {
      const response = await api.post(`/api/holidays/sync?year=${year}`);
      toast.success(`Sinkronisasi selesai. ${response.data.synced} hari libur diperbarui.`);
      fetchHolidays(year);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Gagal melakukan sinkronisasi.';
      toast.error(message);
      console.error('Error syncing holidays:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) {
      toast.warn('Tanggal dan Nama Hari Libur harus diisi.');
      return;
    }
    try {
      await api.post('/api/holidays', {
        date: newHolidayDate,
        name: newHolidayName,
        role: newHolidayRole,
      });
      toast.success('Hari libur manual berhasil ditambahkan.');
      setNewHolidayDate('');
      setNewHolidayName('');
      setNewHolidayRole('all');
      fetchHolidays(year);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Gagal menambahkan hari libur.';
      toast.error(message);
      console.error('Error adding holiday:', error);
    }
  };

  const handleConfirmDelete = (holiday: Holiday) => {
    setHolidayToDelete(holiday);
    setShowDeleteModal(true);
  };

  const handleDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      await api.delete(`/api/holidays/${holidayToDelete._id}`);
      toast.success('Hari libur berhasil dihapus.');
      fetchHolidays(year);
      setShowDeleteModal(false);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Gagal menghapus hari libur.';
      toast.error(message);
      console.error('Error deleting holiday:', error);
    }
  };

  const yearOptions = () => {
    const current = new Date().getFullYear();
    const years = [];
    for (let i = current - 5; i <= current + 5; i++) {
      years.push(i);
    }
    return years.map(y => <option key={y} value={y}>{y}</option>);
  };

  return (
    <Container fluid className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h1 className="h3 mb-1 fw-bold text-dark">
            <Calendar className="me-2 text-primary" size={32} />
            Pengaturan Hari Libur
          </h1>
          <p className="text-muted mb-0">Kelola daftar hari libur nasional dan libur internal institusi.</p>
        </div>
        <div className="d-flex align-items-center gap-2 bg-light p-2 rounded shadow-sm">
          <Form.Label htmlFor="year-select" className="mb-0 fw-bold small text-muted text-uppercase">Tahun:</Form.Label>
          <Form.Select id="year-select" value={year} onChange={handleYearChange} className="border-0 bg-transparent fw-bold" style={{ width: '100px' }}>
            {yearOptions()}
          </Form.Select>
        </div>
      </div>
      
      <Row className="g-4">
        <Col lg={8}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-3 border-0 d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold">Daftar Hari Libur {year}</h5>
              <Button 
                variant="outline-primary" 
                size="sm" 
                onClick={handleSyncHolidays} 
                disabled={isSyncing}
                className="d-flex align-items-center gap-2"
              >
                {isSyncing ? (
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Sinkronkan Libur Nasional
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {isLoading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="text-muted mt-2">Memuat data hari libur...</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table hover className="mb-0">
                    <thead className="bg-light">
                      <tr>
                        <th className="px-4 py-3 border-0">Tanggal</th>
                        <th className="px-4 py-3 border-0">Nama Hari Libur</th>
                        <th className="px-4 py-3 border-0">Tipe</th>
                        <th className="px-4 py-3 border-0">Role</th>
                        <th className="px-4 py-3 border-0 text-end">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.length > 0 ? holidays.map(holiday => (
                        <tr key={holiday._id} className="align-middle">
                          <td className="px-4 py-3 text-nowrap">
                            <div className="fw-bold">{new Date(holiday.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', timeZone: 'UTC' })}</div>
                            <div className="small text-muted">{new Date(holiday.date).toLocaleDateString('id-ID', { year: 'numeric', timeZone: 'UTC' })}</div>
                          </td>
                          <td className="px-4 py-3 fw-bold">{holiday.name}</td>
                          <td className="px-4 py-3">
                            {holiday.isNationalHoliday ? (
                              <Badge bg="success" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <Globe size={12} /> Nasional
                              </Badge>
                            ) : (
                              <Badge bg="info" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <Info size={12} /> Internal
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge bg="light" text="dark" className="border px-3 py-2">
                              {ROLES.find(r => r.value === holiday.role)?.label || holiday.role}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-end">
                            <Button variant="outline-danger" size="sm" onClick={() => handleConfirmDelete(holiday)} className="border-0">
                              <Trash2 size={18} />
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="text-center py-5 text-muted">
                            <Calendar size={48} className="mb-3 opacity-25" />
                            <p>Tidak ada data hari libur untuk tahun {year}.</p>
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
        
        <Col lg={4}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 border-0">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <Plus size={20} className="text-primary" />
                Tambah Manual
              </h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleAddHoliday}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Tanggal Libur</Form.Label>
                  <Form.Control type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} required className="py-2" />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Nama Hari Libur</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={newHolidayName} 
                    onChange={e => setNewHolidayName(e.target.value)} 
                    placeholder="Cth: Cuti Bersama Awal Puasa" 
                    required 
                    className="py-2"
                  />
                </Form.Group>
                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Berlaku Untuk Role</Form.Label>
                  <Form.Select value={newHolidayRole} onChange={e => setNewHolidayRole(e.target.value)} className="py-2">
                    {ROLES.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <div className="d-grid">
                  <Button type="submit" variant="primary" className="py-2 fw-bold">
                    Tambah Hari Libur
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
          
          <Card className="border-0 shadow-sm mt-4 bg-primary text-white">
            <Card.Body>
              <h6 className="fw-bold mb-2 d-flex align-items-center gap-2">
                <Info size={18} />
                Informasi
              </h6>
              <p className="small mb-0 opacity-75">
                Sinkronisasi akan mengambil data libur nasional secara otomatis dari sistem eksternal untuk tahun yang dipilih.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered size="sm">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold">Hapus Libur?</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center pt-4">
          <div className="text-danger mb-3">
            <Trash2 size={48} />
          </div>
          <p>Hapus hari libur <strong>{holidayToDelete?.name}</strong>?</p>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-center pb-4">
          <Button variant="light" onClick={() => setShowDeleteModal(false)} className="px-4">
            Batal
          </Button>
          <Button variant="danger" onClick={handleDeleteHoliday} className="px-4">
            Hapus
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default HolidaySettings;
