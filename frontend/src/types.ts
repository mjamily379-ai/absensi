// frontend/src/types.ts
import type { Role } from './constants/roles';

// Centralized interface for AttendanceRecord
export interface Attendance {
  _id: string;
  staffId: StaffRef;
  name: string;
  status: 'Hadir' | 'Sakit' | 'Izin' | 'Alpha' | 'Cuti';
  date: string;
  time: string;
  notes?: string;
}

export interface Staff {
  _id: string;
  name: string;
}

// staffId may be a plain string (id) or a populated staff object, depending on the API response.
export type StaffRef = string | { _id: string; name: string };

export const extractStaffId = (ref: StaffRef): string =>
  typeof ref === 'object' && ref !== null ? ref._id : ref;

/**
 * Read the cached user from localStorage without ever throwing.
 *
 * A corrupt or older-schema entry (app upgrade, interrupted write, manual edit)
 * used to make the raw `JSON.parse` throw during the useState initializer, which
 * white-screened the whole app with no way to recover except clearing storage.
 */
export const readStoredUser = (): User | null => {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...parsed, _id: parsed.id || parsed._id } as User;
  } catch (error) {
    console.warn('Discarding unreadable cached user:', error);
    try {
      localStorage.removeItem('user');
    } catch { /* storage unavailable (private mode) */ }
    return null;
  }
};

export interface User {
  _id: string;
  username: string;
  name: string;
  role: Role;
  staffId?: StaffRef;
  mustChangePassword?: boolean;
}

export interface EditedBy {
  _id: string;
  name: string;
}

export interface LocationData {
  latitude?: number;
  longitude?: number;
  distance?: number;
  address?: string;
}

export interface Record {
  _id: string;
  staffId: StaffRef;
  timestamp: string;
  type: 'clock-in' | 'clock-out';
  clockOutStatus?: 'pulang lebih awal' | 'tepat waktu' | 'long shift';
  location?: LocationData;
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
  staffId: StaffRef;
  timestamp: string;
  type: 'clock-in' | 'clock-out';
  entry_status: 'normal' | 'manual_admin' | 'koreksi';
  notes?: string;
  edited_by?: EditedBy;
  location?: LocationData;
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
  clockInLocation?: LocationData;
  clockOutLocation?: LocationData;
}

export interface LeaveRequest {
  _id: string;
  userId: {
    _id: string;
    name: string;
    role: string;
  };
  staffId?: StaffRef;
  leaveType: 'Sakit' | 'Izin' | 'Cuti'; // Changed from 'Cuti Tahunan'
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  attachment?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
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
    location?: LocationData;
}

export interface Announcement {
  _id: string;
  title: string;
  content: string;
  targetRole?: string;
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

export interface CorrectionRequest {
  _id: string;
  userId: {
    _id: string;
    name: string;
    username: string;
    role: string;
  };
  staffId: StaffRef;
  date: string;
  requestType: 'clock-in' | 'clock-out' | 'both';
  requestedClockIn?: string;
  requestedClockOut?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  reviewedBy?: {
    _id: string;
    name: string;
  };
  reviewedAt?: string;
  createdAt: string;
}

// ---- Phase 5: server-side analytics (GET /api/analytics/*) ----

export interface AnalyticsPeriod {
  month: number;
  year: number;
  start: string;
  end: string;
  daysProcessed?: number;
}

export interface AnalyticsSummary {
  staffCount: number;
  workdays: number;
  hadir: number;
  onTime: number;
  late: number;
  sick: number;
  izin: number;
  cuti: number;
  alpha: number;
  longShifts: number;
  onTimeRate: number | null;
  lateRate: number | null;
  alphaRate: number | null;
  sickRate: number | null;
  attendanceRate: number | null;
  avgHoursFormatted: string;
  totalHoursFormatted: string;
}

export interface RoleAnalytics {
  role: string;
  staffCount: number;
  workdays: number;
  hadir: number;
  onTime: number;
  late: number;
  sick: number;
  izin: number;
  cuti: number;
  alpha: number;
  longShifts: number;
  attendanceRate: number | null;
  onTimeRate: number | null;
  alphaRate: number | null;
  avgHoursFormatted: string;
}

export interface LatenessDistributionItem {
  label: string;
  count: number;
}

export interface LatenessAnalytics {
  distribution: LatenessDistributionItem[];
  longShiftCount: number;
}

export interface WeeklyTrendItem {
  week: number;
  label: string;
  workdays: number;
  hadir: number;
  late: number;
  attendanceRate: number | null;
}

export interface UserAnalytics {
  staffId: string;
  name: string;
  role: string;
  workdays: number;
  hadir: number;
  onTime: number;
  late: number;
  sick: number;
  izin: number;
  cuti: number;
  alpha: number;
  longShifts: number;
  avgHoursFormatted: string;
  totalHoursFormatted: string;
}

export interface PersonalAnalytics {
  staffId: string;
  name: string;
  role: string;
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

