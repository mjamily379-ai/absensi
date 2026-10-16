import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api, { fetchAttachmentBlobUrl } from './api';
import Select from 'react-select';
import { AdminSummary } from './AdminSummary';
import { AdminCharts, AdminChartsRef } from './AdminCharts';
import AdminAnalytics from './AdminAnalytics';
import AdminAttendanceMatrix from './AdminAttendanceMatrix';
import { Modal, Button, Form, Badge, Tooltip, OverlayTrigger, Tabs, Tab, Row, Col, Card, InputGroup, Spinner } from 'react-bootstrap';
import { Download, Search, PlusCircle, Edit2, Trash2, Calendar, FileText, Settings, History as HistoryIcon, UserPlus, CheckCircle, Clock, Activity, Camera, Megaphone, MapPin, Bell, FileSpreadsheet } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import HolidaySettings from './HolidaySettings';
import WorkDaySettings from './WorkDaySettings';
import RamadanSettings from './RamadanSettings';
import type { Attendance, Staff, User, EditedBy, WorkTimeRecord, LeaveRequest, RecordWithStaff, Holiday, RamadanPeriod, CorrectionRequest } from './types';
import { ROLE_LABELS, ROLE_OPTIONS, MONTHS_ID, DAYS_ID_SUNDAY_FIRST } from './constants/roles';
 // Import Attendance


interface AdminDashboardProps {}

