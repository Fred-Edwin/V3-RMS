import PDFDocument from 'pdfkit';
import type {
  BranchOverviewReport,
  DailySummaryReport,
  ReportType,
  StaffPerformanceReport,
} from '../types/report.types';

type ReportDataByType = {
  daily_summary: DailySummaryReport;
  staff_performance: StaffPerformanceReport;
  branch_overview: BranchOverviewReport;
};

const csvEscape = (value: string | number | null | undefined): string => {
  const input = value === null || value === undefined ? '' : String(value);
  if (input.includes(',') || input.includes('"') || input.includes('\n')) {
    return `"${input.replace(/"/g, '""')}"`;
  }

  return input;
};

const buildCsv = (rows: Array<Array<string | number | null | undefined>>): string => {
  return rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n');
};

const toDailySummaryCsv = (data: DailySummaryReport): Buffer => {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['Date', data.date],
    ['Organization', data.organizationName],
    ['Total Revenue', data.totalRevenue],
    ['Order Count', data.orderCount],
    [],
    ['Orders By Type'],
    ['DINE_IN', data.ordersByType.DINE_IN],
    ['TAKE_AWAY', data.ordersByType.TAKE_AWAY],
    ['DELIVERY', data.ordersByType.DELIVERY],
    [],
    ['Revenue By Payment Method'],
    ['MPESA', data.revenueByPaymentMethod.MPESA],
    ['CASH', data.revenueByPaymentMethod.CASH],
    ['CARD', data.revenueByPaymentMethod.CARD],
    [],
    ['Top Items'],
    ['Item', 'Quantity Sold', 'Revenue'],
    ...data.topItems.map((item) => [item.name, item.quantitySold, item.revenue]),
    [],
    ['Average Prep Time (Minutes)'],
    ['KITCHEN', data.averagePrepTimeMinutes.KITCHEN],
    ['BARISTA', data.averagePrepTimeMinutes.BARISTA],
  ];

  return Buffer.from(buildCsv(rows), 'utf-8');
};

const toStaffPerformanceCsv = (data: StaffPerformanceReport): Buffer => {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['Start Date', data.period.startDate],
    ['End Date', data.period.endDate],
    ['Organization', data.organizationName],
    [],
    [
      'Name',
      'Role',
      'Orders/Tickets',
      'Average Order Value',
      'Average Prep Time Minutes',
      'Scheduled Hours',
      'Actual Hours',
    ],
    ...data.staff.map((staff) => [
      staff.name,
      staff.role,
      staff.ordersHandled,
      staff.averageOrderValue,
      staff.averagePrepTimeMinutes,
      staff.scheduledHours,
      staff.actualHours,
    ]),
  ];

  return Buffer.from(buildCsv(rows), 'utf-8');
};

const toBranchOverviewCsv = (data: BranchOverviewReport): Buffer => {
  const rows: Array<Array<string | number | null | undefined>> = [
    ['Start Date', data.period.startDate],
    ['End Date', data.period.endDate],
    ['Total Revenue', data.totalRevenue],
    ['Total Orders', data.totalOrders],
    [],
    ['Branch', 'Revenue', 'Order Count', 'Avg Prep KITCHEN', 'Avg Prep BARISTA'],
    ...data.branches.map((branch) => [
      branch.name,
      branch.revenue,
      branch.orderCount,
      branch.averagePrepTimeMinutes.KITCHEN,
      branch.averagePrepTimeMinutes.BARISTA,
    ]),
  ];

  return Buffer.from(buildCsv(rows), 'utf-8');
};

export const toCsv = <T extends ReportType>(type: T, data: ReportDataByType[T]): Buffer => {
  if (type === 'daily_summary') {
    return toDailySummaryCsv(data as ReportDataByType['daily_summary']);
  }

  if (type === 'staff_performance') {
    return toStaffPerformanceCsv(data as ReportDataByType['staff_performance']);
  }

  return toBranchOverviewCsv(data as ReportDataByType['branch_overview']);
};

const drawTitle = (doc: PDFKit.PDFDocument, title: string, subtitle?: string): void => {
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#1f2937').text(title);

  if (subtitle) {
    doc.moveDown(0.2);
    doc.fontSize(11).font('Helvetica').fillColor('#6b7280').text(subtitle);
  }

  doc.moveDown(0.8);
};

const drawKeyValue = (doc: PDFKit.PDFDocument, key: string, value: string | number): void => {
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827').text(`${key}:`, {
    continued: true,
  });
  doc.font('Helvetica').fillColor('#111827').text(` ${value}`);
};

