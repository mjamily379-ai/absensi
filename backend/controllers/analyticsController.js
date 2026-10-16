const { getMonthlyAnalytics } = require('../services/analyticsService');

// Phase 5 — server-side analytics endpoints.
// All data is derived in analyticsService.getMonthlyAnalytics (single pass),
// so overview / roles / lateness / personal stay consistent with each other.

const parsePeriod = (req) => {
    const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month, 10) : new Date().getMonth() + 1;
    const role = req.query.role && req.query.role !== 'all' ? req.query.role : undefined;
    return { year, month, role };
};

// 5.1 — Monthly overview (totals, on-time/alpa/sick %, avg hours, lateness).
exports.getOverview = async (req, res) => {
    try {
        const { year, month, role } = parsePeriod(req);
        const { summary, roles, period, lateness, weekly } = await getMonthlyAnalytics({ year, month, role });
        res.json({ period, summary, roles, lateness, weekly });
    } catch (err) {
        console.error('Analytics overview error:', err);
        res.status(500).json({ message: 'Error computing analytics overview' });
    }
};

// 5.4 — Role-level analytics: attendance % per role for the given month.
exports.getRoles = async (req, res) => {
    try {
        const { year, month, role } = parsePeriod(req);
        const { roles, period, summary } = await getMonthlyAnalytics({ year, month, role });
        res.json({ period, roles, summary });
    } catch (err) {
        console.error('Analytics roles error:', err);
        res.status(500).json({ message: 'Error computing role analytics' });
    }
};

// 5.3 — Lateness distribution by time-window, long-shift count, weekly trend.
exports.getLateness = async (req, res) => {
    try {
        const { year, month, role } = parsePeriod(req);
        const { lateness, weekly, period, summary } = await getMonthlyAnalytics({ year, month, role });
        res.json({ period, lateness, weekly, summary });
    } catch (err) {
        console.error('Analytics lateness error:', err);
        res.status(500).json({ message: 'Error computing lateness analytics' });
    }
};

// 5.7 — Personal analytics parity: server-side on-time/lateness % for one staff.
// Defaults to the requester's own staffId; admins may pass another staffId.
exports.getPersonal = async (req, res) => {
    try {
        const { year, month } = parsePeriod(req);
        let staffId = req.query.staffId;
        const isAdmin = req.user && req.user.role === 'admin';
        if (!staffId) {
            if (!req.user || !req.user.staffId) {
                return res.status(400).json({ message: 'Staff ID tidak ditemukan.' });
            }
            staffId = req.user.staffId;
        } else if (!isAdmin) {
            return res.status(403).json({ message: 'Akses terlarang.' });
        }

        const { users, period, summary } = await getMonthlyAnalytics({ year, month, staffId });
        const personal = users.length > 0 ? users[0] : null;
        if (!personal) {
            return res.status(404).json({ message: 'Data staf tidak ditemukan.' });
        }

        const onTimeRate = personal.onTime + personal.late > 0
            ? Math.round((personal.onTime / (personal.onTime + personal.late)) * 10000) / 100
            : null;

        res.json({
            period,
            personal: {
                staffId: personal.staffId,
                name: personal.name,
                role: personal.role,
                workdays: personal.workdays,
                hadir: personal.hadir,
                onTime: personal.onTime,
                late: personal.late,
                lateRate: personal.onTime + personal.late > 0
                    ? Math.round((personal.late / (personal.onTime + personal.late)) * 10000) / 100
                    : null,
                onTimeRate,
                sick: personal.sick,
                izin: personal.izin,
                cuti: personal.cuti,
                alpha: personal.alpha,
                longShifts: personal.longShifts,
                avgHoursFormatted: personal.avgHoursFormatted,
                totalHoursFormatted: personal.totalHoursFormatted
            },
            summary
        });
    } catch (err) {
        console.error('Personal analytics error:', err);
        res.status(500).json({ message: 'Error computing personal analytics' });
    }
};