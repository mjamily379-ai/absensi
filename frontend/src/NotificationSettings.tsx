import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Row, Col, Button, Spinner } from 'react-bootstrap';
import { Bell, Clock, Send, Save, ShieldCheck, Smartphone } from 'lucide-react';
import api from './api';
import { toast } from 'react-toastify';

const NotificationSettings: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  // Form State
  const [enableMorningReminder, setEnableMorningReminder] = useState<boolean>(true);
  const [morningReminderMinutesBefore, setMorningReminderMinutesBefore] = useState<number>(15);
  const [morningReminderMessage, setMorningReminderMessage] = useState<string>('Jangan lupa untuk absen masuk hari ini!');

  const [enableEveningReminder, setEnableEveningReminder] = useState<boolean>(true);
  const [eveningReminderMinutesBefore, setEveningReminderMinutesBefore] = useState<number>(15);
  const [eveningReminderMessage, setEveningReminderMessage] = useState<string>('Waktu kerja telah selesai, jangan lupa absen pulang!');

  const [enableAbsentAlert, setEnableAbsentAlert] = useState<boolean>(true);
  const [enableLeaveRequestNotifyAdmin, setEnableLeaveRequestNotifyAdmin] = useState<boolean>(true);
  const [enableCorrectionRequestNotifyAdmin, setEnableCorrectionRequestNotifyAdmin] = useState<boolean>(true);
  const [enableAnnouncementPush, setEnableAnnouncementPush] = useState<boolean>(true);
  const [enableLateArrivalAlertAdmin, setEnableLateArrivalAlertAdmin] = useState<boolean>(false);
  const [lateArrivalThresholdMinutes, setLateArrivalThresholdMinutes] = useState<number>(15);

  const [lastUpdated, setLastUpdated] = useState<{ name?: string; at?: string }>({});

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/notification-settings');
      if (res.data) {
        const d = res.data;
        setEnableMorningReminder(d.enableMorningReminder ?? true);
        setMorningReminderMinutesBefore(d.morningReminderMinutesBefore ?? 15);
        setMorningReminderMessage(d.morningReminderMessage || 'Jangan lupa untuk absen masuk hari ini!');

        setEnableEveningReminder(d.enableEveningReminder ?? true);
        setEveningReminderMinutesBefore(d.eveningReminderMinutesBefore ?? 15);
        setEveningReminderMessage(d.eveningReminderMessage || 'Waktu kerja telah selesai, jangan lupa absen pulang!');

        setEnableAbsentAlert(d.enableAbsentAlert ?? true);
        setEnableLeaveRequestNotifyAdmin(d.enableLeaveRequestNotifyAdmin ?? true);
        setEnableCorrectionRequestNotifyAdmin(d.enableCorrectionRequestNotifyAdmin ?? true);
        setEnableAnnouncementPush(d.enableAnnouncementPush ?? true);
        setEnableLateArrivalAlertAdmin(d.enableLateArrivalAlertAdmin ?? false);
        setLateArrivalThresholdMinutes(d.lateArrivalThresholdMinutes ?? 15);

        if (d.updatedAt) {
          setLastUpdated({
            name: d.updatedByName || 'Admin',
            at: new Date(d.updatedAt).toLocaleString('id-ID')
          });
        }
      }
    } catch (err: any) {
      console.error('Error fetching notification settings:', err);
      toast.error('Gagal mengambil konfigurasi notifikasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        enableMorningReminder,
        morningReminderMinutesBefore,
        morningReminderMessage,
        enableEveningReminder,
        eveningReminderMinutesBefore,
        eveningReminderMessage,
        enableAbsentAlert,
        enableLeaveRequestNotifyAdmin,
        enableCorrectionRequestNotifyAdmin,
        enableAnnouncementPush,
        enableLateArrivalAlertAdmin,
        lateArrivalThresholdMinutes
      };

      const res = await api.put('/api/notification-settings', payload);
      toast.success(res.data.message || 'Pengaturan notifikasi berhasil disimpan.');
      if (res.data.settings?.updatedAt) {
        setLastUpdated({
          name: res.data.settings.updatedByName || 'Admin',
          at: new Date(res.data.settings.updatedAt).toLocaleString('id-ID')
        });
      }
    } catch (err: any) {
      console.error('Error saving notification settings:', err);
      toast.error(err.response?.data?.message || 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      const res = await api.post('/api/notification-settings/test');
      toast.success(res.data.message || 'Test notifikasi berhasil dikirim!');
    } catch (err: any) {
      console.error('Error sending test notification:', err);
      toast.error(err.response?.data?.message || 'Gagal mengirim test notifikasi. Pastikan izin notifikasi aktif.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" variant="success" />
        <div className="mt-2 text-muted small">Memuat konfigurasi notifikasi...</div>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
        <div>
          <h2 className="fw-bold text-primary-green mb-1 d-flex align-items-center gap-2">
            <Bell size={28} /> Pengaturan Notifikasi & Web Push
          </h2>
          <p className="text-muted small mb-0">
            Kelola jadwal pengingat absensi otomatis, pesan notifikasi, dan preferensi peringatan push sistem.
          </p>
        </div>

        {lastUpdated.at && (
          <div className="small text-muted bg-light px-3 py-2 rounded-pill border">
            Terakhir diubah: <strong>{lastUpdated.at}</strong> oleh <strong>{lastUpdated.name}</strong>
          </div>
        )}
      </div>

      <Form onSubmit={handleSave}>
        <Row className="g-4">
          {/* Section 1: Pengingat Kehadiran Staf */}
          <Col lg={6}>
            <Card className="border-0 shadow-sm rounded-16 h-100">
              <Card.Header className="bg-white border-0 pt-4 px-4 pb-0">
                <div className="d-flex align-items-center gap-2 text-primary-green fw-bold">
                  <Clock size={20} />
                  <span>Pengingat Kehadiran Staf (Pagi & Pulang)</span>
                </div>
                <p className="text-muted small mt-1 mb-0">
                  Notifikasi otomatis yang dikirim ke browser staf pada jadwal kerja mereka.
                </p>
              </Card.Header>
              <Card.Body className="p-4">
                {/* Morning Reminder */}
                <div className="p-3 bg-light rounded-12 mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <Form.Label className="fw-bold mb-0 text-dark">🌅 Pengingat Absen Masuk (Pagi)</Form.Label>
                    <Form.Check
                      type="switch"
                      id="switch-morning"
                      checked={enableMorningReminder}
                      onChange={(e) => setEnableMorningReminder(e.target.checked)}
                    />
                  </div>
                  <p className="text-muted small mb-3">
                    Mengirim push notification sebelum jam masuk kerja untuk staf yang belum hadir.
                  </p>

                  {enableMorningReminder && (
                    <Row className="g-2">
                      <Col sm={5}>
                        <Form.Label className="small text-muted fw-bold">Kirim Sebelum</Form.Label>
                        <Form.Select
                          size="sm"
                          value={morningReminderMinutesBefore}
                          onChange={(e) => setMorningReminderMinutesBefore(parseInt(e.target.value))}
                        >
                          <option value={5}>5 Menit Sebelum</option>
                          <option value={10}>10 Menit Sebelum</option>
                          <option value={15}>15 Menit Sebelum</option>
                          <option value={30}>30 Menit Sebelum</option>
                          <option value={60}>1 Jam Sebelum</option>
                        </Form.Select>
                      </Col>
                      <Col sm={7}>
                        <Form.Label className="small text-muted fw-bold">Isi Pesan Notifikasi</Form.Label>
                        <Form.Control
                          size="sm"
                          type="text"
                          value={morningReminderMessage}
                          onChange={(e) => setMorningReminderMessage(e.target.value)}
                        />
                      </Col>
                    </Row>
                  )}
                </div>

                {/* Evening Reminder */}
                <div className="p-3 bg-light rounded-12">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <Form.Label className="fw-bold mb-0 text-dark">🌆 Pengingat Absen Pulang (Sore)</Form.Label>
                    <Form.Check
                      type="switch"
                      id="switch-evening"
                      checked={enableEveningReminder}
                      onChange={(e) => setEnableEveningReminder(e.target.checked)}
                    />
                  </div>
                  <p className="text-muted small mb-3">
                    Mengingatkan staf yang sudah absen masuk agar tidak lupa melakukan absen pulang.
                  </p>

                  {enableEveningReminder && (
                    <Row className="g-2">
                      <Col sm={5}>
                        <Form.Label className="small text-muted fw-bold">Kirim Sebelum/Pada</Form.Label>
                        <Form.Select
                          size="sm"
                          value={eveningReminderMinutesBefore}
                          onChange={(e) => setEveningReminderMinutesBefore(parseInt(e.target.value))}
                        >
                          <option value={0}>Tepat Waktu Pulang</option>
                          <option value={10}>10 Menit Sebelum</option>
                          <option value={15}>15 Menit Sebelum</option>
                          <option value={30}>30 Menit Sebelum</option>
                        </Form.Select>
                      </Col>
                      <Col sm={7}>
                        <Form.Label className="small text-muted fw-bold">Isi Pesan Notifikasi</Form.Label>
                        <Form.Control
                          size="sm"
                          type="text"
                          value={eveningReminderMessage}
                          onChange={(e) => setEveningReminderMessage(e.target.value)}
                        />
                      </Col>
                    </Row>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Section 2: Peringatan & Aktivitas Admin */}
          <Col lg={6}>
            <Card className="border-0 shadow-sm rounded-16 h-100">
              <Card.Header className="bg-white border-0 pt-4 px-4 pb-0">
                <div className="d-flex align-items-center gap-2 text-primary-green fw-bold">
                  <ShieldCheck size={20} />
                  <span>Notifikasi & Alert untuk Admin</span>
                </div>
                <p className="text-muted small mt-1 mb-0">
                  Notifikasi instan yang diterima admin saat ada aktivitas baru dari pengguna.
                </p>
              </Card.Header>
              <Card.Body className="p-4 d-flex flex-column gap-3">
                {/* Leave Request Alert */}
                <div className="p-3 bg-light rounded-12 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold small text-dark">📋 Pengajuan Izin / Cuti Baru</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      Kirim notifikasi ke admin saat staf mengajukan izin atau cuti sakit.
                    </div>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-leave-notif"
                    checked={enableLeaveRequestNotifyAdmin}
                    onChange={(e) => setEnableLeaveRequestNotifyAdmin(e.target.checked)}
                  />
                </div>

                {/* Correction Request Alert */}
                <div className="p-3 bg-light rounded-12 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold small text-dark">📝 Pengajuan Koreksi Absensi Baru</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      Kirim notifikasi ke admin saat staf meminta perbaikan jam masuk/pulang.
                    </div>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-corr-notif"
                    checked={enableCorrectionRequestNotifyAdmin}
                    onChange={(e) => setEnableCorrectionRequestNotifyAdmin(e.target.checked)}
                  />
                </div>

                {/* Announcement Auto Push */}
                <div className="p-3 bg-light rounded-12 d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold small text-dark">📢 Push Otomatis saat Pengumuman Dibuat</div>
                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      Secara otomatis mengirim push notification ke role staf yang ditargetkan.
                    </div>
                  </div>
                  <Form.Check
                    type="switch"
                    id="switch-announcement-push"
                    checked={enableAnnouncementPush}
                    onChange={(e) => setEnableAnnouncementPush(e.target.checked)}
                  />
                </div>

                {/* Late Arrival Alert */}
                <div className="p-3 bg-light rounded-12">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div>
                      <div className="fw-bold small text-dark">⚠️ Peringatan Keterlambatan Staf</div>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Beri tahu admin jika ada staf yang belum absen setelah batas toleransi.
                      </div>
                    </div>
                    <Form.Check
                      type="switch"
                      id="switch-late-alert"
                      checked={enableLateArrivalAlertAdmin}
                      onChange={(e) => setEnableLateArrivalAlertAdmin(e.target.checked)}
                    />
                  </div>

                  {enableLateArrivalAlertAdmin && (
                    <div className="mt-2 pt-2 border-top">
                      <Row className="align-items-center g-2">
                        <Col sm={7}>
                          <span className="small text-muted">Batas waktu keterlambatan:</span>
                        </Col>
                        <Col sm={5}>
                          <Form.Select
                            size="sm"
                            value={lateArrivalThresholdMinutes}
                            onChange={(e) => setLateArrivalThresholdMinutes(parseInt(e.target.value))}
                          >
                            <option value={10}>10 Menit setelah masuk</option>
                            <option value={15}>15 Menit setelah masuk</option>
                            <option value={30}>30 Menit setelah masuk</option>
                            <option value={60}>1 Jam setelah masuk</option>
                          </Form.Select>
                        </Col>
                      </Row>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Section 3: Test Notification Card */}
          <Col lg={12}>
            <Card className="border-0 shadow-sm rounded-16 bg-emerald-light">
              <Card.Body className="p-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-white p-3 text-primary-green shadow-xs">
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <h5 className="fw-bold mb-1 text-dark">Uji Coba Push Notifikasi</h5>
                    <p className="text-muted small mb-0">
                      Kirim pesan notifikasi instan untuk memverifikasi apakah browser dan perangkat ini dapat menerima Web Push.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline-success"
                  className="rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2 bg-white"
                  onClick={handleTestNotification}
                  disabled={testing}
                >
                  {testing ? (
                    <>
                      <Spinner animation="border" size="sm" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Kirim Test Notifikasi</span>
                    </>
                  )}
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Save Bar */}
        <div className="d-flex justify-content-end mt-4">
          <Button
            type="submit"
            variant="success"
            size="lg"
            className="rounded-pill px-5 py-2 fw-bold shadow-sm d-flex align-items-center gap-2"
            disabled={saving}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Simpan Pengaturan Notifikasi</span>
              </>
            )}
          </Button>
        </div>
      </Form>
    </Container>
  );
};

export default NotificationSettings;
