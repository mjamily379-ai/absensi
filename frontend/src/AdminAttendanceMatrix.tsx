import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from './api';
import { Card, Form, Alert, Spinner } from 'react-bootstrap';
import { CalendarDays, LayoutGrid } from 'lucide-react';
import { MONTHS_ID, ROLE_LABELS } from './constants/roles';
import './AdminAttendanceMatrix.css';

interface MatrixCell {
  ch: string;
  id?: string;
}

interface MatrixRow {
  staffId: string;
  name: string;
  role: string;
  days: Record<string, MatrixCell>;
  counts: { hadir: number; sakit: number; izin: number; cuti: number; alpha: number };
}

interface MatrixResponse {
  data: MatrixRow[];
  total: number;
}

const SHORT_DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  H: { label: 'Hadir', cls: 'hadir' },
  S: { label: 'Sakit', cls: 'sakit' },
  I: { label: 'Izin', cls: 'izin' },
  A: { label: 'Alpha', cls: 'alpha' },
  C: { label: 'Cuti', cls: 'cuti' }
};

const AdminAttendanceMatrix: React.FC = () => {
  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [role, setRole] = useState<string>('all');
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const daysInMonth = new Date(year, month, 0).getDate();

  // Stale-response guard: only the latest request may update state, so a slow
  // response can't overwrite the result of a newer filter selection.
  const fetchSeqRef = useRef(0);

  const fetchMatrix = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (role !== 'all') params.set('role', role);
      const response = await api.get(`/api/attendance/matrix?${params.toString()}`);
      if (seq !== fetchSeqRef.current) return;
      const body = response.data as MatrixResponse;
      setRows(body.data || []);
    } catch (err) {
      console.error('Matrix fetch error:', err);
      if (seq !== fetchSeqRef.current) return;
      setError('Gagal memuat matriks kehadiran.');
    } finally {
      if (seq === fetchSeqRef.current) setIsLoading(false);
    }
  }, [year, month, role]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const years = () => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  };

  const dayHeader = (day: number) => {
    const dow = new Date(year, month - 1, day).getDay();
    return { num: day, short: SHORT_DAY_NAMES[dow] };
  };

  return (
    <div className="admin-matrix">
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-3 p-md-4">
          <div className="d-flex flex-wrap align-items-end gap-3">
            <div>
              <h5 className="d-flex align-items-center gap-2 mb-1">
                <LayoutGrid size={18} className="text-primary-green" /> Matriks Kehadiran
              </h5>
              <p className="text-muted small mb-0">Status harian H (Hadir) / S (Sakit) / I (Izin) / A (Alpha) / C (Cuti)</p>
            </div>
            <div className="ms-auto d-flex flex-wrap gap-2 align-items-end">
              <Form.Group>
                <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Bulan</Form.Label>
                <Form.Select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ minWidth: 130 }}>
                  {MONTHS_ID.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Tahun</Form.Label>
                <Form.Select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ minWidth: 100 }}>
                  {years().map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Role</Form.Label>
                <Form.Select value={role} onChange={(e) => setRole(e.target.value)} style={{ minWidth: 160 }}>
                  <option value="all">Semua Role</option>
                  {Object.entries(ROLE_LABELS).filter(([r]) => r !== 'admin').map(([r, label]) => (
                    <option key={r} value={r}>{label}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-3 mt-3 mb-2">
            {Object.entries(STATUS_META).map(([ch, meta]) => (
              <span key={ch} className="d-inline-flex align-items-center gap-1 small text-muted">
                <span className={`matrix-legend-dot matrix-${meta.cls}`} /> {ch} = {meta.label}
              </span>
            ))}
          </div>

          {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
          {isLoading && (
            <div className="d-flex justify-content-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          )}

          {!isLoading && !error && (
            <div className="matrix-scroll mt-3">
              <table className="table matrix-table mb-0">
                <thead>
                  <tr>
                    <th className="matrix-sticky-first">Nama Karyawan</th>
                    <th className="matrix-sticky-second">Role</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const h = dayHeader(d);
                      return (
                        <th key={d} className="matrix-day-header text-center">
                          <div className="matrix-day-num">{h.num}</div>
                          <div className="matrix-day-short">{h.short}</div>
                        </th>
                      );
                    })}
                    <th className="text-center">H</th>
                    <th className="text-center">S</th>
                    <th className="text-center">I</th>
                    <th className="text-center">C</th>
                    <th className="text-center">A</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.staffId}>
                      <td className="matrix-sticky-first fw-semibold">{row.name}</td>
                      <td className="matrix-sticky-second text-muted small">
                        {ROLE_LABELS[row.role as keyof typeof ROLE_LABELS] || row.role}
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                        const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const cell = row.days[dateKey];
                        const meta = cell ? STATUS_META[cell.ch] : null;
                        return (
                          <td key={d} className="text-center p-1">
                            {meta ? (
                              <span className={`matrix-cell matrix-${meta.cls}`} title={`${meta.label} - ${dateKey}`}>
                                {cell.ch}
                              </span>
                            ) : (
                              <span className="matrix-cell matrix-empty">&middot;</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="text-center fw-bold text-success">{row.counts.hadir}</td>
                      <td className="text-center text-warning">{row.counts.sakit}</td>
                      <td className="text-center text-info">{row.counts.izin}</td>
                      <td className="text-center text-purple">{row.counts.cuti}</td>
                      <td className="text-center text-danger">{row.counts.alpha}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={daysInMonth + 7} className="text-center text-muted py-4">
                        Tidak ada data untuk periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>

      <p className="text-muted small d-flex align-items-center gap-2">
        <CalendarDays size={14} /> Total {rows.length} karyawan ditampilkan.
      </p>
    </div>
  );
};

export default AdminAttendanceMatrix;