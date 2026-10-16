import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api, { fetchAttachmentBlobUrl } from './api';
import './LeaveRequestPage.css';
import { Card, Form, Button, Row, Col, Container, InputGroup, Spinner, Badge, Modal, Tabs, Tab } from 'react-bootstrap';
import { FileText, Calendar, Send, Info, ChevronRight, ClipboardList, Paperclip, Clock, CheckCircle, XCircle, Eye, RefreshCw, Edit3, AlertCircle } from 'lucide-react';
import type { LeaveRequest, CorrectionRequest } from './types';
import { extractStaffId } from './types';

const deduceAttachmentType = (dataUri: string): string => dataUri.match(/^data:([^;]+)/)?.[1] || '';

const LeaveRequestPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mainTab, setMainTab] = useState<string>(searchParams.get('tab') === 'correction' ? 'correction' : 'leave');

  // Leave Request States
  const [leaveType, setLeaveType] = useState('Izin');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<string | null>(null);
  const [previewAttachmentType, setPreviewAttachmentType] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewBlobRef = useRef<string>('');
  const previewAbortRef = useRef<AbortController | null>(null);

  const releasePreview = useCallback(() => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = '';
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewAttachment(null);
    setPreviewAttachmentType('');
    releasePreview();
  }, [releasePreview]);

  useEffect(() => releasePreview, [releasePreview]);

  // Server-hosted attachments must be pulled through the authenticated client:
  // the API is a different subdomain in production and its helmet CSP /
  // X-Frame-Options header block a direct <img>/<iframe> src.
  const openPreview = async (attachment: string, mime?: string) => {
    releasePreview();
    setPreviewAttachment('');
    setPreviewAttachmentType(mime || (attachment.startsWith('data:') ? deduceAttachmentType(attachment) : ''));
    setIsPreviewLoading(true);

    const controller = new AbortController();
    previewAbortRef.current = controller;

    try {
      const { url, mime: resolvedMime } = await fetchAttachmentBlobUrl(attachment, controller.signal);
      if (controller.signal.aborted) {
        URL.revokeObjectURL(url);
        return;
      }
      previewBlobRef.current = url.startsWith('blob:') ? url : '';
      setPreviewAttachment(url);
      setPreviewAttachmentType(mime || resolvedMime);
    } catch (error: any) {
      if (controller.signal.aborted || error?.name === 'CanceledError') return;
      toast.error('Gagal memuat lampiran. Periksa koneksi Anda.');
    } finally {
      if (!controller.signal.aborted) setIsPreviewLoading(false);
    }
  };

  // Correction Request States
  const [corrDate, setCorrDate] = useState('');
  const [corrType, setCorrType] = useState<'clock-in' | 'clock-out' | 'both'>('clock-in');
  const [corrClockIn, setCorrClockIn] = useState('');
  const [corrClockOut, setCorrClockOut] = useState('');
  const [corrReason, setCorrReason] = useState('');
  const [isCorrSubmitting, setIsCorrSubmitting] = useState(false);
  const [myCorrections, setMyCorrections] = useState<CorrectionRequest[]>([]);
  const [isLoadingCorrections, setIsLoadingCorrections] = useState(false);

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

  const fetchMyCorrections = useCallback(async () => {
    setIsLoadingCorrections(true);
    try {
      const response = await api.get('/api/correction-requests/my');
      setMyCorrections(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching my correction requests:', error);
    } finally {
      setIsLoadingCorrections(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRequests();
    fetchMyCorrections();
  }, [fetchMyRequests, fetchMyCorrections]);

  // Prefill the correction form from query params (?tab=correction&date=...&in=...&out=...).
  useEffect(() => {
    if (searchParams.get('tab') !== 'correction') return;
    const date = searchParams.get('date');
    const inTime = searchParams.get('in');
    const outTime = searchParams.get('out');
    if (date) setCorrDate(date);
    const hasIn = inTime && inTime !== '-' && inTime !== 'N/A';
    const hasOut = outTime && outTime !== '-' && outTime !== 'N/A';
    if (hasIn && hasOut) {
      setCorrType('both');
      setCorrClockIn(inTime);
      setCorrClockOut(outTime);
    } else if (hasIn) {
      setCorrType('clock-in');
      setCorrClockIn(inTime);
    } else if (hasOut) {
      setCorrType('clock-out');
      setCorrClockOut(outTime);
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

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
        staffId: user.staffId ? extractStaffId(user.staffId) : undefined,
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

  const handleCorrectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrDate || !corrReason) {
      toast.warn('Harap lengkapi tanggal dan alasan koreksi.');
      return;
    }
    if ((corrType === 'clock-in' || corrType === 'both') && !corrClockIn) {
      toast.warn('Harap masukkan jam masuk yang benar.');
      return;
    }
    if ((corrType === 'clock-out' || corrType === 'both') && !corrClockOut) {
      toast.warn('Harap masukkan jam pulang yang benar.');
      return;
    }

    setIsCorrSubmitting(true);
    try {
      const response = await api.post('/api/correction-requests', {
        date: corrDate,
        requestType: corrType,
        requestedClockIn: corrClockIn || undefined,
        requestedClockOut: corrClockOut || undefined,
        reason: corrReason,
      });

      toast.success(response.data.message || 'Pengajuan koreksi berhasil dikirim!');
      setCorrDate('');
      setCorrClockIn('');
      setCorrClockOut('');
      setCorrReason('');
      fetchMyCorrections();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Gagal mengirim pengajuan koreksi.');
    } finally {
      setIsCorrSubmitting(false);
    }
  };

  return (
    <Container className="py-4 leave-request-wrapper animate-fade-in">
      <div className="mb-4">
        <h2 className="fw-bold text-primary-green d-flex align-items-center gap-2 mb-1">
          <FileText size={28} />
          Pusat Pengajuan & Koreksi
        </h2>
        <p className="text-muted small mb-0">Ajukan permohonan izin/cuti atau pengajuan koreksi waktu absensi Anda.</p>
      </div>

      <Tabs
        activeKey={mainTab}
        onSelect={(k) => setMainTab(k || 'leave')}
        className="mb-4 custom-nav-tabs border-0"
      >
        {/* ================= TAB 1: IZIN & CUTI ================= */}
        <Tab eventKey="leave" title="Pengajuan Izin & Cuti">
          <Row className="g-4">
            <Col lg={7}>
              <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
                <Card.Header className="bg-primary-green text-white py-3 border-0">
                  <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <ClipboardList size={20} />
                    Formulir Izin / Cuti
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
                        <Paperclip size={14} /> Lampiran Dokumen / Surat Dokter (Maks 5MB)
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
                        <>Kirim Permohonan <Send size={18} /></>
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
                    Informasi Izin & Cuti
                  </h5>
                  <ul className="list-unstyled mb-4">
                    <li className="mb-3 d-flex gap-2">
                      <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                      <span className="small text-muted">Ajukan permohonan izin minimal 1 hari sebelumnya bila memungkinkan.</span>
                    </li>
                    <li className="mb-3 d-flex gap-2">
                      <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                      <span className="small text-muted">Untuk izin sakit lebih dari 1 hari, mohon lampirkan surat keterangan dokter.</span>
                    </li>
                    <li className="mb-3 d-flex gap-2">
                      <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                      <span className="small text-muted">Setelah disetujui, tanggal tersebut otomatis tercatat sebagai Izin/Sakit/Cuti pada sistem absensi.</span>
                    </li>
                  </ul>

                  <div className="bg-white p-3 rounded-12 border shadow-sm mt-auto">
                    <p className="small fw-bold mb-1">Status Notifikasi</p>
                    <p className="tiny text-muted mb-0">Admin akan langsung menerima notifikasi dan meninjau pengajuan Anda.</p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabel Riwayat Izin / Cuti */}
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden mt-4">
            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-primary-green">
                <Clock size={20} />
                Riwayat Pengajuan Izin & Cuti
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
                  <p className="text-muted mb-0">Belum ada pengajuan izin/cuti.</p>
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
                                onClick={() => openPreview(req.attachment!, req.attachmentType)}
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
        </Tab>

        {/* ================= TAB 2: KOREKSI ABSENSI ================= */}
        <Tab eventKey="correction" title="Koreksi Absensi">
          <Row className="g-4">
            <Col lg={7}>
              <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
                <Card.Header className="bg-primary-green text-white py-3 border-0">
                  <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <Edit3 size={20} />
                    Formulir Koreksi Waktu Absensi
                  </h5>
                </Card.Header>
                <Card.Body className="p-4">
                  <Form onSubmit={handleCorrectionSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Tanggal Yang Ingin Dikoreksi</Form.Label>
                      <InputGroup>
                        <InputGroup.Text className="bg-light border-end-0">
                          <Calendar size={18} className="text-muted" />
                        </InputGroup.Text>
                        <Form.Control
                          type="date"
                          value={corrDate}
                          onChange={(e) => setCorrDate(e.target.value)}
                          required
                          disabled={isCorrSubmitting}
                          className="bg-light border-start-0 py-2"
                        />
                      </InputGroup>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Jenis Koreksi</Form.Label>
                      <Form.Select
                        value={corrType}
                        onChange={(e) => setCorrType(e.target.value as any)}
                        required
                        disabled={isCorrSubmitting}
                        className="py-2 fw-bold"
                      >
                        <option value="clock-in">Koreksi Jam Masuk Saja</option>
                        <option value="clock-out">Koreksi Jam Pulang Saja</option>
                        <option value="both">Koreksi Jam Masuk & Pulang</option>
                      </Form.Select>
                    </Form.Group>

                    <Row className="g-3 mb-3">
                      {(corrType === 'clock-in' || corrType === 'both') && (
                        <Col md={corrType === 'both' ? 6 : 12}>
                          <Form.Group>
                            <Form.Label className="small fw-bold text-muted text-uppercase">Jam Masuk Sebenarnya</Form.Label>
                            <InputGroup>
                              <InputGroup.Text className="bg-light border-end-0">
                                <Clock size={18} className="text-muted" />
                              </InputGroup.Text>
                              <Form.Control
                                type="time"
                                value={corrClockIn}
                                onChange={(e) => setCorrClockIn(e.target.value)}
                                required={corrType === 'clock-in' || corrType === 'both'}
                                disabled={isCorrSubmitting}
                                className="bg-light border-start-0 py-2"
                              />
                            </InputGroup>
                          </Form.Group>
                        </Col>
                      )}

                      {(corrType === 'clock-out' || corrType === 'both') && (
                        <Col md={corrType === 'both' ? 6 : 12}>
                          <Form.Group>
                            <Form.Label className="small fw-bold text-muted text-uppercase">Jam Pulang Sebenarnya</Form.Label>
                            <InputGroup>
                              <InputGroup.Text className="bg-light border-end-0">
                                <Clock size={18} className="text-muted" />
                              </InputGroup.Text>
                              <Form.Control
                                type="time"
                                value={corrClockOut}
                                onChange={(e) => setCorrClockOut(e.target.value)}
                                required={corrType === 'clock-out' || corrType === 'both'}
                                disabled={isCorrSubmitting}
                                className="bg-light border-start-0 py-2"
                              />
                            </InputGroup>
                          </Form.Group>
                        </Col>
                      )}
                    </Row>

                    <Form.Group className="mb-4">
                      <Form.Label className="small fw-bold text-muted text-uppercase">Alasan Permintaan Koreksi</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={corrReason}
                        onChange={(e) => setCorrReason(e.target.value)}
                        required
                        disabled={isCorrSubmitting}
                        placeholder="Contoh: Lupa tap absen pulang karena mendadak ada evaluasi rapat sampai sore..."
                        className="py-2"
                      />
                    </Form.Group>

                    <Button 
                      variant="primary" 
                      type="submit" 
                      disabled={isCorrSubmitting}
                      className="w-100 py-3 fw-bold rounded-12 shadow-sm d-flex align-items-center justify-content-center gap-2"
                    >
                      {isCorrSubmitting ? (
                        <Spinner animation="border" size="sm" />
                      ) : (
                        <>Kirim Pengajuan Koreksi <Send size={18} /></>
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
                    Ketentuan Koreksi Absensi
                  </h5>
                  <ul className="list-unstyled mb-4">
                    <li className="mb-3 d-flex gap-2">
                      <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                      <span className="small text-muted">Gunakan fitur ini jika terjadi kendala jaringan saat absen, lupa clock-in/out, atau tugas luar mendesak.</span>
                    </li>
                    <li className="mb-3 d-flex gap-2">
                      <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                      <span className="small text-muted">Admin akan memeriksa dan memvalidasi permohonan koreksi sebelum data tercatat ke rekap absensi.</span>
                    </li>
                    <li className="mb-3 d-flex gap-2">
                      <ChevronRight size={18} className="text-primary-green flex-shrink-0" />
                      <span className="small text-muted">Jika disetujui, waktu kehadiran pada tanggal tersebut akan otomatis diperbarui dan status menjadi Hadir.</span>
                    </li>
                  </ul>
                  
                  <div className="bg-white p-3 rounded-12 border shadow-sm mt-auto">
                    <p className="small fw-bold mb-1">Butuh koreksi tanggal lama?</p>
                    <p className="tiny text-muted mb-0">Pengajuan dapat dilakukan untuk tanggal mana pun yang belum disetujui sebelumnya.</p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Tabel Riwayat Koreksi */}
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden mt-4">
            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold d-flex align-items-center gap-2 text-primary-green">
                <Clock size={20} />
                Riwayat Pengajuan Koreksi Anda
              </h5>
              <Button
                variant="outline-secondary"
                size="sm"
                className="d-flex align-items-center gap-1 rounded-pill"
                onClick={fetchMyCorrections}
                disabled={isLoadingCorrections}
              >
                <RefreshCw size={14} className={isLoadingCorrections ? 'spin-animation' : ''} /> Refresh
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              {isLoadingCorrections ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="success" size="sm" />
                  <p className="text-muted small mt-2 mb-0">Memuat riwayat koreksi...</p>
                </div>
              ) : myCorrections.length === 0 ? (
                <div className="text-center py-5">
                  <AlertCircle size={40} className="text-muted mb-2 opacity-25" />
                  <p className="text-muted mb-0">Belum ada pengajuan koreksi absensi.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="bg-light">
                      <tr>
                        <th className="px-4 py-3 small text-muted text-uppercase">Tanggal Absen</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Tipe</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Waktu Diajukan</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Alasan</th>
                        <th className="px-4 py-3 small text-muted text-uppercase text-center">Status</th>
                        <th className="px-4 py-3 small text-muted text-uppercase">Catatan Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myCorrections.map(corr => (
                        <tr key={corr._id}>
                          <td className="px-4 py-3 fw-bold">
                            {new Date(corr.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <Badge bg="light" text="dark" className="border fw-normal">
                              {corr.requestType === 'clock-in' ? 'Masuk' : corr.requestType === 'clock-out' ? 'Pulang' : 'Masuk & Pulang'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 small">
                            {corr.requestedClockIn && <span className="d-block text-primary-green">Masuk: {corr.requestedClockIn}</span>}
                            {corr.requestedClockOut && <span className="d-block text-info">Pulang: {corr.requestedClockOut}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="small text-wrap" style={{ minWidth: '160px' }}>
                              {corr.reason}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {corr.status === 'pending' && (
                              <Badge bg="warning" text="dark" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <Clock size={12} /> Menunggu
                              </Badge>
                            )}
                            {corr.status === 'approved' && (
                              <Badge bg="success" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <CheckCircle size={12} /> Disetujui
                              </Badge>
                            )}
                            {corr.status === 'rejected' && (
                              <Badge bg="danger" className="px-3 py-2 d-inline-flex align-items-center gap-1">
                                <XCircle size={12} /> Ditolak
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 small text-muted">
                            {corr.adminNotes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* Modal Preview Lampiran */}
      <Modal show={isPreviewLoading || !!previewAttachment} onHide={closePreview} centered size="lg">
        <Modal.Header closeButton className="border-0">
          <Modal.Title className="h6 fw-bold">Lampiran Dokumen</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-4">
          {isPreviewLoading ? (
            <div className="text-muted py-5">
              <Spinner animation="border" size="sm" className="me-2" /> Memuat lampiran...
            </div>
          ) : previewAttachment ? (() => {
            const isImage = previewAttachmentType.startsWith('image/');

            if (isImage) {
              return <img src={previewAttachment} alt="Lampiran" className="img-fluid rounded shadow" style={{ maxHeight: '70vh' }} />;
            }
            return <iframe src={previewAttachment} title="Lampiran" width="100%" style={{ height: '70vh', border: 'none', borderRadius: '8px' }} />;
          })() : (
            <p className="text-muted">Lampiran tidak ditemukan.</p>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default LeaveRequestPage;
