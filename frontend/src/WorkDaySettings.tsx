import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Button, Form, Container, Row, Col, Card, Spinner, InputGroup } from 'react-bootstrap';
import api from './api';
import type { WorkDay } from './types';
import { Settings, Clock, Moon, Save, UserCheck, Calendar } from 'lucide-react';

const WorkDaySettings: React.FC = () => {
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<string>('staff');

  const daysOfWeek = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const roles = ['admin', 'staff', 'petugas kebersihan', 'guru ra', 'guru mi akhwat', 'guru mi ikhwan', 'guru tahfidz fase a', 'guru tahfidz fase b & c'];

  useEffect(() => {
    const fetchWorkDays = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/api/workday?role=${selectedRole}`);
        if (response.data && response.data.length > 0) {
          const sortedWorkDays = daysOfWeek.map(day => {
            const foundDay = response.data.find((d: WorkDay) => d.day === day);
            return foundDay || {
              day,
              role: selectedRole,
              isWorkDay: false,
              startTime: '00:00',
              endTime: '00:00',
              ramadanStartTime: '00:00',
              ramadanEndTime: '00:00',
            };
          });
          setWorkDays(sortedWorkDays);
        } else {
          const defaultWorkDays = daysOfWeek.map(day => ({
            day,
            role: selectedRole,
            isWorkDay: !['Sabtu', 'Minggu'].includes(day),
            startTime: '08:00',
            endTime: '17:00',
            ramadanStartTime: '08:00',
            ramadanEndTime: '15:00',
          }));
          setWorkDays(defaultWorkDays as WorkDay[]);
        }
      } catch (error) {
        toast.error('Gagal memuat pengaturan hari kerja.');
        console.error('Error fetching work days:', error);
        const defaultWorkDays = daysOfWeek.map(day => ({
          day,
          role: selectedRole,
          isWorkDay: !['Sabtu', 'Minggu'].includes(day),
          startTime: '08:00',
          endTime: '17:00',
          ramadanStartTime: '08:00',
          ramadanEndTime: '15:00',
        }));
        setWorkDays(defaultWorkDays as WorkDay[]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkDays();
  }, [selectedRole]);

  const handleCheckboxChange = (index: number) => {
    const updatedWorkDays = [...workDays];
    updatedWorkDays[index].isWorkDay = !updatedWorkDays[index].isWorkDay;
    setWorkDays(updatedWorkDays);
  };

  const handleTimeChange = (index: number, field: keyof WorkDay, value: string) => {
    const updatedWorkDays = [...workDays];
    (updatedWorkDays[index] as any)[field] = value;
    setWorkDays(updatedWorkDays);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await api.post(`/api/workday`, { workDays, role: selectedRole });
      toast.success('Pengaturan hari kerja berhasil disimpan.');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan.');
      console.error('Error saving work days:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container fluid className="py-4">
      <div className="mb-4">
        <h1 className="h3 mb-1 fw-bold text-dark d-flex align-items-center gap-2">
          <Settings className="text-primary" size={32} />
          Aturan Jam Kerja
        </h1>
        <p className="text-muted">Tentukan hari dan jam kerja yang berlaku untuk absensi berdasarkan peran masing-masing.</p>
      </div>

      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="bg-light rounded">
          <Row className="align-items-center">
            <Col md={6}>
              <div className="d-flex align-items-center gap-3">
                <div className="bg-primary text-white p-3 rounded-circle shadow-sm">
                  <UserCheck size={24} />
                </div>
                <div>
                  <h5 className="mb-0 fw-bold text-capitalize">Peraturan Untuk: {selectedRole}</h5>
                  <p className="small text-muted mb-0">Pilih peran di samping untuk mengubah aturan.</p>
                </div>
              </div>
            </Col>
            <Col md={6} className="text-md-end mt-3 mt-md-0">
              <div className="d-inline-block text-start">
                <Form.Label className="small fw-bold text-muted text-uppercase mb-1">Ganti Peran</Form.Label>
                <Form.Select 
                  value={selectedRole} 
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="fw-bold border-primary"
                  style={{ minWidth: '200px' }}
                >
                  {roles.map(role => (
                    <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
                  ))}
                </Form.Select>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="text-muted mt-2">Memuat pengaturan...</p>
        </div>
      ) : (
        <Form>
          <Row className="g-3">
            {workDays.map((workDay, index) => (
              <Col key={index} xs={12}>
                <Card className={`border-0 shadow-sm ${workDay.isWorkDay ? 'border-start border-4 border-primary' : 'opacity-75'}`}>
                  <Card.Body className="py-3">
                    <Row className="align-items-center">
                      <Col md={2}>
                        <Form.Check 
                          type="switch"
                          id={`switch-${index}`}
                          label={<span className={`fw-bold h5 mb-0 ${workDay.isWorkDay ? 'text-primary' : 'text-muted'}`}>{workDay.day}</span>}
                          checked={workDay.isWorkDay}
                          onChange={() => handleCheckboxChange(index)}
                          className="workday-switch"
                        />
                      </Col>
                      
                      <Col md={5}>
                        <div className="d-flex gap-3">
                          <div className="flex-fill">
                            <Form.Label className="small text-muted mb-1 d-flex align-items-center gap-1">
                              <Clock size={14} /> Jam Masuk
                            </Form.Label>
                            <Form.Control 
                              type="time"
                              value={workDay.startTime}
                              onChange={(e) => handleTimeChange(index, 'startTime', e.target.value)}
                              disabled={!workDay.isWorkDay}
                              className="border-0 bg-light"
                            />
                          </div>
                          <div className="flex-fill">
                            <Form.Label className="small text-muted mb-1 d-flex align-items-center gap-1">
                              <Clock size={14} /> Jam Pulang
                            </Form.Label>
                            <Form.Control 
                              type="time"
                              value={workDay.endTime}
                              onChange={(e) => handleTimeChange(index, 'endTime', e.target.value)}
                              disabled={!workDay.isWorkDay}
                              className="border-0 bg-light"
                            />
                          </div>
                        </div>
                      </Col>

                      <Col md={5}>
                        <div className="d-flex gap-3 bg-light p-2 rounded">
                          <div className="flex-fill">
                            <Form.Label className="small text-primary mb-1 d-flex align-items-center gap-1">
                              <Moon size={14} /> Masuk Ramadhan
                            </Form.Label>
                            <Form.Control 
                              type="time"
                              value={workDay.ramadanStartTime}
                              onChange={(e) => handleTimeChange(index, 'ramadanStartTime', e.target.value)}
                              disabled={!workDay.isWorkDay}
                              className="border-0"
                            />
                          </div>
                          <div className="flex-fill">
                            <Form.Label className="small text-primary mb-1 d-flex align-items-center gap-1">
                              <Moon size={14} /> Pulang Ramadhan
                            </Form.Label>
                            <Form.Control 
                              type="time"
                              value={workDay.ramadanEndTime}
                              onChange={(e) => handleTimeChange(index, 'ramadanEndTime', e.target.value)}
                              disabled={!workDay.isWorkDay}
                              className="border-0"
                            />
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
          
          <div className="mt-4 text-end">
            <Button 
              variant="primary" 
              size="lg"
              onClick={handleSaveSettings} 
              disabled={isSaving}
              className="px-5 py-3 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
            >
              {isSaving ? (
                <><Spinner as="span" animation="border" size="sm" /> Menyimpan...</>
              ) : (
                <><Save size={20} /> Simpan Pengaturan</>
              )}
            </Button>
          </div>
        </Form>
      )}
    </Container>
  );
};

export default WorkDaySettings;