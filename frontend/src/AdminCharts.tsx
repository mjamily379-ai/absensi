import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Pie, Bar } from 'react-chartjs-2';
import type { Attendance, User } from './types';
import { Card, Row, Col } from 'react-bootstrap';
import { PieChart, BarChart3, TrendingUp, Info } from 'lucide-react';

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

interface AdminChartsProps {
  allAttendance: Attendance[];
  users: User[];
}

export const AdminCharts = forwardRef<AdminChartsRef, AdminChartsProps>(({ allAttendance, users }, ref) => {
  const pieChartRef = useRef<ChartJS<'pie', number[], string>>(null);
  const barChartRef = useRef<ChartJS<'bar', number[], string>>(null);

  useImperativeHandle(ref, () => ({
    getChartImages: () => {
      const pieChartImage = pieChartRef.current?.toBase64Image() || '';
      const barChartImage = barChartRef.current?.toBase64Image() || '';
      return { pieChartImage, barChartImage };
    },
  }));

  // --- Pie Chart Logic: Today's Attendance Summary ---
  const today = new Date().toLocaleDateString('en-CA');
  const todaysAttendance = allAttendance.filter(a => a.date === today);

  const totalStaff = users.filter(u => u.role !== 'admin').length;
  const hadirCount = todaysAttendance.filter(a => a.status === 'Hadir').length;
  const sakitCount = todaysAttendance.filter(a => a.status === 'Sakit').length;
  const izinCount = todaysAttendance.filter(a => a.status === 'Izin').length;
  const alphaCount = todaysAttendance.filter(a => a.status === 'Alpha').length;
  const cutiCount = todaysAttendance.filter(a => a.status === 'Cuti').length;
  const remainingNotPresentCount = totalStaff - hadirCount - sakitCount - izinCount - alphaCount - cutiCount;

  const pieChartData = {
    labels: ['Hadir', 'Sakit', 'Izin', 'Alpha', 'Cuti', 'Belum Absen'],
    datasets: [
      {
        data: [
          hadirCount,
          sakitCount,
          izinCount,
          alphaCount,
          cutiCount,
          remainingNotPresentCount > 0 ? remainingNotPresentCount : 0
        ],
        backgroundColor: [
          '#10b981', // Hadir - Success
          '#f59e0b', // Sakit - Warning
          '#06b6d4', // Izin - Info
          '#ef4444', // Alpha - Danger
          '#8b5cf6', // Cuti - Purple
          '#94a3b8', // Belum Absen - Slate
        ],
        borderWidth: 0,
        hoverOffset: 10
      },
    ],
  };

  const pieChartOptions = {
    animation: { duration: 800 },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { family: 'inherit', size: 12 }
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 14, weight: 'bold' as const },
        bodyFont: { size: 13 }
      }
    },
    responsive: true,
    maintainAspectRatio: false,
  };

  // --- Bar Chart Logic: Weekly Attendance Report ---
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toLocaleDateString('en-CA');
  }).reverse();

  const barChartData = {
    labels: last7Days.map(date => new Date(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Hadir',
        data: last7Days.map(date => allAttendance.filter(a => a.date === date && a.status === 'Hadir').length),
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
      {
        label: 'Sakit',
        data: last7Days.map(date => allAttendance.filter(a => a.date === date && a.status === 'Sakit').length),
        backgroundColor: '#f59e0b',
        borderRadius: 4,
      },
      {
        label: 'Izin',
        data: last7Days.map(date => allAttendance.filter(a => a.date === date && a.status === 'Izin').length),
        backgroundColor: '#06b6d4',
        borderRadius: 4,
      },
      {
        label: 'Alpha',
        data: last7Days.map(date => allAttendance.filter(a => a.date === date && a.status === 'Alpha').length),
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
      {
        label: 'Cuti',
        data: last7Days.map(date => allAttendance.filter(a => a.date === date && a.status === 'Cuti').length),
        backgroundColor: '#8b5cf6',
        borderRadius: 4,
      },
    ],
  };

  const barChartOptions = {
    animation: { duration: 1000 },
    plugins: {
      legend: {
        position: 'top' as const,
        align: 'end' as const,
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          font: { family: 'inherit', size: 11 }
        }
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        cornerRadius: 8
      }
    },
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        grid: { display: false }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { stepSize: 1 },
        grid: { color: '#f1f5f9' }
      },
    },
  };

  return (
    <Row className="g-4 mt-1">
      <Col lg={4}>
        <Card className="border-0 shadow-sm h-100 overflow-hidden">
          <Card.Header className="bg-white border-0 py-3 d-flex align-items-center gap-2">
            <PieChart size={20} className="text-primary-green" />
            <h5 className="mb-0 fw-bold small text-uppercase text-muted">Status Hari Ini</h5>
          </Card.Header>
          <Card.Body style={{ height: '320px' }} className="d-flex align-items-center justify-content-center">
            <Pie ref={pieChartRef} data={pieChartData} options={pieChartOptions} />
          </Card.Body>
        </Card>
      </Col>
      <Col lg={8}>
        <Card className="border-0 shadow-sm h-100 overflow-hidden">
          <Card.Header className="bg-white border-0 py-3 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <BarChart3 size={20} className="text-primary-green" />
              <h5 className="mb-0 fw-bold small text-uppercase text-muted">Tren Kehadiran Mingguan</h5>
            </div>
            <div className="d-flex align-items-center gap-1 text-success small fw-bold">
              <TrendingUp size={14} />
              <span>+5% dari minggu lalu</span>
            </div>
          </Card.Header>
          <Card.Body style={{ height: '320px' }}>
            <Bar ref={barChartRef} options={barChartOptions} data={barChartData} />
          </Card.Body>
          <Card.Footer className="bg-light border-0 py-2 small text-muted d-flex align-items-center gap-1">
            <Info size={14} />
            Data diperbarui secara real-time berdasarkan aktivitas absensi.
          </Card.Footer>
        </Card>
      </Col>
    </Row>
  );
});
