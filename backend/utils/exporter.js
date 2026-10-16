const ExcelJS = require('exceljs');

// Shared helpers for report exports (Excel + CSV).
// Phase 5 adds leave-request & correction-review exports alongside the
// existing attendance exports; both formats are produced server-side.

// Escape a single CSV cell (quotes/trailing commas/newlines).
const csvCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const sendCsv = (res, filename, headers, rows) => {
    const lines = [headers, ...rows].map((row) => row.map(csvCell).join(','));
    // BOM so Excel opens UTF-8 (Indonesian text) correctly.
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + lines.join('\r\n'));
};

// Build a workbook with a single title + table sheet and stream it to the response.
const sendXlsx = async (res, filename, { title, headers, rows, columnWidths }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'An Najiyah Attendance System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(title || 'Laporan');

    const headerRow = sheet.addRow(headers.map((h) => h.label));
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    const dataRows = rows.map((row) => sheet.addRow(row.map((cell) => (cell === null || cell === undefined ? '' : cell))));

    if (columnWidths) {
        columnWidths.forEach((width, i) => {
            if (width) sheet.getColumn(i + 1).width = width;
        });
    }
    dataRows.forEach((row) => {
        row.alignment = { vertical: 'middle' };
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
};

const downloadExporter = (res, format, filename, headers, rows, options = {}) => {
    if (format === 'csv') {
        sendCsv(res, filename.replace(/\.xlsx$/i, '.csv'), headers.map((h) => h.label), rows);
        return;
    }
    return sendXlsx(res, filename, { headers, rows, ...options });
};

module.exports = { sendCsv, sendXlsx, downloadExporter };