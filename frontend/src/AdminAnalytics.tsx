import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { Bar } from 'react-chartjs-2';
import { Card, Row, Col, Form, Table, Button, Alert, Spinner } from 'react-bootstrap';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartJSTitle,
  Tooltip,
  Legend as ChartJSLegend
} from 'chart.js';
import {
  BarChart3,
  Clock,
  CalendarCheck,
  Timer,
  Activity,
  TrendingUp,
  Briefcase,
  X
} from 'lucide-react';
import type { AnalyticsPeriod, AnalyticsSummary, RoleAnalytics, LatenessAnalytics, WeeklyTrendItem } from './types';
import { MONTHS_ID, ROLE_LABELS } from './constants/roles';
import './AdminAnalytics.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartJSTitle, Tooltip, ChartJSLegend);

interface OverviewResponse {
  period: AnalyticsPeriod;
  summary: AnalyticsSummary;
  roles: RoleAnalytics[];
  lateness: LatenessAnalytics;
  weekly: WeeklyTrendItem[];
}

const FORMAT_PCT = (rate: number | null | undefined): string => (rate === null || rate === undefined ? 'N/A' : `${rate}%`);

const AdminAnalytics: React.FC = () => {
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [role, setRole] = useState<string>('all');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Stale-response guard: only the latest request may update state, so a slow
  // response can't overwrite the result of a newer filter selection.
  const fetchSeqRef = useRef(0);

  const fetchOverview = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ month: String(month), year: String(year) });
      if (role !== 'all') params.set('role', role);
      const response = await api.get(`/api/analytics/overview?${params.toString()}`);
      if (seq !== fetchSeqRef.current) return;
      setData(response.data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      if (seq !== fetchSeqRef.current) return;
      setError('Gagal memuat data analitik.');
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, [month, year, role]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

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

  const summary = data?.summary;
  const lateness = data?.lateness;
  const weekly = data?.weekly || [];
  const roles = data?.roles || [];

  const years = useCallback(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  const axisColor = theme === 'dark' ? getThemeColor('--text', '#e5e7eb') : getThemeColor('--text', '#374151');
  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';

  const latenessChartData = {
    labels: (lateness?.distribution || []).map((d) => d.label),
    datasets: [
      {
        label: 'Jumlah keterlambatan',
        data: (lateness?.distribution || []).map((d) => d.count),
        backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
        borderRadius: 8,
        maxBarThickness: 52
      }
    ]
  };

  const weeklyChartData = {
    labels: weekly.map((w) => w.label),
    datasets: [
      {
        label: 'Kehadiran (%)',
        data: weekly.map((w) => w.attendanceRate ?? 0),
        backgroundColor: getThemeColor('--success', '#10b981'),
        borderRadius: 8,
        maxBarThickness: 48,
        yAxisID: 'yPct'
      },
      {
        label: 'Terlambat',
        data: weekly.map((w) => w.late),
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        maxBarThickness: 48,
        yAxisID: 'yCount'
      }
    ]
  };

  const chartOptions = (extra: any = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: axisColor } },
      tooltip: { mode: 'index' as const, intersect: false }
    },
    scales: {
      x: { ticks: { color: axisColor }, grid: { color: gridColor } },
      y: { ticks: { color: axisColor }, grid: { color: gridColor }, beginAtZero: true },
      ...extra
    }
  });

  const weeklyOptions = chartOptions({
    yPct: { position: 'left' as const, ticks: { color: axisColor, callback: (v: unknown) => `${v}%` }, grid: { color: gridColor }, beginAtZero: true, max: 100 },
    yCount: { position: 'right' as const, ticks: { color: axisColor }, grid: { drawOnChartArea: false }, beginAtZero: true }
  });

  const kpiCards = summary ? [
    { label: 'Staf Diukur', value: String(summary.staffCount), icon: <Briefcase size={20} />, color: '--info' },
    { label: 'Hari Kerja (Total)', value: String(summary.workdays), icon: <CalendarCheck size={20} />, color: '--info' },
    { label: 'Hadir', value: String(summary.hadir), icon: <Activity size={20} />, color: '--success' },
    { label: 'Tepat Waktu', value: FORMAT_PCT(summary.onTimeRate), icon: <Timer size={20} />, color: '--success' },
    { label: 'Terlambat', value: String(summary.late), icon: <Clock size={20} />, color: '--warning' },
    { label: 'Alpa', value: FORMAT_PCT(summary.alphaRate), icon: <X size={20} />, color: '--danger' },
    { label: 'Sakit', value: FORMAT_PCT(summary.sickRate), icon: <Activity size={20} />, color: '--warning' },
    { label: 'Rata-rata Jam', value: summary.avgHoursFormatted, icon: <TrendingUp size={20} />, color: '--primary-main' }
  ] : [];

  return (
    <div className="admin-analytics">
      <Row className="g-3 mb-4">
        <Col xl={4} lg={3} md={4}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Bulan</Form.Label>
            <Form.Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS_ID.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xl={3} lg={3} md={4}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Tahun</Form.Label>
            <Form.Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xl={3} lg={3} md={4}>
          <Form.Group>
            <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Role</Form.Label>
            <Form.Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="all">Semua Role</option>
              {Object.entries(ROLE_LABELS).filter(([r]) => r !== 'admin').map(([r, label]) => (
                <option key={r} value={r}>{label}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col xl={2} lg={3} md={12} className="d-flex align-items-end">
          <p className="text-muted small mb-2">
            <Clock size={14} /> Analitik dihitung oleh server{' '}
            {data ? `${data.period.start} s/d ${data.period.end}` : ''}
          </p>
        </Col>
      </Row>

      {role !== 'all' && (
        <Alert variant="info" className="d-flex flex-wrap align-items-center gap-2 py-2 px-3">
          <span className="small">Filter role aktif:</span>
          <strong className="small">{ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}</strong>
          <Button variant="outline-secondary" size="sm" className="ms-auto rounded-pill" onClick={() => setRole('all')}>
            <X size={14} className="me-1" /> Reset
          </Button>
        </Alert>
      )}

      {isLoading && (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" variant="primary" />
        </div>
      )}

      {error && !isLoading && <Alert variant="danger">{error}</Alert>}

      {!isLoading && data && (
        <>
          <div className="analytics-kpi-grid mb-4">
            {kpiCards.map((k) => (
              <div key={k.label} className="analytics-kpi-card">
                <div className="analytics-kpi-icon" style={{ color: `var(${k.color})`, backgroundColor: `color-mix(in srgb, var(${k.color}) 14%, transparent)` }}>
                  {k.icon}
                </div>
                <div className="analytics-kpi-body">
                  <div className="analytics-kpi-value">{k.value}</div>
                  <div className="analytics-kpi-label">{k.label}</div>
                </div>
              </div>
            ))}
            <div className="analytics-kpi-card analytics-kpi-card-warn" title="Terlambat pulang melebihi jam kerja + 2 jam">
              <div className="analytics-kpi-icon" style={{ color: 'var(--warning)', backgroundColor: 'color-mix(in srgb, var(--warning) 14%, transparent)' }}>
                <BarChart3 size={20} />
              </div>
              <div className="analytics-kpi-body">
                <div className="analytics-kpi-value">{lateness?.longShiftCount ?? 0}</div>
                <div className="analytics-kpi-label">Long Shift (Lembur)</div>
              </div>
            </div>
          </div>

          <Row className="g-4 mb-4">
            <Col lg={6}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h5 className="d-flex align-items-center gap-2 mb-1">
                    <Clock size={18} className="text-warning" /> Distribusi Keterlambatan
                  </h5>
                  <p className="text-muted small mb-3">Jumlah keterlambatan berdasarkan rentang waktu tiba</p>
                  <div className="chart-box" style={{ height: 260 }}>
                    <Bar data={latenessChartData} options={chartOptions()} />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Body>
                  <h5 className="d-flex align-items-center gap-2 mb-1">
                    <TrendingUp size={18} className="text-primary-green" /> Tren Mingguan
                  </h5>
                  <p className="text-muted small mb-3">Perbandingan kehadiran & keterlambatan per minggu</p>
                  <div className="chart-box" style={{ height: 260 }}>
                    <Bar data={weeklyChartData} options={weeklyOptions} />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <h5 className="d-flex align-items-center gap-2 mb-1">
                <Activity size={18} className="text-primary-green" /> Analitik per Role
              </h5>
              <p className="text-muted small mb-3">Klik baris role untuk melihat statistik detail role tersebut</p>
              <div className="table-responsive">
                <Table hover size="sm" className="align-middle mb-0 analytics-role-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th className="text-center">Staf</th>
                      <th className="text-center">Hari Kerja</th>
                      <th className="text-center">Hadir</th>
                      <th className="text-center">Terlambat</th>
                      <th className="text-center">Kehadiran</th>
                      <th className="text-center">Tepat Waktu</th>
                      <th className="text-center">Alpa</th>
                      <th className="text-center">Rata-rata Jam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map((r) => (
                      <tr key={r.role} onClick={() => setRole(r.role === role ? 'all' : r.role)} className="clickable-row">
                        <td className="fw-semibold">{ROLE_LABELS[r.role as keyof typeof ROLE_LABELS] || r.role}</td>
                        <td className="text-center">{r.staffCount}</td>
                        <td className="text-center">{r.workdays}</td>
                        <td className="text-center text-success fw-bold">{r.hadir}</td>
                        <td className="text-center text-warning">{r.late}</td>
                        <td className="text-center">{FORMAT_PCT(r.attendanceRate)}</td>
                        <td className="text-center">{FORMAT_PCT(r.onTimeRate)}</td>
                        <td className="text-center text-danger">{FORMAT_PCT(r.alphaRate)}</td>
                        <td className="text-center">{r.avgHoursFormatted}</td>
                      </tr>
                    ))}
                    {roles.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4">
                          Belum ada data untuk periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;