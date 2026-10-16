import React, { useRef, useImperativeHandle, forwardRef, useMemo, useState, useEffect } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import type { Attendance, User, WorkDay, Holiday, RamadanPeriod, Staff, StaffRef, EditedBy } from './types';
import { Card, Row, Col } from 'react-bootstrap';
import { PieChart, BarChart3, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { DAYS_ID_SUNDAY_FIRST } from './constants/roles';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export interface AdminChartsRef {
  getChartImages: () => { pieChartImage: string; barChartImage: string };
}

interface RecordWithStaff {
  _id: string;
  staffId: StaffRef;
  type: 'clock-in' | 'clock-out';
  timestamp: string;
  notes?: string;
  entry_status?: 'normal' | 'manual_admin' | 'koreksi';
  edited_by?: EditedBy;
  photo?: string;
  keteranganMasuk?: string;
  keteranganPulang?: string;
}

interface AdminChartsProps {
  allAttendance: Attendance[];
  users: User[];
  todaysRecords: RecordWithStaff[];
  allRecords: RecordWithStaff[];
  workDaySettings: WorkDay[];
  holidays: Holiday[];
  staff: Staff[];
  ramadanPeriods: RamadanPeriod[];
}

export const AdminCharts = forwardRef<AdminChartsRef, AdminChartsProps>(({ allAttendance, users, todaysRecords, allRecords, workDaySettings, holidays, staff, ramadanPeriods }, ref) => {
  const pieChartRef = useRef<ChartJS<'pie', number[], string>>(null);
  const barChartRef = useRef<ChartJS<'bar', number[], string>>(null);

  const getThemeMode = (): 'light' | 'dark' => (document.documentElement.getAttribute('data-theme') || 'light') as 'light' | 'dark';
  const [theme, setTheme] = useState<'light' | 'dark'>(getThemeMode);

  useEffect(() => {
    const onThemeChange = () => setTheme(getThemeMode());
    window.addEventListener('themechange', onThemeChange);
    return () => window.removeEventListener('themechange', onThemeChange);
  }, []);

  const getThemeColor = (cssVar: string, fallback: string): string => {
    try {
      const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
      return value || fallback;
    } catch {
      return fallback;
    }
  };

  useImperativeHandle(ref, () => ({
    getChartImages: () => {
      const pieChartImage = pieChartRef.current?.toBase64Image() || '';
      const barChartImage = barChartRef.current?.toBase64Image() || '';
      return { pieChartImage, barChartImage };
    },
  }));

  // --- HELPERS ---
  const getStaffIdFromRecord = (r: RecordWithStaff): string => {
    return typeof r.staffId === 'object' && r.staffId !== null ? r.staffId._id : r.staffId;
  };

  const getStaffIdFromUser = (u: User): string | null => {
    const s = u.staffId;
    return typeof s === 'object' && s !== null ? s._id : (s || null);
  };

  const getDateString = (d: Date): string => d.toLocaleDateString('en-CA');

  const today = new Date();
  const todayStr = getDateString(today);


  const isWorkDayForRole = (role: string, date: Date): boolean => {
    const dIdx = date.getDay();
    const dName = DAYS_ID_SUNDAY_FIRST[dIdx] || '';
    const dStr = getDateString(date);

    const wd = workDaySettings?.find(w => w.role === role && w.day === dName);
    if (!wd || !wd.isWorkDay) return false;

    const isHoliday = holidays?.some(h => {
      const hDate = new Date(h.date);
      return getDateString(hDate) === dStr && (h.role === 'all' || h.role === role);
    });

    if (isHoliday) return false;
    return true;
  };

  const getAttendanceRecord = (staffId: string, dateStr: string): Attendance | null => {
    const matches = allAttendance?.filter(a => {
      const sid = typeof a.staffId === 'object' && a.staffId !== null ? a.staffId._id : a.staffId;
      return sid === staffId && a.date === dateStr;
    }) || [];

    if (matches.length === 0) return null;

    // Prioritize leave/absence statuses over Hadir (in case of duplicate records)
    const priority = ['Izin', 'Sakit', 'Cuti', 'Alpha', 'Hadir'];
    matches.sort((a, b) => {
      const ai = priority.indexOf(a.status);
      const bi = priority.indexOf(b.status);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return matches[0];
  };

  // Count for a specific date: combines raw records (clock-ins) + attendance (Sakit/Izin/Cuti)
  const getAttendanceCountsForDate = (date: Date) => {
    const dStr = getDateString(date);
    const isToday = dStr === todayStr;

    // Use todaysRecords if today, else filter allRecords for that date
    const recordsForDate = isToday
      ? (todaysRecords || [])
      : (allRecords || []).filter(r => getDateString(new Date(r.timestamp)) === dStr);

    // Find staff with any clock-in today
    const clockedInStaffIds = new Set<string>();
    recordsForDate.forEach(r => {
      if (r.type === 'clock-in') {
        const sid = getStaffIdFromRecord(r);
        if (sid) clockedInStaffIds.add(sid);
      }
    });

    let hadir = 0, sakit = 0, izin = 0, alpha = 0, cuti = 0;

    (staff || []).forEach(staffMember => {
      const user = (users || []).find(u => getStaffIdFromUser(u) === staffMember._id);
      if (!user || user.role === 'admin') return;

      // Check if it's a work day
      if (!isWorkDayForRole(user.role, date)) return;

      const staffId = staffMember._id;
      const record = getAttendanceRecord(staffId, dStr);

      if (record) {
        const s = record.status;
        if (s === 'Sakit') sakit++;
        else if (s === 'Izin') izin++;
        else if (s === 'Cuti') cuti++;
        else if (s === 'Alpha') alpha++;
        else if (s === 'Hadir') hadir++;
        // any other status: ignored (not counted)
      } else if (clockedInStaffIds.has(staffId)) {
        hadir++;
      } else if (date < today) {
        // Past: no attendance record and no clock-in = Alpha
        alpha++;
      }
      // Today: no record, no clock-in = counted as "Belum Absen" (handled by pie caller)
    });

    return { hadir, sakit, izin, cuti, alpha };
  };

  // --- PIE CHART: Today's Attendance Summary ---
  const pieChartData = useMemo(() => {
    const counts = getAttendanceCountsForDate(today);
    const nonAdminStaffCount = (staff || []).filter(s => {
      const user = (users || []).find(u => getStaffIdFromUser(u) === s._id);
      return user && user.role !== 'admin';
    }).filter(s => {
      const user = (users || []).find(u => getStaffIdFromUser(u) === s._id);
      return user && isWorkDayForRole(user.role, today);
    }).length;

    const accounted = counts.hadir + counts.sakit + counts.izin + counts.cuti + counts.alpha;
    const belumAbsen = Math.max(0, nonAdminStaffCount - accounted);

    return {
      labels: ['Hadir', 'Sakit', 'Izin', 'Alpha', 'Cuti', 'Belum Absen'],
      datasets: [
        {
          data: [
            counts.hadir,
            counts.sakit,
            counts.izin,
            counts.alpha,
            counts.cuti,
            belumAbsen
          ],
          backgroundColor: [
            '#10b981', // Hadir - Success
            '#f59e0b', // Sakit - Warning
            '#06b6d4', // Izin - Info
            '#ef4444', // Alpha - Danger
            '#8b5cf6', // Cuti - Purple
            '#94a3b8', // Belum Absen - Slate
          ],
          borderWidth: 2,
          borderColor: theme === 'dark' ? getThemeColor('--bg-card', '#131e3a') : '#ffffff',
          hoverOffset: 12,
        },
      ],
    };
  }, [staff, users, workDaySettings, holidays, todaysRecords, allAttendance, ramadanPeriods, theme]);

  const pieChartOptions = {
    animation: { duration: 800, easing: 'easeOutQuart' as const },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { family: 'Plus Jakarta Sans', size: 12, weight: 500 as const },
          generateLabels: (chart: any) => {
            const datasets = chart.data.datasets;
            return chart.data.labels.map((label: string, i: number) => {
              const value = datasets[0].data[i];
              return {
                text: `${label} (${value})`,
                fillStyle: datasets[0].backgroundColor[i],
                strokeStyle: datasets[0].borderColor?.[i] || 'transparent',
                lineWidth: 0,
                hidden: false,
                index: i,
                pointStyle: 'circle',
              };
            });
          }
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 14,
        cornerRadius: 10,
        titleFont: { family: 'Plus Jakarta Sans', size: 14, weight: 'bold' as const },
        bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
        callbacks: {
          label: (ctx: any) => {
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0) || 1;
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return ` ${ctx.label}: ${ctx.parsed} orang (${pct}%)`;
          }
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    cutout: '52%',
  };

  // --- BAR/LINE CHART: Weekly Attendance Report ---
  // First day of week: Monday (match Indonesian work week perspective)
  const getDaysAgoStr = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return getDateString(d);
  };

  const last7Days = useMemo(() => [6, 5, 4, 3, 2, 1, 0].map(i => getDaysAgoStr(i)), [todayStr]);
  const prev7Days = useMemo(() => [13, 12, 11, 10, 9, 8, 7].map(i => getDaysAgoStr(i)), [todayStr]);

  const computeWeeklyPresence = (dateStrings: string[]) => {
    let totalHadir = 0;
    let totalWork = 0;
    dateStrings.forEach(dStr => {
      const d = new Date(dStr);
      const counts = getAttendanceCountsForDate(d);
      totalHadir += counts.hadir;
      const workableStaff = (staff || []).filter(s => {
        const user = (users || []).find(u => getStaffIdFromUser(u) === s._id);
        return user && user.role !== 'admin' && isWorkDayForRole(user.role, d);
      }).length;
      totalWork += workableStaff;
    });
    return totalWork > 0 ? (totalHadir / totalWork) * 100 : 0;
  };

  const thisWeekPresence = useMemo(() => computeWeeklyPresence(last7Days), [staff, users, workDaySettings, holidays, allRecords, todaysRecords, allAttendance, ramadanPeriods, last7Days]);
  const prevWeekPresence = useMemo(() => computeWeeklyPresence(prev7Days), [staff, users, workDaySettings, holidays, allRecords, allAttendance, ramadanPeriods, prev7Days]);
  const percentChange = prevWeekPresence === 0 ? (thisWeekPresence > 0 ? 100 : 0) : (thisWeekPresence - prevWeekPresence);
  const isTrendUp = percentChange >= 0;

  const barChartData = useMemo(() => {
    const hadirArr: number[] = [];
    const sakitArr: number[] = [];
    const izinArr: number[] = [];
    const alphaArr: number[] = [];
    const cutiArr: number[] = [];

    last7Days.forEach(dStr => {
      const d = new Date(dStr);
      const c = getAttendanceCountsForDate(d);
      hadirArr.push(c.hadir);
      sakitArr.push(c.sakit);
      izinArr.push(c.izin);
      alphaArr.push(c.alpha);
      cutiArr.push(c.cuti);
    });

    return {
      labels: last7Days.map(date => {
        const d = new Date(date);
        const wd = d.toLocaleDateString('id-ID', { weekday: 'short' });
        const day = d.getDate();
        return `${wd.slice(0, 3)}, ${day}`;
      }),
      datasets: [
        {
          label: 'Hadir',
          data: hadirArr,
          backgroundColor: '#10b981',
          borderRadius: 6,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
        {
          label: 'Sakit',
          data: sakitArr,
          backgroundColor: '#f59e0b',
          borderRadius: 6,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
        {
          label: 'Izin',
          data: izinArr,
          backgroundColor: '#06b6d4',
          borderRadius: 6,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
        {
          label: 'Alpha',
          data: alphaArr,
          backgroundColor: '#ef4444',
          borderRadius: 6,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
        {
          label: 'Cuti',
          data: cutiArr,
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          borderSkipped: false as const,
          maxBarThickness: 32,
        },
      ],
    };
  }, [last7Days, staff, users, workDaySettings, holidays, allRecords, todaysRecords, allAttendance, ramadanPeriods, theme]);

  const axisTickColor = getThemeColor('--text-muted', theme === 'dark' ? '#94a3b8' : '#64748b');
  const axisGridColor = theme === 'dark' ? 'rgba(148, 163, 184, 0.15)' : '#f1f5f9';

  const barChartOptions = {
    animation: { duration: 900, easing: 'easeOutQuart' as const },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
          padding: 16,
          font: { family: 'Plus Jakarta Sans', size: 11, weight: 500 as const }
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        cornerRadius: 10,
        titleFont: { family: 'Plus Jakarta Sans', size: 13, weight: 'bold' as const },
        bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
        callbacks: {
          label: (ctx: any) => ` ${ctx.dataset.label}: ${ctx.parsed.y} orang`,
        }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: {
          font: { family: 'Plus Jakarta Sans', size: 11 },
          color: axisTickColor
        },
        border: { display: false }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { family: 'Plus Jakarta Sans', size: 11 },
          color: axisTickColor
        },
        grid: { color: axisGridColor },
        border: { display: false }
      },
    },
  };

  const pieSummaryText = pieChartData.datasets[0].data
    .map((value, index) => `${pieChartData.labels[index]}: ${value}`)
    .join(', ');

  return (
    <Row className="g-4 mt-1">
      <Col lg={4}>
        <Card className="border-0 shadow-sm h-100 overflow-hidden card-hover">
          <Card.Header className="bg-white border-0 py-3 px-4 d-flex align-items-center gap-2">
            <div className="icon-box bg-emerald-light text-primary-green" style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PieChart size={18} />
            </div>
            <h5 className="mb-0 fw-bold text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>Status Hari Ini</h5>
          </Card.Header>
          <Card.Body style={{ height: '340px' }} className="d-flex align-items-center justify-content-center px-3">
            <div role="img" aria-label={`Grafik status kehadiran hari ini: ${pieSummaryText}.`} className="w-100 h-100 d-flex align-items-center justify-content-center">
              <Pie ref={pieChartRef} data={pieChartData} options={pieChartOptions} />
            </div>
            <span className="visually-hidden">{pieSummaryText}</span>
          </Card.Body>
        </Card>
      </Col>
      <Col lg={8}>
        <Card className="border-0 shadow-sm h-100 overflow-hidden card-hover">
          <Card.Header className="bg-white border-0 py-3 px-4 d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="d-flex align-items-center gap-2">
              <div className="icon-box bg-info-light" style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={18} style={{ color: 'var(--info)' }} />
              </div>
              <h5 className="mb-0 fw-bold text-uppercase text-muted" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>Tren Kehadiran Mingguan</h5>
            </div>
            <div
              className={`d-flex align-items-center gap-1 small fw-bold px-3 py-1 rounded-pill ${isTrendUp ? 'bg-emerald-light text-success' : 'bg-danger-light text-danger'}`}
            >
              {isTrendUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>{isTrendUp ? '+' : ''}{percentChange.toFixed(1)}%</span>
              <span className="fw-normal opacity-75">vs minggu lalu</span>
            </div>
          </Card.Header>
          <Card.Body style={{ height: '340px' }} className="px-3">
            <Bar ref={barChartRef} options={barChartOptions} data={barChartData} />
          </Card.Body>
          <Card.Footer className="bg-light border-0 py-2 px-4 small text-muted d-flex align-items-center gap-1">
            <Info size={14} />
            Data diperbarui secara real-time berdasarkan aktivitas absensi.
          </Card.Footer>
        </Card>
      </Col>
    </Row>
  );
});
