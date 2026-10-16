import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from './api';
import { Card, Container, Row, Col, Badge, Modal, Button, ProgressBar, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import confetti from 'canvas-confetti';
import { 
  LogIn, 
  LogOut as LogOutIcon, 
  Stethoscope, 
  CalendarClock, 
  Clock, 
  Timer, 
  History, 
  Trophy, 
  Activity, 
  AlertCircle, 
  Bell,
  Flame,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import type { Attendance, WorkTimeRecord, User, Announcement, LeaveRequest } from './types';
import { extractStaffId } from './types';
import PersonalAttendanceReport from './PersonalAttendanceReport';
import './MainApp.css';

const OFFICE_LOCATION = {
  latitude: -6.958115592601739,
  longitude: 107.70755749004297,
};
const GEOFENCE_RADIUS = 50;

interface MainAppProps {
  user: User;
  onLogout: () => void;
}

const ISLAMIC_QUOTES = [
  "Bekerja adalah ibadah, jika niatnya karena Allah.",
  "Sebaik-baik manusia adalah yang paling bermanfaat bagi orang lain.",
  "Allah menyukai profesionalisme dalam bekerja.",
  "Tangan yang di atas lebih baik daripada tangan yang di bawah.",
  "Bukanlah kekayaan itu dari banyaknya harta, melainkan kekayaan jiwa (hati yang selalu merasa cukup).",
  "Janganlah kamu menunda-nunda amal kebaikan dan pekerjaan, karena kamu tidak tahu kapan ajal menjemput.",
  "Barangsiapa bersungguh-sungguh, sesungguhnya kesungguhannya itu adalah untuk dirinya sendiri.",
  "Rezeki yang berkah tidak selalu tentang jumlahnya, melainkan tentang rida Allah di dalamnya.",
  "Doa tanpa usaha adalah angan-angan, usaha tanpa doa adalah kesombongan.",
  "Kejujuran adalah perhiasan jiwa yang paling indah dalam setiap pekerjaan.",
  "Mudahkanlah urusan orang lain, maka Allah akan memudahkan urusannya."
];

const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const staffIdStr = useMemo(() => (user.staffId ? extractStaffId(user.staffId) : null), [user.staffId]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [clockStatus, setClockStatus] = useState<'in' | 'out' | 'finished'>('out');
  const [workTimeRecords, setWorkTimeRecords] = useState<WorkTimeRecord[]>([]);
  const [runningDuration, setRunningDuration] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userRanking, setUserRanking] = useState<{ rank: number; total: number; label: string } | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [currentQuote] = useState(() => ISLAMIC_QUOTES[Math.floor(Math.random() * ISLAMIC_QUOTES.length)]);

  // Entry modal state (clock-in notes / Sakit-Izin reason)
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [entryAction, setEntryAction] = useState<'clock-in' | 'clock-out' | 'Sakit' | 'Izin'>('Sakit');
  const [entryNotes, setEntryNotes] = useState('');

  const openEntryModal = (action: 'clock-in' | 'clock-out' | 'Sakit' | 'Izin') => {
    setEntryAction(action);
    setEntryNotes('');
    setShowEntryModal(true);
  };

  const handleEntryModalConfirm = () => {
    const trimmed = entryNotes.trim();
    setShowEntryModal(false);
    if (entryAction === 'clock-in' || entryAction === 'clock-out') {
      processAttendance(entryAction, trimmed || undefined);
    } else {
      handleOtherStatus(entryAction, trimmed || undefined);
    }
  };

  // Announcement Modal State
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [showAnnModal, setShowAnnModal] = useState(false);

  const handleShowAnnouncement = (ann: Announcement) => {
    setSelectedAnnouncement(ann);
    setShowAnnModal(true);
  };

  const triggerSuccessFeedback = () => {
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#064e3b', '#b45309', '#10b981'] });
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.2);
  };

  const fetchRecords = useCallback(async (id: string) => {
    try {
      const response = await api.get(`/api/records/${id}`);
      const allRecords = response.data as WorkTimeRecord[];
      setWorkTimeRecords(allRecords);
      const todayInJakarta = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const todaysRecord = allRecords.find((r: WorkTimeRecord) => new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === todayInJakarta);
      if (todaysRecord) {
        if (todaysRecord.clockInTime !== 'N/A' && todaysRecord.clockOutTime === 'N/A') setClockStatus('in');
        else setClockStatus('finished');
      } else setClockStatus('out');
    } catch (error) { setClockStatus('out'); } finally { setIsLoading(false); }
  }, []);

  const fetchUserAttendance = useCallback(async () => {
    if (staffIdStr) {
      try {
        const response = await api.get('/api/attendance');
        setAttendance(response.data.filter((a: Attendance) => extractStaffId(a.staffId) === staffIdStr));
      } catch (error) { console.error("Error fetching attendance:", error); }
    }
  }, [staffIdStr]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const response = await api.get('/api/announcements');
      setAnnouncements(response.data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  }, []);

  const fetchRanking = useCallback(async () => {
    try {
      const response = await api.get('/api/attendance/ranking');
      const rankings = response.data;
      const myPos = rankings.findIndex((r: any) => String(r.staffId) === String(staffIdStr));
      if (myPos !== -1) {
        const rank = myPos + 1;
        let label = 'Pejuang Disiplin';
        if (rank === 1) label = '#1 Terbaik';
        else if (rank <= 5) label = 'Top 5 Disiplin';
        setUserRanking({ rank, total: rankings.length, label });
      } else {
        console.log('User not found in rankings. User staffId:', staffIdStr, 'Rankings:', rankings);
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
    }
  }, [staffIdStr]);

  const fetchLeaveRequests = useCallback(async () => {
    try {
      const response = await api.get('/api/leave-requests/my');
      setLeaveRequests(response.data);
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  }, []);

  const isTodayInLeaveRange = (leave: LeaveRequest) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(leave.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(leave.endDate);
    end.setHours(0, 0, 0, 0);
    return today >= start && today <= end && leave.status === 'approved';
  };

  useEffect(() => {
    if (staffIdStr) {
      fetchRecords(staffIdStr);
      fetchUserAttendance();
      fetchAnnouncements();
      fetchRanking();
      fetchLeaveRequests();
    }
    const leaveInterval = setInterval(() => {
      fetchLeaveRequests();
    }, 30000); // Light poll: own leave requests
    const attendanceInterval = setInterval(() => {
      fetchUserAttendance();
    }, 300000); // Heavy poll: personal attendance history (every 5 minutes instead of 10s)
    return () => {
      clearInterval(leaveInterval);
      clearInterval(attendanceInterval);
    };
  }, [staffIdStr, fetchRecords, fetchUserAttendance, fetchAnnouncements, fetchRanking, fetchLeaveRequests]);

  // Refresh local state after the offline queue is replayed by the service worker.
  useEffect(() => {
    const handleOfflineFlushed = () => {
      if (staffIdStr) {
        fetchRecords(staffIdStr);
        fetchUserAttendance();
      }
    };
    window.addEventListener('offline-queue-flushed', handleOfflineFlushed);
    return () => window.removeEventListener('offline-queue-flushed', handleOfflineFlushed);
  }, [staffIdStr, fetchRecords, fetchUserAttendance]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (clockStatus === 'in') {
      const todayInJakarta = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      const todaysRecord = workTimeRecords.find(r => new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === todayInJakarta);
      if (todaysRecord && todaysRecord.clockInTime !== 'N/A') {
        const timeParts = todaysRecord.clockInTime.match(/\d+/g);
        if (timeParts && timeParts.length >= 2) {
          const hours = parseInt(timeParts[0], 10);
          const minutes = parseInt(timeParts[1], 10);
          const seconds = timeParts.length >= 3 ? parseInt(timeParts[2], 10) : 0;
          const clockInDate = new Date(); clockInDate.setHours(hours, minutes, seconds);
          timer = setInterval(() => {
            const now = new Date().getTime();
            const diff = now - clockInDate.getTime();
            if (diff < 0) return;
            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setRunningDuration(`${h}j ${m}m ${s}d`);
          }, 1000);
        }
      }
    }
    return () => clearInterval(timer);
  }, [clockStatus, workTimeRecords]);

  // Attendance & Smart Flow
  const processAttendance = async (type: 'clock-in' | 'clock-out', notes?: string) => {
    if (!staffIdStr || isSubmitting) return;

    setIsSubmitting(true);
    const toastId = toast.loading("Validasi Lokasi...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const R = 6371e3;
        const lat1 = (latitude * Math.PI) / 180;
        const lat2 = (OFFICE_LOCATION.latitude * Math.PI) / 180;
        const dLat = ((OFFICE_LOCATION.latitude - latitude) * Math.PI) / 180;
        const dLon = ((OFFICE_LOCATION.longitude - longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        if (distance > GEOFENCE_RADIUS) {
          toast.update(toastId, { render: "Lokasi di luar jangkauan (Maks 50m).", type: "error", isLoading: false, autoClose: 3000 });
          setIsSubmitting(false); return;
        }

        try {
          await api.post('/api/records', { 
            staffId: staffIdStr, 
            type,
            notes: notes || undefined,
            location: {
              latitude,
              longitude,
              distance: Math.round(distance)
            }
          });
          toast.update(toastId, { render: `${type === 'clock-in' ? 'Masuk' : 'Pulang'} berhasil!`, type: "success", isLoading: false, autoClose: 3000 });
          triggerSuccessFeedback();
          fetchRecords(staffIdStr);
        } catch (error: any) {
          if (error?.offlineQueued) {
            toast.update(toastId, { render: "Anda sedang offline — absensi disimpan dan akan dikirim otomatis saat online.", type: "info", isLoading: false, autoClose: 4000 });
            setClockStatus(type === 'clock-in' ? 'in' : 'finished');
          } else {
            toast.update(toastId, { render: error.response?.data?.message || 'Terjadi kesalahan.', type: "error", isLoading: false, autoClose: 3000 });
          }
        } finally {
          setIsSubmitting(false);
        }
      },
      (error) => {
        toast.update(toastId, { render: "Gagal mendapatkan lokasi.", type: "error", isLoading: false, autoClose: 3000 });
        setIsSubmitting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleOtherStatus = (status: 'Sakit' | 'Izin', notes?: string) => {
    if (!staffIdStr) return;
    const toastId = toast.loading("Mengirim laporan...");
    api.post('/api/attendance', { staffId: staffIdStr, name: user.name, status, date: new Date().toLocaleDateString('en-CA'), time: new Date().toTimeString().split(' ')[0], notes: notes || undefined })
    .then(() => { toast.update(toastId, { render: "Laporan terkirim!", type: "success", isLoading: false, autoClose: 3000 }); triggerSuccessFeedback(); fetchUserAttendance(); })
    .catch(err => {
      if (err?.offlineQueued) {
        toast.update(toastId, { render: "Anda sedang offline — laporan disimpan dan akan dikirim otomatis saat online.", type: "info", isLoading: false, autoClose: 4000 });
      } else {
        toast.update(toastId, { render: "Gagal mengirim laporan.", type: "error", isLoading: false, autoClose: 3000 });
      }
    });
  };

  const todayInJakarta = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  const todaysAttendance = attendance.find(a => a.date === todayInJakarta);
  const todaysLeave = leaveRequests.find(isTodayInLeaveRange);

  const stats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRecords = workTimeRecords.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const hadir = monthlyRecords.length;
    const terlambat = monthlyRecords.filter(r => r.keteranganMasuk === 'Terlambat').length;
    const tepatWaktu = monthlyRecords.filter(r => ['Tepat Waktu', 'Datang Lebih Awal'].includes(r.keteranganMasuk)).length;
    const pulangLebihAwal = monthlyRecords.filter(r => r.keteranganPulang === 'Pulang Lebih Awal').length;

    // Parse total hours in minutes
    let totalMinutes = 0;
    monthlyRecords.forEach(r => {
      if (r.totalHours) {
        const parts = r.totalHours.match(/(\d+)\s*jam(?:\s*(\d+)\s*menit)?/i);
        if (parts) {
          const h = parseInt(parts[1], 10) || 0;
          const m = parseInt(parts[2], 10) || 0;
          totalMinutes += (h * 60) + m;
        }
      }
    });

    const totalHoursNum = Math.floor(totalMinutes / 60);
    const totalRemainingMinutes = totalMinutes % 60;
    const totalJamKerjaFormatted = totalMinutes > 0 ? `${totalHoursNum}j ${totalRemainingMinutes}m` : '0j';

    const avgMinutesPerDay = hadir > 0 ? Math.round(totalMinutes / hadir) : 0;
    const avgH = Math.floor(avgMinutesPerDay / 60);
    const avgM = avgMinutesPerDay % 60;
    const rataHarianFormatted = avgMinutesPerDay > 0 ? `${avgH}j ${avgM}m` : '0j';

    const percentage = hadir > 0 ? Math.round(((hadir - terlambat) / hadir) * 100) : 100;

    // Calculate current streak of attendance without late
    const sortedDesc = [...workTimeRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    let currentStreak = 0;
    for (const r of sortedDesc) {
      if (r.keteranganMasuk !== 'Terlambat' && r.clockInTime && r.clockInTime !== 'N/A') {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      hadir,
      terlambat,
      tepatWaktu,
      pulangLebihAwal,
      totalJamKerjaFormatted,
      rataHarianFormatted,
      percentage,
      streak: currentStreak
    };
  }, [workTimeRecords]);

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <div className="spinner-border text-primary-green mb-3" role="status"></div>
        <p className="text-muted font-jakarta">Menyiapkan dashboard...</p>
      </Container>
    );
  }

  return (
    <Container className="py-4 main-app-container animate-fade-in">
      {/* Header & Avatar */}
      <div className="d-flex align-items-center justify-content-between mb-4 user-header">
        <div className="d-flex align-items-center gap-3">
          <div className="avatar-circle glass text-primary-green">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="d-block greeting-small">Assalamu'alaikum,</span>
            <span className="d-block user-name-title">{user.name}</span>
          </div>
        </div>
        {userRanking && (
          <div className={`ranking-badge d-flex align-items-center gap-2 px-3 py-1 rounded-pill ${userRanking.rank <= 5 ? 'bg-gold-light' : 'bg-light'}`}>
            <Trophy size={16} className={userRanking.rank <= 5 ? 'text-gold' : 'text-muted'} />
            <span className="small font-weight-bold">{userRanking.label}</span>
          </div>
        )}
      </div>

      <section className="status-widget mb-4">
        <Card className="hero-card glass border-0 shadow-lg">
          <Card.Body className="p-4">
            <div className="d-flex justify-content-between align-items-center w-100">
              <div className="status-main-info flex-grow-1">
                <Badge 
                  bg="none" 
                  className={`status-badge-hero mb-2 px-3 py-2 rounded-pill shadow-sm ${todaysAttendance ? todaysAttendance.status.toLowerCase() : (todaysLeave ? todaysLeave.leaveType.toLowerCase() : 'belum')}`}
                >
                  {todaysAttendance ? todaysAttendance.status : (todaysLeave ? todaysLeave.leaveType : 'Belum Absen')}
                </Badge>
                <h2 className="hero-main-title">Status Anda</h2>
                <p className="islamic-quote mt-2 mb-0">"{currentQuote}"</p>
              </div>
              <div className="border-left-white ms-3">
                <div className="quick-info text-white">
                  <Clock size={18} className="mb-1 opacity-75" />
                  <div className="time-text fw-bold">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="small opacity-75">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</div>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </section>

      {/* Main Actions - 1 Click Optimization */}
      <div className="primary-actions-container mb-4">
        <div className="primary-actions">
          <button 
            className="main-action-btn btn-masuk-large"
            onClick={() => openEntryModal('clock-in')}
            disabled={clockStatus === 'in' || clockStatus === 'finished' || !!todaysAttendance || !!todaysLeave || isSubmitting}
          >
            <LogIn size={24} className="me-2" /> Absen Masuk
          </button>
          <button 
            className="main-action-btn btn-pulang-large"
            onClick={() => openEntryModal('clock-out')}
            disabled={clockStatus === 'out' || clockStatus === 'finished' || !!todaysLeave || isSubmitting}
          >
            <LogOutIcon size={24} className="me-2" /> Absen Pulang
          </button>
        </div>
      </div>

      <Row className="g-4 mb-4">
        <Col lg={5}>
          {/* Visual Progress Ring */}
          <Card className="border-0 shadow-sm rounded-lg h-100">
            <Card.Body className="d-flex flex-column align-items-center p-4">
              <h6 className="text-muted small text-uppercase font-weight-bold mb-4">Waktu Kerja Hari Ini</h6>
              <div className={`status-indicator-ring ${clockStatus}`}>
                <div className="inner-content">
                  <Timer size={32} className="mb-2 status-icon" />
                  <span className="timer-text">{runningDuration || '00:00:00'}</span>
                </div>
              </div>
              <div className="w-100 mt-4 d-flex justify-content-around text-center">
                <div>
                  <span className="d-block text-muted tiny">MASUK</span>
                  <span className="font-weight-bold">
                    {(() => {
                      const todayInJakarta = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
                      const todaysRecord = workTimeRecords.find(r => new Date(r.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) === todayInJakarta);
                      return todaysRecord?.clockInTime !== 'N/A' ? todaysRecord?.clockInTime : '--:--';
                    })()}
                  </span>
                </div>
                <div className="border-right-light"></div>
                <div>
                  <span className="d-block text-muted tiny">KEDISIPLINAN</span>
                  <span className="text-primary-green font-weight-bold">{stats.percentage}%</span>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          {/* Insights & Analytics Shortcut */}
          <Card className="border-0 shadow-sm rounded-lg mb-4 bg-emerald-light">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0 font-weight-bold d-flex align-items-center">
                  <Activity size={18} className="me-2 text-primary-green" /> Statistik Bulan Ini
                </h6>
                {stats.streak > 0 && (
                  <Badge bg="warning" text="dark" className="d-flex align-items-center gap-1 rounded-pill px-3 py-1 shadow-sm font-weight-bold">
                    <Flame size={14} className="text-danger" /> {stats.streak} Hari Disiplin
                  </Badge>
                )}
              </div>

              <Row className="g-2 mb-3">
                <Col xs={6} sm={3}>
                  <div className="analytic-item text-center p-2 bg-white rounded-12 shadow-xs">
                    <span className="label text-muted tiny d-block">HADIR</span>
                    <span className="value font-weight-bold text-dark">{stats.hadir} <small className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>hari</small></span>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="analytic-item text-center p-2 bg-white rounded-12 shadow-xs">
                    <span className="label text-danger tiny d-block">TERLAMBAT</span>
                    <span className="value font-weight-bold text-danger">{stats.terlambat} <small className="text-muted fw-normal" style={{ fontSize: '0.7rem' }}>kali</small></span>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="analytic-item text-center p-2 bg-white rounded-12 shadow-xs">
                    <span className="label text-primary-green tiny d-block">TOTAL JAM</span>
                    <span className="value font-weight-bold text-primary-green">{stats.totalJamKerjaFormatted}</span>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="analytic-item text-center p-2 bg-white rounded-12 shadow-xs">
                    <span className="label text-info tiny d-block">RATA-RATA</span>
                    <span className="value font-weight-bold text-info">{stats.rataHarianFormatted}</span>
                  </div>
                </Col>
              </Row>

              <div className="discipline-progress pt-1">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="tiny text-muted font-weight-bold d-flex align-items-center gap-1">
                    <TrendingUp size={12} className="text-primary-green" /> Skor Kedisiplinan
                  </span>
                  <span className={`tiny font-weight-bold ${stats.percentage >= 85 ? 'text-success' : stats.percentage >= 70 ? 'text-warning' : 'text-danger'}`}>
                    {stats.percentage}%
                  </span>
                </div>
                <ProgressBar 
                  now={stats.percentage} 
                  variant={stats.percentage >= 85 ? 'success' : stats.percentage >= 70 ? 'warning' : 'danger'} 
                  className="rounded-pill mb-2" 
                  style={{ height: '6px' }} 
                />
                <div className="tiny text-muted d-flex align-items-center gap-1">
                  <Sparkles size={12} className="text-warning flex-shrink-0" />
                  <span>{stats.percentage >= 90 ? 'Luar biasa! Pertahankan kedisiplinan prima Anda.' : stats.percentage >= 75 ? 'Bagus! Terus jaga ketepatan waktu hadir.' : 'Mari tingkatkan ketepatan waktu absen datang.'}</span>
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Quick Actions */}
          <div className="quick-actions-grid">
            <button className="q-btn" onClick={() => openEntryModal('Sakit')} disabled={clockStatus === 'finished' || !!todaysAttendance || !!todaysLeave}>
              <Stethoscope size={20} className="text-warning" />
              <span>Sakit</span>
            </button>
            <button className="q-btn" onClick={() => openEntryModal('Izin')} disabled={clockStatus === 'finished' || !!todaysAttendance || !!todaysLeave}>
              <CalendarClock size={20} className="text-info" />
              <span>Izin</span>
            </button>
            <button className="q-btn" onClick={() => document.getElementById('full-history')?.scrollIntoView({ behavior: 'smooth' })}>
              <History size={20} className="text-muted" />
              <span>Riwayat</span>
            </button>
          </div>
        </Col>
      </Row>

      {/* Announcements & Updates */}
      <section className="announcements-section mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="section-title mb-0"><Bell size={18} className="me-2 text-primary-green" /> Pengumuman</h5>
          {announcements.length > 2 && (
            <button className="btn-link-custom tiny font-weight-bold" onClick={() => setShowAnnModal(true)}>LIHAT SEMUA</button>
          )}
        </div>
        <div className="announcement-grid">
          {announcements.length > 0 ? (
            announcements.slice(0, 2).map((ann) => (
              <Card 
                key={ann._id} 
                className="border-0 shadow-sm mb-2 ann-modern-card clickable"
                onClick={() => handleShowAnnouncement(ann)}
              >
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-start mb-1 flex-wrap gap-1">
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="ann-title-text mb-0 text-primary-green">{ann.title}</h6>
                      {ann.targetRole && ann.targetRole !== 'all' && (
                        <Badge bg="info" text="dark" className="tiny fw-normal rounded-pill">
                          Khusus
                        </Badge>
                      )}
                    </div>
                    <span className="tiny text-muted">{new Date(ann.createdAt).toLocaleDateString('id-ID')}</span>
                  </div>
                  <p className="ann-content-preview small text-muted mb-0">{ann.content}</p>
                  <div className="text-end mt-1">
                    <span className="tiny text-primary-green font-weight-bold">Baca Selengkapnya →</span>
                  </div>
                </Card.Body>
              </Card>
            ))
          ) : (
            <div className="text-center py-4 bg-light rounded-lg">
              <p className="small text-muted mb-0">Belum ada pengumuman terbaru.</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal Detail Pengumuman */}
      <Modal show={showAnnModal && !!selectedAnnouncement} onHide={() => setShowAnnModal(false)} centered scrollable>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h6 font-weight-bold text-primary-green">Detail Pengumuman</Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selectedAnnouncement && (
            <div className="ann-detail">
              <h5 className="font-weight-bold mb-1">{selectedAnnouncement.title}</h5>
              <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                <Badge bg="light" className="text-muted tiny">
                  {new Date(selectedAnnouncement.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Badge>
                <Badge bg="light" className="text-muted tiny">Oleh Admin</Badge>
                {selectedAnnouncement.targetRole && selectedAnnouncement.targetRole !== 'all' ? (
                  <Badge bg="info" text="dark" className="tiny rounded-pill">
                    Penerima: {selectedAnnouncement.targetRole.toUpperCase()}
                  </Badge>
                ) : (
                  <Badge bg="secondary" className="tiny rounded-pill">
                    Penerima: Semua
                  </Badge>
                )}
              </div>
              <div className="ann-full-content text-muted small" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {selectedAnnouncement.content}
              </div>
            </div>
          )}
          
          {/* List All if triggered by View All */}
          {!selectedAnnouncement && announcements.map(ann => (
             <div key={ann._id} className="p-3 border-bottom clickable" onClick={() => setSelectedAnnouncement(ann)}>
               <h6 className="mb-1 font-weight-bold">{ann.title}</h6>
               <p className="tiny text-muted mb-0">{new Date(ann.createdAt).toLocaleDateString('id-ID')}</p>
             </div>
          ))}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="light" className="rounded-pill px-4" onClick={() => {
            if (selectedAnnouncement && announcements.length > 1) setSelectedAnnouncement(null);
            else setShowAnnModal(false);
          }}>
            {selectedAnnouncement && announcements.length > 1 ? 'Kembali ke Daftar' : 'Tutup'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* PWA: Offline / Location Notice */}
      <div className="mt-4 p-3 bg-white border rounded-lg d-flex align-items-center gap-3">
        <AlertCircle size={20} className="text-warning" />
        <p className="small mb-0 text-muted">Aplikasi ini mendukung mode offline. Absen masuk/pulang yang dibuat tanpa koneksi akan dikirim otomatis saat kembali online.</p>
      </div>

      {/* Entry Modal: clock-in/out notes / Sakit-Izin reason */}
      <Modal show={showEntryModal} onHide={() => setShowEntryModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold d-flex align-items-center gap-2">
            {entryAction === 'clock-in' ? <LogIn size={20} className="text-primary-green" /> : entryAction === 'clock-out' ? <LogOutIcon size={20} className="text-warning" /> : entryAction === 'Sakit' ? <Stethoscope size={20} className="text-warning" /> : <CalendarClock size={20} className="text-info" />}
            {entryAction === 'clock-in' ? 'Konfirmasi Absen Masuk' : entryAction === 'clock-out' ? 'Konfirmasi Absen Pulang' : `Laporan ${entryAction}`}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <p className="small text-muted mb-3">
            {entryAction === 'clock-in'
              ? 'Tambahkan catatan (opsional) seperti keterangan keterlambatan atau keperluan luar sebelum validasi lokasi.'
              : entryAction === 'clock-out'
              ? 'Tambahkan catatan (opsional) seperti keterangan pulang lebih awal sebelum validasi lokasi.'
              : `Jelaskan alasan ${entryAction} Anda. Laporan ini akan direview oleh admin.`}
          </p>
          <Form.Group>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={500}
              value={entryNotes}
              onChange={(e) => setEntryNotes(e.target.value)}
              placeholder={entryAction === 'clock-in' ? 'Contoh: Keterlambatan karena hujan deras...' : entryAction === 'clock-out' ? 'Contoh: Pulang lebih awal karena ada keperluan mendesak...' : 'Contoh: Periksa ke dokter, anak sakit, ada kepentingan keluarga...'}
              className="bg-light border-0 rounded-12"
            />
            <Form.Text className="text-muted text-end d-block mt-1">{entryNotes.length}/500</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 d-flex justify-content-center pb-4">
          <Button variant="light" className="rounded-pill px-4" onClick={() => setShowEntryModal(false)}>
            Batal
          </Button>
          <Button
            variant={entryAction === 'clock-in' ? 'success' : entryAction === 'clock-out' ? 'warning' : 'primary'}
            className="rounded-pill px-4 fw-bold"
            onClick={handleEntryModalConfirm}
            disabled={isSubmitting}
          >
            {entryAction === 'clock-in' || entryAction === 'clock-out' ? 'Konfirmasi & Absen' : `Kirim Laporan ${entryAction}`}
          </Button>
        </Modal.Footer>
      </Modal>

      <div id="full-history" className="history-section mt-5 border-top pt-4">
        <PersonalAttendanceReport attendance={attendance} workTimeRecords={workTimeRecords} user={user} />
      </div>
    </Container>
  );
};

export default MainApp;