const AdminDashboard: React.FC<AdminDashboardProps> = () => {
  // All State declarations
  const [attendanceRecords, setAttendances] = useState<Attendance[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');
  const [historySortColumn, setHistorySortColumn] = useState<string>('date');
  const [historySortDirection, setHistorySortDirection] = useState<'asc' | 'desc'>('desc');
  const [workTimeRecords, setWorkTimeRecords] = useState<WorkTimeRecord[]>([]);
  const [selectedMonth, setselectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currentRecord, setCurrentRecord] = useState<Attendance | null>(null);
  const [formData, setFormData] = useState({
    staffId: '', name: '', status: 'Hadir' as Attendance['status'], date: '', time: '',
    clockInTime: '', clockOutTime: '', notes: '',
  });

  const [isWorkTimeModalOpen, setIsWorkTimeModalOpen] = useState(false);
  const [workTimeModalMode, setWorkTimeModalMode] = useState<'add' | 'edit'>('add');
  const [workTimeFormData, setWorkTimeFormData] = useState({
    staffId: '', name: '', date: '', clockInTime: '', clockOutTime: '', notes: '',
  });

  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{ _id?: string; staffId: string; date: string } | null>(null);
  const [showDeleteRecordModal, setShowDeleteRecordModal] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState<string | null>(null);
  const [rawRecordsDate, setRawRecordsDate] = useState(new Date());

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [currentPhotoUser, setCurrentPhotoUser] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const photoBlobRef = useRef<string>('');
  const photoAbortRef = useRef<AbortController | null>(null);
  
  // Data states
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
  const [allRecords, setAllRecords] = useState<RecordWithStaff[]>([]);
  const [rawRecords, setRawRecords] = useState<RecordWithStaff[]>([]);
  const [todaysRecords, setTodaysRecords] = useState<RecordWithStaff[]>([]);
  const [workDaySettings, setWorkDaySettings] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [ramadanPeriods, setRamadanPeriods] = useState<RamadanPeriod[]>([]);
  const chartsRef = useRef<AdminChartsRef>(null);
  const [pendingLeaveRequests, setPendingLeaveRequests] = useState<LeaveRequest[]>([]); // New state

  // Correction Modal State
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [recordToCorrect, setRecordToCorrect] = useState<RecordWithStaff | null>(null);
  const [correctionFormData, setCorrectionFormData] = useState({ timestamp: '', notes: '' });

  // Add Clock-Out Modal State
  const [isAddClockOutModalOpen, setIsAddClockOutModalOpen] = useState(false);
  const [recordForClockOut, setRecordForClockOut] = useState<RecordWithStaff | null>(null);
  const [addClockOutFormData, setAddClockOutFormData] = useState({ clockOutTime: '', notes: '' });

  // Bulk Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRole, setExportRole] = useState('all');
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [exportIncludeIndividual, setExportIncludeIndividual] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Correction Requests State
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [selectedCorrToReview, setSelectedCorrToReview] = useState<CorrectionRequest | null>(null);
  const [corrReviewAction, setCorrReviewAction] = useState<'approved' | 'rejected'>('approved');
  const [corrAdminNotes, setCorrAdminNotes] = useState('');
  const [showCorrReviewModal, setShowCorrReviewModal] = useState(false);
  const [isCorrReviewing, setIsCorrReviewing] = useState(false);

  // KPI drill-down (from AdminSummary clickable cards via ?kpi=in|late|notin)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKpi = searchParams.get('kpi');

  const kpiStaffList = useMemo(() => {
    const dateString = new Date().toLocaleDateString('en-CA');
    const dayName = DAYS_ID_SUNDAY_FIRST[new Date().getDay()] || '';
    const isRamadan = (ramadanPeriods || []).some(p => dateString >= p.startDate && dateString <= p.endDate);

    const clockInTimes = new Map<string, Date>();
    (todaysRecords || []).forEach(r => {
      if (r.type === 'clock-in') {
        const sid = typeof r.staffId === 'object' && r.staffId !== null ? r.staffId._id : r.staffId;
        clockInTimes.set(sid, new Date(r.timestamp));
      }
    });

    const otherAttendanceIds = new Set<string>();
    (allAttendance || [])
      .filter(a => a.date === dateString && (a.status === 'Sakit' || a.status === 'Izin' || a.status === 'Cuti'))
      .forEach(a => {
        const sid = typeof a.staffId === 'object' && a.staffId !== null ? a.staffId._id : a.staffId;
        if (sid) otherAttendanceIds.add(sid);
      });

    const inList: { id: string; name: string }[] = [];
    const lateList: { id: string; name: string }[] = [];
    const notinList: { id: string; name: string }[] = [];

    (staff || []).forEach(s => {
      const user = users.find(u => {
        const sid = typeof u.staffId === 'object' && u.staffId !== null ? u.staffId._id : u.staffId;
        return sid === s._id;
      });
      if (!user || user.role === 'admin') return;
      const userStaffId = typeof user.staffId === 'object' && user.staffId !== null ? user.staffId._id : user.staffId;
      if (!userStaffId) return;
      const wd = (workDaySettings || []).find(ws => ws.role === user.role && ws.day === dayName);
      if (!wd || !wd.isWorkDay) return;

      const clockedIn = clockInTimes.has(userStaffId);
      if (clockedIn) {
        inList.push({ id: userStaffId, name: user.name });
        const startStr = (isRamadan && wd.ramadanStartTime) ? wd.ramadanStartTime : wd.startTime;
        const [sh, sm] = (startStr || '00:00').split(':').map(Number);
        const t = clockInTimes.get(userStaffId)!;
        if (t.getHours() > sh || (t.getHours() === sh && t.getMinutes() > sm)) {
          lateList.push({ id: userStaffId, name: user.name });
        }
      } else if (!otherAttendanceIds.has(userStaffId)) {
        notinList.push({ id: userStaffId, name: user.name });
      }
    });

    return { in: inList, late: lateList, notin: notinList };
  }, [users, todaysRecords, allAttendance, staff, workDaySettings, ramadanPeriods]);

  useEffect(() => {
    // Auto-select the first staff of the active KPI only when the current
    // selection is no longer part of that list (initial load, KPI switch, or a
    // refresh moved the staff to another list). A manual selection is preserved
    // across data refreshes instead of being silently flipped.
    const activeList = kpiStaffList[activeKpi as keyof typeof kpiStaffList] || [];
    if (!activeList.some(s => s.id === selectedStaffId) && activeList.length) {
      setSelectedStaffId(activeList[0].id);
    }
  }, [activeKpi, kpiStaffList, selectedStaffId]);

  const kpiTitles: Record<string, string> = { in: 'Hadir Saat Ini', late: 'Terlambat', notin: 'Belum Absen' };

  // Helper Functions
  const getLoggedInUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  };

  const fetchCorrectionRequests = () => {
    api.get('/api/correction-requests')
      .then(res => setCorrectionRequests(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error('Error fetching correction requests:', err));
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

  const handleCorrExport = async (format: 'xlsx' | 'csv') => {
    try {
      const params = new URLSearchParams({ format });
      const response = await api.get(`/api/export-corrections?${params.toString()}`, { responseType: 'blob' });
      const disposition = String(response.headers?.['content-disposition'] || '');
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `Laporan_Koreksi_Absensi.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      downloadBlob(response.data as Blob, filename);
      toast.success('Laporan koreksi berhasil diunduh!');
    } catch (err) {
      console.error('Error exporting corrections:', err);
      toast.error('Gagal mengekspor laporan koreksi.');
    }
  };

  const fetchTodaysRecords = () => {
    api.get('/api/records/today')
      .then(response => setTodaysRecords(response.data))
      .catch(error => console.error("Error fetching today's records:", error));
  };

  const fetchRawRecords = (date: Date) => {
    const dateString = date.toLocaleDateString('en-CA');
    api.get(`/api/records/by-date?date=${dateString}`)
      .then(response => setRawRecords(response.data))
      .catch(error => console.error("Error fetching raw records:", error));
  };


  const extractYear = (value: string | Date | undefined | null): number | undefined => {
    if (value == null || value === '') return undefined;
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4})/);
      if (match) return parseInt(match[1], 10);
    }
    const year = new Date(value).getFullYear();
    return Number.isFinite(year) ? year : undefined;
  };

  // The server returns already-computed daily status per staff (matrix),
  // so we no longer run an O(staff x 365) Alpha generation loop in the browser.
  const STATUS_MAP: Record<string, Attendance['status']> = {
    H: 'Hadir', S: 'Sakit', I: 'Izin', C: 'Cuti', A: 'Alpha',
  };

  const flattenMatrix = (rows: any[]): Attendance[] => {
    const result: Attendance[] = [];
    for (const row of rows) {
      if (!row.days) continue;
      for (const [date, cell] of Object.entries(row.days)) {
        const entry = cell as { ch?: string; id?: string } | string;
        const ch = typeof entry === 'string' ? entry : entry.ch;
        if (!ch) continue;
        const id = typeof entry === 'object' && entry.id ? entry.id : `${row.staffId}-${date}-${ch}`;
        result.push({
          _id: id,
          staffId: row.staffId,
          name: row.name,
          status: STATUS_MAP[ch] || 'Hadir',
          date,
          time: ch === 'A' ? '00:00' : 'N/A',
        });
      }
    }
    return result;
  };

  const fetchBaseData = async () => {
    try {
      const [
        staffResponse,
        usersResponse,
        workDaySettingsResponse,
        holidaysResponse,
        allRecordsResponse,
        ramadanResponse,
      ] = await Promise.all([
        api.get('/api/staff'),
        api.get('/api/users'),
        api.get('/api/workday/all'),
        api.get(`/api/holidays?year=${new Date().getFullYear()}`),
        api.get('/api/records/all-records'),
        api.get('/api/ramadan'),
      ]);

      setStaff(staffResponse.data);
      setUsers(usersResponse.data);
      setWorkDaySettings(workDaySettingsResponse.data);
      setHolidays(holidaysResponse.data);
      setAllRecords(allRecordsResponse.data);
      setRamadanPeriods(ramadanResponse.data);
    } catch (error) {
      console.error("Error fetching base data:", error);
    }
  };

  const fetchAllAttendance = async (year: number) => {
    try {
      const response = await api.get(`/api/attendance/matrix?year=${year}`);
      const rows = Array.isArray(response.data) ? response.data : response.data?.data;
      setAllAttendance(flattenMatrix(Array.isArray(rows) ? rows : []));
    } catch (error) {
      console.error("Error fetching attendance matrix:", error);
    }
  };

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    allAttendance.forEach(a => {
      const year = extractYear(a.date);
      if (year) years.add(year);
    });
    allRecords.forEach(r => {
      const year = extractYear(r.timestamp);
      if (year) years.add(year);
    });
    workTimeRecords.forEach(w => {
      const year = extractYear(w.date);
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [allAttendance, allRecords, workTimeRecords]);

  // useEffect Hooks
  useEffect(() => {
    fetchBaseData();
    fetchTodaysRecords();
    fetchCorrectionRequests();

    // Fetch pending leave requests
    api.get('/api/leave-requests')
        .then(response => {
            const data = Array.isArray(response.data) ? response.data : [];
            const pending = data.filter((req: LeaveRequest) => req.status === 'pending');
            setPendingLeaveRequests(pending);
        })
        .catch(error => console.error("Error fetching leave requests:", error));
  }, []); // Empty dependency array means it runs once on mount

  // Server-side attendance matrix follows the selected year (replaces the old client loop)
  useEffect(() => {
    fetchAllAttendance(selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    fetchRawRecords(rawRecordsDate);
  }, [rawRecordsDate]);

  const fetchSelectedStaffWorkTime = (staffId: string) => {
    return api.get(`/api/records/${staffId}`)
      .then((response) => {
        setWorkTimeRecords(Array.isArray(response.data) ? response.data : []);
      })
      .catch((err) => {
        console.error('Error fetching work time records:', err);
        setWorkTimeRecords([]);
      });
  };

  useEffect(() => {
    if (selectedStaffId) {
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(selectedStaffId);
      if (isValidObjectId) {
        fetchSelectedStaffWorkTime(selectedStaffId);

        const filteredAttendance = allAttendance.filter((record: Attendance) => {
          const recStaffId = typeof (record as any).staffId === 'object' && (record as any).staffId !== null
            ? (record as any).staffId._id
            : (record as any).staffId;
          return recStaffId === selectedStaffId;
        });
        setAttendances(filteredAttendance);
      } else {
        console.warn('Invalid selectedStaffId:', selectedStaffId, 'preventing API call.');
        setWorkTimeRecords([]);
        setAttendances([]);
      }
    } else {
      setAttendances([]);
      setWorkTimeRecords([]);
    }
  }, [selectedStaffId, allAttendance]);

  // All handler functions
  const handleExport = async () => {
    if (selectedStaffId) {
        const staffIdParam = `staffId=${selectedStaffId}`;
        const monthParam = selectedMonth !== -1 ? `month=${selectedMonth + 1}` : '';
        const yearParam = selectedYear !== -1 ? `year=${selectedYear}` : '';
        const params = [staffIdParam, monthParam, yearParam].filter(Boolean).join('&');
        
        try {
            const response = await api.get(`/api/export-personal-excel?${params}`, { 
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const staffName = staff.find(s => s._id === selectedStaffId)?.name || 'Staff';
            link.setAttribute('download', `Laporan_Absensi_${staffName.replace(/\s+/g, '_')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting personal excel:', error);
            toast.error('Gagal mengekspor laporan staff.');
        }
        return;
    }

    setExportMonth(selectedMonth);
    setExportYear(selectedYear);
    setExportRole('all');
    setExportIncludeIndividual(true);
    setShowExportModal(true);
  };

  const handleExecuteBulkExport = async () => {
    setIsExporting(true);
    let pieChartImage = null;
    let barChartImage = null;
    if (chartsRef.current) {
      const chartImgs = chartsRef.current.getChartImages();
      pieChartImage = chartImgs.pieChartImage;
      barChartImage = chartImgs.barChartImage;
    }

    const payload = {
        month: exportMonth !== -1 ? exportMonth + 1 : null,
        year: exportYear !== -1 ? exportYear : null,
        role: exportRole,
        includeIndividualSheets: exportIncludeIndividual,
        pieChartImage,
        barChartImage
    };

    try {
        const response = await api.post('/api/export-excel', payload, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const roleSuffix = exportRole !== 'all' ? `_${exportRole.replace(/\s+/g, '_')}` : '';
        const monthSuffix = exportMonth !== -1 ? `_${exportMonth + 1}-${exportYear}` : `_${exportYear}`;
        link.setAttribute('download', `Laporan_Absensi_Bulk${roleSuffix}${monthSuffix}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setShowExportModal(false);
        toast.success('Laporan Excel bulk berhasil diunduh!');
    } catch (error) {
        console.error('Error exporting bulk excel:', error);
        toast.error('Gagal mengekspor laporan bulk Excel.');
    } finally {
        setIsExporting(false);
    }
  };

  const handleOpenCorrReview = (req: CorrectionRequest, action: 'approved' | 'rejected') => {
    setSelectedCorrToReview(req);
    setCorrReviewAction(action);
    setCorrAdminNotes('');
    setShowCorrReviewModal(true);
  };

  const handleReviewCorrection = async () => {
    if (!selectedCorrToReview) return;
    setIsCorrReviewing(true);
    try {
      const response = await api.put(`/api/correction-requests/${selectedCorrToReview._id}/review`, {
        status: corrReviewAction,
        adminNotes: corrAdminNotes
      });
      toast.success(response.data.message || `Pengajuan koreksi berhasil ${corrReviewAction === 'approved' ? 'disetujui' : 'ditolak'}.`);
      setShowCorrReviewModal(false);
      setCorrAdminNotes('');
      fetchCorrectionRequests();
      fetchAllAttendance(selectedYear);
      fetchTodaysRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memproses review koreksi.');
    } finally {
      setIsCorrReviewing(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) {
        toast.warn('Admin not logged in!');
        return;
    }

    if (formData.status === 'Hadir' && (modalMode === 'add' || currentRecord?.status !== 'Hadir')) {
      if (!formData.clockInTime || !formData.clockOutTime) {
        toast.warn('Untuk status "Hadir", jam masuk dan jam pulang wajib diisi.');
        return;
      }
      const payload = {
        staffId: formData.staffId, name: formData.name, date: formData.date,
        clockInTime: formData.clockInTime, clockOutTime: formData.clockOutTime,
        notes: formData.notes || `Status diubah menjadi Hadir`,
        adminId: loggedInUser._id || loggedInUser.id
      };
      try {
        await api.post('/api/records/manual', payload);
        fetchAllAttendance(selectedYear);
        if (selectedStaffId) fetchSelectedStaffWorkTime(selectedStaffId);
        fetchRawRecords(rawRecordsDate);
        fetchTodaysRecords();
        handleCloseModal();
        toast.success('Status berhasil diubah menjadi Hadir dan jam kerja telah dicatat.');
      } catch (error) {
        console.error('Error upgrading status to Hadir:', error);
        toast.error('Gagal menyimpan perubahan status.');
      }
      return;
    }

    // Pastikan `time` terisi untuk status non-Hadir (Sakit, Izin, Cuti, Alpha)
    const finalTime = formData.status !== 'Hadir'
      ? (formData.time && formData.time !== 'N/A' ? formData.time : '00:00')
      : (formData.time && formData.time !== 'N/A' ? formData.time : '00:00');
    const payload = { ...formData, time: finalTime, name: formData.name || staff.find(s => s._id === formData.staffId)?.name || '', fromAdmin: true };
    try {
      if (modalMode === 'edit' && currentRecord) {
        const attendanceId = /^[0-9a-fA-F]{24}$/.test(currentRecord._id) ? currentRecord._id : 'status';
        await api.put(`/api/attendance/${attendanceId}`, payload);
      } else {
        await api.post('/api/attendance', payload);
      }
      fetchAllAttendance(selectedYear);
      if (selectedStaffId) fetchSelectedStaffWorkTime(selectedStaffId);
      fetchRawRecords(rawRecordsDate);
      fetchTodaysRecords();
      handleCloseModal();
      toast.success(`Status ${formData.status} berhasil disimpan.`);
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error.response?.data?.message || 'Gagal menyimpan kehadiran.');
    }
  };

  const handleWorkTimeFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) {
      toast.warn('Admin not logged in. Please log in again.');
      return;
    }
    const staffName = staff.find(s => s._id === workTimeFormData.staffId)?.name;
    if (!staffName) {
      toast.warn('Invalid staff selected.');
      return;
    }

    if (!workTimeFormData.clockInTime && !workTimeFormData.clockOutTime) {
      toast.warn('Harap isi setidaknya jam masuk atau jam pulang.');
      return;
    }
    const payload = { ...workTimeFormData, name: staffName, adminId: loggedInUser._id };
    try {
      if (workTimeModalMode === 'add') {
        await api.post('/api/records/manual', payload);
        fetchAllAttendance(selectedYear);
        fetchRawRecords(rawRecordsDate);
        fetchTodaysRecords();
        toast.success('Absensi manual berhasil disimpan.');
      } else {
        toast.info('Fungsi edit belum diimplementasikan di modal ini. Gunakan fitur Koreksi.');
      }
      handleCloseWorkTimeModal();
    } catch (error) {
      console.error('Error submitting manual attendance form:', error);
      toast.error('Gagal menyimpan data absensi manual.');
    }
  };

  const handleCorrectionFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser || !recordToCorrect) {
        toast.warn('Sesi admin tidak valid atau tidak ada data dipilih.');
        return;
    }
    const payload = { ...correctionFormData, adminId: loggedInUser._id };
    try {
      await api.put(`/api/records/${recordToCorrect._id}/koreksi`, payload);
      fetchRawRecords(rawRecordsDate);
      fetchTodaysRecords();
      fetchAllAttendance(selectedYear); // Re-fetch all attendance to recalculate Alpha status
      handleCloseCorrectionModal();
      toast.success('Data berhasil dikoreksi!');
    } catch (error) {
      console.error('Error correcting record:', error);
      toast.error('Gagal mengoreksi data.');
    }
  };

  const handleAddClockOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser || !recordForClockOut) {
        toast.warn('Sesi admin tidak valid atau tidak ada data dipilih.');
        return;
    }
    if (!addClockOutFormData.clockOutTime || !addClockOutFormData.notes) {
        toast.warn('Jam Pulang dan Catatan wajib diisi.');
        return;
    }
    const payload = {
        ...addClockOutFormData,
        staffId: recordForClockOut.staffId._id, // Simplified staffId extraction
        date: new Date(recordForClockOut.timestamp).toLocaleDateString('en-CA'),
        adminId: loggedInUser._id
    };

    try {
        await api.post('/api/records/add-clock-out', payload);
        fetchRawRecords(rawRecordsDate);
        fetchTodaysRecords();
        fetchAllAttendance(selectedYear); // Re-fetch all attendance to recalculate Alpha status
        handleCloseAddClockOutModal();
        toast.success('Absen pulang berhasil ditambahkan.');
    } catch (error) {
        console.error('Error adding clock out:', error);
        toast.error('Gagal menambahkan absen pulang.');
    }
  };

  // Other handlers...
  const handleOpenModal = (mode: 'add' | 'edit', record: Attendance | null = null) => {
    setModalMode(mode);
    setCurrentRecord(record);
    if (mode === 'edit' && record) {
      const recStaffId = typeof (record as any).staffId === 'object' && (record as any).staffId !== null
        ? (record as any).staffId._id
        : record.staffId;
      setFormData({
        staffId: recStaffId || selectedStaffId || '',
        name: record.name || staff.find(s => s._id === (recStaffId || selectedStaffId))?.name || '',
        status: record.status,
        date: record.date,
        time: record.time || 'N/A',
        clockInTime: '', clockOutTime: '', notes: ''
      });
    } else {
      const today = new Date();
      setFormData({
        staffId: selectedStaffId || '', name: staff.find(s => s._id === selectedStaffId)?.name || '',
        status: 'Hadir', date: today.toLocaleDateString('en-CA'), time: today.toTimeString().slice(0, 8),
        clockInTime: '', clockOutTime: '', notes: ''
      });
    }
    setIsModalOpen(true);
  };
  const handleCloseModal = () => setIsModalOpen(false);
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as any }));
  };
  const handleOpenWorkTimeModal = (mode: 'add' | 'edit', record: WorkTimeRecord | null = null) => {
    setWorkTimeModalMode(mode);
    if (mode === 'edit' && record) {
      setWorkTimeFormData({
        staffId: record.staffId, name: record.name, date: record.date,
        clockInTime: record.clockInTime, clockOutTime: record.clockOutTime, notes: record.notes || ''
      });
    } else {
      setWorkTimeFormData({
        staffId: selectedStaffId || '', name: staff.find(s => s._id === selectedStaffId)?.name || '',
        date: new Date().toLocaleDateString('en-CA'), clockInTime: '', clockOutTime: '', notes: ''
      });
    }
    setIsWorkTimeModalOpen(true);
  };
  const handleCloseWorkTimeModal = () => setIsWorkTimeModalOpen(false);
  const handleWorkTimeFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setWorkTimeFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleOpenCorrectionModal = (record: RecordWithStaff) => {
    setRecordToCorrect(record);
    const localTimestamp = new Date(new Date(record.timestamp).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setCorrectionFormData({ timestamp: localTimestamp, notes: record.notes || '' });
    setIsCorrectionModalOpen(true);
  };
  const handleCloseCorrectionModal = () => {
    setIsCorrectionModalOpen(false);
    setRecordToCorrect(null);
  };

  const handleOpenAddClockOutModal = (record: RecordWithStaff) => {
    setRecordForClockOut(record);
    setAddClockOutFormData({ clockOutTime: '', notes: '' });
    setIsAddClockOutModalOpen(true);
  };

  const releasePhoto = useCallback(() => {
    photoAbortRef.current?.abort();
    photoAbortRef.current = null;
    if (photoBlobRef.current) {
      URL.revokeObjectURL(photoBlobRef.current);
      photoBlobRef.current = '';
    }
  }, []);

  const closePhotoModal = useCallback(() => {
    setShowPhotoModal(false);
    setCurrentPhoto(null);
    releasePhoto();
  }, [releasePhoto]);

  useEffect(() => releasePhoto, [releasePhoto]);

  // Attendance photos are served from the API host, which is a different subdomain
  // in production and answers with `Cross-Origin-Resource-Policy: same-origin`.
  // A direct <img src> on the API origin is therefore rejected by the browser, so
  // pull it through the authenticated client and preview the resulting blob URL.
  const handleShowPhoto = async (photo: string, name: string, recordId: string) => {
    releasePhoto();
    setCurrentPhotoUser(name);
    setCurrentPhoto(null);
    setShowPhotoModal(true);

    // Legacy rows still embed base64 in the document — usable as-is.
    if (!photo.startsWith('/uploads/')) {
      setCurrentPhoto(photo);
      return;
    }

    setIsPhotoLoading(true);
    const controller = new AbortController();
    photoAbortRef.current = controller;
    try {
      const { url } = await fetchAttachmentBlobUrl(`/api/records/${recordId}/photo`, controller.signal);
      if (controller.signal.aborted) {
        URL.revokeObjectURL(url);
        return;
      }
      photoBlobRef.current = url.startsWith('blob:') ? url : '';
      setCurrentPhoto(url);
    } catch (error: any) {
      if (controller.signal.aborted || error?.name === 'CanceledError') return;
      toast.error('Gagal memuat foto absensi.');
    } finally {
      if (!controller.signal.aborted) setIsPhotoLoading(false);
    }
  };

  const handleCloseAddClockOutModal = () => {
    setIsAddClockOutModalOpen(false);
    setRecordForClockOut(null);
  };
  const handleCorrectionFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCorrectionFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleAddClockOutFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setAddClockOutFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleHistorySort = (column: string) => {
    if (historySortColumn === column) {
      setHistorySortDirection(historySortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setHistorySortColumn(column);
      setHistorySortDirection('asc');
    }
  };
  const openDeleteModal = (record: { _id?: string; staffId: string; date: string }) => {
    setRecordToDelete(record);
    setShowDeleteModal(true);
  };
  const closeDeleteModal = () => {
    setRecordToDelete(null);
    setShowDeleteModal(false);
  };
  const handleDelete = async () => {
    if (recordToDelete) {
      try {
        const attendanceId = recordToDelete._id && /^[0-9a-fA-F]{24}$/.test(recordToDelete._id)
          ? recordToDelete._id
          : 'status';
        await api.delete(`/api/attendance/${attendanceId}`, {
          params: { staffId: recordToDelete.staffId, date: recordToDelete.date }
        });
        fetchAllAttendance(selectedYear);
        if (selectedStaffId) fetchSelectedStaffWorkTime(selectedStaffId);
        fetchRawRecords(rawRecordsDate);
        fetchTodaysRecords();
        toast.success('Data berhasil dihapus.');
      } catch (error) {
        toast.error('Gagal menghapus data.');
      } finally {
        closeDeleteModal();
      }
    }
  };

  const openDeleteRecordModal = (id: string) => {
    setRecordToDeleteId(id);
    setShowDeleteRecordModal(true);
  };

  const closeDeleteRecordModal = () => {
    setRecordToDeleteId(null);
    setShowDeleteRecordModal(false);
  };

  const handleDeleteRecord = async () => {
    if (recordToDeleteId) {
      try {
        await api.delete(`/api/records/${recordToDeleteId}`);
        fetchRawRecords(rawRecordsDate);
        fetchTodaysRecords();
        fetchAllAttendance(selectedYear); // Re-fetch all attendance to recalculate Alpha status
        toast.success('Data record berhasil dihapus.');
      } catch (error) {
        toast.error('Gagal menghapus data record.');
      } finally {
        closeDeleteRecordModal();
      }
    }
  };

  const renderStatusBadge = (status: 'normal' | 'manual_admin' | 'koreksi', notes?: string, edited_by?: EditedBy) => {
    const normalized = status || 'normal';
    const variant = normalized === 'manual_admin' ? 'info' : normalized === 'koreksi' ? 'warning' : 'secondary';
    const text = normalized === 'manual_admin' ? 'Manual' : normalized === 'koreksi' ? 'Koreksi' : 'Otomatis';
    const tooltip = (
      <Tooltip id={`tooltip-${normalized}`}>
        <strong>Entry status: {text}</strong>
        {edited_by?.name ? <><br />Oleh {edited_by.name}</> : null}
        {notes ? <><br />Notes: {notes}</> : null}
      </Tooltip>
    );
    return (
      <OverlayTrigger placement="top" overlay={tooltip}>
        <Badge bg={variant} className="ms-2">{text}</Badge>
      </OverlayTrigger>
    );
  };

  const renderKeteranganBadge = (keterangan: string) => {
    if (!keterangan || keterangan === '-' || keterangan === 'N/A') return keterangan;

    let variant: string;

    switch (keterangan) {
      case 'Datang Lebih Awal':
      case 'Tepat Waktu':
        variant = 'success';
        break;
      case 'Pulang Lebih Awal':
      case 'Terlambat':
        variant = 'warning';
        break;
      case 'Long Shift':
        variant = 'primary';
        break;
      case 'Hari Libur':
      case 'Hari Tidak Didefinisikan':
        variant = 'info';
        break;
          case 'Sakit':
            variant = 'warning';
            break;
          case 'Izin':
            variant = 'info';
            break;
          case 'Cuti':
            variant = 'primary';
            break;
          case 'Alpha':
            variant = 'danger';
            break;
          default:
            variant = 'secondary';
        }
      
        return <Badge bg={variant}>{keterangan}</Badge>;
      };
      const renderAttendanceStatusBadge = (status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpha' | 'Cuti' | '-') => {
        let variant: string;
        switch (status) {
          case 'Hadir':
            variant = 'success'; // Green for present
            break;
          case 'Sakit':
            variant = 'warning'; // Yellow for sick, consistent with PersonalAttendanceReport
            break;
          case 'Alpha':
            variant = 'danger'; // Red for unexplained absence
            break;
          case 'Izin':
            variant = 'info'; // Blue for permission, consistent with PersonalAttendanceReport
            break;
          case 'Cuti':
            variant = 'primary'; // Blue for official leave
            break;
          default:
            variant = 'secondary'; // Grey for undefined or other
        }
        return <Badge bg={variant}>{status}</Badge>;
      };
  // Derived data for rendering
  const attendanceByDate = new Map(attendanceRecords.map(a => [a.date, a]));
  const workTimeByDate = new Map(workTimeRecords.map(w => [w.date, w]));
  const allDates = Array.from(new Set([...attendanceRecords.map(a => a.date), ...workTimeRecords.map(r => r.date)]));
  
  const combinedHistory = allDates.map(date => {
    const attendanceRecord = attendanceByDate.get(date);
    const workTimeRecord = workTimeByDate.get(date);
    
    let status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpha' | 'Cuti' | '-' = '-';
    let keteranganMasuk = workTimeRecord?.keteranganMasuk || '';
    let keteranganPulang = workTimeRecord?.keteranganPulang || '';
    let entry_status: 'normal' | 'manual_admin' | 'koreksi' = workTimeRecord?.entry_status || 'normal';

    if (attendanceRecord && attendanceRecord.status && attendanceRecord.status !== 'Hadir') {
        status = attendanceRecord.status;
        keteranganMasuk = attendanceRecord.status;
        keteranganPulang = '';
        if (!workTimeRecord) {
          entry_status = /^[0-9a-fA-F]{24}$/.test(attendanceRecord._id) ? 'manual_admin' : 'normal';
        }
    } else if (workTimeRecord) {
        status = 'Hadir';
        keteranganMasuk = workTimeRecord.keteranganMasuk;
        keteranganPulang = workTimeRecord.keteranganPulang;
    } else if (attendanceRecord) {
        status = attendanceRecord.status;
        keteranganMasuk = attendanceRecord.status;
        keteranganPulang = '';
        if (attendanceRecord.status !== 'Alpha' && /^[0-9a-fA-F]{24}$/.test(attendanceRecord._id)) {
          entry_status = 'manual_admin';
        }
    } else {
        status = '-';
        keteranganMasuk = '-';
        keteranganPulang = '-';
    }

    return {
      date, status, keteranganMasuk, keteranganPulang,
      clockInTime: status === 'Hadir' ? (workTimeRecord?.clockInTime || '-') : '-',
      clockOutTime: status === 'Hadir' ? (workTimeRecord?.clockOutTime || '-') : '-',
      totalHours: status === 'Hadir' ? (workTimeRecord?.totalHours || '-') : '-',
      name: workTimeRecord?.name || attendanceRecord?.name || '',
      staffId: selectedStaffId || '',
      attendanceId: attendanceRecord?._id,
      time: attendanceRecord?.time || 'N/A',
      entry_status,
      notes: workTimeRecord?.notes,
      edited_by: workTimeRecord?.edited_by,
    };
  });

  const sortedCombinedHistory = [...combinedHistory]
    .filter(item => {
      const recordDate = new Date(item.date);
      const monthMatch = selectedMonth === -1 || recordDate.getMonth() === selectedMonth;
      const yearMatch = selectedYear === -1 || recordDate.getFullYear() === selectedYear;
      const searchMatch = Object.values(item).some(val => String(val).toLowerCase().includes(historySearchTerm.toLowerCase()));
      return monthMatch && yearMatch && searchMatch;
    })
    .sort((a, b) => {
      const aValue = a[historySortColumn as keyof typeof a];
      const bValue = b[historySortColumn as keyof typeof b];
      if (historySortColumn === 'date') {
        return historySortDirection === 'asc' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return historySortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return historySortDirection === 'asc' ? -1 : 1;
      if (aValue < bValue) return historySortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return historySortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const staffOptions = staff
    .filter(s => (s as any).name !== 'Administrator')
    .map(s => {
      const user = users.find(u => {
        const userStaffId = typeof (u as any).staffId === 'object' && (u as any).staffId !== null ? (u as any).staffId._id : (u as any).staffId;
        return userStaffId === (s as any)._id;
      });
      const role = user ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff';
      return { value: (s as any)._id, label: `${(s as any).name} (${role})` };
    });
    
  const rawRecordsClockOuts = new Set(
    rawRecords
      .filter(r => r.type === 'clock-out' && r.staffId?._id)
      .map(r => new Date(r.timestamp).toLocaleDateString('en-CA') + '-' + r.staffId._id)
  );

  // JSX Return
  return (
    <div className="container-fluid py-4 bg-light min-vh-100">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 font-jakarta font-weight-bold text-primary-green mb-1">Admin Dashboard</h1>
          <p className="text-muted small mb-0">Kelola kehadiran, pengaturan hari kerja, dan laporan staf.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button as={Link as any} to="/admin/announcements" variant="outline-primary" className="rounded-pill px-3 shadow-sm d-flex align-items-center">
            <Megaphone size={16} className="me-2" />
            Pengumuman
          </Button>
          <Button as={Link as any} to="/admin/audit-logs" variant="outline-secondary" className="rounded-pill px-3 shadow-sm d-flex align-items-center">
            <HistoryIcon size={16} className="me-2" />
            Audit Trail
          </Button>
          <Button as={Link as any} to="/admin/notification-settings" variant="outline-success" className="rounded-pill px-3 shadow-sm d-flex align-items-center">
            <Bell size={16} className="me-2" />
            Notifikasi
          </Button>
          <Button variant="success" className="rounded-pill px-4 shadow-sm d-flex align-items-center" onClick={handleExport}>
            <Download size={16} className="me-2" />
            {selectedStaffId ? 'Export Laporan Staff' : 'Export Laporan Global'}
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-4">
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Label className="small font-weight-bold text-muted text-uppercase mb-2">Pilih Staff Untuk Detail</Form.Label>
              <Select 
                id="staff-select" 
                classNamePrefix="react-select"
                options={staffOptions} 
                value={staffOptions.find(option => option.value === selectedStaffId)}
                onChange={(selectedOption) => setSelectedStaffId(selectedOption ? selectedOption.value : null)}
                isClearable 
                isSearchable 
                placeholder="Cari nama staff..." 
              />
            </Col>
            <Col md={5}>
              <Form.Label className="small font-weight-bold text-muted text-uppercase mb-2">Filter Periode Laporan</Form.Label>
              <div className="d-flex gap-2">
                <Form.Select className="rounded-12 border-light bg-light py-2" value={selectedMonth} onChange={(e) => setselectedMonth(parseInt(e.target.value))}>
                  <option value={-1}>Semua Bulan</option>
                  {MONTHS_ID.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </Form.Select>
                <Form.Select className="rounded-12 border-light bg-light py-2" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  <option value={-1}>Semua Tahun</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {activeKpi && kpiStaffList[activeKpi as keyof typeof kpiStaffList] && (
        <Card className="border-0 shadow-sm mb-3 rounded-12 overflow-hidden" style={{ borderLeft: '4px solid var(--accent-green)' }}>
          <Card.Body className="d-flex align-items-center gap-2 flex-wrap py-3 px-4 bg-emerald-light">
            <span className="fw-bold text-primary-green me-2">{kpiTitles[activeKpi] || activeKpi}:</span>
            {kpiStaffList[activeKpi as keyof typeof kpiStaffList].length > 0 ? (
              kpiStaffList[activeKpi as keyof typeof kpiStaffList].map(s => (
                <Button
                  key={s.id}
                  size="sm"
                  variant={selectedStaffId === s.id ? 'success' : 'light'}
                  className={`rounded-pill fw-bold shadow-sm ${selectedStaffId === s.id ? '' : 'border'}`}
                  onClick={() => setSelectedStaffId(s.id)}
                >
                  {s.name}
                </Button>
              ))
            ) : (
              <span className="text-muted small">Tidak ada staf pada kategori ini.</span>
            )}
            <Button
              size="sm"
              variant="link"
              className="ms-auto text-decoration-none fw-bold small px-2"
              onClick={() => { setSearchParams({}); setSelectedStaffId(null); }}
            >
              Reset
            </Button>
          </Card.Body>
        </Card>
      )}

      <Tabs defaultActiveKey="dashboard" id="admin-dashboard-tabs" className="mb-3">
        <Tab eventKey="dashboard" title="Dashboard">
          {!selectedStaffId ? (
            <>
              {pendingLeaveRequests.length > 0 && (
                <Card className="border-0 shadow-sm rounded-16 mb-4 overflow-hidden">
                  <Card.Header className="bg-primary-green p-3 border-0 d-flex justify-content-between align-items-center">
                    <h5 className="h6 mb-0 text-white d-flex align-items-center fw-bold">
                      <FileText size={18} className="me-2" /> Pengajuan Cuti Menunggu
                    </h5>
                    <Button variant="link" className="text-white p-0 small text-decoration-none fw-bold" href="/admin/leave-requests">
                      Kelola Semua <Activity size={14} className="ms-1" />
                    </Button>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <div className="list-group list-group-flush">
                      {pendingLeaveRequests.slice(0, 5).map(req => (
                        <div key={req._id} className="list-group-item d-flex justify-content-between align-items-center py-3 border-light bg-hover-light transition-all">
                          <div className="d-flex align-items-center">
                            <div className="avatar-circle-sm bg-emerald-light text-primary-green me-3 fw-bold shadow-sm">
                              {req.userId.name.charAt(0)}
                            </div>
                            <div>
                              <div className="fw-bold text-dark">{req.userId.name}</div>
                              <div className="small text-muted d-flex align-items-center gap-1">
                                <Badge bg="light" text="dark" className="border font-weight-normal">{req.leaveType}</Badge>
                                <span>•</span>
                                <Calendar size={12} />
                                {new Date(req.startDate).toLocaleDateString('id-ID')} - {new Date(req.endDate).toLocaleDateString('id-ID')}
                              </div>
                            </div>
                          </div>
                          <Badge bg="warning" text="dark" className="rounded-pill px-3 py-2 shadow-sm">Menunggu</Badge>
                        </div>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
              )}
              <AdminSummary users={users} todaysRecords={todaysRecords} workDaySettings={workDaySettings} allAttendance={allAttendance} staff={staff} ramadanPeriods={ramadanPeriods} />
              <AdminCharts ref={chartsRef} allAttendance={allAttendance} users={users} todaysRecords={todaysRecords} allRecords={allRecords} workDaySettings={workDaySettings} holidays={holidays} staff={staff} ramadanPeriods={ramadanPeriods} />
            </>
          ) : (
            <Card className="border-0 shadow-sm rounded-16 mb-4 overflow-hidden">
              <Card.Body className="p-4">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                  <div>
                    <h2 className="h4 font-weight-bold text-primary-green mb-1">
                      Riwayat Aktivitas: {staff.find(s => s._id === selectedStaffId)?.name || ''}
                    </h2>
                    <div className="d-flex align-items-center gap-2 mt-2">
                      <Badge bg="emerald-light" className="text-primary-green px-3 py-2 rounded-pill shadow-sm border-0">
                        <UserPlus size={14} className="me-1" />
                        Role: {(() => {
                          const matchedUser = users.find(u => {
                            const uStaffId = typeof u.staffId === 'object' && u.staffId !== null ? u.staffId._id : u.staffId;
                            return uStaffId === selectedStaffId;
                          });
                          const rawRole = matchedUser?.role;
                          if (!rawRole) return 'Staff';
                          return ROLE_LABELS[rawRole as keyof typeof ROLE_LABELS] || rawRole;
                        })()}
                      </Badge>
                      <Badge bg="light" text="dark" className="px-3 py-2 rounded-pill shadow-sm border">
                        ID: {selectedStaffId.slice(-6).toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <Button variant="primary" className="rounded-pill px-4 py-2 shadow-sm d-flex align-items-center gap-2 fw-bold" onClick={() => handleOpenModal('add')}>
                      <PlusCircle size={18} /> Kehadiran Manual
                    </Button>
                    <Button variant="outline-info" className="rounded-pill px-4 py-2 shadow-sm d-flex align-items-center gap-2 fw-bold" onClick={() => handleOpenWorkTimeModal('add')}>
                      <Clock size={18} /> Input Masuk/Pulang
                    </Button>
                  </div>
                </div>

                <div className="search-wrapper mb-4">
                  <InputGroup className="shadow-sm rounded-pill overflow-hidden border-0">
                    <InputGroup.Text className="bg-white border-0 ps-4">
                      <Search size={18} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control 
                      type="text" 
                      className="border-0 py-2 shadow-none" 
                      placeholder="Cari berdasarkan tanggal, status, atau keterangan..." 
                      value={historySearchTerm} 
                      onChange={(e) => setHistorySearchTerm(e.target.value)} 
                    />
                  </InputGroup>
                </div>

                <div className="table-responsive rounded-12 border shadow-sm">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="bg-light">
                      <tr>
                        <th className="border-0 py-3 ps-4" onClick={() => handleHistorySort('date')} style={{ cursor: 'pointer' }}
                            aria-sort={historySortColumn === 'date' ? (historySortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          <div className="d-flex align-items-center gap-2">Tanggal <HistoryIcon size={14} className="text-muted" /></div>
                        </th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('status')} style={{ cursor: 'pointer' }}
                            aria-sort={historySortColumn === 'status' ? (historySortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Status</th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('clockInTime')} style={{ cursor: 'pointer' }}
                            aria-sort={historySortColumn === 'clockInTime' ? (historySortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Jam Masuk</th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('clockOutTime')} style={{ cursor: 'pointer' }}
                            aria-sort={historySortColumn === 'clockOutTime' ? (historySortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Jam Pulang</th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('totalHours')} style={{ cursor: 'pointer' }}
                            aria-sort={historySortColumn === 'totalHours' ? (historySortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}>Total Jam</th>
                        <th className="border-0 py-3">Keterangan</th>
                        <th className="border-0 py-3 text-center pe-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCombinedHistory.length > 0 ? sortedCombinedHistory.map((item) => (
                        <tr key={item.date} className="transition-all">
                          <td className="ps-4 fw-bold text-dark">
                            {item.date} 
                            {renderStatusBadge(item.entry_status, item.notes, item.edited_by)}
                          </td>
                          <td>{renderAttendanceStatusBadge(item.status)}</td>
                          <td><code className="text-primary-green bg-emerald-light px-2 py-1 rounded small fw-bold">{item.clockInTime}</code></td>
                          <td><code className="text-primary-green bg-emerald-light px-2 py-1 rounded small fw-bold">{item.clockOutTime}</code></td>
                          <td>
                            <Badge bg="light" text="dark" className="border px-2 py-1">
                              <span className="fw-bold">{item.totalHours}</span>
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex gap-1 flex-wrap">
                              {renderKeteranganBadge(item.keteranganMasuk)}
                              {renderKeteranganBadge(item.keteranganPulang)}
                            </div>
                          </td>
                          <td className="text-center pe-4">
                            <div className="d-flex justify-content-center gap-2">
                              <Button
                                variant="outline-info"
                                size="sm"
                                className="border-0 rounded-circle p-2"
                                title="Edit status kehadiran"
                                onClick={() => handleOpenModal('edit', {
                                  _id: item.attendanceId || '',
                                  staffId: item.staffId || selectedStaffId || '',
                                  name: item.name,
                                  status: item.status === '-' ? 'Hadir' : item.status,
                                  date: item.date,
                                  time: item.time || 'N/A',
                                })}
                              >
                                <Edit2 size={16} />
                              </Button>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                className="border-0 rounded-circle p-2"
                                title="Hapus kehadiran"
                                onClick={() => openDeleteModal({
                                  _id: item.attendanceId,
                                  staffId: item.staffId || selectedStaffId || '',
                                  date: item.date,
                                })}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={7} className="text-center py-5 text-muted">
                          <HistoryIcon size={48} className="mb-3 opacity-25" />
                          <p>Tidak ada riwayat untuk ditampilkan.</p>
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
            </Card>
          )}
        </Tab>
        <Tab eventKey="workday-settings" title="Aturan Hari Kerja">
          <WorkDaySettings />
        </Tab>
        <Tab eventKey="holiday-settings" title="Pengaturan Hari Libur">
          <HolidaySettings />
        </Tab>
        <Tab eventKey="ramadan-settings" title="Pengaturan Ramadhan">
          <RamadanSettings />
        </Tab>
        <Tab 
          eventKey="correction-requests" 
          title={
            <div className="d-flex align-items-center gap-2">
              <span>Permintaan Koreksi</span>
              {correctionRequests.filter(c => c.status === 'pending').length > 0 && (
                <Badge bg="danger" pill style={{ fontSize: '0.7rem' }}>
                  {correctionRequests.filter(c => c.status === 'pending').length}
                </Badge>
              )}
            </div>
          }
        >
          <Card className="border-0 shadow-sm rounded-16 overflow-hidden">
            <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h5 className="mb-0 fw-bold text-primary-green d-flex align-items-center gap-2">
                  <Edit2 size={18} /> Daftar Pengajuan Koreksi Absensi Staf
                </h5>
                <small className="text-muted">Tinjau dan setujui permintaan koreksi jam masuk/pulang staf</small>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Button
                  variant="outline-success"
                  size="sm"
                  className="rounded-pill px-3 d-flex align-items-center gap-1"
                  onClick={() => handleCorrExport('xlsx')}
                >
                  <FileSpreadsheet size={14} /> Export Excel
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="rounded-pill px-3 d-flex align-items-center gap-1"
                  onClick={() => handleCorrExport('csv')}
                >
                  <Download size={14} /> Export CSV
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  className="rounded-pill px-3 d-flex align-items-center gap-1"
                  onClick={fetchCorrectionRequests}
                >
                  <HistoryIcon size={14} /> Refresh Data
                </Button>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {correctionRequests.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="bg-light">
                      <tr>
                        <th className="py-3 ps-4">Nama Staf</th>
                        <th className="py-3">Tanggal Absen</th>
                        <th className="py-3">Tipe</th>
                        <th className="py-3">Waktu Diajukan</th>
                        <th className="py-3">Alasan</th>
                        <th className="py-3 text-center">Status</th>
                        <th className="py-3">Catatan Admin</th>
                        <th className="py-3 text-center pe-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {correctionRequests.map((corr) => {
                        const staffName = (corr.staffId && typeof corr.staffId === 'object' ? corr.staffId.name : null) || corr.userId?.name || 'Staff';
                        const role = corr.userId?.role || 'Staff';

                        return (
                          <tr key={corr._id}>
                            <td className="ps-4 fw-bold text-dark">
                              <div>{staffName}</div>
                              <span className="small text-muted fw-normal text-capitalize">{role}</span>
                            </td>
                            <td>{new Date(corr.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td>
                              <Badge bg="light" text="dark" className="border fw-normal">
                                {corr.requestType === 'clock-in' ? 'Masuk' : corr.requestType === 'clock-out' ? 'Pulang' : 'Masuk & Pulang'}
                              </Badge>
                            </td>
                            <td className="small">
                              {corr.requestedClockIn && <div className="text-primary-green fw-bold">Masuk: {corr.requestedClockIn}</div>}
                              {corr.requestedClockOut && <div className="text-info fw-bold">Pulang: {corr.requestedClockOut}</div>}
                            </td>
                            <td>
                              <div className="small text-wrap" style={{ maxWidth: '200px' }}>
                                {corr.reason}
                              </div>
                            </td>
                            <td className="text-center">
                              {corr.status === 'pending' && (
                                <Badge bg="warning" text="dark" className="px-3 py-1 rounded-pill">
                                  Menunggu
                                </Badge>
                              )}
                              {corr.status === 'approved' && (
                                <Badge bg="success" className="px-3 py-1 rounded-pill">
                                  Disetujui
                                </Badge>
                              )}
                              {corr.status === 'rejected' && (
                                <Badge bg="danger" className="px-3 py-1 rounded-pill">
                                  Ditolak
                                </Badge>
                              )}
                            </td>
                            <td className="small text-muted">{corr.adminNotes || '-'}</td>
                            <td className="text-center pe-4">
                              {corr.status === 'pending' ? (
                                <div className="d-flex justify-content-center gap-1">
                                  <Button 
                                    variant="success" 
                                    size="sm" 
                                    className="rounded-pill px-3 py-1 fw-bold shadow-xs"
                                    onClick={() => handleOpenCorrReview(corr, 'approved')}
                                  >
                                    Setujui
                                  </Button>
                                  <Button 
                                    variant="outline-danger" 
                                    size="sm" 
                                    className="rounded-pill px-3 py-1 shadow-xs"
                                    onClick={() => handleOpenCorrReview(corr, 'rejected')}
                                  >
                                    Tolak
                                  </Button>
                                </div>
                              ) : (
                                <span className="small text-muted">Selesai</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-5 text-muted">
                  <Edit2 size={40} className="mb-2 opacity-25" />
                  <p className="mb-0">Tidak ada pengajuan koreksi absensi.</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Tab>
        <Tab eventKey="matrix" title="Matriks Kehadiran">
          <AdminAttendanceMatrix />
        </Tab>
        <Tab eventKey="analytics" title="Analisis">
          <AdminAnalytics />
        </Tab>
      </Tabs>

      <Card className="border-0 shadow-sm rounded-16 mb-4 overflow-hidden">
        <Card.Body className="p-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
            <h2 className="h5 font-weight-bold text-primary-green mb-0 d-flex align-items-center gap-2">
              <Activity size={22} /> Aktivitas Mentah (Raw Data)
            </h2>
            <div className="col-md-4 col-lg-3">
              <InputGroup className="shadow-sm rounded-12 overflow-hidden border">
                <InputGroup.Text className="bg-light border-0">
                  <Calendar size={18} className="text-muted" />
                </InputGroup.Text>
                <Form.Control
                  type="date"
                  className="bg-white border-0 py-2 shadow-none"
                  value={rawRecordsDate.toLocaleDateString('en-CA')}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newDate = new Date(year, month - 1, day);
                      setRawRecordsDate(newDate);
                    }
                  }}
                />
              </InputGroup>
            </div>
          </div>
          <div className="table-responsive rounded-12 border shadow-sm">
            <table className="table table-hover mb-0 align-middle">
              <thead className="bg-light">
                <tr>
                  <th className="py-3 ps-4">Nama Staff</th>
                  <th className="py-3">Waktu</th>
                  <th className="py-3">Tipe</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Lokasi</th>
                  <th className="py-3">Catatan</th>
                  <th className="py-3 text-center pe-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rawRecords.length > 0 ? rawRecords.map((record) => {
                  const hasClockOut = rawRecordsClockOuts.has(new Date(record.timestamp).toLocaleDateString('en-CA') + '-' + record.staffId._id);
                  return (
                  <tr key={record._id} className="transition-all">
                    <td className="ps-4 fw-bold text-dark">{record.staffId.name}</td>
                    <td><code className="text-primary-green bg-emerald-light px-2 py-1 rounded small fw-bold">{new Date(record.timestamp).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</code></td>
                    <td>
                      <Badge bg={record.type === 'clock-in' ? 'primary' : 'secondary'} className="rounded-pill px-3 py-1 shadow-sm">
                        {record.type === 'clock-in' ? 'Masuk' : 'Pulang'}
                      </Badge>
                    </td>
                    <td>{renderStatusBadge(record.entry_status, record.notes, record.edited_by)}</td>
                    <td>
                      {record.location && record.location.latitude && record.location.longitude ? (
                        <a 
                          href={`https://www.google.com/maps?q=${record.location.latitude},${record.location.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-light py-1 px-2 rounded-pill d-inline-flex align-items-center gap-1 text-primary-green small text-decoration-none border shadow-xs"
                          title={`Lat: ${record.location.latitude}, Lon: ${record.location.longitude}`}
                        >
                          <MapPin size={13} />
                          <span>{record.location.distance !== undefined ? `${record.location.distance}m` : 'Peta'}</span>
                        </a>
                      ) : (
                        <span className="text-muted small">-</span>
                      )}
                    </td>
                    <td className="small text-muted">{record.notes || '-'}</td>
                    <td className="text-center pe-4">
                      <div className="d-flex justify-content-center gap-1">
                        {(record as any).photo && (
                          <OverlayTrigger overlay={<Tooltip>Lihat Foto Absen</Tooltip>}>
                            <Button variant="outline-primary" size="sm" className="border-0 rounded-circle p-2" onClick={() => handleShowPhoto((record as any).photo, record.staffId.name, record._id)}>
                              <Camera size={16} />
                            </Button>
                          </OverlayTrigger>
                        )}
                        <OverlayTrigger overlay={<Tooltip>Koreksi Waktu</Tooltip>}>
                          <Button variant="outline-warning" size="sm" className="border-0 rounded-circle p-2" onClick={() => handleOpenCorrectionModal(record)}>
                            <Settings size={16} />
                          </Button>
                        </OverlayTrigger>
                        <OverlayTrigger overlay={<Tooltip>Hapus Record</Tooltip>}>
                          <Button variant="outline-danger" size="sm" className="border-0 rounded-circle p-2" onClick={() => openDeleteRecordModal(record._id)}>
                            <Trash2 size={16} />
                          </Button>
                        </OverlayTrigger>
                        {record.type === 'clock-in' && !hasClockOut && (
                          <OverlayTrigger overlay={<Tooltip>Input Pulang Manual</Tooltip>}>
                            <Button variant="outline-success" size="sm" className="border-0 rounded-circle p-2" onClick={() => handleOpenAddClockOutModal(record)}>
                              <CheckCircle size={16} />
                            </Button>
                          </OverlayTrigger>
                        )}
                      </div>
                    </td>
                  </tr>
                )}) : (
                  <tr><td colSpan={7} className="text-center py-5 text-muted">
                    <Activity size={48} className="mb-3 opacity-25" />
                    <p>Tidak ada aktivitas pada tanggal ini.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card.Body>
      </Card>

      {/* All Modals */}
      <Modal show={isModalOpen} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>{modalMode === 'add' ? 'Tambah Kehadiran (Sakit/Izin/Cuti)' : 'Edit Kehadiran'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleFormSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Staff</Form.Label>
              <Form.Control as="select" name="staffId" value={formData.staffId} onChange={handleFormChange} required disabled={modalMode === 'edit'}>
                <option value="">Pilih Staff</option>
                {staff.map((s) => (<option key={(s as any)._id} value={(s as any)._id}>{(s as any).name}</option>))}
              </Form.Control>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Control as="select" name="status" value={formData.status} onChange={handleFormChange} required>
                <option value="Hadir">Hadir</option>
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Cuti">Cuti</option>
                <option value="Alpha">Alpha</option>
              </Form.Control>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Tanggal</Form.Label>
              <Form.Control type="date" name="date" value={formData.date} onChange={handleFormChange} required disabled={modalMode === 'edit'} />
            </Form.Group>
            {formData.status === 'Hadir' && currentRecord?.status !== 'Hadir' ? (
              <>
                <hr/>
                <p className="text-muted">Mengubah status menjadi "Hadir" memerlukan input jam kerja.</p>
                <Form.Group className="mb-3">
                  <Form.Label>Jam Masuk</Form.Label>
                  <Form.Control type="time" name="clockInTime" value={formData.clockInTime} onChange={handleFormChange} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Jam Pulang</Form.Label>
                  <Form.Control type="time" name="clockOutTime" value={formData.clockOutTime} onChange={handleFormChange} required />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Catatan</Form.Label>
                  <Form.Control as="textarea" rows={2} name="notes" value={formData.notes} onChange={handleFormChange} placeholder="Cth: Perubahan dari Sakit menjadi Hadir"/>
                </Form.Group>
              </>
            ) : (
              <>
                {modalMode === 'add' && formData.status !== 'Hadir' && <Form.Group className="mb-3">
                  <Form.Label>Waktu</Form.Label>
                  <Form.Control type="time" name="time" value={formData.time} onChange={handleFormChange} required />
                </Form.Group>}
                {modalMode === 'add' && formData.status === 'Hadir' && (
                  <>
                    <hr/>
                    <p className="text-muted">Status Hadir baru memerlukan jam kerja, atau gunakan tombol Input Masuk/Pulang.</p>
                    <Form.Group className="mb-3">
                      <Form.Label>Jam Masuk</Form.Label>
                      <Form.Control type="time" name="clockInTime" value={formData.clockInTime} onChange={handleFormChange} required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Jam Pulang</Form.Label>
                      <Form.Control type="time" name="clockOutTime" value={formData.clockOutTime} onChange={handleFormChange} required />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>Catatan</Form.Label>
                      <Form.Control as="textarea" rows={2} name="notes" value={formData.notes} onChange={handleFormChange} />
                    </Form.Group>
                  </>
                )}
              </>
            )}
            <Button variant="primary" type="submit">{modalMode === 'add' ? 'Tambah' : 'Simpan Perubahan'}</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={isWorkTimeModalOpen} onHide={handleCloseWorkTimeModal}>
        <Modal.Header closeButton>
          <Modal.Title>Input Absensi Manual</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleWorkTimeFormSubmit}>
            <Form.Group className="mb-3"><Form.Label>Staff</Form.Label><Form.Control as="select" name="staffId" value={workTimeFormData.staffId} onChange={handleWorkTimeFormChange} required><option value="">Pilih Staff</option>{staff.map((s) => (<option key={(s as any)._id} value={(s as any)._id}>{(s as any).name}</option>))}</Form.Control></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Tanggal</Form.Label><Form.Control type="date" name="date" value={workTimeFormData.date} onChange={handleWorkTimeFormChange} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Jam Masuk</Form.Label><Form.Control type="time" name="clockInTime" value={workTimeFormData.clockInTime} onChange={handleWorkTimeFormChange} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Jam Pulang</Form.Label><Form.Control type="time" name="clockOutTime" value={workTimeFormData.clockOutTime} onChange={handleWorkTimeFormChange} /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Catatan (Wajib)</Form.Label><Form.Control as="textarea" rows={3} name="notes" value={workTimeFormData.notes} onChange={handleWorkTimeFormChange} required /></Form.Group>
            <Button variant="primary" type="submit">Simpan Absensi Manual</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={isCorrectionModalOpen} onHide={handleCloseCorrectionModal}>
        <Modal.Header closeButton><Modal.Title>Koreksi Record</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCorrectionFormSubmit}>
            <Form.Group className="mb-3"><Form.Label>Staff</Form.Label><Form.Control type="text" value={recordToCorrect ? recordToCorrect.staffId.name : ''} disabled /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Timestamp Koreksi</Form.Label><Form.Control type="datetime-local" name="timestamp" value={correctionFormData.timestamp} onChange={handleCorrectionFormChange} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Catatan Koreksi (Wajib)</Form.Label><Form.Control as="textarea" rows={3} name="notes" value={correctionFormData.notes} onChange={handleCorrectionFormChange} required /></Form.Group>
            <Button variant="warning" type="submit">Simpan Koreksi</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={isAddClockOutModalOpen} onHide={handleCloseAddClockOutModal}>
        <Modal.Header closeButton><Modal.Title>Tambah Absen Pulang Manual</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleAddClockOutSubmit}>
            <p>Menambahkan absen pulang untuk: <strong>{recordForClockOut?.staffId.name || ''}</strong> pada tanggal <strong>{recordForClockOut ? new Date(recordForClockOut.timestamp).toLocaleDateString('id-ID') : ''}</strong></p>
            <Form.Group className="mb-3"><Form.Label>Jam Pulang</Form.Label><Form.Control type="time" name="clockOutTime" value={addClockOutFormData.clockOutTime} onChange={handleAddClockOutFormChange} required /></Form.Group>
            <Form.Group className="mb-3"><Form.Label>Catatan (Wajib)</Form.Label><Form.Control as="textarea" rows={3} name="notes" value={addClockOutFormData.notes} onChange={handleAddClockOutFormChange} required placeholder="Cth: Lupa absen pulang"/></Form.Group>
            <Button variant="primary" type="submit">Simpan Absen Pulang</Button>
          </Form>
        </Modal.Body>
      </Modal>

      <Modal show={showDeleteModal} onHide={closeDeleteModal}><Modal.Header closeButton><Modal.Title>Konfirmasi Hapus</Modal.Title></Modal.Header><Modal.Body>Apakah Anda yakin ingin menghapus data ini?</Modal.Body><Modal.Footer><Button variant="secondary" onClick={closeDeleteModal}>Batal</Button><Button variant="danger" onClick={handleDelete}>Hapus</Button></Modal.Footer></Modal>
      <Modal show={showDeleteRecordModal} onHide={closeDeleteRecordModal}>
        <Modal.Header closeButton>
          <Modal.Title>Konfirmasi Hapus Record</Modal.Title>
        </Modal.Header>
        <Modal.Body>Apakah Anda yakin ingin menghapus data record mentah ini? Tindakan ini tidak dapat diurungkan.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDeleteRecordModal}>Batal</Button>
          <Button variant="danger" onClick={handleDeleteRecord}>Hapus</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPhotoModal} onHide={closePhotoModal} centered size="lg">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="h5 font-jakarta font-weight-bold text-primary-green">
            <Camera size={20} className="me-2" /> Foto Absen: {currentPhotoUser}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center bg-dark">
          {isPhotoLoading ? (
            <div className="py-5 text-white">
              <Spinner animation="border" size="sm" className="me-2" /> Memuat foto...
            </div>
          ) : currentPhoto ? (
            <img src={currentPhoto} alt="Absen" className="img-fluid shadow-lg" style={{ maxHeight: '80vh', width: 'auto' }} />
          ) : (
            <div className="py-5 text-white">Foto tidak tersedia</div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="secondary" className="rounded-pill px-4" onClick={closePhotoModal}>Tutup</Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 font-weight-bold text-primary-green d-flex align-items-center gap-2">
            <Download size={22} /> Export Laporan Excel Bulk
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          <p className="text-muted small mb-4">
            Ekspor rekapitulasi absensi lengkap seluruh staf dalam format Excel multi-sheet (Grafik, Matriks Kehadiran, Log Aktivitas, dan Tab Per Staf).
          </p>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-muted text-uppercase">Filter Role Staf</Form.Label>
              <Form.Select 
                value={exportRole} 
                onChange={(e) => setExportRole(e.target.value)}
                className="py-2 rounded-12"
              >
                <option value="all">Semua Role (Semua Staf)</option>
                {ROLE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row className="g-2 mb-3">
              <Col sm={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted text-uppercase">Bulan</Form.Label>
                  <Form.Select 
                    value={exportMonth} 
                    onChange={(e) => setExportMonth(parseInt(e.target.value))}
                    className="py-2 rounded-12"
                  >
                    <option value={-1}>Sepanjang Tahun</option>
                    {MONTHS_ID.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col sm={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-muted text-uppercase">Tahun</Form.Label>
                  <Form.Select 
                    value={exportYear} 
                    onChange={(e) => setExportYear(parseInt(e.target.value))}
                    className="py-2 rounded-12"
                  >
                    <option value={-1}>Semua Tahun</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Check 
                type="checkbox"
                id="export-include-individual-sheets"
                label="Sertakan sheet/tab individual untuk setiap staf"
                checked={exportIncludeIndividual}
                onChange={(e) => setExportIncludeIndividual(e.target.checked)}
                className="small fw-bold text-muted"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="light" className="rounded-pill px-4" onClick={() => setShowExportModal(false)} disabled={isExporting}>
            Batal
          </Button>
          <Button variant="success" className="rounded-pill px-4 shadow-sm fw-bold d-flex align-items-center gap-2" onClick={handleExecuteBulkExport} disabled={isExporting}>
            {isExporting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Unduh File Excel</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Review Correction Modal */}
      <Modal show={showCorrReviewModal} onHide={() => setShowCorrReviewModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="h5 fw-bold">
            {corrReviewAction === 'approved' ? 'Setujui Pengajuan Koreksi' : 'Tolak Pengajuan Koreksi'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-3">
          {selectedCorrToReview && (
            <div className="mb-3 p-3 bg-light rounded-12">
              <div className="fw-bold mb-1">
                {(selectedCorrToReview.staffId && typeof selectedCorrToReview.staffId === 'object' ? selectedCorrToReview.staffId.name : null) || selectedCorrToReview.userId?.name}
              </div>
              <div className="small text-muted mb-1">
                Tanggal: <strong>{new Date(selectedCorrToReview.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
              </div>
              <div className="small text-muted mb-1">
                Waktu Diajukan: {selectedCorrToReview.requestedClockIn ? `Masuk (${selectedCorrToReview.requestedClockIn}) ` : ''} {selectedCorrToReview.requestedClockOut ? `Pulang (${selectedCorrToReview.requestedClockOut})` : ''}
              </div>
              <div className="small text-muted">
                Alasan: <em>"{selectedCorrToReview.reason}"</em>
              </div>
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold text-muted text-uppercase">Catatan Admin (Opsional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={corrAdminNotes}
              onChange={(e) => setCorrAdminNotes(e.target.value)}
              placeholder={corrReviewAction === 'approved' ? 'Cth: Disetujui sesuai konfirmasi' : 'Cth: Mohon berikan bukti kehadiran yang valid'}
              className="py-2"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="light" className="rounded-pill px-4" onClick={() => setShowCorrReviewModal(false)} disabled={isCorrReviewing}>
            Batal
          </Button>
          <Button 
            variant={corrReviewAction === 'approved' ? 'success' : 'danger'} 
            className="rounded-pill px-4 shadow-sm fw-bold" 
            onClick={handleReviewCorrection} 
            disabled={isCorrReviewing}
          >
            {isCorrReviewing ? (
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
            ) : corrReviewAction === 'approved' ? (
              'Setujui Koreksi'
            ) : (
              'Tolak Pengajuan'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;