import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Card, Table, Form, Row, Col, Button, Badge, Modal, Pagination, Spinner, InputGroup } from 'react-bootstrap';
import { History, Search, Download, RefreshCw, Eye, User, ShieldAlert } from 'lucide-react';
import api from './api';
import { toast } from 'react-toastify';

interface AuditLogEntry {
  _id: string;
  adminId?: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
  adminName: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  description: string;
  details?: any;
  ip?: string;
  createdAt: string;
}

const AdminAuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [limit] = useState<number>(20);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Only applied on submit, so typing in the search box doesn't fire a request
  // per keystroke. fetchLogs depends on `appliedSearch`, not `searchTerm`.
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedTargetType, setSelectedTargetType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Dropdown options
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableTargetTypes, setAvailableTargetTypes] = useState<string[]>([]);

  // Detail Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await api.get('/api/audit-logs/filters');
      if (res.data) {
        setAvailableActions(res.data.actions || []);
        setAvailableTargetTypes(res.data.targetTypes || []);
      }
    } catch (err) {
      console.warn('Failed to load audit filters', err);
    }
  }, []);

  // Stale-response guard: only the latest request may update state (fast
  // filter/pagination clicks must not be overwritten by a slower response).
  const fetchSeqRef = useRef(0);

  const fetchLogs = useCallback(async (targetPage = 1) => {
    const seq = ++fetchSeqRef.current;
    setLoading(true);
    try {
      const params: any = {
        page: targetPage,
        limit
      };

      if (appliedSearch) params.search = appliedSearch;
      if (selectedAction !== 'all') params.action = selectedAction;
      if (selectedTargetType !== 'all') params.targetType = selectedTargetType;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await api.get('/api/audit-logs', { params });
      if (seq !== fetchSeqRef.current) return;
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
      setTotalPages(res.data.totalPages || 1);
    } catch (err: any) {
      console.error('Error fetching audit logs:', err);
      if (seq !== fetchSeqRef.current) return;
      toast.error(err.response?.data?.message || 'Gagal memuat audit log.');
    } finally {
      if (seq === fetchSeqRef.current) setLoading(false);
    }
  }, [appliedSearch, selectedAction, selectedTargetType, startDate, endDate, limit]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchTerm.trim());
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setAppliedSearch('');
    setSelectedAction('all');
    setSelectedTargetType('all');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCsv = () => {
    if (logs.length === 0) {
      toast.info('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = ['Waktu', 'Admin', 'Aksi', 'Target Tipe', 'Target Nama', 'Deskripsi', 'IP Address'];
    const rows = logs.map(l => [
      `"${new Date(l.createdAt).toLocaleString('id-ID')}"`,
      `"${l.adminName || 'Admin'}"`,
      `"${l.action}"`,
      `"${l.targetType || '-'}"`,
      `"${l.targetName || '-'}"`,
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.ip || '-'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('CREATE') || act.includes('APPROVE') || act.includes('ADD')) {
      return <Badge bg="success" className="px-2 py-1 rounded-pill">{action}</Badge>;
    }
    if (act.includes('DELETE') || act.includes('REJECT')) {
      return <Badge bg="danger" className="px-2 py-1 rounded-pill">{action}</Badge>;
    }
    if (act.includes('UPDATE') || act.includes('CORRECT') || act.includes('REVIEW')) {
      return <Badge bg="warning" text="dark" className="px-2 py-1 rounded-pill">{action}</Badge>;
    }
    return <Badge bg="primary" className="px-2 py-1 rounded-pill">{action}</Badge>;
  };

  return (
    <Container className="py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 className="fw-bold text-primary-green mb-1 d-flex align-items-center gap-2">
            <History size={28} /> Audit Trail & Aktivitas Admin
          </h2>
          <p className="text-muted small mb-0">
            Log rekaman seluruh tindakan administratif (perubahan data, review permohonan, penghapusan, dan pengaturan).
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" className="rounded-pill d-flex align-items-center gap-2" onClick={() => fetchLogs(page)}>
            <RefreshCw size={16} /> Refresh
          </Button>
          <Button variant="success" className="rounded-pill d-flex align-items-center gap-2" onClick={handleExportCsv}>
            <Download size={16} /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Card */}
      <Card className="border-0 shadow-sm mb-4 rounded-16">
        <Card.Body className="p-4">
          <Form onSubmit={handleSearchSubmit}>
            <Row className="g-3 align-items-end">
              <Col lg={4} md={6}>
                <Form.Label className="small fw-bold text-muted text-uppercase">Pencarian</Form.Label>
                <InputGroup>
                  <InputGroup.Text className="bg-light border-end-0">
                    <Search size={16} className="text-muted" />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Cari deskripsi, target, nama admin..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="border-start-0 py-2"
                  />
                  <Button variant="primary" type="submit">
                    Cari
                  </Button>
                </InputGroup>
              </Col>

              <Col lg={2} md={3} sm={6}>
                <Form.Label className="small fw-bold text-muted text-uppercase">Aksi</Form.Label>
                <Form.Select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="py-2"
                >
                  <option value="all">Semua Aksi</option>
                  {availableActions.map((act) => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col lg={2} md={3} sm={6}>
                <Form.Label className="small fw-bold text-muted text-uppercase">Tipe Target</Form.Label>
                <Form.Select
                  value={selectedTargetType}
                  onChange={(e) => setSelectedTargetType(e.target.value)}
                  className="py-2"
                >
                  <option value="all">Semua Target</option>
                  {availableTargetTypes.map((tgt) => (
                    <option key={tgt} value={tgt}>{tgt}</option>
                  ))}
                </Form.Select>
              </Col>

              <Col lg={2} md={3} sm={6}>
                <Form.Label className="small fw-bold text-muted text-uppercase">Dari Tanggal</Form.Label>
                <Form.Control
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="py-2"
                />
              </Col>

              <Col lg={2} md={3} sm={6}>
                <Form.Label className="small fw-bold text-muted text-uppercase">Sampai Tanggal</Form.Label>
                <Form.Control
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="py-2"
                />
              </Col>
            </Row>

            {(searchTerm || selectedAction !== 'all' || selectedTargetType !== 'all' || startDate || endDate) && (
              <div className="mt-3 text-end">
                <Button variant="link" size="sm" className="text-muted p-0" onClick={handleResetFilters}>
                  Reset Filter
                </Button>
              </div>
            )}
          </Form>
        </Card.Body>
      </Card>

      {/* Table Card */}
      <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
        <Card.Body className="p-0">
          <div className="table-responsive">
            <Table hover className="align-middle mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="py-3 ps-4" style={{ width: '170px' }}>Waktu</th>
                  <th className="py-3" style={{ width: '180px' }}>Admin</th>
                  <th className="py-3" style={{ width: '160px' }}>Aksi</th>
                  <th className="py-3">Deskripsi & Target</th>
                  <th className="py-3 text-center pe-4" style={{ width: '90px' }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-5">
                      <Spinner animation="border" variant="success" size="sm" className="me-2" />
                      <span className="text-muted small">Memuat audit log...</span>
                    </td>
                  </tr>
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log._id}>
                      <td className="ps-4">
                        <div className="small fw-bold text-dark">
                          {new Date(log.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <div className="rounded-circle bg-emerald-light d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                            <User size={16} className="text-primary-green" />
                          </div>
                          <div>
                            <div className="fw-bold small text-dark">{log.adminName || 'Admin'}</div>
                            {log.ip && <div className="text-muted" style={{ fontSize: '0.7rem' }}>IP: {log.ip}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{getActionBadge(log.action)}</td>
                      <td>
                        <div className="small text-dark mb-1">{log.description}</div>
                        {log.targetType && (
                          <div className="d-flex align-items-center gap-1">
                            <Badge bg="light" text="dark" className="border font-monospace" style={{ fontSize: '0.7rem' }}>
                              {log.targetType}{log.targetName ? `: ${log.targetName}` : ''}
                            </Badge>
                          </div>
                        )}
                      </td>
                      <td className="text-center pe-4">
                        <Button
                          variant="light"
                          size="sm"
                          className="rounded-circle p-2 border shadow-xs"
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetailModal(true);
                          }}
                          title="Lihat Detail JSON"
                        >
                          <Eye size={15} />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-5 text-muted">
                      <ShieldAlert size={48} className="mb-3 opacity-25" />
                      <p className="mb-0">Tidak ada log aktivitas admin yang sesuai kriteria.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top bg-light">
              <div className="small text-muted">
                Menampilkan halaman <strong>{page}</strong> dari <strong>{totalPages}</strong> (Total: {total} entri)
              </div>
              <Pagination className="mb-0 gap-1">
                <Pagination.Prev disabled={page <= 1} onClick={() => fetchLogs(page - 1)} />
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = page;
                  if (page <= 3) pageNum = i + 1;
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = page - 2 + i;

                  if (pageNum > 0 && pageNum <= totalPages) {
                    return (
                      <Pagination.Item
                        key={pageNum}
                        active={pageNum === page}
                        onClick={() => fetchLogs(pageNum)}
                      >
                        {pageNum}
                      </Pagination.Item>
                    );
                  }
                  return null;
                })}
                <Pagination.Next disabled={page >= totalPages} onClick={() => fetchLogs(page + 1)} />
              </Pagination>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Detail Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold text-primary-green d-flex align-items-center gap-2">
            <History size={20} /> Rincian Log Audit
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          {selectedLog && (
            <div>
              <div className="mb-3 p-3 bg-light rounded-12">
                <Row className="g-2 small">
                  <Col sm={6}><strong>Waktu:</strong> {new Date(selectedLog.createdAt).toLocaleString('id-ID')}</Col>
                  <Col sm={6}><strong>Admin:</strong> {selectedLog.adminName}</Col>
                  <Col sm={6}><strong>Aksi:</strong> {selectedLog.action}</Col>
                  <Col sm={6}><strong>Target:</strong> {selectedLog.targetType || '-'} {selectedLog.targetName ? `(${selectedLog.targetName})` : ''}</Col>
                  {selectedLog.ip && <Col sm={6}><strong>IP Address:</strong> {selectedLog.ip}</Col>}
                </Row>
                <div className="mt-2 pt-2 border-top small">
                  <strong>Deskripsi:</strong> {selectedLog.description}
                </div>
              </div>

              <Form.Label className="small fw-bold text-muted text-uppercase">Payload / Parameter Detail (JSON)</Form.Label>
              <pre className="p-3 bg-dark text-light rounded-12 small overflow-auto" style={{ maxHeight: '300px' }}>
                {JSON.stringify(selectedLog.details || {}, null, 2)}
              </pre>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" className="rounded-pill px-4" onClick={() => setShowDetailModal(false)}>
            Tutup
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminAuditLog;
