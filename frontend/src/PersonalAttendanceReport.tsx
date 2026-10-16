import React, { useState, useMemo, useEffect } from 'react';
import { Badge, Button, Row, Col, Form, Card, Tabs, Tab, ProgressBar } from 'react-bootstrap';
import { toast } from 'react-toastify';
import api from './api';
import { Search, Download, Clock, AlertTriangle, CheckCircle, Calendar, Sparkles, AlertCircle, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import './PersonalAttendanceReport.css';
import type { Attendance, WorkTimeRecord, User } from './types';
import { extractStaffId } from './types';
import { MONTHS_ID } from './constants/roles';

// Years offered in the report filter, derived from the current year so the
// list never goes stale (previously hardcoded [2024, 2025, 2026]).
const REPORT_YEAR_OPTIONS = (() => {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear; y >= 2024; y--) years.push(y);
  return years.length ? years : [currentYear];
})();

interface PersonalAttendanceReportProps {
  attendance: Attendance[];
  workTimeRecords: WorkTimeRecord[];
  user: User;
}

const PersonalAttendanceReport: React.FC<PersonalAttendanceReportProps> = ({ attendance, workTimeRecords, user }) => {
  const [activeTab, setActiveTab] = useState<string>('all-history');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  interface ServerPersonal {
    workdays: number;
    hadir: number;
    onTime: number;
    late: number;
    lateRate: number | null;
    onTimeRate: number | null;
    sick: number;
    izin: number;
    cuti: number;
    alpha: number;
    longShifts: number;
    avgHoursFormatted: string;
    totalHoursFormatted: string;
  }

  const [serverAnalytics, setServerAnalytics] = useState<ServerPersonal | null>(null);
  const [serverPeriod, setServerPeriod] = useState<string>('');

  useEffect(() => {
    if (selectedMonth === -1 || selectedYear === -1) {
      setServerAnalytics(null);
      setServerPeriod('');
      return;
    }
    let cancelled = false;
    api.get(`/api/analytics/personal?month=${selectedMonth + 1}&year=${selectedYear}`)
      .then((res) => {
        if (cancelled) return;
        setServerAnalytics(res.data?.personal || null);
        const p = res.data?.period;
        setServerPeriod(p ? `${p.start} s/d ${p.end}` : '');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Personal analytics fetch error:', err);
        setServerAnalytics(null);
        setServerPeriod('');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Hadir': return 'success';
      case 'Sakit': return 'warning';
      case 'Izin': return 'info';
      case 'Cuti': return 'purple';
      case 'Alpha': return 'danger';
      default: return 'secondary';
    }
  };

  const getKeteranganColor = (ket: string) => {
    if (!ket || ket === '-' || ket === 'N/A') return 'secondary';
    if (['Tepat Waktu', 'Datang Lebih Awal'].includes(ket)) return 'success';
    if (['Terlambat', 'Pulang Lebih Awal', 'Sakit'].includes(ket)) return 'warning';
    if (['Long Shift', 'Cuti'].includes(ket)) return 'purple';
    if (['Hari Libur', 'Izin'].includes(ket)) return 'info';
    if (ket === 'Alpha') return 'danger';
    return 'secondary';
  };

  const correctionLink = (item: { date: string; in: string; out: string }) =>
    `/pengajuan-cuti?tab=correction&date=${item.date}&in=${encodeURIComponent(item.in)}&out=${encodeURIComponent(item.out)}`;

  const handleExport = async () => {
    if (!user.staffId) {
      toast.error('Staff ID tidak ditemukan.');
      return;
    }
    const params = `staffId=${extractStaffId(user.staffId)}&month=${selectedMonth + 1}&year=${selectedYear}`;
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
      window.URL.revokeObjectURL(url);
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
        notes: work?.notes || '',
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

  // Lateness specific records and stats
  const latenessData = useMemo(() => {
    const lateItems = combinedHistory.filter(item => {
      const d = new Date(item.date);
      const mMatch = selectedMonth === -1 || d.getMonth() === selectedMonth;
      const yMatch = selectedYear === -1 || d.getFullYear() === selectedYear;
      const isLate = item.ketMasuk === 'Terlambat';
      return mMatch && yMatch && isLate;
    });

    const totalWorkDaysInPeriod = combinedHistory.filter(item => {
      const d = new Date(item.date);
      const mMatch = selectedMonth === -1 || d.getMonth() === selectedMonth;
      const yMatch = selectedYear === -1 || d.getFullYear() === selectedYear;
      return mMatch && yMatch && item.status === 'Hadir';
    }).length;

    // Day of week breakdown for lateness
    const dayCounts: Record<string, number> = {};
    lateItems.forEach(item => {
      const dayName = new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long' });
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1;
    });

    let mostFrequentLateDay = '-';
    let maxCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentLateDay = day;
      }
    });

    const onTimePercentage = totalWorkDaysInPeriod > 0
      ? Math.round(((totalWorkDaysInPeriod - lateItems.length) / totalWorkDaysInPeriod) * 100)
      : 100;

    return {
      lateItems,
      totalLate: lateItems.length,
      totalWorkDaysInPeriod,
      onTimePercentage,
      mostFrequentLateDay
    };
  }, [combinedHistory, selectedMonth, selectedYear]);

  return (
    <div className="report-container animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="font-jakarta font-weight-bold mb-1">Riwayat & Laporan Kehadiran</h4>
          <p className="text-muted small mb-0">Pantau performa kehadiran, catatan keterlambatan, dan unduh rekap.</p>
        </div>
        <Button variant="success" className="d-flex align-items-center shadow-sm px-4 rounded-pill" onClick={handleExport}>
          <Download size={18} className="me-2" /> Export Excel
        </Button>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onSelect={(k) => setActiveTab(k || 'all-history')} 
        className="mb-4 custom-nav-tabs border-0"
      >
        <Tab eventKey="all-history" title="Semua Riwayat Kehadiran">
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
                      {MONTHS_ID.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </Form.Select>
                    <Form.Select className="filter-select border-0 bg-light" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                      <option value={-1}>Semua Tahun</option>
                      {REPORT_YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                    </Form.Select>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Desktop Table */}
          <div className="d-none d-md-block card border-0 shadow-sm overflow-hidden rounded-16">
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
                    <th>Catatan</th>
                    <th>Aksi</th>
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
                      <td>
                        {item.notes ? (
                          <span className="small text-muted" title={item.notes}>{item.notes}</span>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                      <td>
                        {item.status === 'Hadir' && (
                          <Button
                            as={Link as any}
                            to={correctionLink(item)}
                            variant="outline-primary"
                            size="sm"
                            className="rounded-pill px-3 d-inline-flex align-items-center gap-1 shadow-xs"
                          >
                            <span>Ajukan Koreksi</span>
                            <ArrowUpRight size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={8} className="text-center py-4 text-muted">Data tidak ditemukan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="d-md-none">
            {filteredHistory.length > 0 ? filteredHistory.map(item => (
              <Card key={item.date} className="border-0 shadow-sm mb-3 history-mobile-card rounded-16">
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
                      <div className="p-2 bg-light rounded-12">
                        <span className="d-block small text-muted"><Clock size={12} className="me-1" /> Masuk</span>
                        <span className="font-weight-bold">{item.in}</span>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="p-2 bg-light rounded-12">
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
                  {item.notes && (
                    <div className="mt-2 small text-muted bg-light rounded-12 p-2">
                      <span className="fw-bold d-block mb-1">Catatan:</span>
                      {item.notes}
                    </div>
                  )}
                  {item.status === 'Hadir' && (
                    <div className="mt-2 text-end">
                      <Button
                        as={Link as any}
                        to={correctionLink(item)}
                        variant="outline-primary"
                        size="sm"
                        className="rounded-pill px-3 d-inline-flex align-items-center gap-1 shadow-xs"
                      >
                        <span>Ajukan Koreksi</span>
                        <ArrowUpRight size={14} />
                      </Button>
                    </div>
                  )}
                </Card.Body>
              </Card>
            )) : (
              <div className="text-center py-5 text-muted">Data tidak ditemukan.</div>
            )}
          </div>
        </Tab>

        <Tab eventKey="lateness-report" title="Laporan Keterlambatan">
          {serverAnalytics && (
            <Card className="border-0 shadow-sm rounded-16 mb-4 server-analytics-banner">
              <Card.Body className="p-3 p-md-4">
                <div className="d-flex align-items-center gap-2 mb-3" style={{ color: 'var(--primary-green)', fontWeight: 700 }}>
                  <ArrowUpRight size={18} /> Statistik Server ({serverPeriod})
                </div>
                <Row className="g-3">
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Hari Kerja</span><span className="stat-chip-value">{serverAnalytics.workdays}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Tepat Waktu</span><span className="stat-chip-value text-success">{serverAnalytics.onTimeRate === null ? 'N/A' : `${serverAnalytics.onTimeRate}%`}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Total Terlambat (Server)</span><span className="stat-chip-value text-danger">{serverAnalytics.late}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Rata-rata Jam Kerja</span><span className="stat-chip-value">{serverAnalytics.avgHoursFormatted}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Sakit</span><span className="stat-chip-value text-warning">{serverAnalytics.sick}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Izin</span><span className="stat-chip-value text-info">{serverAnalytics.izin}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Cuti</span><span className="stat-chip-value text-primary">{serverAnalytics.cuti}</span></div>
                  </Col>
                  <Col xs={6} md={3}>
                    <div className="stat-chip"><span className="stat-chip-label">Long Shift</span><span className="stat-chip-value text-purple">{serverAnalytics.longShifts}</span></div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}
          <Row className="g-3 mb-4">
            <Col sm={6} lg={4}>
              <Card className="border-0 shadow-sm rounded-16 h-100 bg-white">
                <Card.Body className="p-4 d-flex align-items-center gap-3">
                  <div className="p-3 bg-danger bg-opacity-10 text-danger rounded-circle">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <span className="text-muted tiny d-block text-uppercase fw-bold">Total Terlambat</span>
                    <h3 className="fw-bold mb-0 text-danger">{latenessData.totalLate} <small className="text-muted h6 fw-normal">kali</small></h3>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={6} lg={4}>
              <Card className="border-0 shadow-sm rounded-16 h-100 bg-white">
                <Card.Body className="p-4 d-flex align-items-center gap-3">
                  <div className="p-3 bg-success bg-opacity-10 text-success rounded-circle">
                    <CheckCircle size={24} />
                  </div>
                  <div className="flex-grow-1">
                    <span className="text-muted tiny d-block text-uppercase fw-bold">Skor Ketepatan Waktu</span>
                    <h3 className="fw-bold mb-1 text-success">{latenessData.onTimePercentage}%</h3>
                    <ProgressBar 
                      now={latenessData.onTimePercentage} 
                      variant={latenessData.onTimePercentage >= 85 ? 'success' : latenessData.onTimePercentage >= 70 ? 'warning' : 'danger'} 
                      style={{ height: '5px' }} 
                      className="rounded-pill" 
                    />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col sm={12} lg={4}>
              <Card className="border-0 shadow-sm rounded-16 h-100 bg-white">
                <Card.Body className="p-4 d-flex align-items-center gap-3">
                  <div className="p-3 bg-info bg-opacity-10 text-info rounded-circle">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <span className="text-muted tiny d-block text-uppercase fw-bold">Hari Paling Sering Telat</span>
                    <h4 className="fw-bold mb-0 text-dark">{latenessData.mostFrequentLateDay}</h4>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="border-0 shadow-sm mb-4 filter-card">
            <Card.Body className="p-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <AlertCircle size={18} className="text-warning" />
                <span className="small fw-bold text-muted">Daftar hari ketika Anda tercatat datang melebihi jam kerja standar:</span>
              </div>
              <div className="d-flex gap-2">
                <Form.Select className="filter-select border-0 bg-light py-2" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                  <option value={-1}>Semua Bulan</option>
                  {MONTHS_ID.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </Form.Select>
                <Form.Select className="filter-select border-0 bg-light py-2" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  <option value={-1}>Semua Tahun</option>
                  {REPORT_YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                </Form.Select>
              </div>
            </Card.Body>
          </Card>

          {latenessData.lateItems.length > 0 ? (
            <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead className="bg-light">
                    <tr>
                      <th className="py-3 ps-4">Tanggal & Hari</th>
                      <th className="py-3">Jam Masuk Aktual</th>
                      <th className="py-3">Jam Pulang</th>
                      <th className="py-3">Total Jam Kerja</th>
                      <th className="py-3">Status Masuk</th>
                      <th className="py-3 text-end pe-4">Opsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latenessData.lateItems.map(item => (
                      <tr key={item.date}>
                        <td className="ps-4 fw-bold">
                          {new Date(item.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                        <td>
                          <code className="text-danger bg-danger bg-opacity-10 px-2 py-1 rounded fw-bold">
                            {item.in}
                          </code>
                        </td>
                        <td>{item.out}</td>
                        <td className="fw-bold text-primary-green">{item.total}</td>
                        <td>
                          <Badge bg="danger" className="rounded-pill px-3 py-1 fw-normal">
                            Terlambat
                          </Badge>
                        </td>
                        <td className="text-end pe-4">
                          <Button 
                            as={Link as any} 
                            to={correctionLink(item)} 
                            variant="outline-primary" 
                            size="sm" 
                            className="rounded-pill px-3 d-inline-flex align-items-center gap-1 shadow-xs"
                          >
                            <span>Ajukan Koreksi</span>
                            <ArrowUpRight size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="text-center py-5 bg-light rounded-16 shadow-sm">
              <div className="p-3 bg-success bg-opacity-10 text-success rounded-circle d-inline-flex mb-3">
                <Sparkles size={36} />
              </div>
              <h5 className="fw-bold text-success mb-1">Alhamdulillah! Tidak Ada Catatan Keterlambatan</h5>
              <p className="text-muted small mb-0">Kedisiplinan Anda pada periode ini sangat baik. Pertahankan!</p>
            </div>
          )}
        </Tab>
      </Tabs>
    </div>
  );
};

export default PersonalAttendanceReport;
