const ExcelJS = require('exceljs');
const Staff = require('../models/staffModel');
const User = require('../models/userModel');
const Attendance = require('../models/attendanceModel');
const Record = require('../models/recordModel');
const Holiday = require('../models/holidayModel');
const WorkDay = require('../models/workDayModel');
const LeaveRequest = require('../models/leaveRequestModel');
const RamadanPeriod = require('../models/ramadanModel');
const mongoose = require('mongoose');


const processWorkTimeRecordsForExcel = (staffId, staffName, staffRecords, user, holidaySet, workDaySettings, ramadanPeriods = []) => {
    const dailyRecords = {};
    staffRecords.forEach(record => {
        const ts = new Date(record.timestamp);
        const date = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}`;
        if (!dailyRecords[date]) dailyRecords[date] = [];
        dailyRecords[date].push(record);
    });

    const userWorkDaySettings = workDaySettings.filter(ws => ws.role === user.role);
    const workDayMap = new Map(userWorkDaySettings.map(day => [day.day, day]));

    const processedRecords = [];
    for (const date in dailyRecords) {
        const recordsForDate = dailyRecords[date].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const clockIn = recordsForDate.find(r => r.type === 'clock-in');
        const clockOut = [...recordsForDate].reverse().find(r => r.type === 'clock-out');
        let totalHours = 'N/A';
        let keteranganMasuk = '';
        let keteranganPulang = '';

        const recordDate = new Date(clockIn ? clockIn.timestamp : date + 'T00:00:00Z');
        const dayOfWeek = recordDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][dayOfWeek];
        const currentWorkDay = workDayMap.get(dayName);

        const capitalize = (str) => {
            if (!str) return '';
            return str.replace(/\b\w/g, char => char.toUpperCase());
        };

        if (holidaySet.has(date) || (currentWorkDay && !currentWorkDay.isWorkDay)) {
            keteranganMasuk = 'Hari Libur';
            keteranganPulang = 'Hari Libur';
        } else if (currentWorkDay && currentWorkDay.isWorkDay) {
            // Check if current date is within Ramadan period
            const isRamadan = ramadanPeriods.some(p => date >= p.startDate && date <= p.endDate);
            const startTime = (isRamadan && currentWorkDay.ramadanStartTime) ? currentWorkDay.ramadanStartTime : currentWorkDay.startTime;
            const endTime = (isRamadan && currentWorkDay.ramadanEndTime) ? currentWorkDay.ramadanEndTime : currentWorkDay.endTime;

            if (clockIn) {
                const clockInDate = new Date(clockIn.timestamp);
                const [startHour, startMinute] = startTime.split(':').map(Number);

                if (clockInDate.getHours() < startHour || (clockInDate.getHours() === startHour && clockInDate.getMinutes() < startMinute)) {
                    keteranganMasuk = 'Datang Lebih Awal';
                } else if (clockInDate.getHours() === startHour && clockInDate.getMinutes() === startMinute) {
                    keteranganMasuk = 'Tepat Waktu';
                } else {
                    keteranganMasuk = 'Terlambat';
                }
            }
            if (clockOut) {
                if (clockOut.clockOutStatus) {
                    keteranganPulang = capitalize(clockOut.clockOutStatus);
                } else {
                    // Fallback for old records: calculate status using the NEW rules
                    const clockOutDate = new Date(clockOut.timestamp);
                    const clockOutHour = clockOutDate.getHours();
                    const clockOutMinute = clockOutDate.getMinutes();

                    if (endTime) {
                        const [endHour, endMinute] = endTime.split(':').map(Number);
                        const onTimeEndHour = endHour + 2;

                        const clockOutTimeInMinutes = clockOutHour * 60 + clockOutMinute;
                        const earlyTimeInMinutes = endHour * 60 + endMinute;
                        const onTimeEndInMinutes = onTimeEndHour * 60 + endMinute;

                        if (clockOutTimeInMinutes < earlyTimeInMinutes) {
                            keteranganPulang = 'Pulang Lebih Awal';
                        } else if (clockOutTimeInMinutes >= earlyTimeInMinutes && clockOutTimeInMinutes <= onTimeEndInMinutes) {
                            keteranganPulang = 'Tepat Waktu';
                        } else {
                            keteranganPulang = 'Long Shift';
                        }
                    }
                }
            }
        } else {
            // Fallback for days not defined in workDaySettings
            keteranganMasuk = 'Hari Tidak Didefinisikan';
            keteranganPulang = 'Hari Tidak Didefinisikan';
        }

        if (clockIn && clockOut) {
            const diffMillis = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
            const hours = Math.floor(diffMillis / 3600000);
            const minutes = Math.floor((diffMillis % 3600000) / 60000);
            totalHours = `${hours} jam ${minutes} menit`;
        } else if (clockIn) {
            totalHours = 'Sedang Bekerja';
        }

        processedRecords.push({
            staffId: staffId,
            name: staffName,
            date: date,
            clockInTime: clockIn ? new Date(clockIn.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            clockOutTime: clockOut ? new Date(clockOut.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
            totalHours: totalHours,
            keteranganMasuk,
            keteranganPulang,
            notes: clockIn?.notes || clockOut?.notes || '',
        });
    }
    return processedRecords;
};

exports.exportExcel = async (req, res) => {
    try {
        const { pieChartImage, barChartImage, month, year, role, includeIndividualSheets = true } = req.body;

        // Data fetching and processing logic
        let attendanceQuery = {}, recordQuery = {}, holidayQuery = {};
        const targetYear = year ? parseInt(year) : new Date().getFullYear();
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1; // Default to current month
        const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
        const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        holidayQuery.date = { $regex: `^${targetYear}` };
        attendanceQuery.$expr = { $and: [{ $eq: [{ $toInt: { $substr: ["$date", 0, 4] } }, targetYear] }, { $eq: [{ $toInt: { $substr: ["$date", 5, 2] } }, targetMonth] }] };
        recordQuery.timestamp = { $gte: startOfMonth, $lte: endOfMonth };

        // Scope users by role server-side (also avoids shipping password hashes)
        const userQuery = {};
        if (role && role !== 'all') userQuery.role = { $in: [role.toLowerCase()] };

        let [staff, users, attendance, records, holidays, allWorkDaySettings, allLeaveRequests, ramadanPeriods] = await Promise.all([
            Staff.find({}).select('_id name').lean(),
            User.find(userQuery).select('-password').lean(),
            Attendance.find(attendanceQuery).lean(),
            Record.find(recordQuery).select('staffId timestamp type clockOutStatus notes').lean(),
            Holiday.find(holidayQuery).lean(),
            WorkDay.find().lean(),
            LeaveRequest.find({
                startDate: { $lte: endOfMonth },
                endDate: { $gte: startOfMonth },
                status: 'approved'
            }).select('staffId leaveType startDate endDate status').lean(),
            RamadanPeriod.find().lean()
        ]);

        // Filter by role if specified
        if (role && role !== 'all') {
            const roleUsers = users.filter(u => u.role && u.role.toLowerCase() === role.toLowerCase());
            const roleStaffIds = new Set(roleUsers.map(u => u.staffId ? (u.staffId._id ? u.staffId._id.toString() : u.staffId.toString()) : '').filter(Boolean));
            staff = staff.filter(s => roleStaffIds.has(s._id.toString()));
            users = roleUsers;
        }

        const allProcessedRecords = [];
        staff.forEach(s => {
            const staffRecords = records.filter(r => r.staffId.toString() === s._id.toString());
            const user = users.find(u => u.staffId && (u.staffId._id ? u.staffId._id.toString() : u.staffId.toString()) === s._id.toString());
            if (user) {
                const userHolidaySet = new Set(holidays.filter(h => h.role === 'all' || h.role === user.role).map(h => h.date));
                const processed = processWorkTimeRecordsForExcel(s._id, s.name, staffRecords, user, userHolidaySet, allWorkDaySettings, ramadanPeriods);
                allProcessedRecords.push(...processed);
            }
        });

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'An Najiyah Attendance System';
        workbook.created = new Date();

        // 1. Summary & Charts Sheet
        const summaryAndChartsSheet = workbook.addWorksheet('Summary & Charts');
        
        const addChartToSheet = (base64Data, range) => {
            try {
                if (!base64Data) return;
                const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
                const imageId = workbook.addImage({ 
                    base64: cleanBase64, 
                    extension: 'png' 
                });
                summaryAndChartsSheet.addImage(imageId, range);
            } catch (imageError) {
                console.error('Error adding image to Excel:', imageError);
            }
        };

        if (pieChartImage) addChartToSheet(pieChartImage, 'A1:G25');
        if (barChartImage) addChartToSheet(barChartImage, 'H1:U25');

        // 2. Daily Absensi Report (Matrix)
        const dailyAbsensiSheet = workbook.addWorksheet('Matriks Absensi Bulanan');
        const daysInMonth = endOfMonth.getDate();
        const shortDayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

        const monthName = new Date(targetYear, targetMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
        const monthRow = dailyAbsensiSheet.addRow(['', `LAPORAN KEHADIRAN BULANAN - ${monthName.toUpperCase()}`]);
        dailyAbsensiSheet.mergeCells(monthRow.number, 2, monthRow.number, 1 + daysInMonth + 5);
        monthRow.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        monthRow.getCell(2).font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
        monthRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } };

        const dayNamesHeader = [''];
        const dateNumberHeader = ['Nama Staff'];
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(targetYear, targetMonth - 1, i);
            dayNamesHeader.push(shortDayNames[date.getDay()]);
            dateNumberHeader.push(i);
        }
        dayNamesHeader.push('Hadir', 'Sakit', 'Izin', 'Cuti', 'Alpha');
        dateNumberHeader.push('Total H', 'Total S', 'Total I', 'Total C', 'Total A');
        
        const rowDayNames = dailyAbsensiSheet.addRow(dayNamesHeader);
        const rowDateNumber = dailyAbsensiSheet.addRow(dateNumberHeader);

        dailyAbsensiSheet.mergeCells(monthRow.number, 1, monthRow.number + 2, 1);
        const nameHeaderCell = dailyAbsensiSheet.getCell(monthRow.number, 1);
        nameHeaderCell.value = 'Nama Staff';
        nameHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
        nameHeaderCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        nameHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } };

        // Style the headers
        [rowDayNames, rowDateNumber].forEach(row => {
            row.eachCell((cell, colNumber) => {
                if (colNumber > 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.font = { bold: true, size: 10 };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                }
            });
        });

        dailyAbsensiSheet.getColumn(1).width = 28;
        for (let i = 1; i <= daysInMonth; i++) {
            dailyAbsensiSheet.getColumn(i + 1).width = 4.5;
            dailyAbsensiSheet.getColumn(i + 1).alignment = { horizontal: 'center' };
        }
        for (let j = 0; j < 5; j++) {
            dailyAbsensiSheet.getColumn(daysInMonth + 2 + j).width = 9;
            dailyAbsensiSheet.getColumn(daysInMonth + 2 + j).alignment = { horizontal: 'center' };
        }
        
        const attendanceMap = new Map();
        attendance.forEach(att => attendanceMap.set(`${att.staffId.toString()}_${att.date}`, att.status));

        const leaveRequestMap = new Map();
        allLeaveRequests.forEach(lr => {
            let currentDate = new Date(lr.startDate);
            const endDate = new Date(lr.endDate);
            while (currentDate <= endDate) {
                const dateString = currentDate.toLocaleDateString('en-CA');
                leaveRequestMap.set(`${lr.staffId.toString()}_${dateString}`, lr.leaveType);
                currentDate.setDate(currentDate.getDate() + 1);
            }
        });

        for (const s of staff) {
            const rowData = [s.name];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let hadirCount = 0, sakitCount = 0, izinCount = 0, cutiCount = 0, alphaCount = 0;

            for (let i = 1; i <= daysInMonth; i++) {
                const date = new Date(targetYear, targetMonth - 1, i);
                let statusChar = '';

                if (date > today) {
                    statusChar = '';
                } else {
                    const dateString = date.toLocaleDateString('en-CA');
                    const staffId = s._id.toString();
                    const attStatus = attendanceMap.get(`${staffId}_${dateString}`);
                    const leaveStatus = leaveRequestMap.get(`${staffId}_${dateString}`);

                    const currentDayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][date.getDay()];
                    const user = users.find(u => u.staffId && (u.staffId._id ? u.staffId._id.toString() : u.staffId.toString()) === staffId);
                    const userRole = user ? user.role : 'staff';
                    const userWorkDay = allWorkDaySettings.find(wd => wd.role === userRole && wd.day === currentDayName);

                    const staffHolidaySet = new Set(holidays.filter(h => h.role === 'all' || h.role === userRole).map(h => h.date));
                    const isHoliday = staffHolidaySet.has(dateString);
                    const isWorkDay = userWorkDay && userWorkDay.isWorkDay;

                    if (leaveStatus) {
                        statusChar = leaveStatus.charAt(0);
                    } else if (attStatus) {
                        statusChar = attStatus.charAt(0);
                    } else if (isHoliday || (user && !isWorkDay)) {
                        statusChar = '';
                    } else {
                        statusChar = 'A';
                    }
                }
                rowData.push(statusChar);
                if (statusChar === 'H') hadirCount++;
                else if (statusChar === 'S') sakitCount++;
                else if (statusChar === 'I') izinCount++;
                else if (statusChar === 'C') cutiCount++;
                else if (statusChar === 'A') alphaCount++;
            }
            rowData.push(hadirCount, sakitCount, izinCount, cutiCount, alphaCount);
            const addedRow = dailyAbsensiSheet.addRow(rowData);
            
            // Format and highlight matrix cells
            addedRow.eachCell((cell, colIdx) => {
                cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
                if (colIdx > 1 && colIdx <= daysInMonth + 1) {
                    const val = cell.value;
                    if (val === 'H') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
                        cell.font = { color: { argb: 'FF2E7D32' }, bold: true };
                    } else if (val === 'S') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
                        cell.font = { color: { argb: 'FFE65100' }, bold: true };
                    } else if (val === 'I') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE1F5FE' } };
                        cell.font = { color: { argb: 'FF0277BD' }, bold: true };
                    } else if (val === 'C') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
                        cell.font = { color: { argb: 'FF7B1FA2' }, bold: true };
                    } else if (val === 'A') {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
                        cell.font = { color: { argb: 'FFC62828' }, bold: true };
                    }
                } else if (colIdx > daysInMonth + 1) {
                    cell.font = { bold: true };
                }
            });
        }

        // 3. Daily Work Activity Sheet
        const dailyWorkActivitySheet = workbook.addWorksheet('Aktivitas Kerja Harian');
        dailyWorkActivitySheet.columns = [
            { header: 'Nama Staff', key: 'name', width: 25 },
            { header: 'Role', key: 'role', width: 20 },
            { header: 'Tanggal', key: 'date', width: 15 },
            { header: 'Status Kehadiran', key: 'status', width: 18 },
            { header: 'Jam Masuk (Aktual)', key: 'clockInTime', width: 20 },
            { header: 'Jam Pulang (Aktual)', key: 'clockOutTime', width: 20 },
            { header: 'Total Jam Kerja', key: 'totalHours', width: 20 },
            { header: 'Keterangan Masuk', key: 'keteranganMasuk', width: 20 },
            { header: 'Keterangan Pulang', key: 'keteranganPulang', width: 20 },
            { header: 'Catatan Admin', key: 'adminNotes', width: 25 },
        ];
        
        // Header style
        dailyWorkActivitySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        dailyWorkActivitySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } };
        dailyWorkActivitySheet.getRow(1).height = 25;

        const dailyWorkActivityData = [];
        for (const att of attendance) {
            const user = users.find(u => u.staffId && (u.staffId._id ? u.staffId._id.toString() : u.staffId.toString()) === att.staffId.toString());
            if (!user && role && role !== 'all') continue;
            const procRec = allProcessedRecords.find(pr => pr.staffId.toString() === att.staffId.toString() && pr.date === att.date);
            dailyWorkActivityData.push({
                name: att.name,
                role: user?.role || 'Staff',
                date: att.date,
                status: att.status,
                clockInTime: procRec ? procRec.clockInTime : 'N/A',
                clockOutTime: procRec ? procRec.clockOutTime : 'N/A',
                totalHours: procRec ? procRec.totalHours : 'N/A',
                keteranganMasuk: procRec ? procRec.keteranganMasuk : 'N/A',
                keteranganPulang: procRec ? procRec.keteranganPulang : 'N/A',
                adminNotes: procRec ? procRec.notes : '',
            });
        }
        dailyWorkActivitySheet.addRows(dailyWorkActivityData);

        // 4. Monthly Recap Sheet
        const monthlyRecapSheet = workbook.addWorksheet('Rekapitulasi Bulanan');
        monthlyRecapSheet.columns = [
            { header: 'Nama Staff', key: 'name', width: 25 },
            { header: 'Role', key: 'role', width: 18 },
            { header: 'Bulan', key: 'month', width: 15 },
            { header: 'Tahun', key: 'year', width: 10 },
            { header: 'Jumlah Hadir', key: 'totalHadir', width: 15 },
            { header: 'Jumlah Sakit', key: 'totalSakit', width: 15 },
            { header: 'Jumlah Izin', key: 'totalIzin', width: 15 },
            { header: 'Jumlah Cuti', key: 'totalCuti', width: 15 },
            { header: 'Jumlah Alpha', key: 'totalAlpha', width: 15 },
            { header: 'Datang Lebih Awal', key: 'totalDatangLebihAwal', width: 20 },
            { header: 'Tepat Waktu (Masuk)', key: 'totalTepatWaktuMasuk', width: 20 },
            { header: 'Terlambat', key: 'totalTerlambat', width: 15 },
            { header: 'Pulang Lebih Awal', key: 'totalPulangLebihAwal', width: 20 },
            { header: 'Tepat Waktu (Pulang)', key: 'totalTepatWaktuPulang', width: 20 },
            { header: 'Jumlah Long Shift', key: 'totalLongShift', width: 15 },
            { header: 'Total Jam Kerja Bulanan', key: 'totalMonthlyHours', width: 25 },
            { header: 'Rata-rata Jam Kerja Harian', key: 'avgDailyHours', width: 25 },
        ];
        
        monthlyRecapSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        monthlyRecapSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } };
        monthlyRecapSheet.getRow(1).height = 25;

        const monthlyRecapData = [];
        const monthlyAggregates = new Map();

        for (const att of attendance) {
            const staffIdKey = att.staffId.toString();
            const date = new Date(att.date);
            const monthKey = date.getMonth();
            const yearKey = date.getFullYear();
            const key = `${staffIdKey}-${monthKey}-${yearKey}`;

            if (!monthlyAggregates.has(key)) {
                monthlyAggregates.set(key, {
                    staffId: staffIdKey,
                    name: att.name,
                    role: users.find(u => u.staffId && (u.staffId._id ? u.staffId._id.toString() : u.staffId.toString()) === staffIdKey)?.role || 'Staff',
                    month: date.toLocaleString('id-ID', { month: 'long' }),
                    year: yearKey,
                    totalHadir: 0,
                    totalSakit: 0,
                    totalIzin: 0,
                    totalAlpha: 0,
                    totalCuti: 0,
                    totalDatangLebihAwal: 0,
                    totalTepatWaktuMasuk: 0,
                    totalTerlambat: 0,
                    totalPulangLebihAwal: 0,
                    totalTepatWaktuPulang: 0,
                    totalLongShift: 0,
                    totalWorkHoursInMinutes: 0,
                    workDaysCount: 0,
                });
            }
            const aggregate = monthlyAggregates.get(key);
            if (att.status === 'Hadir') aggregate.totalHadir++;
            else if (att.status === 'Sakit') aggregate.totalSakit++;
            else if (att.status === 'Izin') aggregate.totalIzin++;
            else if (att.status === 'Cuti') aggregate.totalCuti++;
            else if (att.status === 'Alpha') aggregate.totalAlpha++;
        }

        for (const procRec of allProcessedRecords) {
            const staffIdKey = procRec.staffId.toString();
            const date = new Date(procRec.date);
            const monthKey = date.getMonth();
            const yearKey = date.getFullYear();
            const key = `${staffIdKey}-${monthKey}-${yearKey}`;

            if (monthlyAggregates.has(key)) {
                const aggregate = monthlyAggregates.get(key);
                if (procRec.totalHours && procRec.totalHours.includes('jam')) {
                    const parts = procRec.totalHours.match(/(\d+) jam (\d+) menit/);
                    if (parts) {
                        aggregate.totalWorkHoursInMinutes += (parseInt(parts[1]) * 60) + parseInt(parts[2]);
                        aggregate.workDaysCount++;
                    }
                }
                if (procRec.keteranganMasuk) {
                    if (procRec.keteranganMasuk === 'Datang Lebih Awal') aggregate.totalDatangLebihAwal++;
                    if (procRec.keteranganMasuk === 'Tepat Waktu') aggregate.totalTepatWaktuMasuk++;
                    if (procRec.keteranganMasuk === 'Terlambat') aggregate.totalTerlambat++;
                }
                if (procRec.keteranganPulang) {
                    if (procRec.keteranganPulang === 'Pulang Lebih Awal') aggregate.totalPulangLebihAwal++;
                    if (procRec.keteranganPulang === 'Tepat Waktu') aggregate.totalTepatWaktuPulang++;
                    if (procRec.keteranganPulang === 'Long Shift') aggregate.totalLongShift++;
                }
            }
        }

        for (const [_key, aggregate] of monthlyAggregates.entries()) {
            const totalMonthlyHoursFormatted = `${Math.floor(aggregate.totalWorkHoursInMinutes / 60)} jam ${Math.round(aggregate.totalWorkHoursInMinutes % 60)} menit`;
            const avgDailyHoursFormatted = aggregate.workDaysCount > 0
                ? `${Math.floor((aggregate.totalWorkHoursInMinutes / aggregate.workDaysCount) / 60)} jam ${Math.round((aggregate.totalWorkHoursInMinutes / aggregate.workDaysCount) % 60)} menit`
                : 'N/A';
            monthlyRecapData.push({
                ...aggregate,
                totalMonthlyHours: totalMonthlyHoursFormatted,
                avgDailyHours: avgDailyHoursFormatted,
            });
        }
        monthlyRecapSheet.addRows(monthlyRecapData);

        // 5. Individual Tab per Staff (Optional / Default true for Bulk)
        if (includeIndividualSheets) {
            staff.forEach((s, idx) => {
                const _user = users.find(u => u.staffId && (u.staffId._id ? u.staffId._id.toString() : u.staffId.toString()) === s._id.toString());
                const staffProcRecords = allProcessedRecords.filter(pr => pr.staffId.toString() === s._id.toString());
                
                let cleanSheetName = `${idx + 1}. ${s.name}`.replace(/[\\/?*:[\]]/g, '').trim().substring(0, 30);
                const staffSheet = workbook.addWorksheet(cleanSheetName);

                staffSheet.columns = [
                    { header: 'Tanggal', key: 'date', width: 15 },
                    { header: 'Status', key: 'status', width: 15 },
                    { header: 'Jam Masuk', key: 'clockInTime', width: 18 },
                    { header: 'Jam Pulang', key: 'clockOutTime', width: 18 },
                    { header: 'Total Jam', key: 'totalHours', width: 20 },
                    { header: 'Keterangan Masuk', key: 'keteranganMasuk', width: 22 },
                    { header: 'Keterangan Pulang', key: 'keteranganPulang', width: 22 },
                    { header: 'Catatan', key: 'notes', width: 25 },
                ];

                staffSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
                staffSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4D3E' } };

                const rows = staffProcRecords.map(pr => {
                    const att = attendance.find(a => a.staffId.toString() === s._id.toString() && a.date === pr.date);
                    return {
                        date: pr.date,
                        status: att ? att.status : 'Hadir',
                        clockInTime: pr.clockInTime,
                        clockOutTime: pr.clockOutTime,
                        totalHours: pr.totalHours,
                        keteranganMasuk: pr.keteranganMasuk,
                        keteranganPulang: pr.keteranganPulang,
                        notes: pr.notes,
                    };
                });
                staffSheet.addRows(rows);
            });
        }

        const fileNameRole = role && role !== 'all' ? `_${role.replace(/\s+/g, '_')}` : '';
        const finalFileName = `Laporan_Absensi_Bulk${fileNameRole}_${targetMonth}-${targetYear}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (_err) {
        console.error('Error exporting Excel:', _err);
        res.status(500).send('Error exporting data to Excel');
    }
};

exports.exportPersonalExcel = async (req, res) => {
  try {
    const { staffId, month, year } = req.query;
    if (!staffId) {
      return res.status(400).send('Staff ID is required for personal export.');
    }

    // IDOR guard: staff may only export their own attendance report.
    if (req.user.role !== 'admin' && String(req.user.staffId || '') !== String(staffId)) {
      return res.status(403).send('Akses terlarang. Anda hanya dapat mengekspor data sendiri.');
    }

    let attendanceQuery = { staffId: new mongoose.Types.ObjectId(staffId) }, 
        recordQuery = { staffId: new mongoose.Types.ObjectId(staffId) }, 
        holidayQuery = {};

    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const reportMonth = month ? parseInt(month) : new Date().getMonth() + 1;
    
    holidayQuery.date = { $regex: `^${targetYear}` };

    let startPeriod = new Date(targetYear, reportMonth - 1, 1);
    let endPeriod = new Date(targetYear, reportMonth, 0, 23, 59, 59, 999);
    let fileNameSuffix = `_${reportMonth}-${targetYear}`;

    if (!month) {
        startPeriod = new Date(targetYear, 0, 1);
        endPeriod = new Date(targetYear, 11, 31, 23, 59, 59, 999);
        fileNameSuffix = `_${targetYear}`;
    }

    attendanceQuery.date = { 
        $gte: startPeriod.toLocaleDateString('en-CA'),
        $lte: endPeriod.toLocaleDateString('en-CA')
    };
    recordQuery.timestamp = { $gte: startPeriod, $lte: endPeriod };

    const [staffDetails, userDetails, attendanceData, recordsData, holidays, allWorkDaySettings, personalLeaveRequests, ramadanPeriods] = await Promise.all([
      Staff.findById(staffId).select('_id name').lean(),
      User.findOne({ staffId: staffId }).select('-password -tokenVersion').lean(),
      Attendance.find(attendanceQuery).lean(),
      Record.find(recordQuery).select('staffId timestamp type clockOutStatus notes').lean(),
      Holiday.find(holidayQuery).lean(),
      WorkDay.find().lean(),
      LeaveRequest.find({ 
          staffId: new mongoose.Types.ObjectId(staffId),
          startDate: { $lte: endPeriod },
          endDate: { $gte: startPeriod },
          status: 'approved'
      }).select('staffId leaveType startDate endDate status').lean(),
      RamadanPeriod.find().lean()
    ]);

    if (!staffDetails || !userDetails) {
      return res.status(404).send('Staff or User not found.');
    }
    
    const holidaySet = new Set(holidays.filter(h => h.role === 'all' || h.role === userDetails.role).map(h => h.date));
    const allProcessedRecords = processWorkTimeRecordsForExcel(staffId, staffDetails.name, recordsData, userDetails, holidaySet, allWorkDaySettings, ramadanPeriods);
    
    const workbook = new ExcelJS.Workbook();
    // Sanitize staff name for filename
    const sanitizedStaffName = staffDetails.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalFileName = `Personal_Attendance_Report_${sanitizedStaffName}${fileNameSuffix}.xlsx`;

    // --- Sheet 1: Daily Absensi Report ---
    const dailyAbsensiSheet = workbook.addWorksheet('Daily Absensi Report');
    const daysInMonth = new Date(targetYear, reportMonth, 0).getDate();
    const shortDayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    const monthName = new Date(targetYear, reportMonth - 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    const monthRow = dailyAbsensiSheet.addRow(['', monthName]);
    dailyAbsensiSheet.mergeCells(monthRow.number, 2, monthRow.number, 1 + daysInMonth + 5); // +5 for Hadir, Sakit, Izin, Cuti, Alpha
    monthRow.getCell(2).alignment = { horizontal: 'center' };
    
    const dayNamesHeader = [''];
    const dateNumberHeader = ['nama'];
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(targetYear, reportMonth - 1, i);
        dayNamesHeader.push(shortDayNames[date.getDay()]);
        dateNumberHeader.push(i);
    }
    dayNamesHeader.push('Hadir', 'Sakit', 'Izin', 'Cuti', 'Alpha');
    dateNumberHeader.push('Total', 'Total', 'Total', 'Total', 'Total');
    dailyAbsensiSheet.addRow(dayNamesHeader);
    dailyAbsensiSheet.addRow(dateNumberHeader);

    dailyAbsensiSheet.getColumn(1).width = 25;
    for (let i = 1; i <= daysInMonth; i++) {
        dailyAbsensiSheet.getColumn(i + 1).width = 5;
        dailyAbsensiSheet.getColumn(i + 1).alignment = { horizontal: 'center' };
    }
    dailyAbsensiSheet.getColumn(daysInMonth + 2).width = 10;
    dailyAbsensiSheet.getColumn(daysInMonth + 3).width = 10;
    dailyAbsensiSheet.getColumn(daysInMonth + 4).width = 10;
    dailyAbsensiSheet.getColumn(daysInMonth + 5).width = 10;
    dailyAbsensiSheet.getColumn(daysInMonth + 6).width = 10;
    
    const attendanceMap = new Map();
    attendanceData.forEach(att => attendanceMap.set(att.date, att.status));
    const leaveRequestMap = new Map();
    personalLeaveRequests.forEach(lr => {
        let currentDate = new Date(lr.startDate);
        const lrEndDate = new Date(lr.endDate);
        while (currentDate <= lrEndDate) {
            leaveRequestMap.set(currentDate.toLocaleDateString('en-CA'), lr.leaveType);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });

    const dataRow = [staffDetails.name];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let hadirCount = 0, sakitCount = 0, izinCount = 0, cutiCount = 0, alphaCount = 0;

    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(targetYear, reportMonth - 1, i);
        let statusChar = '';

        if (date > today) {
            statusChar = '';
        } else {
            const dateString = date.toLocaleDateString('en-CA');
            const attStatus = attendanceMap.get(dateString);
            const leaveStatus = leaveRequestMap.get(dateString);
            const currentDayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][date.getDay()];
            const userWorkDay = allWorkDaySettings.find(wd => wd.role === userDetails.role && wd.day === currentDayName);

            if (leaveStatus) {
                statusChar = leaveStatus.charAt(0);
            } else if (attStatus) {
                statusChar = attStatus.charAt(0);
            } else if (holidaySet.has(dateString) || !(userWorkDay && userWorkDay.isWorkDay)) {
                statusChar = '';
            } else {
                statusChar = 'A';
            }
        }
        dataRow.push(statusChar);
        if (statusChar === 'H') hadirCount++;
        else if (statusChar === 'S') sakitCount++;
        else if (statusChar === 'I') izinCount++;
        else if (statusChar === 'C') cutiCount++;
        else if (statusChar === 'A') alphaCount++;
    }
    dataRow.push(hadirCount, sakitCount, izinCount, cutiCount, alphaCount);
    dailyAbsensiSheet.addRow(dataRow);
    
    dailyAbsensiSheet.mergeCells(monthRow.number, 1, monthRow.number + 2, 1);
    dailyAbsensiSheet.getCell(monthRow.number, 1).value = 'nama';
    dailyAbsensiSheet.getCell(monthRow.number, 1).alignment = { vertical: 'middle', horizontal: 'center' };
    
    // --- Sheet 2: Daily Work Activity ---
    const dailyWorkActivitySheet = workbook.addWorksheet('Daily Work Activity');
    dailyWorkActivitySheet.columns = [
        { header: 'Nama Staff', key: 'name', width: 25 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Tanggal', key: 'date', width: 15 },
        { header: 'Status Kehadiran', key: 'status', width: 20 },
        { header: 'Jam Masuk', key: 'clockInTime', width: 20 },
        { header: 'Jam Pulang', key: 'clockOutTime', width: 20 },
        { header: 'Total Jam', key: 'totalHours', width: 25 },
        { header: 'Keterangan Masuk', key: 'keteranganMasuk', width: 20 },
        { header: 'Keterangan Pulang', key: 'keteranganPulang', width: 20 },
        { header: 'Catatan Admin', key: 'adminNotes', width: 30 },
    ];
    
    const dailyWorkActivityData = allProcessedRecords.map(rec => {
        const attRecord = attendanceData.find(a => a.date === rec.date);
        return {
            name: rec.name,
            role: userDetails.role,
            date: rec.date,
            status: attRecord ? attRecord.status : 'Hadir',
            clockInTime: rec.clockInTime,
            clockOutTime: rec.clockOutTime,
            totalHours: rec.totalHours,
            keteranganMasuk: rec.keteranganMasuk,
            keteranganPulang: rec.keteranganPulang,
            adminNotes: rec.notes,
        };
    });
    dailyWorkActivitySheet.addRows(dailyWorkActivityData);
    
    // --- Sheet 3: Monthly Recap ---
    const monthlyRecapSheet = workbook.addWorksheet('Monthly Recap');
    monthlyRecapSheet.columns = [
        { header: 'Nama Staff', key: 'name', width: 25 }, { header: 'Role', key: 'role', width: 15 },
        { header: 'Bulan', key: 'month', width: 15 }, { header: 'Tahun', key: 'year', width: 10 },
        { header: 'Hadir', key: 'totalHadir', width: 10 }, { header: 'Sakit', key: 'totalSakit', width: 10 },
        { header: 'Izin', key: 'totalIzin', width: 10 }, { header: 'Cuti', key: 'totalCuti', width: 10 },
        { header: 'Alpha', key: 'totalAlpha', width: 10 }, 
        { header: 'Datang Awal', key: 'totalDatangLebihAwal', width: 15 }, { header: 'Tepat Waktu (Masuk)', key: 'totalTepatWaktuMasuk', width: 15 },
        { header: 'Terlambat', key: 'totalTerlambat', width: 15 }, { header: 'Pulang Awal', key: 'totalPulangLebihAwal', width: 15 },
        { header: 'Tepat Waktu (Pulang)', key: 'totalTepatWaktuPulang', width: 15 },
        { header: 'Jumlah Long Shift', key: 'totalLongShift', width: 15 },
        { header: 'Total Jam Kerja', key: 'totalMonthlyHours', width: 20 }, { header: 'Rata-rata Jam Harian', key: 'avgDailyHours', width: 20 },
    ];
    
    const monthlyAggregates = new Map();
    for (const att of attendanceData) {
        const date = new Date(att.date);
        const monthKey = date.toLocaleString('id-ID', { month: 'long' });
        const yearKey = date.getFullYear();
        const key = `${monthKey}-${yearKey}`;

        if (!monthlyAggregates.has(key)) {
            monthlyAggregates.set(key, {
                name: att.name, role: userDetails.role, month: monthKey, year: yearKey,
                totalHadir: 0, totalSakit: 0, totalIzin: 0, totalAlpha: 0, totalCuti: 0,
                totalDatangLebihAwal: 0, totalTepatWaktuMasuk: 0, totalTerlambat: 0,
                totalPulangLebihAwal: 0, totalTepatWaktuPulang: 0, totalLongShift: 0,
                totalWorkHoursInMinutes: 0, workDaysCount: 0,
            });
        }
        const aggregate = monthlyAggregates.get(key);
        switch(att.status) {
            case 'Hadir': aggregate.totalHadir++; break;
            case 'Sakit': aggregate.totalSakit++; break;
            case 'Izin': aggregate.totalIzin++; break;
            case 'Alpha': aggregate.totalAlpha++; break;
            case 'Cuti': aggregate.totalCuti++; break;
        }
    }

    for (const procRec of allProcessedRecords) {
        const date = new Date(procRec.date);
        const monthKey = date.toLocaleString('id-ID', { month: 'long' });
        const yearKey = date.getFullYear();
        const key = `${monthKey}-${yearKey}`;

        if (monthlyAggregates.has(key)) {
            const aggregate = monthlyAggregates.get(key);
            if (procRec.totalHours.includes('jam')) {
                const parts = procRec.totalHours.match(/(\d+) jam (\d+) menit/);
                if (parts) {
                    aggregate.totalWorkHoursInMinutes += (parseInt(parts[1]) * 60) + parseInt(parts[2]);
                    aggregate.workDaysCount++;
                }
            }
            if (procRec.keteranganMasuk === 'Datang Lebih Awal') aggregate.totalDatangLebihAwal++;
            if (procRec.keteranganMasuk === 'Tepat Waktu') aggregate.totalTepatWaktuMasuk++;
            if (procRec.keteranganMasuk === 'Terlambat') aggregate.totalTerlambat++;
            if (procRec.keteranganPulang === 'Pulang Lebih Awal') aggregate.totalPulangLebihAwal++;
            if (procRec.keteranganPulang === 'Tepat Waktu') aggregate.totalTepatWaktuPulang++;
            if (procRec.keteranganPulang === 'Long Shift') aggregate.totalLongShift++;
        }
    }

    const monthlyRecapData = [];
    for (const [_key, aggregate] of monthlyAggregates.entries()) {
        const totalMonthlyHoursFormatted = `${Math.floor(aggregate.totalWorkHoursInMinutes / 60)} jam ${Math.round(aggregate.totalWorkHoursInMinutes % 60)} menit`;
        const avgDailyHoursFormatted = aggregate.workDaysCount > 0 ? `${Math.floor((aggregate.totalWorkHoursInMinutes / aggregate.workDaysCount) / 60)} jam ${Math.round((aggregate.totalWorkHoursInMinutes / aggregate.workDaysCount) % 60)} menit` : 'N/A';
        monthlyRecapData.push({ ...aggregate, totalMonthlyHours: totalMonthlyHoursFormatted, avgDailyHours: avgDailyHoursFormatted });
    }
    monthlyRecapSheet.addRows(monthlyRecapData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${finalFileName}"`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (_err) {
    console.error('Error exporting personal Excel:', _err);
    res.status(500).send('Error exporting data to Excel');
  }
};