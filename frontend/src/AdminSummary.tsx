import React from 'react';
import { Tooltip, OverlayTrigger, Card } from 'react-bootstrap';
import { Users, Timer, Clock, UserX, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Staff, User, Record, Attendance, WorkDay, RamadanPeriod } from './types';
import './AdminSummary.css';

interface AdminSummaryProps {
  users: User[];
  todaysRecords: Record[];
  workDaySettings: WorkDay[];
  allAttendance: Attendance[];
  staff: Staff[];
  ramadanPeriods: RamadanPeriod[];
}

export const AdminSummary = ({ users, todaysRecords, workDaySettings, allAttendance, staff, ramadanPeriods }: AdminSummaryProps) => {

  const clockedInStaff = new Map<string, Record>();
  if (todaysRecords) {
    todaysRecords.forEach(record => {
      if (record.staffId) {
        if (record.type === 'clock-in' && typeof record.staffId === 'object') {
          clockedInStaff.set(record.staffId._id, record);
        } else if (record.type === 'clock-out' && typeof record.staffId === 'object') {
          clockedInStaff.delete(record.staffId._id);
        }
      }
    });
  }
  const currentlyClockedInCount = clockedInStaff.size;

  const lateStaff: { name: string, time: string }[] = [];
  const staffClockInTimes = new Map<string, Date>();
  if (todaysRecords) {
    todaysRecords.forEach(record => {
      if (record.type === 'clock-in' && typeof record.staffId === 'object') {
        staffClockInTimes.set(record.staffId._id, new Date(record.timestamp));
      }
    });
  }

  const today = new Date();
  const dateString = today.toLocaleDateString('en-CA');
  const isRamadan = ramadanPeriods && ramadanPeriods.some(p => dateString >= p.startDate && dateString <= p.endDate);

  staffClockInTimes.forEach((clockInTime, staffId: string) => {
    const user = users.find(u => {
      const uId = typeof u.staffId === 'object' && u.staffId !== null ? (u.staffId as any)._id : u.staffId;
      return uId === staffId;
    });
    if (user) {
      const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][today.getDay()];
      const userWorkDay = workDaySettings.find(ws => ws.role === user.role && ws.day === dayName);

      if (userWorkDay && userWorkDay.isWorkDay) {
        const startTimeStr = (isRamadan && userWorkDay.ramadanStartTime) ? userWorkDay.ramadanStartTime : userWorkDay.startTime;
        const [startHour, startMinute] = startTimeStr.split(':').map(Number);
        
        if (clockInTime.getHours() > startHour || (clockInTime.getHours() === startHour && clockInTime.getMinutes() > startMinute)) {
          lateStaff.push({ name: user.name, time: clockInTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
        }
      }
    }
  });
  const lateStaffCount = lateStaff.length;

  const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][today.getDay()];
  const todaysClockedInStaffIds = new Set(
    (todaysRecords as any[])
      .filter(r => r.type === 'clock-in')
      .map(r => typeof r.staffId === 'object' ? (r.staffId as { _id: string })._id : r.staffId)
  );

  const todaysOtherAttendanceStaffIds = new Set(
    allAttendance
      .filter(a => a.date === dateString && (a.status === 'Sakit' || a.status === 'Izin' || a.status === 'Cuti'))
      .map(a => a.staffId)
  );

  const staffNotClockedIn = staff
    .filter(staffMember => {
      const user = users.find(u => {
        const uStaffId = typeof u.staffId === 'object' && u.staffId !== null ? (u.staffId as any)._id : u.staffId;
        return uStaffId === staffMember._id;
      });
      if (!user || user.role === 'admin') return false;
      const userStaffId = typeof user.staffId === 'object' && user.staffId !== null ? (user.staffId as any)._id : user.staffId;
      if (!userStaffId) return false;
      const userWorkDay = workDaySettings.find(ws => ws.role === user.role && ws.day === dayName);
      if (!userWorkDay || !userWorkDay.isWorkDay) return false;
      return !todaysClockedInStaffIds.has(userStaffId) && !todaysOtherAttendanceStaffIds.has(userStaffId);
    });
    
  const notClockedInCount = staffNotClockedIn.length;
  const totalStaffNonAdmin = users.filter(user => user.role !== 'admin').length;

  return (
    <div className="admin-summary-grid mb-4">
      {/* Total Staff Card */}
      <Card className="summary-card border-0 shadow-sm overflow-hidden h-100">
        <Card.Body className="d-flex align-items-center p-4 position-relative">
          <div className="icon-box bg-primary-light text-primary-green me-3 shadow-sm">
            <Users size={26} />
          </div>
          <div className="z-index-1">
            <h6 className="card-subtitle text-muted mb-1 small fw-bold text-uppercase">Total Pegawai</h6>
            <h2 className="card-title mb-0 font-weight-bold">{totalStaffNonAdmin}</h2>
          </div>
          <Users size={80} className="card-bg-icon opacity-05" />
        </Card.Body>
      </Card>

      {/* Currently Clocked In Card */}
      <Card className="summary-card border-0 shadow-sm overflow-hidden h-100">
        <Card.Body className="d-flex align-items-center p-4 position-relative">
          <div className="icon-box bg-success-light text-success me-3 shadow-sm">
            <Timer size={26} />
          </div>
          <div className="z-index-1">
            <h6 className="card-subtitle text-muted mb-1 small fw-bold text-uppercase">Hadir Saat Ini</h6>
            <h2 className="card-title mb-0 font-weight-bold text-success">
              {currentlyClockedInCount}
              <span className="ms-2 small text-muted font-weight-normal h6">Staff</span>
            </h2>
          </div>
          <CheckCircle2 size={80} className="card-bg-icon opacity-05 text-success" />
        </Card.Body>
      </Card>

      {/* Late Staff Card */}
      <OverlayTrigger
        placement="bottom"
        overlay={
          <Tooltip id="tooltip-late-staff">
            {lateStaff.length > 0 ? lateStaff.map(s => `${s.name} (${s.time})`).join(', ') : 'Sempurna! Tidak ada yang terlambat hari ini.'}
          </Tooltip>
        }
      >
        <Card className="summary-card border-0 shadow-sm clickable overflow-hidden h-100">
          <Card.Body className="d-flex align-items-center p-4 position-relative">
            <div className="icon-box bg-danger-light text-danger me-3 shadow-sm">
              <Clock size={26} />
            </div>
            <div className="z-index-1">
              <h6 className="card-subtitle text-muted mb-1 small fw-bold text-uppercase">Terlambat</h6>
              <h2 className="card-title mb-0 font-weight-bold text-danger">{lateStaffCount}</h2>
            </div>
            <AlertCircle size={80} className="card-bg-icon opacity-05 text-danger" />
          </Card.Body>
        </Card>
      </OverlayTrigger>

      {/* Not Clocked In Card */}
      <OverlayTrigger
        placement="bottom"
        overlay={
          <Tooltip id="tooltip-not-clocked-in">
            {staffNotClockedIn.length > 0 ? staffNotClockedIn.map(s => s.name).join(', ') : 'Luar biasa! Semua staf sudah absen.'}
          </Tooltip>
        }
      >
        <Card className="summary-card border-0 shadow-sm clickable overflow-hidden h-100">
          <Card.Body className="d-flex align-items-center p-4 position-relative">
            <div className="icon-box bg-warning-light text-warning me-3 shadow-sm">
              <UserX size={26} />
            </div>
            <div className="z-index-1">
              <h6 className="card-subtitle text-muted mb-1 small fw-bold text-uppercase">Belum Absen</h6>
              <h2 className="card-title mb-0 font-weight-bold text-warning">{notClockedInCount}</h2>
            </div>
            <UserX size={80} className="card-bg-icon opacity-05 text-warning" />
          </Card.Body>
        </Card>
      </OverlayTrigger>
    </div>
  );
};
