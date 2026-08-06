import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from './api';
import './LeaveRequestPage.css';
import { Card, Form, Button, Row, Col, Container, InputGroup, Spinner, Badge, Modal } from 'react-bootstrap';
import { FileText, Calendar, Send, Info, ChevronRight, ClipboardList, Paperclip, Clock, CheckCircle, XCircle, Eye, RefreshCw } from 'lucide-react';
import type { LeaveRequest } from './types';

const LeaveRequestPage = () => {
  const [leaveType, setLeaveType] = useState('Izin');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);

  const fetchMyRequests = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const response = await api.get('/api/leave-requests/my');
      setMyRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching my leave requests:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const savedUser = localStorage.getItem('user');
    if (!savedUser) {
      toast.error('Anda harus login untuk membuat pengajuan.');
      return;
    }

    if (!startDate || !endDate || !reason) {
      toast.warn('Harap lengkapi semua data pengajuan.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Tanggal mulai tidak boleh melebihi tanggal selesai.');
      return;
    }

    setIsLoading(true);
    const user = JSON.parse(savedUser);

    try {
      const response = await api.post('/api/leave-requests', {
        userId: user._id,
        staffId: user.staffId,
        leaveType,
        startDate,
        endDate,
        reason,
        attachment,
      });

      if (response.status === 201 || response.status === 200) {
        toast.success('Pengajuan Anda telah berhasil dikirim!');
        setLeaveType('Izin');
        setStartDate('');
        setEndDate('');
        setReason('');
        setAttachment('');
        fetchMyRequests();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Terjadi kesalahan saat mengirim pengajuan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="py-4 leave-request-wrapper animate-fade-in">
      <div className="mb-4">
        <h2 className="fw-bold text-primary-green d-flex align-items-center gap-2">
          <FileText size={28} />
          Pengajuan Izin & Cuti
        </h2>
        <p className="text-muted">Silakan lengkapi formulir di bawah untuk mengajukan permohonan izin atau cuti.</p>
      </div>

      <Row className="g-4">
        <Col lg={7}>
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
            <Card.Header className="bg-primary-green text-white py-3 border-0">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                <ClipboardList size={20} />
                Formulir Pengajuan
              </h5>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Jenis Pengajuan</Form.Label>
                  <Form.Select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    required
                    disabled={isLoading}
                    className="py-2 fw-bold"
                  >
                    <option value="Izin">Izin (Keperluan Mendesak)</option>
                    <option value="Sakit">Sakit (Butuh Istirahat)</option>
                    <option value="Cuti">Cuti (Tahunan/Khusus)</option>
                  </Form.Select>
                </Form.Group>

                <Row className="g-3 mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted text-uppercase">Tanggal Mulai</Form.Label>
                      <InputGroup>
                        <InputGroup.Text className="bg-light border-end-0">
                          <Calendar size={18} className="text-muted" />
                        </InputGroup.Text>
                        <Form.Control
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          required
                          disabled={isLoading}
                          className="bg-light border-start-0 py-2"
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-bold text-muted text-uppercase">Tanggal Selesai</Form.Label>
                      <InputGroup>
                        <InputGroup.Text className="bg-light border-end-0">
                          <Calendar size={18} className="text-muted" />
                        </InputGroup.Text>
                        <Form.Control
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          required
                          disabled={isLoading}
                          className="bg-light border-start-0 py-2"
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-bold text-muted text-uppercase">Alasan / Keterangan</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="Tuliskan alasan pengajuan secara detail..."
                    className="py-2"
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label className="small fw-bold text-muted text-uppercase d-flex align-items-center gap-1">
                    <Paperclip size={14} /> Lampiran Dokumen / Gambar (Maks 5MB)
                  </Form.Label>
                  <Form.Control
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={isLoading}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                          toast.error("File terlalu besar. Maksimum ukuran adalah 5MB.");
                          e.target.value = "";
                          setAttachment('');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setAttachment(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      } else {
                        setAttachment('');
                      }
                    }}
                  />
                  {attachment && (
                    <div className="mt-2 text-success small d-flex align-items-center gap-1">
                      <span>✓ File berhasil dilampirkan</span>
                    </div>
                  )}
                </Form.Group>

                <Button 
                  variant="primary" 
                  type="submit" 
                  disabled={isLoading}
                  className="w-100 py-3 fw-bold rounded-12 shadow-sm d-flex align-items-center justify-content-center gap-2"
                >
                  {isLoading ? (
                    <Spinner animation="border" size="sm" />
                  ) : (
                    <>Kirim Pengajuan <Send size={18} /></>
                  )}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="border-0 shadow-sm rounded-16 bg-emerald-light h-100">
            <Card.Body className="p-4">
              <h5 className="fw-bold text-primary-green mb-3 d-flex align-items-center gap-2">
                <Info size={20} />
                Informasi Penting
              </h5>
              <ul className="list-unstyled mb-4">
                <li className="mb-3 d-flex gap-2">
                  <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                  <span className="small text-muted">Pastikan Anda mengajukan permohonan minimal 1 hari sebelum tanggal mulai (kecuali sakit/mendesak).</span>
                </li>
                <li className="mb-3 d-flex gap-2">
                  <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                  <span className="small text-muted">Admin akan meninjau pengajuan Anda dalam waktu maksimal 1x24 jam hari kerja.</span>
                </li>
                <li className="mb-3 d-flex gap-2">
                  <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                  <span className="small text-muted">Status pengajuan dapat Anda pantau melalui dashboard atau riwayat kehadiran.</span>
                </li>
              </ul>
              
              <div className="bg-white p-3 rounded-12 border shadow-sm mt-auto">
                <p className="small fw-bold mb-1">Butuh bantuan?</p>
                <p className="tiny text-muted mb-0">Hubungi bagian personalia jika mengalami kesulitan teknis.</p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* ===== RIWAYAT PENGAJUAN ===== */}
      <Row className="mt-4">
        <Col>
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-primary-green">
                <Clock size={20} />
                Riwayat Pengajuan Anda
              </h5>
              <Button
                variant="outline-secondary"
                size="sm"
                className="d-flex align-items-center gap-1 rounded-pill"
                onClick={fetchMyRequests}
                disabled={isLoadingHistory}
              >
                <RefreshCw size={14} className={isLoadingHistory ? 'spin-animation' : ''} /> Refresh
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {isLoadingHistory ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="success" size="sm" />
                  <p className="text-muted small mt-2 mb-0">Memuat riwayat...</p>
                </div>
              ) : myRequests.length === 0 ? (
                <div className="text-center py-5">
                  <FileText size={40} className="text-muted mb-2 opacity-25" />
                  <p className="text-muted mb-0">Belum ada pengajuan.</p>
                  <p className="text-muted small">Pengajuan yang Anda kirim akan muncul di sini.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="bg-light">
                      <tr>
                        <th className="px-4 py-3 small text-muted text-uppercase">Jenis</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Periode</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Alasan</th>
                        <th className="px-4 py-3 small text-muted text-uppercase text-center">Lampiran</th>
                        <th className="px-4 py-3 small text-muted text-uppercase text-center">Status</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Tanggal Ajuan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.map(req => (
                        <tr key={req._id}>
                          <td className="px-4 py-3">
                            <Badge bg="light" text="dark" className="border fw-normal">{req.leaveType}</Badge>
                          </td>
                          <td className="px-4 py-3 small">
                            {new Date(req.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {req.startDate !== req.endDate && (
                              <> — {new Date(req.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="small text-wrap" style={{ minWidth: '150px' }}>
                              {req.reason}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {req.attachment ? (
                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="d-flex align-items-center gap-1 mx-auto"
                                onClick={() => setPreviewAttachment(req.attachment!)}
                              >
                                <Eye size={14} /> Lihat
                              </Button>
                            ) : (
                              <span className="text-muted small">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {req.status === 'pending' && (
                              <Badge bg="warning" text="dark" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <Clock size={12} /> Menunggu
                              </Badge>
                            )}
                            {req.status === 'approved' && (
                              <Badge bg="success" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <CheckCircle size={12} /> Disetujui
                              </Badge>
                            )}
                            {req.status === 'rejected' && (
                              <Badge bg="danger" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <XCircle size={12} /> Ditolak
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 small text-muted">
                            {new Date(req.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Modal Preview Lampiran */}
      <Modal show={!!previewAttachment} onHide={() => setPreviewAttachment(null)} centered size="lg">
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="h6 fw-bold">Lampiran Dokumen</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-4">
          {previewAttachment && (
            previewAttachment.startsWith('data:image') ? (
              <img src={previewAttachment} alt="Lampiran" className="img-fluid rounded shadow" style={{ maxHeight: '70vh' }} />
            ) : previewAttachment.startsWith('data:application/pdf') ? (
              <iframe src={previewAttachment} title="Lampiran PDF" width="100%" style={{ height: '70vh', border: 'none', borderRadius: '8px' }} />
            ) : (
              <p className="text-muted">Format file tidak didukung untuk pratinjau.</p>
            )
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default LeaveRequestPage;
