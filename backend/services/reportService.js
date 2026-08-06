const User = require('../models/userModel');
const Staff = require('../models/staffModel');
const WorkDay = require('../models/workDayModel');
const Holiday = require('../models/holidayModel');

// This function is adapted from the original index.js
const processWorkTimeRecords = (staffId, records, staff, user, holidaySet, workDaySettings, ramadanPeriods = []) => {
      const dailyRecords = {};
      records.forEach(record => {
        const date = new Date(record.timestamp).toLocaleDateString('en-CA');
        if (!dailyRecords[date]) dailyRecords[date] = [];
        dailyRecords[date].push(record);
      });

      if(!user || !staff) {
        return []; // If no user or staff, no records can be processed
      }
      const userWorkDaySettings = workDaySettings.filter(ws => ws.role === user.role);
      const workDayMap = new Map(userWorkDaySettings.map(day => [day.day, day]));
      const processedRecords = [];
      for (const date in dailyRecords) {
        const recordsForDate = dailyRecords[date].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const clockIn = recordsForDate.find(r => r.type === 'clock-in');
        const clockOut = [...recordsForDate].reverse().find(r => r.type === 'clock-out');
        let totalHours = 'N/A';
        if (clockIn && clockOut) {
          const diffMillis = new Date(clockOut.timestamp).getTime() - new Date(clockIn.timestamp).getTime();
          const hours = Math.floor(diffMillis / 3600000);
          const minutes = Math.floor((diffMillis % 3600000) / 60000);
          totalHours = `${hours} jam ${minutes} menit`;
        } else if (clockIn) {
          totalHours = 'Sedang Bekerja';
        }

        let keteranganMasuk = '';
        let keteranganPulang = '';
        const recordDate = new Date(clockIn ? clockIn.timestamp : date + 'T00:00:00Z');
        const dayOfWeek = recordDate.getDay();
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
            keteranganMasuk = 'Hari Tidak Didefinisikan';
            keteranganPulang = 'Hari Tidak Didefinisikan';
        }

        processedRecords.push({
          _id: clockIn?._id || clockOut?._id || date, // Provide a stable key
          staffId,
          name: staff.name || 'Unknown',
          date,
          clockInTime: clockIn ? new Date(clockIn.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          clockOutTime: clockOut ? new Date(clockOut.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
          totalHours, 
          keteranganMasuk,
          keteranganPulang,
          entry_status: clockIn?.entry_status || 'normal',
          notes: clockIn?.notes,
          edited_by: clockIn?.edited_by,
        });
      }
      return processedRecords;
    };

module.exports = { processWorkTimeRecords };
