// frontend/src/types.ts

// Centralized interface for AttendanceRecord
export interface Attendance {
  _id: string;
  staffId: string;
  name: string;
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpha' | 'Cuti';
  date: string;
  time: string;
}

export interface Staff {
  _id: string;
  name: string;
}

export interface User {
  _id: string;
  username: string;
  name: string;
  role: 'admin' | 'staff' | 'petugas kebersihan' | 'guru ra' | 'guru mi akhwat' | 'guru mi ikhwan' | 'guru tahfidz fase a' | 'guru tahfidz fase b & c';
  staffId?: string;
}

export interface EditedBy {
  _id: string;
  name: string;
}

export interface Record {
  _id: string;
      staffId: string | { _id: string; name: string; };
  timestamp: string;
  type: 'clock-in' | 'clock-out';
  clockOutStatus?: 'pulang lebih awal' | 'tepat waktu' | 'long shift';
}

export interface WorkDay {
  day: string;
  role: string;
  isWorkDay: boolean;
  startTime: string;
  endTime: string;
  ramadanStartTime?: string;
  ramadanEndTime?: string;
}

export interface RamadanPeriod {
  _id: string;
  year: number;
  startDate: string;
  endDate: string;
}

export interface ClockInOutRecord {
  _id: string;
  staffId: string;
  timestamp: string;
  type: 'clock-in' | 'clock-out';
  entry_status: 'normal' | 'manual_admin' | 'koreksi';
  notes?: string;
  edited_by?: EditedBy;
}

export interface WorkTimeRecord {
  _id: string;
  staffId: string;
  name: string;
  date: string;
  clockInTime: string;
  clockOutTime: string; 
  totalHours: string;
  keteranganMasuk: string;
  keteranganPulang: string;
  entry_status: 'normal' | 'manual_admin' | 'koreksi';
  notes?: string;
  edited_by?: EditedBy;
}

export interface LeaveRequest {
  _id: string;
  userId: {
    _id: string;
    name: string;
    role: string;
  };
  leaveType: 'Sakit' | 'Izin' | 'Cuti'; // Changed from 'Cuti Tahunan'
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  attachment?: string;
  createdAt: string;
}

export interface RecordWithStaff {
    _id: string;
    timestamp: string;
    type: 'clock-in' | 'clock-out';
    staffId: Staff;
    entry_status: 'normal' | 'manual_admin' | 'koreksi';
    notes?: string;
    edited_by?: EditedBy;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
  };
}

export interface Holiday {
  _id: string;
  name: string;
  date: string;
  isNationalHoliday: boolean;
  role: string;
}