const drawSubheading = (doc: PDFKit.PDFDocument, label: string): void => {
  doc.moveDown(0.4);
  doc.fontSize(12).font('Helvetica-Bold').fillColor('#111827').text(label);
  doc.moveDown(0.2);
};

const drawDailySummaryPdf = (doc: PDFKit.PDFDocument, data: DailySummaryReport): void => {
  drawTitle(doc, 'Daily Summary Report', `${data.organizationName} · ${data.date}`);

  drawKeyValue(doc, 'Total Revenue', data.totalRevenue);
  drawKeyValue(doc, 'Order Count', data.orderCount);
  drawKeyValue(doc, 'Avg Prep KITCHEN', `${data.averagePrepTimeMinutes.KITCHEN} min`);
  drawKeyValue(doc, 'Avg Prep BARISTA', `${data.averagePrepTimeMinutes.BARISTA} min`);

  drawSubheading(doc, 'Orders By Type');
  drawKeyValue(doc, 'Dine-In', data.ordersByType.DINE_IN);
  drawKeyValue(doc, 'Take-Away', data.ordersByType.TAKE_AWAY);
  drawKeyValue(doc, 'Delivery', data.ordersByType.DELIVERY);

  drawSubheading(doc, 'Revenue By Payment Method');
  drawKeyValue(doc, 'MPESA', data.revenueByPaymentMethod.MPESA);
  drawKeyValue(doc, 'Cash', data.revenueByPaymentMethod.CASH);
  drawKeyValue(doc, 'Card', data.revenueByPaymentMethod.CARD);

  drawSubheading(doc, 'Top Selling Items');
  if (data.topItems.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('No top items for this date.');
    return;
  }

  data.topItems.forEach((item, index) => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#111827')
      .text(`${index + 1}. ${item.name} — Qty ${item.quantitySold} — Revenue ${item.revenue}`);
  });
};

const drawStaffPerformancePdf = (doc: PDFKit.PDFDocument, data: StaffPerformanceReport): void => {
  drawTitle(
    doc,
    'Staff Performance Report',
    `${data.organizationName} · ${data.period.startDate} to ${data.period.endDate}`,
  );

  if (data.staff.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('No staff metrics found for the selected period.');
    return;
  }

  data.staff.forEach((staff, index) => {
    drawSubheading(doc, `${index + 1}. ${staff.name} (${staff.role})`);
    drawKeyValue(doc, 'Orders/Tickets', staff.ordersHandled);
    drawKeyValue(doc, 'Avg Order Value', staff.averageOrderValue ?? '-');
    drawKeyValue(doc, 'Avg Prep Time', staff.averagePrepTimeMinutes ?? '-');
    drawKeyValue(doc, 'Scheduled Hours', staff.scheduledHours);
    drawKeyValue(doc, 'Actual Hours', staff.actualHours);
  });
};

const drawBranchOverviewPdf = (doc: PDFKit.PDFDocument, data: BranchOverviewReport): void => {
  drawTitle(
    doc,
    'Branch Overview Report',
    `${data.period.startDate} to ${data.period.endDate}`,
  );

  drawKeyValue(doc, 'Total Revenue', data.totalRevenue);
  drawKeyValue(doc, 'Total Orders', data.totalOrders);

  drawSubheading(doc, 'Branch Breakdown');
  if (data.branches.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('No branch data found for this period.');
    return;
  }

  data.branches.forEach((branch, index) => {
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#111827')
      .text(`${index + 1}. ${branch.name}`);
    doc.font('Helvetica').fontSize(10).fillColor('#111827').text(`Revenue: ${branch.revenue}`);
    doc.text(`Order Count: ${branch.orderCount}`);
    doc.text(
      `Avg Prep (KITCHEN/BARISTA): ${branch.averagePrepTimeMinutes.KITCHEN} / ${branch.averagePrepTimeMinutes.BARISTA} min`,
    );
    doc.moveDown(0.3);
  });
};

export const toPdf = async <T extends ReportType>(
  type: T,
  data: ReportDataByType[T],
): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
      info: {
        Title: 'Wendo RMS Report',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    if (type === 'daily_summary') {
      drawDailySummaryPdf(doc, data as ReportDataByType['daily_summary']);
    } else if (type === 'staff_performance') {
      drawStaffPerformancePdf(doc, data as ReportDataByType['staff_performance']);
    } else {
      drawBranchOverviewPdf(doc, data as ReportDataByType['branch_overview']);
    }

    doc.end();
  });
};

