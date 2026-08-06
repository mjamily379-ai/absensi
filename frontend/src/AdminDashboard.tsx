import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import Select from 'react-select';
import { AdminSummary } from './AdminSummary';
import { AdminCharts, AdminChartsRef } from './AdminCharts';
import { Modal, Button, Form, Badge, Tooltip, OverlayTrigger, Tabs, Tab, Row, Col, Card, InputGroup } from 'react-bootstrap';
import { Download, Search, PlusCircle, Edit2, Trash2, Calendar, FileText, Settings, History as HistoryIcon, UserPlus, Info, CheckCircle, Clock, Activity, Camera } from 'lucide-react';
import { toast } from 'react-toastify';
import HolidaySettings from './HolidaySettings';
import WorkDaySettings from './WorkDaySettings';
import RamadanSettings from './RamadanSettings';
import type { Attendance, Staff, User, EditedBy, ClockInOutRecord, WorkTimeRecord, LeaveRequest, RecordWithStaff, Holiday, RamadanPeriod } from './types'; // Import RecordWithStaff
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
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [showDeleteRecordModal, setShowDeleteRecordModal] = useState(false);
  const [recordToDeleteId, setRecordToDeleteId] = useState<string | null>(null);
  const [rawRecordsDate, setRawRecordsDate] = useState(new Date());

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [currentPhotoUser, setCurrentPhotoUser] = useState<string | null>(null);
  
  // Data states
  const [allAttendance, setAllAttendance] = useState<Attendance[]>([]);
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


  // Helper Functions
  const getLoggedInUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
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


  const getDatesBetween = (startDate: Date, endDate: Date): string[] => {
    const dates: string[] = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(currentDate.toLocaleDateString('en-CA'));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const getWorkingDaysMap = (workDaySettings: any[]) => {
    const map = new Map();
    workDaySettings.forEach(setting => {
      if (!map.has(setting.role)) {
        map.set(setting.role, new Map());
      }
      map.get(setting.role).set(setting.day, setting.isWorkDay);
    });
    return map;
  };

  const fetchAllAttendance = async () => {
    try {
      const [
        attendanceResponse,
        staffResponse,
        usersResponse,
        workDaySettingsResponse,
        holidaysResponse,
        allRecordsResponse, // Fetch all raw records
        ramadanResponse,
      ] = await Promise.all([
        api.get('/api/attendance'),
        api.get('/api/staff'),
        api.get('/api/users'),
        api.get('/api/workday/all'),
        api.get(`/api/holidays?year=${new Date().getFullYear()}`),
        api.get('/api/records/all-records'),
        api.get('/api/ramadan'),
      ]);

      const existingAttendance: Attendance[] = attendanceResponse.data;
      const allStaff: Staff[] = staffResponse.data;
      const allUsers: User[] = usersResponse.data;
      const workDaySettingsData: any[] = workDaySettingsResponse.data;
      const holidaysData: Holiday[] = holidaysResponse.data;
      const allRecords: RecordWithStaff[] = allRecordsResponse.data;
      const ramadanData: RamadanPeriod[] = ramadanResponse.data;

      // Set states that other components rely on
      setStaff(allStaff);
      setUsers(allUsers);
      setWorkDaySettings(workDaySettingsData);
      setHolidays(holidaysData);
      setRamadanPeriods(ramadanData);

      const workingDaysMap = getWorkingDaysMap(workDaySettingsData);

      const processedAttendance: Attendance[] = [...existingAttendance];

      // Define date range for checking (e.g., last year until today)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - 1); // Check for the last year

      const datesToCheck = getDatesBetween(startDate, endDate);

      for (const staffMember of allStaff) {
        // Exclude admin staff from general attendance calculation
        const user = allUsers.find(u => u.staffId === staffMember._id);
        if (!user || user.role === 'admin') {
          continue;
        }

        const userRole = user.role;
        const userHolidaySet = new Set(holidaysData
          .filter(h => h.role === 'all' || h.role === userRole)
          .map(h => new Date(h.date).toLocaleDateString('en-CA'))
        );

        for (const dateString of datesToCheck) {
          const currentDate = new Date(dateString);
          const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][currentDate.getDay()];

          // Check if it's a workday for this user's role
          const isWorkDay = workingDaysMap.has(userRole) && workingDaysMap.get(userRole).get(dayName);
          const isHoliday = userHolidaySet.has(dateString);

          if (isWorkDay && !isHoliday) {
            // Check for existing attendance (Sakit, Izin, Cuti)
            const hasExistingAttendance = existingAttendance.some(
              a => a.staffId === staffMember._id && a.date === dateString && a.status !== 'Hadir'
            );

            // Check for existing clock-in/out records
            const hasClockInOrOut = allRecords.some(
              r => (typeof r.staffId === 'object' ? r.staffId._id : r.staffId) === staffMember._id && new Date(r.timestamp).toLocaleDateString('en-CA') === dateString
            );

            // If no existing attendance record and no clock-in/out, then it's 'Alpha'
            if (!hasExistingAttendance && !hasClockInOrOut) {
              processedAttendance.push({
                _id: `${staffMember._id}-${dateString}-alpha`, // Unique ID for generated Alpha
                staffId: staffMember._id,
                name: staffMember.name,
                status: 'Alpha',
                date: dateString,
                time: '00:00', // Default time
              });
            }
          }
        }
      }
      setAllAttendance(processedAttendance);
    } catch (error) {
      console.error("Error fetching all attendance data:", error);
    }
  };

  // useEffect Hooks
  useEffect(() => {
    fetchAllAttendance();
    fetchTodaysRecords();

    // Fetch pending leave requests
    api.get('/api/leave-requests')
        .then(response => {
            const data = Array.isArray(response.data) ? response.data : [];
            const pending = data.filter((req: LeaveRequest) => req.status === 'pending');
            setPendingLeaveRequests(pending);
        })
        .catch(error => console.error("Error fetching leave requests:", error));
  }, []); // Empty dependency array means it runs once on mount

  useEffect(() => {
    fetchRawRecords(rawRecordsDate);
  }, [rawRecordsDate]);

  useEffect(() => {
    if (selectedStaffId) {
      // Add a simple check for ObjectId format (24 hex characters)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(selectedStaffId);
      if (isValidObjectId) {
        api.get(`/api/records/${selectedStaffId}`).then((response) => {
          setWorkTimeRecords(response.data);
        });
        const filteredAttendance = allAttendance.filter((record: Attendance) => record.staffId === selectedStaffId);
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
        } catch (error) {
            console.error('Error exporting personal excel:', error);
            toast.error('Gagal mengekspor laporan staff.');
        }
        return;
    }

    if (!chartsRef.current) {
      toast.error('Komponen grafik tidak tersedia.');
      return;
    }
    const { pieChartImage, barChartImage } = chartsRef.current.getChartImages();
    const payload = {
        month: selectedMonth !== -1 ? selectedMonth + 1 : null,
        year: selectedYear !== -1 ? selectedYear : null,
        pieChartImage,
        barChartImage
    };
    try {
        const response = await api.post('/api/export-excel', payload, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Attendance_Report_Everyone.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
    } catch (error) {
        console.error('Error exporting with charts:', error);
        toast.error('Gagal mengekspor laporan dengan grafik.');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) {
        toast.warn('Admin not logged in!');
        return;
    }

    if (modalMode === 'edit' && formData.status === 'Hadir' && currentRecord?.status !== 'Hadir') {
      if (!formData.clockInTime || !formData.clockOutTime) {
        toast.warn('Untuk mengubah status menjadi "Hadir", jam masuk dan jam pulang wajib diisi.');
        return;
      }
      const payload = {
        staffId: formData.staffId, name: formData.name, date: formData.date,
        clockInTime: formData.clockInTime, clockOutTime: formData.clockOutTime,
        notes: formData.notes || `Status diubah dari ${currentRecord?.status} menjadi Hadir`,
        adminId: loggedInUser.id
      };
      try {
        await api.post('/api/records/manual', payload);
        fetchAllAttendance();
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

    // Pastikan `time` terisi untuk status non-Hadir (Sakit, Izin, Cuti)
    const finalTime = formData.status !== 'Hadir'
      ? (formData.time || 'N/A')
      : formData.time;
    const payload = { ...formData, time: finalTime, fromAdmin: true };
    try {
      if (modalMode === 'edit' && currentRecord) {
        await api.put(`/api/attendance/${currentRecord._id}`, payload);
      } else {
        await api.post('/api/attendance', payload);
      }
      fetchAllAttendance();
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
        fetchAllAttendance();
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
      fetchAllAttendance(); // Re-fetch all attendance to recalculate Alpha status
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
        fetchAllAttendance(); // Re-fetch all attendance to recalculate Alpha status
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
      setFormData({
        staffId: record.staffId, name: record.name, status: record.status, date: record.date, time: record.time,
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

  const handleShowPhoto = (photo: string, name: string) => {
    setCurrentPhoto(photo);
    setCurrentPhotoUser(name);
    setShowPhotoModal(true);
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
  const openDeleteModal = (id: string) => {
    setRecordToDelete(id);
    setShowDeleteModal(true);
  };
  const closeDeleteModal = () => setShowDeleteModal(false);
  const handleDelete = async () => {
    if (recordToDelete) {
      try {
        await api.delete(`/api/attendance/${recordToDelete}`);
        fetchAllAttendance();
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
        fetchAllAttendance(); // Re-fetch all attendance to recalculate Alpha status
        toast.success('Data record berhasil dihapus.');
      } catch (error) {
        toast.error('Gagal menghapus data record.');
      } finally {
        closeDeleteRecordModal();
      }
    }
  };

  const renderStatusBadge = (status: 'normal' | 'manual_admin' | 'koreksi', notes?: string, edited_by?: EditedBy) => {
    if (status === 'normal' || !status) return null;
    const variant = status === 'manual_admin' ? 'info' : 'warning';
    const text = status === 'manual_admin' ? 'Manual' : 'Koreksi';
    const tooltip = (
      <Tooltip id={`tooltip-${status}`}>
        <strong>{text}</strong> by {edited_by?.name || 'N/A'}<br />
        Notes: {notes || 'No notes'}
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

    if (workTimeRecord) {
        // If there are actual clock-in/out records, the status is 'Hadir' for that day
        status = 'Hadir';
        keteranganMasuk = workTimeRecord.keteranganMasuk;
        keteranganPulang = workTimeRecord.keteranganPulang;
    } else if (attendanceRecord) {
        // If there's an attendance record but no clock-in/out, use the attendance status
        status = attendanceRecord.status;
        keteranganMasuk = attendanceRecord.status; // For non-Hadir statuses, set keteranganMasuk to the status
        keteranganPulang = ''; // No clock-out for non-Hadir attendance
    } else {
        // No records at all for this date
        status = '-';
        keteranganMasuk = '-';
        keteranganPulang = '-';
    }

    return {
      date, status, keteranganMasuk, keteranganPulang,
      clockInTime: workTimeRecord?.clockInTime || '-',
      clockOutTime: workTimeRecord?.clockOutTime || '-',
      totalHours: workTimeRecord?.totalHours || '-',
      name: workTimeRecord?.name || attendanceRecord?.name || '',
      entry_status: workTimeRecord?.entry_status || 'normal',
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
        <div className="d-flex gap-2">
          <Button variant="success" className="rounded-pill px-4 shadow-sm" onClick={handleExport}>
            <Download size={18} className="me-2" />
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
                options={staffOptions} 
                value={staffOptions.find(option => option.value === selectedStaffId)}
                onChange={(selectedOption) => setSelectedStaffId(selectedOption ? selectedOption.value : null)}
                isClearable 
                isSearchable 
                placeholder="Cari nama staff..." 
                styles={{
                  control: (base) => ({
                    ...base,
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                    '&:hover': { border: '1px solid #cbd5e1' }
                  })
                }}
              />
            </Col>
            <Col md={5}>
              <Form.Label className="small font-weight-bold text-muted text-uppercase mb-2">Filter Periode Laporan</Form.Label>
              <div className="d-flex gap-2">
                <Form.Select className="rounded-12 border-light bg-light py-2" value={selectedMonth} onChange={(e) => setselectedMonth(parseInt(e.target.value))}>
                  <option value={-1}>Semua Bulan</option>
                  {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </Form.Select>
                <Form.Select className="rounded-12 border-light bg-light py-2" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  <option value={-1}>Semua Tahun</option>
                  {Array.from(new Set(allAttendance.map(a => new Date(a.date).getFullYear()))).sort().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

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
              <AdminCharts ref={chartsRef} allAttendance={allAttendance} users={users} />
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
                        Role: {users.find(u => u.staffId === selectedStaffId)?.role || 'Staff'}
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
                        <th className="border-0 py-3 ps-4" onClick={() => handleHistorySort('date')} style={{ cursor: 'pointer' }}>
                          <div className="d-flex align-items-center gap-2">Tanggal <HistoryIcon size={14} className="text-muted" /></div>
                        </th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('status')} style={{ cursor: 'pointer' }}>Status</th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('clockInTime')} style={{ cursor: 'pointer' }}>Jam Masuk</th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('clockOutTime')} style={{ cursor: 'pointer' }}>Jam Pulang</th>
                        <th className="border-0 py-3" onClick={() => handleHistorySort('totalHours')} style={{ cursor: 'pointer' }}>Total Jam</th>
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
                            {attendanceByDate.get(item.date) ? (
                              <div className="d-flex justify-content-center gap-2">
                                <Button variant="outline-info" size="sm" className="border-0 rounded-circle p-2" onClick={() => handleOpenModal('edit', attendanceByDate.get(item.date))} title="Edit">
                                  <Edit2 size={16} />
                                </Button>
                                <Button variant="outline-danger" size="sm" className="border-0 rounded-circle p-2" onClick={() => openDeleteModal(attendanceByDate.get(item.date)!._id)} title="Hapus">
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            ) : (
                              <Badge bg="light" text="muted" className="border-0 font-weight-normal small">Otomatis</Badge>
                            )}
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
                    <td className="small text-muted">{record.notes || '-'}</td>
                    <td className="text-center pe-4">
                      <div className="d-flex justify-content-center gap-1">
                        {(record as any).photo && (
                          <OverlayTrigger overlay={<Tooltip>Lihat Foto Absen</Tooltip>}>
                            <Button variant="outline-primary" size="sm" className="border-0 rounded-circle p-2" onClick={() => handleShowPhoto((record as any).photo, record.staffId.name)}>
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
                  <tr><td colSpan={6} className="text-center py-5 text-muted">
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
                <option value="Sakit">Sakit</option>
                <option value="Izin">Izin</option>
                <option value="Cuti">Cuti</option>
                <option value="Hadir">Hadir</option>
              </Form.Control>
            </Form.Group>
            {formData.status !== 'Hadir' ? (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Tanggal</Form.Label>
                  <Form.Control type="date" name="date" value={formData.date} onChange={handleFormChange} required />
                </Form.Group>
                {modalMode === 'add' && <Form.Group className="mb-3">
                  <Form.Label>Waktu</Form.Label>
                  <Form.Control type="time" name="time" value={formData.time} onChange={handleFormChange} required />
                </Form.Group>}
              </>
            ) : (
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

      <Modal show={showPhotoModal} onHide={() => setShowPhotoModal(false)} centered size="lg">
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="h5 font-jakarta font-weight-bold text-primary-green">
            <Camera size={20} className="me-2" /> Foto Absen: {currentPhotoUser}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0 text-center bg-dark">
          {currentPhoto ? (
            <img src={currentPhoto} alt="Absen" className="img-fluid shadow-lg" style={{ maxHeight: '80vh', width: 'auto' }} />
          ) : (
            <div className="py-5 text-white">Foto tidak tersedia</div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="secondary" className="rounded-pill px-4" onClick={() => setShowPhotoModal(false)}>Tutup</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;