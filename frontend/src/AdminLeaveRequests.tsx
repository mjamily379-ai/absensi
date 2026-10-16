import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import api, { fetchAttachmentBlobUrl } from './api';
import './AdminLeaveRequests.css';
import { LeaveRequest } from './types';
import { Badge, Nav, Card, InputGroup, FormControl, Button, Modal, Row, Col, Form } from 'react-bootstrap';
import { 
  Search, CheckCircle, XCircle, Clock, FileText, Calendar, Paperclip, 
  ExternalLink, RotateCcw, RefreshCw, Download, FileSpreadsheet, CheckSquare, XSquare
} from 'lucide-react';
import { ROLE_OPTIONS } from './constants/roles';

const ROLES_LIST = [
  { value: 'all', label: 'Semua Role' },
  ...ROLE_OPTIONS,
];

const LEAVE_TYPES = [
  { value: 'all', label: 'Semua Jenis' },
  { value: 'Izin', label: 'Izin' },
  { value: 'Sakit', label: 'Sakit' },
  { value: 'Cuti', label: 'Cuti' },
];

const AdminLeaveRequests = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [currentAttachment, setCurrentAttachment] = useState<string>('');
  const [currentAttachmentType, setCurrentAttachmentType] = useState<string>('');
  const [currentAttachmentName, setCurrentAttachmentName] = useState<string>('');
  const [currentAttachmentUser, setCurrentAttachmentUser] = useState<string>('');
  const [isAttachmentLoading, setIsAttachmentLoading] = useState(false);
  const attachmentBlobUrlRef = useRef<string>('');
  const attachmentAbortRef = useRef<AbortController | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const releaseAttachment = useCallback(() => {
    attachmentAbortRef.current?.abort();
    attachmentAbortRef.current = null;
    if (attachmentBlobUrlRef.current) {
      URL.revokeObjectURL(attachmentBlobUrlRef.current);
      attachmentBlobUrlRef.current = '';
    }
  }, []);

  // Free the blob URL when the modal closes or the admin navigates away.
  const closeAttachment = useCallback(() => {
    setShowAttachmentModal(false);
    releaseAttachment();
    setCurrentAttachment('');
    setCurrentAttachmentType('');
  }, [releaseAttachment]);

  useEffect(() => releaseAttachment, [releaseAttachment]);

  const handleShowAttachment = async (attachment: string, name: string, mime?: string, fileName?: string) => {
    releaseAttachment();
    setCurrentAttachmentUser(name);
    setCurrentAttachmentType(mime || '');
    setCurrentAttachmentName(fileName || '');
    setCurrentAttachment('');
    setShowAttachmentModal(true);
    setIsAttachmentLoading(true);

    const controller = new AbortController();
    attachmentAbortRef.current = controller;

    try {
      const { url, mime: resolvedMime } = await fetchAttachmentBlobUrl(attachment, controller.signal);
      if (controller.signal.aborted) {
        URL.revokeObjectURL(url);
        return;
      }
      attachmentBlobUrlRef.current = url.startsWith('blob:') ? url : '';
      setCurrentAttachment(url);
      setCurrentAttachmentType(mime || resolvedMime);
    } catch (error: any) {
      if (controller.signal.aborted || error?.name === 'CanceledError') return;
      if (error?.response?.status === 404) {
        toast.error('Berkas lampiran tidak ditemukan di server.');
      } else if (error?.response?.status === 403) {
        toast.error('Anda tidak berhak melihat lampiran pengajuan ini.');
      } else {
        toast.error('Gagal memuat lampiran. Periksa koneksi Anda.');
      }
    } finally {
      if (!controller.signal.aborted) setIsAttachmentLoading(false);
    }
  };

  const renderLeaveStatusBadge = (status: string) => {
    if (!status) return <Badge bg="secondary">Unknown</Badge>;
    
    switch (status.toLowerCase()) {
      case 'pending':
        return <Badge bg="warning" text="dark" className="px-3 py-2 d-inline-flex align-items-center gap-1"><Clock size={12} /> Menunggu</Badge>;
      case 'approved':
        return <Badge bg="success" className="px-3 py-2 d-inline-flex align-items-center gap-1"><CheckCircle size={12} /> Disetujui</Badge>;
      case 'rejected':
        return <Badge bg="danger" className="px-3 py-2 d-inline-flex align-items-center gap-1"><XCircle size={12} /> Ditolak</Badge>;
      default:
        return <Badge bg="secondary" className="px-3 py-2">{status}</Badge>;
    }
  };

  const fetchLeaveRequests = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/leave-requests');
      setLeaveRequests(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      console.error('Fetch error:', error);
      toast.error('Gagal mengambil data pengajuan cuti.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const response = await api.put(`/api/leave-requests/${id}`, { status });
      toast.success(response.data.message);
      setLeaveRequests(currentRequests =>
        currentRequests.map(req =>
          req._id === id ? { ...req, status: status } : req
        )
      );
      setSelectedIds(current => current.filter(x => x !== id));
    } catch (error: any) {
      console.error('Update status error:', error);
      toast.error(error.response?.data?.message || 'Gagal memperbarui status.');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  const toggleSelectAllPending = () => {
    if (selectedIds.length === pendingInView.length && pendingInView.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingInView.map(r => r._id));
    }
  };

  const clearSelection = () => setSelectedIds([]);

  const handleBulkUpdate = async (status: 'approved' | 'rejected') => {
    if (selectedIds.length === 0) return;
    setIsBulkUpdating(true);
    try {
      const response = await api.post('/api/leave-requests/bulk', { ids: selectedIds, status });
      toast.success(response.data.message);
      setLeaveRequests(currentRequests =>
        currentRequests.map(req =>
          selectedIds.includes(req._id) ? { ...req, status } : req
        )
      );
      setSelectedIds([]);
    } catch (error: any) {
      console.error('Bulk update error:', error);
      toast.error(error.response?.data?.message || 'Gagal memproses pemilihan massal.');
    } finally {
      setIsBulkUpdating(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const calculateDays = (start: string, end: string) => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return `${diffDays} hari`;
    } catch {
      return '';
    }
  };

  // Available Years extracted from data
  const availableYears = useMemo(() => {
    const years = new Set(leaveRequests.map(r => new Date(r.startDate).getFullYear().toString()).filter(y => y && y !== 'NaN'));
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort().reverse();
  }, [leaveRequests]);

  // Stats
  const stats = useMemo(() => {
    const pending = leaveRequests.filter(r => r.status === 'pending').length;
    const approved = leaveRequests.filter(r => r.status === 'approved').length;
    const rejected = leaveRequests.filter(r => r.status === 'rejected').length;
    const total = leaveRequests.length;
    return { pending, approved, rejected, total };
  }, [leaveRequests]);

  // Filtered and sorted requests
  const filteredRequests = useMemo(() => {
    const filtered = leaveRequests.filter(req => {
      // Tab Status Filter
      const matchesTab = activeTab === 'all' ? true : req.status === activeTab;
      
      // Search Term Filter (Name, Reason, LeaveType)
      const q = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        req.userId?.name?.toLowerCase().includes(q) ||
        req.reason?.toLowerCase().includes(q) ||
        req.leaveType?.toLowerCase().includes(q);

      // Role Filter
      const matchesRole = selectedRole === 'all' || 
        req.userId?.role?.toLowerCase() === selectedRole.toLowerCase();

      // Type Filter
      const matchesType = selectedType === 'all' || 
        req.leaveType?.toLowerCase() === selectedType.toLowerCase();

      // Month & Year Filter
      const reqDate = new Date(req.startDate);
      const matchesMonth = selectedMonth === 'all' || (reqDate.getMonth() + 1).toString() === selectedMonth;
      const matchesYear = selectedYear === 'all' || reqDate.getFullYear().toString() === selectedYear;

      return matchesTab && matchesSearch && matchesRole && matchesType && matchesMonth && matchesYear;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'startDate') {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      }
      // default: 'newest' (createdAt desc)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leaveRequests, activeTab, searchTerm, selectedRole, selectedType, selectedMonth, selectedYear, sortBy]);

  const pendingInView = useMemo(() => filteredRequests.filter(r => r.status === 'pending'), [filteredRequests]);

  const hasActiveFilters = searchTerm !== '' || selectedRole !== 'all' || selectedType !== 'all' || selectedMonth !== 'all' || selectedYear !== 'all' || sortBy !== 'newest';

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedRole('all');
    setSelectedType('all');
    setSelectedMonth('all');
    setSelectedYear('all');
    setSortBy('newest');
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (isLoading) return;
    const params = new URLSearchParams();
    if (activeTab !== 'all') params.set('status', activeTab);
    if (selectedRole !== 'all') params.set('role', selectedRole);
    if (selectedMonth !== 'all') params.set('month', selectedMonth);
    if (selectedYear !== 'all') params.set('year', selectedYear);
    params.set('format', format);
    try {
      const response = await api.get(`/api/export-leave-requests?${params.toString()}`, { responseType: 'blob' });
      const disposition = (response.headers as any) && (response.headers as any)['content-disposition'];
      const match = disposition && disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `Laporan_Pengajuan_Cuti.${format === 'csv' ? 'csv' : 'xlsx'}`;
      downloadBlob(response.data as Blob, filename);
      toast.success('Data berhasil diekspor.');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Gagal mengekspor data pengajuan cuti.');
    }
  };

  if (isLoading && leaveRequests.length === 0) {
    return (
      <div className="admin-leave-container d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Memuat...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-leave-container">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h2 className="d-flex align-items-center gap-2 mb-1">
            <FileText size={28} className="text-primary-green" />
            Pengajuan Izin & Cuti
          </h2>
          <p className="text-muted small mb-0">Kelola dan tinjau seluruh permohonan izin dan cuti karyawan</p>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Button 
            variant="outline-success" 
            size="sm" 
            onClick={() => handleExport('xlsx')} 
            disabled={isLoading}
            className="d-flex align-items-center gap-2 rounded-pill shadow-sm"
          >
            <FileSpreadsheet size={16} />
            <span>Export Excel</span>
          </Button>
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={() => handleExport('csv')} 
            disabled={isLoading}
            className="d-flex align-items-center gap-2 rounded-pill shadow-sm"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </Button>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={fetchLeaveRequests} 
            disabled={isLoading}
            className="d-flex align-items-center gap-2 rounded-pill shadow-sm"
          >
            <RefreshCw size={16} className={isLoading ? 'spin-animation' : ''} />
            <span>Segarkan Data</span>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="leave-stats-grid mb-4">
        <div className="leave-stat-card stat-pending clickable" onClick={() => setActiveTab('pending')}>
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Menunggu Persetujuan</div>
        </div>
        <div className="leave-stat-card stat-approved clickable" onClick={() => setActiveTab('approved')}>
          <div className="stat-number">{stats.approved}</div>
          <div className="stat-label">Telah Disetujui</div>
        </div>
        <div className="leave-stat-card stat-rejected clickable" onClick={() => setActiveTab('rejected')}>
          <div className="stat-number">{stats.rejected}</div>
          <div className="stat-label">Ditolak</div>
        </div>
        <div className="leave-stat-card stat-total clickable" onClick={() => setActiveTab('all')}>
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Pengajuan</div>
        </div>
      </div>

      {/* Filter & Search Box */}
      <Card className="border-0 shadow-sm rounded-16 mb-4">
        <Card.Body className="p-3 p-md-4">
          <Row className="g-3">
            {/* Search Input */}
            <Col xl={3} lg={4} md={6}>
              <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Pencarian</Form.Label>
              <InputGroup className="shadow-none">
                <InputGroup.Text className="bg-light border-end-0">
                  <Search size={16} className="text-muted" />
                </InputGroup.Text>
                <FormControl
                  placeholder="Cari nama, alasan, jenis..."
                  className="bg-light border-start-0 py-2"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>

            {/* Role Filter */}
            <Col xl={2} lg={4} md={6} sm={6}>
              <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Filter Role</Form.Label>
              <Form.Select 
                value={selectedRole} 
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-light py-2"
              >
                {ROLES_LIST.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Form.Select>
            </Col>

            {/* Leave Type Filter */}
            <Col xl={2} lg={4} md={4} sm={6}>
              <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Jenis</Form.Label>
              <Form.Select 
                value={selectedType} 
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-light py-2"
              >
                {LEAVE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Form.Select>
            </Col>

            {/* Month Filter */}
            <Col xl={2} lg={3} md={4} sm={6}>
              <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Bulan</Form.Label>
              <Form.Select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-light py-2"
              >
                <option value="all">Semua Bulan</option>
                <option value="1">Januari</option>
                <option value="2">Februari</option>
                <option value="3">Maret</option>
                <option value="4">April</option>
                <option value="5">Mei</option>
                <option value="6">Juni</option>
                <option value="7">Juli</option>
                <option value="8">Agustus</option>
                <option value="9">September</option>
                <option value="10">Oktober</option>
                <option value="11">November</option>
                <option value="12">Desember</option>
              </Form.Select>
            </Col>

            {/* Year Filter */}
            <Col xl={1} lg={3} md={4} sm={6}>
              <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Tahun</Form.Label>
              <Form.Select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-light py-2"
              >
                <option value="all">Semua</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </Form.Select>
            </Col>

            {/* Sort Filter */}
            <Col xl={1} lg={3} md={4} sm={6}>
              <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Urutan</Form.Label>
              <Form.Select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-light py-2"
              >
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="startDate">Tgl Cuti</option>
              </Form.Select>
            </Col>

            {/* Reset Button */}
            <Col xl={1} lg={3} md={4} sm={6} className="d-flex align-items-end">
              <Button 
                variant={hasActiveFilters ? "outline-danger" : "outline-secondary"} 
                className="w-100 py-2 d-flex align-items-center justify-content-center gap-1"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                title="Reset Filter"
              >
                <RotateCcw size={16} />
                <span className="d-xl-none ms-1">Reset</span>
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Tabs */}
      <Nav variant="pills" className="mb-4 bg-light p-1 rounded-3" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'pending')}>
        <Nav.Item>
          <Nav.Link eventKey="pending" className="rounded-3">
            Menunggu <Badge bg="warning" text="dark" className="ms-1">{stats.pending}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="approved" className="rounded-3">
            Disetujui <Badge bg="success" className="ms-1">{stats.approved}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="rejected" className="rounded-3">
            Ditolak <Badge bg="danger" className="ms-1">{stats.rejected}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="all" className="rounded-3">
            Semua <Badge bg="secondary" className="ms-1">{stats.total}</Badge>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <Card className="border-0 shadow-sm rounded-16 mb-4 bulk-action-bar custom">
          <Card.Body className="p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark">
                {selectedIds.length} pengajuan dipilih
              </span>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Button
                variant="success"
                size="sm"
                className="d-flex align-items-center gap-1 rounded-pill px-3"
                onClick={() => handleBulkUpdate('approved')}
                disabled={isBulkUpdating}
              >
                <CheckSquare size={14} /> Setujui Terpilih
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                className="d-flex align-items-center gap-1 rounded-pill px-3"
                onClick={() => handleBulkUpdate('rejected')}
                disabled={isBulkUpdating}
              >
                <XSquare size={14} /> Tolak Terpilih
              </Button>
              <Button
                variant="light"
                size="sm"
                className="rounded-pill px-3"
                onClick={clearSelection}
                disabled={isBulkUpdating}
              >
                Batal Pilih
              </Button>
              {isBulkUpdating && <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Table */}
      {filteredRequests.length > 0 ? (
        <Card className="border-0 shadow-sm overflow-hidden rounded-16">
          <div className="table-responsive">
            <table className="leave-requests-table mb-0">
              <thead className="bg-light">
                <tr>
                  <th className="px-4 py-3 text-center" style={{ width: '48px' }}>
                    <Form.Check
                      type="checkbox"
                      checked={pendingInView.length > 0 && selectedIds.length === pendingInView.length}
                      onChange={toggleSelectAllPending}
                      title="Pilih semua yang menunggu"
                    />
                  </th>
                  <th className="px-4 py-3">Nama Karyawan</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Alasan</th>
                  <th className="px-4 py-3 text-center">Lampiran</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map(request => (
                  <tr key={request._id} className="align-middle">
                    <td className="px-4 py-3 text-center">
                      {request.status === 'pending' ? (
                        <Form.Check
                          type="checkbox"
                          checked={selectedIds.includes(request._id)}
                          onChange={() => toggleSelect(request._id)}
                          label=""
                          title="Pilih pengajuan ini"
                        />
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="d-flex align-items-center gap-2">
                        <div className="leave-avatar">
                          {request.userId?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="leave-user-details">
                          <span className="leave-user-name">{request.userId?.name || 'N/A'}</span>
                          <span className="leave-user-role">{request.userId?.role || ''}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`leave-type-badge leave-type-${request.leaveType?.toLowerCase()}`}>
                        {request.leaveType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="leave-date-range">
                        <span className="leave-date-main">
                          {formatDate(request.startDate)} - {formatDate(request.endDate)}
                        </span>
                        <span className="leave-date-duration">
                          <Calendar size={12} />
                          {calculateDays(request.startDate, request.endDate)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="leave-reason" title={request.reason}>
                        {request.reason}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {request.attachment ? (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="d-flex align-items-center gap-1 mx-auto rounded-pill px-3"
                          title="Lihat Lampiran"
                          onClick={() => handleShowAttachment(request.attachment!, request.userId?.name || 'Karyawan', request.attachmentType, request.attachmentName)}
                        >
                          <Paperclip size={14} /> Lihat
                        </Button>
                      ) : (
                        <span className="text-muted small">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {renderLeaveStatusBadge(request.status)}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {request.status === 'pending' ? (
                        <div className="d-flex justify-content-end gap-2">
                          <Button 
                            variant="success" 
                            size="sm" 
                            onClick={() => handleUpdateStatus(request._id, 'approved')} 
                            className="d-flex align-items-center gap-1 rounded-pill px-3"
                          >
                            <CheckCircle size={14} /> Setujui
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm" 
                            onClick={() => handleUpdateStatus(request._id, 'rejected')} 
                            className="d-flex align-items-center gap-1 rounded-pill px-3"
                          >
                            <XCircle size={14} /> Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted small italic">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="text-center py-5 bg-light rounded-16 shadow-sm">
          <FileText size={48} className="text-muted mb-3 opacity-25" />
          <p className="text-muted mb-1 fw-bold">Tidak ada pengajuan yang cocok.</p>
          <p className="text-muted small">Coba ubah kata kunci pencarian atau filter yang dipilih.</p>
          {hasActiveFilters && (
            <Button variant="outline-primary" size="sm" onClick={handleResetFilters} className="mt-2 rounded-pill">
              Reset Semua Filter
            </Button>
          )}
        </div>
      )}

      {/* Modal View Attachment */}
      <Modal show={showAttachmentModal} onHide={closeAttachment} centered size="lg">
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h6 fw-bold text-primary-green">
            Lampiran Pengajuan: {currentAttachmentUser}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-3 bg-light">
          {isAttachmentLoading ? (
            <div className="text-muted py-5">
              <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
              Memuat lampiran...
            </div>
          ) : currentAttachment ? (
            currentAttachmentType.startsWith('image/') || currentAttachment.startsWith('data:image') ? (
              <img
                src={currentAttachment}
                alt="Lampiran"
                className="img-fluid rounded shadow"
                style={{ maxHeight: '70vh' }}
              />
            ) : (
              <iframe
                src={currentAttachment}
                title="Preview Lampiran"
                width="100%"
                height="500px"
                style={{ border: 'none', borderRadius: '8px' }}
              />
            )
          ) : (
            <div className="text-muted py-5">Lampiran tidak ditemukan</div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          {currentAttachment && (
            <Button
              variant="primary"
              as="a"
              href={currentAttachment}
              download={currentAttachmentName || `Lampiran_${currentAttachmentUser.replace(/\s+/g, '_')}`}
              className="d-flex align-items-center gap-2 rounded-pill"
            >
              Unduh File <ExternalLink size={14} />
            </Button>
          )}
          <Button variant="secondary" onClick={closeAttachment} className="rounded-pill">Tutup</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminLeaveRequests;
