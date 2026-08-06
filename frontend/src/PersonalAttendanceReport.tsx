import React, { useState, useMemo } from 'react';
import { Badge, Button, Row, Col, Form, Card } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from './api';
import { Search, Download, Clock } from 'lucide-react';
import './PersonalAttendanceReport.css';
import type { Attendance, WorkTimeRecord, User } from './types';

interface PersonalAttendanceReportProps {
  attendance: Attendance[];
  workTimeRecords: WorkTimeRecord[];
  user: User;
}

const PersonalAttendanceReport: React.FC<PersonalAttendanceReportProps> = ({ attendance, workTimeRecords, user }) => {
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hadir': return 'success';
      case 'Sakit': return 'warning';
      case 'Izin': return 'info';
      case 'Cuti': return 'purple'; // Changed from primary to purple
      case 'Alpha': return 'danger';
      default: return 'secondary';
    }
  };

  const getKeteranganColor = (ket: string) => {
    if (!ket || ket === '-' || ket === 'N/A') return 'secondary';
    if (['Tepat Waktu', 'Datang Lebih Awal'].includes(ket)) return 'success';
    if (['Terlambat', 'Pulang Lebih Awal', 'Sakit'].includes(ket)) return 'warning';
    if (['Long Shift', 'Cuti'].includes(ket)) return 'purple'; // Changed to purple
    if (['Hari Libur', 'Izin'].includes(ket)) return 'info';
    if (ket === 'Alpha') return 'danger';
    return 'secondary';
  };

  const handleExport = async () => {
    if (!user.staffId) {
      toast.error('Staff ID tidak ditemukan.');
      return;
    }
    const params = `staffId=${user.staffId}&month=${selectedMonth + 1}&year=${selectedYear}`;
    try {
      const response = await api.get(`/api/export-personal-excel?${params}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Absensi_${user.name.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Gagal mengekspor laporan.');
    }
  };

  const combinedHistory = useMemo(() => {
    const attendanceByDate = new Map(attendance.map(a => [a.date, a]));
    const workTimeByDate = new Map(workTimeRecords.map(w => [w.date, w]));
    const allDates = Array.from(new Set([...attendance.map(a => a.date), ...workTimeRecords.map(r => r.date)]));

    return allDates.map(date => {
      const att = attendanceByDate.get(date);
      const work = workTimeByDate.get(date);
      let status = work ? 'Hadir' : (att?.status || '-');
      let ketMasuk = work?.keteranganMasuk || (['Sakit', 'Izin', 'Cuti', 'Alpha'].includes(status) ? status : '');
      
      return {
        date,
        status,
        in: work?.clockInTime || '-',
        out: work?.clockOutTime || '-',
        total: work?.totalHours || '-',
        ketMasuk,
        ketPulang: work?.keteranganPulang || '',
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [attendance, workTimeRecords]);

  const filteredHistory = useMemo(() => {
    return combinedHistory.filter(item => {
      const d = new Date(item.date);
      const mMatch = selectedMonth === -1 || d.getMonth() === selectedMonth;
      const yMatch = selectedYear === -1 || d.getFullYear() === selectedYear;
      const sMatch = Object.values(item).some(v => String(v).toLowerCase().includes(historySearchTerm.toLowerCase()));
      return mMatch && yMatch && sMatch;
    });
  }, [combinedHistory, selectedMonth, selectedYear, historySearchTerm]);

  return (
    <div className="report-container animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="font-jakarta font-weight-bold mb-1">Riwayat Kehadiran</h4>
          <p className="text-muted small mb-0">Lihat dan unduh laporan absensi Anda.</p>
        </div>
        <Button variant="success" className="d-flex align-items-center shadow-sm px-4 rounded-pill" onClick={handleExport}>
          <Download size={18} className="me-2" /> Export Excel
        </Button>
      </div>

      <Card className="border-0 shadow-sm mb-4 filter-card">
        <Card.Body className="p-3">
          <Row className="g-3">
            <Col md={5}>
              <div className="search-wrapper">
                <Search size={18} className="search-icon" />
                <Form.Control 
                  type="text" 
                  placeholder="Cari tanggal atau status..." 
                  className="search-input border-0 shadow-none" 
                  value={historySearchTerm} 
                  onChange={(e) => setHistorySearchTerm(e.target.value)} 
                />
              </div>
            </Col>
            <Col md={4} sm={6}>
              <div className="d-flex gap-2">
                <Form.Select className="filter-select border-0 bg-light" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                  <option value={-1}>Semua Bulan</option>
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, i) => <option key={i} value={i}>{m}</option>)}
                </Form.Select>
                <Form.Select className="filter-select border-0 bg-light" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  <option value={-1}>Semua Tahun</option>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </Form.Select>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Desktop Table */}
      <div className="d-none d-md-block card border-0 shadow-sm overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 custom-table">
            <thead className="bg-light">
              <tr>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Masuk</th>
                <th>Pulang</th>
                <th>Total Kerja</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? filteredHistory.map(item => (
                <tr key={item.date}>
                  <td className="font-weight-bold">{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td><Badge bg={getStatusColor(item.status)} className="rounded-pill px-3">{item.status}</Badge></td>
                  <td>{item.in}</td>
                  <td>{item.out}</td>
                  <td className="text-primary-green font-weight-bold">{item.total}</td>
                  <td>
                    {(() => {
                      if (['Cuti', 'Sakit', 'Izin', 'Alpha'].includes(item.status)) {
                        return <span className="text-muted">-</span>;
                      }
                      
                      const remarks = [];
                      
                      // Entry Remark
                      if (item.ketMasuk) {
                        remarks.push(
                          <Badge 
                            key="in" 
                            bg={getKeteranganColor(item.ketMasuk)} 
                            className="me-1 opacity-75"
                            title="Keterangan Masuk"
                          >
                            {item.ketMasuk === 'Hadir' ? 'Tepat Waktu' : item.ketMasuk}
                          </Badge>
                        );
                      }
                      
                      // Exit Remark
                      if (item.ketPulang) {
                        remarks.push(
                          <Badge 
                            key="out" 
                            bg={getKeteranganColor(item.ketPulang)} 
                            className="opacity-75"
                            title="Keterangan Pulang"
                          >
                            {item.ketPulang}
                          </Badge>
                        );
                      }
                      
                      return remarks.length > 0 ? remarks : <span className="text-muted">-</span>;
                    })()}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="text-center py-4 text-muted">Data tidak ditemukan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="d-md-none">
        {filteredHistory.length > 0 ? filteredHistory.map(item => (
          <Card key={item.date} className="border-0 shadow-sm mb-3 history-mobile-card">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start mb-3">
                <div className="d-flex align-items-center">
                  <div className="date-box me-3 text-center">
                    <span className="d-block day">{new Date(item.date).getDate()}</span>
                    <span className="d-block month text-uppercase">{new Date(item.date).toLocaleDateString('id-ID', { month: 'short' })}</span>
                  </div>
                  <div>
                    <h6 className="mb-1 font-weight-bold">{new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long' })}</h6>
                    <Badge bg={getStatusColor(item.status)} className="rounded-pill px-2">{item.status}</Badge>
                  </div>
                </div>
                <div className="text-end">
                  <span className="d-block small text-muted">Total</span>
                  <span className="font-weight-bold text-primary-green">{item.total}</span>
                </div>
              </div>
              <Row className="g-2 text-center border-top pt-3">
                <Col xs={6}>
                  <div className="p-2 bg-light rounded">
                    <span className="d-block small text-muted"><Clock size={12} className="me-1" /> Masuk</span>
                    <span className="font-weight-bold">{item.in}</span>
                  </div>
                </Col>
                <Col xs={6}>
                  <div className="p-2 bg-light rounded">
                    <span className="d-block small text-muted"><Clock size={12} className="me-1" /> Pulang</span>
                    <span className="font-weight-bold">{item.out}</span>
                  </div>
                </Col>
              </Row>
              {(item.ketMasuk || item.ketPulang) && (
                <div className="mt-2 small d-flex gap-1 flex-wrap">
                  {(() => {
                    if (['Cuti', 'Sakit', 'Izin', 'Alpha'].includes(item.status)) {
                      return null;
                    }
                    
                    const remarks = [];
                    if (item.ketMasuk) {
                      remarks.push(
                        <Badge 
                          key="in-m" 
                          bg={getKeteranganColor(item.ketMasuk)} 
                          className="opacity-75"
                        >
                          Masuk: {item.ketMasuk === 'Hadir' ? 'Tepat Waktu' : item.ketMasuk}
                        </Badge>
                      );
                    }
                    if (item.ketPulang) {
                      remarks.push(
                        <Badge 
                          key="out-m" 
                          bg={getKeteranganColor(item.ketPulang)} 
                          className="opacity-75"
                        >
                          Pulang: {item.ketPulang}
                        </Badge>
                      );
                    }
                    return remarks;
                  })()}
                </div>
              )}
            </Card.Body>
          </Card>
        )) : (
          <div className="text-center py-5 text-muted">Data tidak ditemukan.</div>
        )}
      </div>
    </div>
  );
};

export default PersonalAttendanceReport;
