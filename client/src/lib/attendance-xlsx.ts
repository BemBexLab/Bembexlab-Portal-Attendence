import type { AttendanceRow, AttendanceStatus } from "@/types/attendance";

type MonthlyEmployee = {
  employeeCode: string;
  employee: string;
  attendanceByDate: Map<string, AttendanceRow>;
};

const border = {
  top: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
  left: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
  bottom: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
  right: { style: "thin" as const, color: { argb: "FFD9D9D9" } },
};

const statusColors: Record<AttendanceStatus, { fill: string; font: string }> = {
  PRESENT: { fill: "FFD1FAE5", font: "FF047857" },
  ABSENT: { fill: "FFFEE2E2", font: "FFDC2626" },
  LATE: { fill: "FFFEF3C7", font: "FFB45309" },
  HALF_DAY: { fill: "FFFEF3C7", font: "FFB45309" },
  MISSING_CHECKOUT: { fill: "FFE0F2FE", font: "FF0369A1" },
  ON_LEAVE: { fill: "FFEDE9FE", font: "FF6D28D9" },
  HOLIDAY: { fill: "FFF3F4F6", font: "FF4B5563" },
  REMOTE: { fill: "FFDBEAFE", font: "FF1D4ED8" },
};

function formatStatus(status: AttendanceStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function triggerDownload(data: Uint8Array, filename: string) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const blob = new Blob([copy.buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadMonthlyAttendanceXlsx(
  filename: string,
  dates: string[],
  employees: MonthlyEmployee[],
  currentDate: string,
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Monthly attendance", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 2 }],
  });

  sheet.mergeCells("A1:A2");
  sheet.mergeCells("B1:B2");
  sheet.getCell("A1").value = "EMPLOYEE ID";
  sheet.getCell("B1").value = "NAME";
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 24;

  dates.forEach((date, index) => {
    const statusColumn = 3 + index * 2;
    const checkInColumn = statusColumn + 1;
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "long",
    }).format(new Date(`${date}T00:00:00.000Z`));

    sheet.mergeCells(1, statusColumn, 1, checkInColumn);
    sheet.getCell(1, statusColumn).value = `${weekday}\n${date}`;
    sheet.getCell(2, statusColumn).value = "STATUS";
    sheet.getCell(2, checkInColumn).value = "CHECK-IN";
    sheet.getColumn(statusColumn).width = 20;
    sheet.getColumn(checkInColumn).width = 14;

    if (date === currentDate) {
      [statusColumn, checkInColumn].forEach((column) => {
        sheet.getCell(1, column).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFDE7B2" },
        };
        sheet.getCell(2, column).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFDE7B2" },
        };
      });
    }
  });

  employees.forEach((employee) => {
    const values: Array<string> = [
      employee.employeeCode,
      employee.employee,
    ];

    dates.forEach((date) => {
      const attendance = employee.attendanceByDate.get(date);
      values.push(
        attendance ? formatStatus(attendance.status) : "-",
        attendance?.arrival ?? "-",
      );
    });

    const row = sheet.addRow(values);
    dates.forEach((date, index) => {
      const attendance = employee.attendanceByDate.get(date);
      if (!attendance) return;

      const cell = row.getCell(3 + index * 2);
      const colors = statusColors[attendance.status];
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colors.fill },
      };
      cell.font = { color: { argb: colors.font }, bold: true };
    });
  });

  sheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 34 : 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = border;
      cell.alignment = {
        vertical: "middle",
        horizontal: Number(cell.col) <= 2 ? "left" : "center",
        wrapText: true,
      };
      if (rowNumber <= 2) {
        cell.font = { ...cell.font, bold: true };
        if (!cell.fill || cell.fill.type !== "pattern") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" },
          };
        }
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Uint8Array(buffer), filename);
}

export async function downloadDailyAttendanceXlsx(
  filename: string,
  rows: AttendanceRow[],
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily attendance", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const headers = [
    "DATE",
    "EMPLOYEE ID",
    "NAME",
    "CHECK-IN",
    "CHECK-OUT",
    "WORKING MINUTES",
    "STATUS",
  ];
  sheet.addRow(headers);

  rows.forEach((attendance) => {
    const row = sheet.addRow([
      attendance.date,
      attendance.employeeCode,
      attendance.employee,
      attendance.arrival ?? "-",
      attendance.exit ?? "-",
      attendance.workingMinutes,
      formatStatus(attendance.status),
    ]);
    const statusCell = row.getCell(7);
    const colors = statusColors[attendance.status];
    statusCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: colors.fill },
    };
    statusCell.font = { color: { argb: colors.font }, bold: true };
  });

  [14, 16, 24, 14, 14, 18, 22].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.autoFilter = { from: "A1", to: "G1" };
  sheet.eachRow((row, rowNumber) => {
    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true };
      if (rowNumber === 1) {
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF3F4F6" },
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(new Uint8Array(buffer), filename);
}
