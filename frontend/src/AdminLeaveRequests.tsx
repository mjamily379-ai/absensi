import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from './api';
import './AdminLeaveRequests.css';
import { LeaveRequest } from './types';
import { Badge, Nav, Card, InputGroup, FormControl, Button, Modal } from 'react-bootstrap';
import { Search, CheckCircle, XCircle, Clock, FileText, Calendar, Paperclip, ExternalLink } from 'lucide-react';

const AdminLeaveRequests = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [currentAttachment, setCurrentAttachment] = useState<string>('');
  const [currentAttachmentUser, setCurrentAttachmentUser] = useState<string>('');

  const handleShowAttachment = (attachment: string, name: string) => {
    setCurrentAttachment(attachment);
    setCurrentAttachmentUser(name);
    setShowAttachmentModal(true);
  };

  const renderLeaveStatusBadge = (status: string) => {
    if (!status) return <Badge bg="secondary">Unknown</Badge>;
    
    let variant: string;
    switch (status.toLowerCase()) {
      case 'pending':
        variant = 'warning';
        return <Badge bg="warning" className="px-3 py-2"><Clock size={12} className="me-1" /> Menunggu</Badge>;
      case 'approved':
        variant = 'success';
        return <Badge bg="success" className="px-3 py-2"><CheckCircle size={12} className="me-1" /> Disetujui</Badge>;
      case 'rejected':
        variant = 'danger';
        return <Badge bg="danger" className="px-3 py-2"><XCircle size={12} className="me-1" /> Ditolak</Badge>;
      default:
        return <Badge bg="secondary" className="px-3 py-2">{status}</Badge>;
    }
  };

  const fetchLeaveRequests = async () => {
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
    } catch (error: any) {
      console.error('Update status error:', error);
      toast.error(error.response?.data?.message || 'Gagal memperbarui status.');
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
  }

  const filteredRequests = leaveRequests.filter(req => {
    const matchesTab = activeTab === 'all' ? true : req.status === activeTab;
    const matchesSearch = req.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          req.leaveType?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  });

  if (isLoading) {
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
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <h2 className="d-flex align-items-center gap-2">
          <FileText size={28} className="text-primary" />
          Pengajuan Cuti & Izin
        </h2>
      </div>

      <div className="mb-4">
        <InputGroup className="search-bar shadow-sm">
          <InputGroup.Text className="bg-white border-end-0">
            <Search size={18} className="text-muted" />
          </InputGroup.Text>
          <FormControl
            placeholder="Cari berdasarkan nama karyawan atau jenis cuti..."
            className="border-start-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </InputGroup>
      </div>

      <Nav variant="pills" className="mb-4 bg-light p-1 rounded-3" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'pending')}>
        <Nav.Item>
          <Nav.Link eventKey="pending" className="rounded-3">
            Menunggu <Badge bg="warning" text="dark" className="ms-1">{leaveRequests.filter(r => r.status === 'pending').length}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="approved" className="rounded-3">
            Disetujui <Badge bg="success" className="ms-1">{leaveRequests.filter(r => r.status === 'approved').length}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="rejected" className="rounded-3">
            Ditolak <Badge bg="danger" className="ms-1">{leaveRequests.filter(r => r.status === 'rejected').length}</Badge>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="all" className="rounded-3">
            Semua <Badge bg="secondary" className="ms-1">{leaveRequests.length}</Badge>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {filteredRequests.length > 0 ? (
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="leave-requests-table mb-0">
              <thead className="bg-light">
                <tr>
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
                    <td className="px-4 py-3">
                      <div className="fw-bold">{request.userId?.name || 'N/A'}</div>
                      <div className="small text-muted">{request.userId?.role || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge bg="light" text="dark" className="border">{request.leaveType}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="small d-flex align-items-center gap-1">
                        <Calendar size={14} className="text-muted" />
                        {formatDate(request.startDate)} - {formatDate(request.endDate)}
                      </div>
                    </td>
                     <td className="px-4 py-3">
                      <div className="small text-wrap" style={{ minWidth: '150px' }}>
                        {request.reason}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {request.attachment ? (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="d-flex align-items-center gap-1 mx-auto"
                          title="Lihat Lampiran"
                          onClick={() => handleShowAttachment(request.attachment!, request.userId?.name || 'Karyawan')}
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
                          <Button variant="success" size="sm" onClick={() => handleUpdateStatus(request._id, 'approved')} className="d-flex align-items-center gap-1">
                            <CheckCircle size={14} /> Setujui
                          </Button>
                          <Button variant="outline-danger" size="sm" onClick={() => handleUpdateStatus(request._id, 'rejected')} className="d-flex align-items-center gap-1">
                            <XCircle size={14} /> Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted small italic">Telah diproses</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="text-center py-5 bg-light rounded shadow-sm">
          <FileText size={48} className="text-muted mb-3 opacity-25" />
          <p className="text-muted mb-0">Tidak ada pengajuan yang ditemukan.</p>
        </div>
      )}

      {/* Modal View Attachment */}
      <Modal show={showAttachmentModal} onHide={() => setShowAttachmentModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="h6 fw-bold text-primary">
            Lampiran Pengajuan: {currentAttachmentUser}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-3 bg-light">
          {currentAttachment ? (
            currentAttachment.startsWith('data:application/pdf') ? (
              <iframe 
                src={currentAttachment} 
                title="Preview PDF" 
                width="100%" 
                height="500px" 
                style={{ border: 'none' }}
              />
            ) : (
              <img 
                src={currentAttachment} 
                alt="Lampiran" 
                className="img-fluid rounded shadow" 
                style={{ maxHeight: '70vh' }}
              />
            )
          ) : (
            <div className="text-muted py-5">Lampiran tidak ditemukan</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {currentAttachment && (
            <Button 
              variant="primary" 
              as="a" 
              href={currentAttachment} 
              download={`Lampiran_${currentAttachmentUser.replace(/\s+/g, '_')}`}
              className="d-flex align-items-center gap-2"
            >
              Unduh File <ExternalLink size={14} />
            </Button>
          )}
          <Button variant="secondary" onClick={() => setShowAttachmentModal(false)}>Tutup</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminLeaveRequests;
