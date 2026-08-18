import type { PayrollReport } from "@/types/attendance";

const border = {
  top: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  left: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  bottom: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
  right: { style: "thin" as const, color: { argb: "FFE5E7EB" } },
};

export async function downloadPayrollXlsx(report: PayrollReport) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Bembex Attendance Portal";
  const sheet = workbook.addWorksheet("Payroll", { views: [{ state: "frozen", ySplit: 4 }] });

  sheet.mergeCells("A1:P1");
  sheet.getCell("A1").value = "MONTHLY PAYROLL REPORT";
  sheet.mergeCells("A2:P2");
  sheet.getCell("A2").value = `Cycle: ${report.cycleStart} to ${report.cycleEnd} · Assessed through: ${report.calculatedThrough ?? "Not started"}`;
  sheet.addRow([]);
  sheet.addRow(["EMPLOYEE CODE", "EMPLOYEE", "DEPARTMENT", "MONTHLY SALARY", "PAYROLL DAYS", "ASSESSED WORKING DAYS", "PRESENT", "LATE", "ABSENT", "HALF DAYS", "HALF-DAY DEDUCTION", "TOTAL DEDUCTION DAYS", "DEDUCTION AMOUNT", "PAYABLE SALARY", "ABSENT DATES", "HALF-DAY DATES"]);

  report.rows.forEach((row) => sheet.addRow([
    row.employeeCode, row.employee, row.department, row.monthlySalary, row.payrollDays,
    row.assessedWorkingDays, row.presentDays, row.lateDays, row.absentDays, row.halfDays,
    row.halfDayDeductionDays, row.totalDeductionDays, row.deductionAmount, row.payableSalary,
    row.attendanceDetails.filter((detail) => detail.status === "ABSENT").map((detail) => `${detail.date} (${detail.day})`).join("; "),
    row.attendanceDetails.filter((detail) => detail.status === "HALF_DAY").map((detail) => `${detail.date} (${detail.day})`).join("; "),
  ]));

  sheet.addRow([]);
  const summaryRow = sheet.addRow(["TOTAL", "", "", report.summary.grossSalary, "", "", "", "", "", "", "", "", report.summary.deductions, report.summary.payableSalary]);
  sheet.mergeCells(summaryRow.number, 1, summaryRow.number, 3);
  [16, 24, 20, 18, 14, 15, 12, 10, 10, 12, 20, 22, 20, 20, 38, 38].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  [4, 13, 14].forEach((column) => { sheet.getColumn(column).numFmt = '"PKR" #,##0.00'; });
  sheet.autoFilter = { from: "A4", to: "P4" };
  sheet.getRow(1).height = 30;
  sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF171717" } };
  sheet.getCell("A2").font = { color: { argb: "FF4B5563" }, italic: true };
  sheet.getRow(4).eachCell((cell) => { cell.font = { bold: true, color: { argb: "FF374151" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } }; });
  summaryRow.eachCell({ includeEmpty: true }, (cell) => { cell.font = { bold: true }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } }; });
  sheet.eachRow((row, rowNumber) => { if (rowNumber < 4) return; row.eachCell({ includeEmpty: true }, (cell) => { cell.border = border; cell.alignment = { vertical: "middle", wrapText: true }; }); });

  const buffer = await workbook.xlsx.writeBuffer();
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(new Uint8Array(buffer));
  const url = URL.createObjectURL(new Blob([copy.buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `payroll-${report.month}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
