import PDFDocument from 'pdfkit';
import type {
  AccountantReconciliationReport,
  BranchOverviewReport,
  CorporateAccountStatementReport,
  DailySummaryReport,
  ReportType,
  StaffPerformanceReport,
} from '../types/report.types';
import { NAIROBI_TZ } from './date-only';

// ── Brand colours ────────────────────────────────────────────────────────────
const ESPRESSO = '#2C1810';
const AMBER    = '#C4862A';
const STONE_50 = '#FAFAF9';
const STONE_100 = '#F5F0E8';
const STONE_200 = '#E8E5E1';
const STONE_500 = '#78716C';
const STONE_800 = '#292524';
const WHITE     = '#FFFFFF';

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatKes = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return 'KES —';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(n)) return 'KES —';
  return `KES ${n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Parse a revenue string (Prisma Decimal) to number safely. */
const rev = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(n) ? 0 : n;
};

const formatHours = (hours: number | null | undefined): string => {
  if (hours === null || hours === undefined) return '—';
  return `${Number(hours).toFixed(1)} h`;
};

const formatMins = (mins: number | null | undefined): string => {
  if (mins === null || mins === undefined) return '—';
  return `${Number(mins).toFixed(1)} min`;
};

const todayLabel = (): string =>
  new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric', timeZone: NAIROBI_TZ });

// ── CSV helpers ───────────────────────────────────────────────────────────────

type CellValue = string | number | null | undefined;

const csvEscape = (value: CellValue): string => {
  const input = value === null || value === undefined ? '' : String(value);
  if (input.includes(',') || input.includes('"') || input.includes('\n')) {
    return `"${input.replace(/"/g, '""')}"`;
  }
  return input;
};

const buildCsv = (rows: Array<Array<CellValue>>): string =>
  rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n');

// ── CSV Builders ──────────────────────────────────────────────────────────────

const toDailySummaryCsv = (data: DailySummaryReport): Buffer => {
  const totalRevenue = rev(data.totalRevenue);
  const totalPayments =
    rev(data.revenueByPaymentMethod.MPESA) +
    rev(data.revenueByPaymentMethod.CASH) +
    rev(data.revenueByPaymentMethod.CARD) +
    rev(data.revenueByPaymentMethod.SPLIT) +
    rev(data.revenueByPaymentMethod.GUEST_SPLIT);

  const totalOrderTypes =
    (data.ordersByType.DINE_IN ?? 0) +
    (data.ordersByType.TAKE_AWAY ?? 0) +
    (data.ordersByType.DELIVERY ?? 0);

  const pct = (n: number, total: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%';

  const rows: Array<Array<CellValue>> = [
    ['WENDO COFFEE BISTRO — DAILY SUMMARY REPORT'],
    [],
    ['Report Date', data.date],
    ['Branch / Organisation', data.organizationName],
    ['Generated On', todayLabel()],
    [],
    ['── KEY PERFORMANCE INDICATORS ──'],
    ['Metric', 'Value'],
    ['Total Revenue', data.totalRevenue],
    ['Total Orders', data.orderCount],
    ['Avg Order Value', data.orderCount > 0 ? (totalRevenue / data.orderCount).toFixed(2) : '0'],
    ['Avg Prep Time (Kitchen)', `${data.averagePrepTimeMinutes.KITCHEN ?? 0} min`],
    ['Avg Prep Time (Barista)', `${data.averagePrepTimeMinutes.BARISTA ?? 0} min`],
    [],
    ['── ORDERS BY TYPE ──'],
    ['Order Type', 'Count', 'Share of Total'],
    ['Dine-In', data.ordersByType.DINE_IN, pct(data.ordersByType.DINE_IN ?? 0, totalOrderTypes)],
    ['Take-Away', data.ordersByType.TAKE_AWAY, pct(data.ordersByType.TAKE_AWAY ?? 0, totalOrderTypes)],
    ['Delivery', data.ordersByType.DELIVERY, pct(data.ordersByType.DELIVERY ?? 0, totalOrderTypes)],
    ['TOTAL', totalOrderTypes, '100%'],
    [],
    ['── REVENUE BY PAYMENT METHOD ──'],
    ['Payment Method', 'Revenue (KES)', 'Share of Revenue'],
    ['M-Pesa', data.revenueByPaymentMethod.MPESA, pct(rev(data.revenueByPaymentMethod.MPESA), totalPayments)],
    ['Cash', data.revenueByPaymentMethod.CASH, pct(rev(data.revenueByPaymentMethod.CASH), totalPayments)],
    ['Card', data.revenueByPaymentMethod.CARD, pct(rev(data.revenueByPaymentMethod.CARD), totalPayments)],
    ['Split (Mpesa+Cash)', data.revenueByPaymentMethod.SPLIT, pct(rev(data.revenueByPaymentMethod.SPLIT), totalPayments)],
    ['Split between guests', data.revenueByPaymentMethod.GUEST_SPLIT, pct(rev(data.revenueByPaymentMethod.GUEST_SPLIT), totalPayments)],
    ['TOTAL', totalPayments.toFixed(2), '100%'],
    [],
    ['── TOP SELLING ITEMS ──'],
    ['Rank', 'Item', 'Qty Sold', 'Revenue (KES)', 'Share of Revenue'],
    ...data.topItems.map((item, i) => [
      i + 1,
      item.name,
      item.quantitySold,
      item.revenue,
      pct(rev(item.revenue), totalRevenue),
    ]),
    ...(data.topItems.length === 0 ? [['No items recorded for this date']] : []),
    [],
    ['── PREPARATION TIMES ──'],
    ['Station', 'Average Prep Time'],
    ['Kitchen', `${data.averagePrepTimeMinutes.KITCHEN ?? 0} min`],
    ['Barista', `${data.averagePrepTimeMinutes.BARISTA ?? 0} min`],
  ];

  return Buffer.from(buildCsv(rows), 'utf-8');
};

const toStaffPerformanceCsv = (data: StaffPerformanceReport): Buffer => {
  const totals = data.staff.reduce(
    (acc, s) => ({
      orders: acc.orders + (s.ordersHandled ?? 0),
      scheduled: acc.scheduled + (s.scheduledHours ?? 0),
      actual: acc.actual + (s.actualHours ?? 0),
    }),
    { orders: 0, scheduled: 0, actual: 0 },
  );

  const rows: Array<Array<CellValue>> = [
    ['WENDO COFFEE BISTRO — STAFF PERFORMANCE REPORT'],
    [],
    ['Period Start', data.period.startDate],
    ['Period End', data.period.endDate],
    ['Branch / Organisation', data.organizationName],
    ['Generated On', todayLabel()],
    ['Staff Members Included', data.staff.length],
    [],
    ['── STAFF PERFORMANCE BREAKDOWN ──'],
    [
      'Name',
      'Role',
      'Orders / Tickets',
      'Avg Order Value (KES)',
      'Avg Prep Time (min)',
      'Scheduled Hours',
      'Actual Hours',
      'Attendance %',
    ],
    ...data.staff.map((s) => {
      const attendancePct =
        s.scheduledHours && s.scheduledHours > 0
          ? `${Math.min(100, ((s.actualHours ?? 0) / s.scheduledHours) * 100).toFixed(1)}%`
          : '—';
      return [
        s.name,
        s.role,
        s.ordersHandled,
        s.averageOrderValue ?? '—',
        s.averagePrepTimeMinutes ?? '—',
        s.scheduledHours,
        s.actualHours,
        attendancePct,
      ];
    }),
    ...(data.staff.length === 0 ? [['No staff data found for this period']] : []),
    [],
    ['── TOTALS ──'],
    ['', '', totals.orders, '', '', totals.scheduled.toFixed(1), totals.actual.toFixed(1)],
  ];

  return Buffer.from(buildCsv(rows), 'utf-8');
};

const toBranchOverviewCsv = (data: BranchOverviewReport): Buffer => {
  const totalRevenue = rev(data.totalRevenue);
  const rows: Array<Array<CellValue>> = [
    ['WENDO COFFEE BISTRO — BRANCH OVERVIEW REPORT'],
    [],
    ['Period Start', data.period.startDate],
    ['Period End', data.period.endDate],
    ['Generated On', todayLabel()],
    [],
    ['── ORGANISATION TOTALS ──'],
    ['Total Revenue (KES)', data.totalRevenue],
    ['Total Orders', data.totalOrders],
    [
      'Avg Revenue Per Branch',
      data.branches.length > 0 ? (totalRevenue / data.branches.length).toFixed(2) : '0',
    ],
    [
      'Avg Orders Per Branch',
      data.branches.length > 0
        ? (data.totalOrders / data.branches.length).toFixed(1)
        : '0',
    ],
    [],
    ['── BRANCH BREAKDOWN ──'],
    [
      'Branch',
      'Revenue (KES)',
      'Revenue Share',
      'Orders',
      'Order Share',
      'Avg Order Value (KES)',
      'Avg Prep Kitchen (min)',
      'Avg Prep Barista (min)',
    ],
    ...data.branches.map((b) => {
      const branchRev = rev(b.revenue);
      const revShare =
        totalRevenue > 0
          ? `${((branchRev / totalRevenue) * 100).toFixed(1)}%`
          : '0%';
      const orderShare =
        data.totalOrders > 0
          ? `${((b.orderCount / data.totalOrders) * 100).toFixed(1)}%`
          : '0%';
      const avgOrderValue =
        b.orderCount > 0 ? (branchRev / b.orderCount).toFixed(2) : '0';
      return [
        b.name,
        b.revenue,
        revShare,
        b.orderCount,
        orderShare,
        avgOrderValue,
        b.averagePrepTimeMinutes.KITCHEN ?? '—',
        b.averagePrepTimeMinutes.BARISTA ?? '—',
      ];
    }),
    ...(data.branches.length === 0 ? [['No branch data found for this period']] : []),
    [],
    ['TOTAL', data.totalRevenue, '100%', data.totalOrders, '100%'],
  ];

  return Buffer.from(buildCsv(rows), 'utf-8');
};

// Forward declaration — full ReportDataByType is defined after the PDF builders.
// toCsv is defined here so it can be exported alongside toPdf below.
export const toCsv = (type: ReportType, data: unknown): Buffer => {
  if (type === 'daily_summary') {
    return toDailySummaryCsv(data as DailySummaryReport);
  }
  if (type === 'staff_performance' || type === 'manager_analytics') {
    return toStaffPerformanceCsv(data as StaffPerformanceReport);
  }
  if (type === 'branch_overview' || type === 'director_analytics') {
    return toBranchOverviewCsv(data as BranchOverviewReport);
  }
  // accountant_reconciliation / corporate_account_statement — PDF-only, empty buffer for CSV
  return Buffer.from('', 'utf-8');
};

// ── PDF Helpers ───────────────────────────────────────────────────────────────

const PAGE_W = 595.28; // A4 points width
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

const drawPageBorder = (doc: PDFKit.PDFDocument): void => {
  doc.save();
  doc.rect(10, 10, PAGE_W - 20, doc.page.height - 20)
    .lineWidth(0.5)
    .strokeColor(STONE_200)
    .stroke();
  doc.restore();
};

const drawBrandedHeader = (
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string,
): void => {
  // Espresso header band
  doc.save();
  doc.rect(0, 0, PAGE_W, 72).fill(ESPRESSO);
  // Amber accent line below band
  doc.rect(0, 72, PAGE_W, 3).fill(AMBER);
  doc.restore();

  // Wendo wordmark (left)
  doc.fontSize(18).font('Helvetica-Bold').fillColor(WHITE);
  doc.text('WENDO', MARGIN, 18, { lineBreak: false });
  doc.fontSize(9).font('Helvetica').fillColor(AMBER);
  doc.text('COFFEE BISTRO', MARGIN, 38, { lineBreak: false });

  // Report title (right-aligned)
  doc.fontSize(11).font('Helvetica-Bold').fillColor(WHITE);
  doc.text(title.toUpperCase(), MARGIN, 16, {
    width: CONTENT_W,
    align: 'right',
    lineBreak: false,
  });
  doc.fontSize(8.5).font('Helvetica').fillColor(AMBER);
  doc.text(subtitle, MARGIN, 32, {
    width: CONTENT_W,
    align: 'right',
    lineBreak: false,
  });

  // Generated date (bottom-right of band)
  doc.fontSize(7.5).font('Helvetica').fillColor(STONE_200);
  doc.text(`Generated ${todayLabel()}`, MARGIN, 54, {
    width: CONTENT_W,
    align: 'right',
    lineBreak: false,
  });

  // Reset cursor below band
  doc.y = 90;
};

const drawSectionLabel = (doc: PDFKit.PDFDocument, label: string): void => {
  const y = doc.y + 10;
  // Amber left rule
  doc.save();
  doc.rect(MARGIN, y, 3, 14).fill(AMBER);
  doc.restore();
  doc.fontSize(9).font('Helvetica-Bold').fillColor(STONE_800);
  doc.text(label.toUpperCase(), MARGIN + 8, y + 2, { lineBreak: false });
  doc.moveDown(0.2);
  doc.y = y + 20;
};

/** Renders a row of KPI cards (amber top border, white bg, label + value). */
const drawKpiRow = (
  doc: PDFKit.PDFDocument,
  cards: Array<{ label: string; value: string }>,
): void => {
  const count = cards.length;
  const gap = 8;
  const cardW = (CONTENT_W - gap * (count - 1)) / count;
  const cardH = 46;
  const startY = doc.y + 6;

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardW + gap);
    // Card bg
    doc.save();
    doc.roundedRect(x, startY, cardW, cardH, 3).fill(STONE_50);
    // Amber top border
    doc.rect(x, startY, cardW, 3).fill(AMBER);
    // Label
    doc.fontSize(7).font('Helvetica').fillColor(STONE_500);
    doc.text(card.label.toUpperCase(), x + 8, startY + 10, { width: cardW - 16, lineBreak: false });
    // Value
    doc.fontSize(12).font('Helvetica-Bold').fillColor(ESPRESSO);
    doc.text(card.value, x + 8, startY + 22, { width: cardW - 16, lineBreak: false });
    doc.restore();
  });

  doc.y = startY + cardH + 10;
};

type TableColumn = { header: string; width: number; align?: 'left' | 'right' | 'center' };

/** Draws a table with an espresso header row, alternating light rows, and an optional totals row. */
const drawTable = (
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: Array<Array<string>>,
  totalsRow?: Array<string>,
): void => {
  const rowH = 18;
  const headerH = 20;
  const cellPad = 6;

  const drawRow = (
    y: number,
    cells: Array<string>,
    bgColor: string,
    textColor: string,
    bold: boolean,
    height: number,
  ): void => {
    doc.save();
    doc.rect(MARGIN, y, CONTENT_W, height).fill(bgColor);
    let x = MARGIN;
    cells.forEach((cell, ci) => {
      const col = columns[ci];
      if (!col) return;
      doc.fontSize(8).font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(textColor);
      doc.text(cell, x + cellPad, y + (height - 10) / 2, {
        width: col.width - cellPad * 2,
        align: col.align ?? 'left',
        lineBreak: false,
      });
      x += col.width;
    });
    doc.restore();
  };

  // Check if we need a new page for header + at least one row
  if (doc.y + headerH + rowH > doc.page.height - 60) {
    doc.addPage();
    drawPageBorder(doc);
    doc.y = MARGIN;
  }

  const headerY = doc.y;
  // Header row (espresso background)
  drawRow(headerY, columns.map((c) => c.header), ESPRESSO, WHITE, true, headerH);
  // Bottom border on header
  doc.save();
  doc.rect(MARGIN, headerY + headerH, CONTENT_W, 1).fill(AMBER);
  doc.restore();

  let currentY = headerY + headerH + 1;

  rows.forEach((row, ri) => {
    // Page break check
    if (currentY + rowH > doc.page.height - 60) {
      doc.addPage();
      drawPageBorder(doc);
      currentY = MARGIN;
      // Reprint header
      drawRow(currentY, columns.map((c) => c.header), ESPRESSO, WHITE, true, headerH);
      doc.save();
      doc.rect(MARGIN, currentY + headerH, CONTENT_W, 1).fill(AMBER);
      doc.restore();
      currentY += headerH + 1;
    }

    const bg = ri % 2 === 0 ? WHITE : STONE_100;
    drawRow(currentY, row, bg, STONE_800, false, rowH);
    currentY += rowH;
  });

  // Totals row
  if (totalsRow) {
    doc.save();
    doc.rect(MARGIN, currentY, CONTENT_W, 1).fill(STONE_200);
    doc.restore();
    currentY += 1;
    drawRow(currentY, totalsRow, STONE_100, ESPRESSO, true, rowH);
    currentY += rowH;
  }

  doc.y = currentY + 6;
};

/** Draws a labelled horizontal bar chart. */
const drawHorizontalBar = (
  doc: PDFKit.PDFDocument,
  items: Array<{ label: string; value: number }>,
  maxValue: number,
  formatValue: (v: number) => string,
): void => {
  const barH = 14;
  const barGap = 6;
  const labelW = 110;
  const valueW = 70;
  const barAreaW = CONTENT_W - labelW - valueW;

  items.forEach((item) => {
    const y = doc.y;

    if (y + barH + barGap > doc.page.height - 60) {
      doc.addPage();
      drawPageBorder(doc);
      doc.y = MARGIN;
    }

    const barFillW = maxValue > 0 ? (item.value / maxValue) * barAreaW : 0;

    // Label
    doc.fontSize(8).font('Helvetica').fillColor(STONE_800);
    doc.text(item.label, MARGIN, doc.y + 2, { width: labelW, lineBreak: false });

    // Bar track
    doc.save();
    doc.rect(MARGIN + labelW, doc.y - 2, barAreaW, barH).fill(STONE_100);
    // Bar fill
    doc.rect(MARGIN + labelW, doc.y - 2, barFillW, barH).fill(AMBER);
    doc.restore();

    // Value
    doc.fontSize(8).font('Helvetica-Bold').fillColor(STONE_800);
    doc.text(formatValue(item.value), MARGIN + labelW + barAreaW + 4, doc.y + 2, {
      width: valueW - 4,
      lineBreak: false,
    });

    doc.y += barH + barGap;
  });
};

const drawFooter = (doc: PDFKit.PDFDocument): void => {
  const footerY = doc.page.height - 36;
  doc.save();
  doc.rect(0, footerY, PAGE_W, 36).fill(ESPRESSO);
  doc.fontSize(7).font('Helvetica').fillColor(STONE_200);
  doc.text(
    'Wendo RMS — Confidential management report. Generated for internal use only.',
    MARGIN,
    footerY + 12,
    { align: 'center', width: CONTENT_W },
  );
  doc.restore();
};

// ── Business identity (used on client-facing documents like the corporate statement) ──
const WENDO_PHONE = '0722270952 / 0724379234';
const WENDO_KRA_PIN = 'P052334921W';

const drawStatementFooter = (doc: PDFKit.PDFDocument): void => {
  const footerY = doc.page.height - 46;
  doc.save();
  doc.rect(0, footerY, PAGE_W, 46).fill(ESPRESSO);
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor(AMBER);
  doc.text('Payment Terms', MARGIN, footerY + 8, { lineBreak: false });
  doc.fontSize(7).font('Helvetica').fillColor(STONE_200);
  doc.text(
    'Payment due within 14 days of statement date. For queries, contact your Wendo Coffee Bistro account representative.',
    MARGIN,
    footerY + 19,
    { width: CONTENT_W, lineBreak: false },
  );
  doc.fontSize(7).font('Helvetica').fillColor(STONE_200);
  doc.text(`Tel: ${WENDO_PHONE}  ·  KRA PIN: ${WENDO_KRA_PIN}`, MARGIN, footerY + 31, {
    width: CONTENT_W,
    lineBreak: false,
  });
  doc.restore();
};

// ── PDF Report Builders ───────────────────────────────────────────────────────

const drawDailySummaryPdf = (doc: PDFKit.PDFDocument, data: DailySummaryReport): void => {
  drawBrandedHeader(doc, 'Daily Summary Report', `${data.organizationName} · ${data.date}`);
  drawPageBorder(doc);

  // KPI Cards
  const totalRevenueNum = rev(data.totalRevenue);
  const avgOrderValue =
    data.orderCount > 0
      ? formatKes(totalRevenueNum / data.orderCount)
      : 'KES —';

  drawKpiRow(doc, [
    { label: 'Total Revenue', value: formatKes(data.totalRevenue) },
    { label: 'Total Orders', value: String(data.orderCount) },
    { label: 'Avg Order Value', value: avgOrderValue },
    { label: 'Kitchen Prep', value: formatMins(data.averagePrepTimeMinutes.KITCHEN) },
  ]);

  // Orders by Type
  drawSectionLabel(doc, 'Orders by Type');
  const totalOrderTypes =
    (data.ordersByType.DINE_IN ?? 0) +
    (data.ordersByType.TAKE_AWAY ?? 0) +
    (data.ordersByType.DELIVERY ?? 0);

  const pctStr = (n: number) =>
    totalOrderTypes > 0 ? ` (${((n / totalOrderTypes) * 100).toFixed(1)}%)` : '';

  drawTable(
    doc,
    [
      { header: 'Order Type', width: 200 },
      { header: 'Count', width: 100, align: 'right' },
      { header: 'Share', width: 100, align: 'right' },
    ],
    [
      ['Dine-In', String(data.ordersByType.DINE_IN ?? 0), pctStr(data.ordersByType.DINE_IN ?? 0)],
      ['Take-Away', String(data.ordersByType.TAKE_AWAY ?? 0), pctStr(data.ordersByType.TAKE_AWAY ?? 0)],
      ['Delivery', String(data.ordersByType.DELIVERY ?? 0), pctStr(data.ordersByType.DELIVERY ?? 0)],
    ],
    ['TOTAL', String(totalOrderTypes), '100%'],
  );

  // Revenue by Payment Method
  drawSectionLabel(doc, 'Revenue by Payment Method');
  const mpesaRev = rev(data.revenueByPaymentMethod.MPESA);
  const cashRev = rev(data.revenueByPaymentMethod.CASH);
  const cardRev = rev(data.revenueByPaymentMethod.CARD);
  const splitRev = rev(data.revenueByPaymentMethod.SPLIT);
  const guestSplitRev = rev(data.revenueByPaymentMethod.GUEST_SPLIT);
  const totalPayments = mpesaRev + cashRev + cardRev + splitRev + guestSplitRev;

  const payItems = [
    { label: 'M-Pesa', value: mpesaRev },
    { label: 'Cash', value: cashRev },
    { label: 'Card', value: cardRev },
    { label: 'Split', value: splitRev },
    { label: 'Guest Split', value: guestSplitRev },
  ];
  drawHorizontalBar(doc, payItems, totalPayments, formatKes);

  // Top Selling Items
  doc.moveDown(0.5);
  drawSectionLabel(doc, 'Top Selling Items');
  if (data.topItems.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(STONE_500).text('No items recorded for this date.');
  } else {
    drawTable(
      doc,
      [
        { header: 'Rank', width: 40, align: 'right' },
        { header: 'Item', width: 220 },
        { header: 'Qty Sold', width: 80, align: 'right' },
        { header: 'Revenue', width: 100, align: 'right' },
        { header: 'Rev Share', width: 75, align: 'right' },
      ],
      data.topItems.map((item, i) => {
        const share =
          totalRevenueNum > 0
            ? `${((rev(item.revenue) / totalRevenueNum) * 100).toFixed(1)}%`
            : '0%';
        return [
          String(i + 1),
          item.name,
          String(item.quantitySold),
          formatKes(item.revenue),
          share,
        ];
      }),
    );
  }

  // Preparation Times
  doc.moveDown(0.5);
  drawSectionLabel(doc, 'Average Preparation Times');
  drawTable(
    doc,
    [
      { header: 'Station', width: 200 },
      { header: 'Avg Prep Time', width: 120, align: 'right' },
    ],
    [
      ['Kitchen', formatMins(data.averagePrepTimeMinutes.KITCHEN)],
      ['Barista', formatMins(data.averagePrepTimeMinutes.BARISTA)],
    ],
  );
};

const drawStaffPerformancePdf = (doc: PDFKit.PDFDocument, data: StaffPerformanceReport): void => {
  drawBrandedHeader(
    doc,
    'Staff Performance Report',
    `${data.organizationName} · ${data.period.startDate} to ${data.period.endDate}`,
  );
  drawPageBorder(doc);

  if (data.staff.length === 0) {
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').fillColor(STONE_500).text('No staff metrics found for the selected period.');
    return;
  }

  // Summary KPI cards
  const totalOrders = data.staff.reduce((s, m) => s + (m.ordersHandled ?? 0), 0);
  const totalScheduled = data.staff.reduce((s, m) => s + (m.scheduledHours ?? 0), 0);
  const totalActual = data.staff.reduce((s, m) => s + (m.actualHours ?? 0), 0);
  const attendanceRate =
    totalScheduled > 0
      ? `${Math.min(100, (totalActual / totalScheduled) * 100).toFixed(0)}%`
      : '—';

  drawKpiRow(doc, [
    { label: 'Staff Members', value: String(data.staff.length) },
    { label: 'Total Orders / Tickets', value: String(totalOrders) },
    { label: 'Total Scheduled Hours', value: formatHours(totalScheduled) },
    { label: 'Team Attendance Rate', value: attendanceRate },
  ]);

  // Staff table
  drawSectionLabel(doc, 'Individual Staff Performance');
  drawTable(
    doc,
    [
      { header: 'Name', width: 120 },
      { header: 'Role', width: 75 },
      { header: 'Orders/Tickets', width: 70, align: 'right' },
      { header: 'Avg Order Val.', width: 80, align: 'right' },
      { header: 'Avg Prep', width: 60, align: 'right' },
      { header: 'Sched. Hrs', width: 60, align: 'right' },
      { header: 'Actual Hrs', width: 50, align: 'right' },
    ],
    data.staff.map((s) => [
      s.name,
      s.role,
      String(s.ordersHandled ?? 0),
      s.averageOrderValue !== null && s.averageOrderValue !== undefined
        ? formatKes(s.averageOrderValue)
        : '—',
      formatMins(s.averagePrepTimeMinutes),
      formatHours(s.scheduledHours),
      formatHours(s.actualHours),
    ]),
    [
      'TEAM TOTAL',
      '',
      String(totalOrders),
      '',
      '',
      formatHours(totalScheduled),
      formatHours(totalActual),
    ],
  );

  // Top performers by orders handled
  const sorted = [...data.staff].sort((a, b) => (b.ordersHandled ?? 0) - (a.ordersHandled ?? 0)).slice(0, 5);
  if (sorted.length > 0) {
    doc.moveDown(0.5);
    drawSectionLabel(doc, 'Top Performers by Orders / Tickets');
    const maxOrders = sorted[0]?.ordersHandled ?? 1;
    drawHorizontalBar(
      doc,
      sorted.map((s) => ({ label: s.name, value: s.ordersHandled ?? 0 })),
      maxOrders,
      (v) => String(v),
    );
  }
};

const drawBranchOverviewPdf = (doc: PDFKit.PDFDocument, data: BranchOverviewReport): void => {
  drawBrandedHeader(
    doc,
    'Branch Overview Report',
    `${data.period.startDate} to ${data.period.endDate}`,
  );
  drawPageBorder(doc);

  // KPI cards
  const totalRevenueNum = rev(data.totalRevenue);
  const avgRevenue =
    data.branches.length > 0 ? totalRevenueNum / data.branches.length : 0;
  const avgOrders =
    data.branches.length > 0 ? data.totalOrders / data.branches.length : 0;

  drawKpiRow(doc, [
    { label: 'Total Revenue', value: formatKes(data.totalRevenue) },
    { label: 'Total Orders', value: String(data.totalOrders) },
    { label: 'Avg Revenue / Branch', value: formatKes(avgRevenue) },
    { label: 'Avg Orders / Branch', value: avgOrders.toFixed(1) },
  ]);

  // Revenue by branch bar chart
  drawSectionLabel(doc, 'Revenue by Branch');
  if (data.branches.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(STONE_500).text('No branch data for this period.');
  } else {
    const branchRevNums = data.branches.map((b) => rev(b.revenue));
    const maxRev = Math.max(...branchRevNums);
    drawHorizontalBar(
      doc,
      data.branches.map((b, i) => ({ label: b.name, value: branchRevNums[i] ?? 0 })),
      maxRev,
      formatKes,
    );
  }

  // Branch breakdown table
  doc.moveDown(0.5);
  drawSectionLabel(doc, 'Branch Breakdown');
  if (data.branches.length > 0) {
    drawTable(
      doc,
      [
        { header: 'Branch', width: 130 },
        { header: 'Revenue (KES)', width: 95, align: 'right' },
        { header: 'Rev Share', width: 65, align: 'right' },
        { header: 'Orders', width: 55, align: 'right' },
        { header: 'Avg Order Val.', width: 85, align: 'right' },
        { header: 'Kitchen Prep', width: 65, align: 'right' },
        { header: 'Barista Prep', width: 65, align: 'right' },
      ],
      data.branches.map((b) => {
        const branchRev = rev(b.revenue);
        const revShare =
          totalRevenueNum > 0
            ? `${((branchRev / totalRevenueNum) * 100).toFixed(1)}%`
            : '0%';
        const avgOrderVal =
          b.orderCount > 0 ? formatKes(branchRev / b.orderCount) : '—';
        return [
          b.name,
          formatKes(branchRev),
          revShare,
          String(b.orderCount),
          avgOrderVal,
          formatMins(b.averagePrepTimeMinutes.KITCHEN),
          formatMins(b.averagePrepTimeMinutes.BARISTA),
        ];
      }),
      [
        'ALL BRANCHES',
        formatKes(data.totalRevenue),
        '100%',
        String(data.totalOrders),
        '',
        '',
        '',
      ],
    );
  }
};

// ── Director Analytics PDF ────────────────────────────────────────────────────

const drawDirectorAnalyticsPdf = (
  doc: PDFKit.PDFDocument,
  data: BranchOverviewReport,
): void => {
  drawBrandedHeader(
    doc,
    'Director Analytics Report',
    `${data.period.startDate} to ${data.period.endDate}`,
  );
  drawPageBorder(doc);

  // KPI strip
  const totalRevenueNum = rev(data.totalRevenue);
  const avgRevenue = data.branches.length > 0 ? totalRevenueNum / data.branches.length : 0;
  drawKpiRow(doc, [
    { label: 'Total Revenue', value: formatKes(data.totalRevenue) },
    { label: 'Total Orders', value: String(data.totalOrders) },
    { label: 'Active Branches', value: String(data.branches.length) },
    { label: 'Avg Revenue / Branch', value: formatKes(avgRevenue) },
  ]);

  // Branch performance table
  drawSectionLabel(doc, 'Branch Performance');
  if (data.branches.length === 0) {
    doc.fontSize(9).font('Helvetica').fillColor(STONE_500).text('No branch data for this period.');
  } else {
    const branchRevNums = data.branches.map((b) => rev(b.revenue));
    drawTable(
      doc,
      [
        { header: 'Branch', width: 130 },
        { header: 'Revenue (KES)', width: 90, align: 'right' },
        { header: 'Rev Share', width: 60, align: 'right' },
        { header: 'Orders', width: 50, align: 'right' },
        { header: 'Avg Order Val.', width: 85, align: 'right' },
        { header: 'Kitchen Prep', width: 60, align: 'right' },
        { header: 'Barista Prep', width: 60, align: 'right' },
      ],
      data.branches.map((b, i) => {
        const branchRev = branchRevNums[i] ?? 0;
        const revShare = totalRevenueNum > 0 ? `${((branchRev / totalRevenueNum) * 100).toFixed(1)}%` : '0%';
        const avgOrderVal = b.orderCount > 0 ? formatKes(branchRev / b.orderCount) : '—';
        return [
          b.name,
          formatKes(branchRev),
          revShare,
          String(b.orderCount),
          avgOrderVal,
          formatMins(b.averagePrepTimeMinutes.KITCHEN),
          formatMins(b.averagePrepTimeMinutes.BARISTA),
        ];
      }),
      ['ALL BRANCHES', formatKes(data.totalRevenue), '100%', String(data.totalOrders), '', '', ''],
    );
  }

  // Revenue allocation (payment method breakdown)
  doc.moveDown(0.5);
  drawSectionLabel(doc, 'Revenue by Payment Method (All Branches)');
  if (data.branches.length > 0) {
    // Aggregate payment breakdown across all branches
    let mpesa = 0, cash = 0, card = 0, house = 0, corporate = 0, credit = 0;
    for (const b of data.branches) {
      mpesa += rev(b.paymentBreakdown.mpesa);
      cash += rev(b.paymentBreakdown.cash);
      card += rev(b.paymentBreakdown.card);
      house += rev(b.paymentBreakdown.houseAccount);
      corporate += rev(b.paymentBreakdown.corporateAccount);
      credit += rev(b.paymentBreakdown.customerCredit);
    }
    const payTotal = mpesa + cash + card + house + corporate + credit;
    const payItems = [
      { label: 'M-Pesa', value: mpesa },
      { label: 'Cash', value: cash },
      { label: 'Card', value: card },
      { label: 'House Account', value: house },
      { label: 'Corporate', value: corporate },
      { label: 'Customer Credit', value: credit },
    ].filter((item) => item.value > 0);
    drawHorizontalBar(doc, payItems, payTotal, formatKes);

    // Per-branch payment breakdown table
    doc.moveDown(0.5);
    drawSectionLabel(doc, 'Payment Breakdown by Branch');
    drawTable(
      doc,
      [
        { header: 'Branch', width: 100 },
        { header: 'M-Pesa', width: 72, align: 'right' },
        { header: 'Cash', width: 72, align: 'right' },
        { header: 'Card', width: 72, align: 'right' },
        { header: 'House', width: 66, align: 'right' },
        { header: 'Corp.', width: 66, align: 'right' },
        { header: 'Credit', width: 66, align: 'right' },
        { header: 'Total', width: 61, align: 'right' },
      ],
      data.branches.map((b) => [
        b.name,
        formatKes(rev(b.paymentBreakdown.mpesa)),
        formatKes(rev(b.paymentBreakdown.cash)),
        formatKes(rev(b.paymentBreakdown.card)),
        formatKes(rev(b.paymentBreakdown.houseAccount)),
        formatKes(rev(b.paymentBreakdown.corporateAccount)),
        formatKes(rev(b.paymentBreakdown.customerCredit)),
        formatKes(rev(b.paymentBreakdown.total)),
      ]),
    );
  }
};

// ── Manager Analytics PDF ─────────────────────────────────────────────────────

const drawManagerAnalyticsPdf = (
  doc: PDFKit.PDFDocument,
  data: StaffPerformanceReport,
): void => {
  drawBrandedHeader(
    doc,
    'Branch Analytics Report',
    `${data.organizationName} · ${data.period.startDate} to ${data.period.endDate}`,
  );
  drawPageBorder(doc);

  if (data.staff.length === 0) {
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').fillColor(STONE_500).text('No staff metrics found for the selected period.');
    return;
  }

  // KPI strip
  const totalOrders = data.staff.reduce((s, m) => s + (m.ordersHandled ?? 0), 0);
  const totalScheduled = data.staff.reduce((s, m) => s + (m.scheduledHours ?? 0), 0);
  const totalActual = data.staff.reduce((s, m) => s + (m.actualHours ?? 0), 0);
  const attendanceRate =
    totalScheduled > 0 ? `${Math.min(100, (totalActual / totalScheduled) * 100).toFixed(0)}%` : '—';

  drawKpiRow(doc, [
    { label: 'Staff Members', value: String(data.staff.length) },
    { label: 'Total Orders / Tickets', value: String(totalOrders) },
    { label: 'Total Scheduled Hours', value: formatHours(totalScheduled) },
    { label: 'Team Attendance Rate', value: attendanceRate },
  ]);

  // Staff performance table
  drawSectionLabel(doc, 'Staff Performance');
  drawTable(
    doc,
    [
      { header: 'Name', width: 120 },
      { header: 'Role', width: 75 },
      { header: 'Orders/Tickets', width: 70, align: 'right' },
      { header: 'Avg Prep', width: 65, align: 'right' },
      { header: 'Sched. Hrs', width: 65, align: 'right' },
      { header: 'Actual Hrs', width: 60, align: 'right' },
      { header: 'Attendance', width: 60, align: 'right' },
    ],
    data.staff.map((s) => {
      const att =
        s.scheduledHours > 0
          ? `${Math.min(100, ((s.actualHours ?? 0) / s.scheduledHours) * 100).toFixed(0)}%`
          : '—';
      return [
        s.name,
        s.role,
        String(s.ordersHandled ?? 0),
        formatMins(s.averagePrepTimeMinutes),
        formatHours(s.scheduledHours),
        formatHours(s.actualHours),
        att,
      ];
    }),
    ['TEAM TOTAL', '', String(totalOrders), '', formatHours(totalScheduled), formatHours(totalActual), attendanceRate],
  );

  // Waiter collections table
  const waiters = data.staff.filter((s) => s.role === 'WAITER' && s.paymentBreakdown);
  if (waiters.length > 0) {
    doc.moveDown(0.5);
    drawSectionLabel(doc, 'Waiter Collections');
    let totMpesa = 0, totCash = 0, totCard = 0, totTotal = 0;
    const waiterTableRows = waiters.map((w) => {
      const pb = w.paymentBreakdown!;
      totMpesa += rev(pb.mpesa);
      totCash += rev(pb.cash);
      totCard += rev(pb.card);
      totTotal += rev(pb.total);
      return [w.name, String(w.ordersHandled), formatKes(rev(pb.mpesa)), formatKes(rev(pb.cash)), formatKes(rev(pb.card)), formatKes(rev(pb.total))];
    });
    drawTable(
      doc,
      [
        { header: 'Waiter', width: 160 },
        { header: 'Orders', width: 60, align: 'right' },
        { header: 'M-Pesa', width: 100, align: 'right' },
        { header: 'Cash', width: 100, align: 'right' },
        { header: 'Card', width: 100, align: 'right' },
        { header: 'Total', width: 95, align: 'right' },
      ],
      waiterTableRows,
      ['TOTAL', String(waiters.reduce((s, w) => s + w.ordersHandled, 0)), formatKes(totMpesa), formatKes(totCash), formatKes(totCard), formatKes(totTotal)],
    );
  }
};

// ── Accountant Reconciliation PDF ─────────────────────────────────────────────

const PAYMENT_LABEL: Record<string, string> = {
  MPESA: 'M-Pesa',
  CASH: 'Cash',
  CARD: 'Card',
  SPLIT: 'Split',
  HOUSE_ACCOUNT: 'House Acct',
  CORPORATE_ACCOUNT: 'Corporate',
  CUSTOMER_CREDIT: 'Credit',
};

const drawReconciliationPdf = (
  doc: PDFKit.PDFDocument,
  data: AccountantReconciliationReport,
): void => {
  drawBrandedHeader(
    doc,
    'Daily Reconciliation Report',
    `${data.organizationName} · ${data.date}`,
  );
  drawPageBorder(doc);

  // Summary KPI strip
  const s = data.summary;
  drawKpiRow(doc, [
    { label: 'Total Collected', value: formatKes(rev(s.total)) },
    { label: 'M-Pesa', value: formatKes(rev(s.mpesa)) },
    { label: 'Cash', value: formatKes(rev(s.cash)) },
    { label: 'Card', value: formatKes(rev(s.card)) },
  ]);

  // By-waiter breakdown
  if (data.waiters.length > 0) {
    drawSectionLabel(doc, 'Collections by Waiter');
    drawTable(
      doc,
      [
        { header: 'Waiter', width: 150 },
        { header: 'Orders', width: 55, align: 'right' },
        { header: 'M-Pesa', width: 90, align: 'right' },
        { header: 'Cash', width: 90, align: 'right' },
        { header: 'Card', width: 90, align: 'right' },
        { header: 'Total', width: 90, align: 'right' },
      ],
      data.waiters.map((w) => [
        w.name,
        String(w.ordersHandled),
        formatKes(rev(w.paymentBreakdown.mpesa)),
        formatKes(rev(w.paymentBreakdown.cash)),
        formatKes(rev(w.paymentBreakdown.card)),
        formatKes(rev(w.paymentBreakdown.total)),
      ]),
      [
        'TOTAL',
        String(data.waiters.reduce((acc, w) => acc + w.ordersHandled, 0)),
        formatKes(rev(s.mpesa)),
        formatKes(rev(s.cash)),
        formatKes(rev(s.card)),
        formatKes(rev(s.total)),
      ],
    );
  }

  // Order detail table
  if (data.orders.length > 0) {
    doc.moveDown(0.5);
    drawSectionLabel(doc, 'Order Detail');
    drawTable(
      doc,
      [
        { header: '#', width: 30, align: 'right' },
        { header: 'Time', width: 50 },
        { header: 'Waiter', width: 90 },
        { header: 'Method', width: 80 },
        { header: 'Amount', width: 80, align: 'right' },
        { header: 'M-Pesa', width: 65, align: 'right' },
        { header: 'Cash', width: 55, align: 'right' },
        { header: 'Card', width: 55, align: 'right' },
      ],
      data.orders.map((o) => {
        const time = new Date(o.time).toLocaleTimeString('en-KE', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: NAIROBI_TZ,
        });
        return [
          String(o.dailyNumber),
          time,
          o.waiterName,
          PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod,
          formatKes(rev(o.total)),
          formatKes(rev(o.paymentBreakdown.mpesa)),
          formatKes(rev(o.paymentBreakdown.cash)),
          formatKes(rev(o.paymentBreakdown.card)),
        ];
      }),
    );
  }
};

const drawCorporateStatementPdf = (
  doc: PDFKit.PDFDocument,
  data: CorporateAccountStatementReport,
): void => {
  drawBrandedHeader(
    doc,
    'Statement of Account',
    `${data.startDate} to ${data.endDate}`,
  );
  drawPageBorder(doc);

  // Statement meta (reference / statement date / due date) + Bill-To, side by side
  const metaY = doc.y;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(STONE_500);
  doc.text('BILL TO', MARGIN, metaY, { lineBreak: false });
  doc.fontSize(10).font('Helvetica-Bold').fillColor(ESPRESSO);
  doc.text(data.companyName, MARGIN, metaY + 12, { lineBreak: false });
  doc.fontSize(8.5).font('Helvetica').fillColor(STONE_500);
  const contactLine = [data.contactName, data.contactPhone, data.contactEmail].filter(Boolean).join('  ·  ');
  doc.text(contactLine, MARGIN, metaY + 27, { width: CONTENT_W / 2, lineBreak: false });

  const metaColX = MARGIN + CONTENT_W / 2;
  doc.fontSize(8).font('Helvetica-Bold').fillColor(STONE_500);
  doc.text('STATEMENT REF', metaColX, metaY, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
  doc.fontSize(9).font('Helvetica').fillColor(STONE_800);
  doc.text(data.statementReference, metaColX, metaY + 12, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
  doc.fontSize(8).font('Helvetica').fillColor(STONE_500);
  doc.text(`Statement Date: ${data.statementDate}`, metaColX, metaY + 27, { width: CONTENT_W / 2, align: 'right', lineBreak: false });
  doc.text(`Due Date: ${data.dueDate}`, metaColX, metaY + 39, { width: CONTENT_W / 2, align: 'right', lineBreak: false });

  doc.y = metaY + 54;

  const opening = rev(data.openingBalance);
  const charged = rev(data.totalCharged);
  const settled = rev(data.totalSettled);
  const closing = rev(data.closingBalance);

  drawKpiRow(doc, [
    { label: 'Opening Balance', value: formatKes(opening) },
    { label: 'Charged This Period', value: formatKes(charged) },
    { label: 'Settled This Period', value: formatKes(settled) },
    { label: 'Closing Balance', value: formatKes(closing) },
  ]);

  if (data.orders.length > 0) {
    drawSectionLabel(doc, 'Charges');
    drawTable(
      doc,
      [
        { header: '#', width: 40, align: 'right' },
        { header: 'Date', width: 80 },
        { header: 'Employee Ref', width: 130 },
        { header: 'Branch', width: 130 },
        { header: 'Amount', width: 135, align: 'right' },
      ],
      data.orders.map((o) => [
        String(o.dailyNumber),
        o.date,
        o.employeeRef ?? '—',
        o.branchName,
        formatKes(rev(o.total)),
      ]),
      ['', '', '', 'TOTAL CHARGED', formatKes(charged)],
    );
  }

  if (data.settlements.length > 0) {
    doc.moveDown(0.5);
    drawSectionLabel(doc, 'Payments Received');
    drawTable(
      doc,
      [
        { header: 'Date', width: 80 },
        { header: 'Method', width: 80 },
        { header: 'Recorded By', width: 130 },
        { header: 'Note', width: 130, align: 'left' },
        { header: 'Amount', width: 95, align: 'right' },
      ],
      data.settlements.map((s) => [
        s.date,
        s.paymentMethod,
        s.recordedBy,
        s.note ?? '—',
        formatKes(rev(s.amount)),
      ]),
      ['', '', '', 'TOTAL SETTLED', formatKes(settled)],
    );
  }

  doc.moveDown(0.8);
  doc.save();
  const summaryY = doc.y;
  doc.rect(MARGIN, summaryY, CONTENT_W, 28).fill(ESPRESSO);
  doc.fontSize(9.5).font('Helvetica-Bold').fillColor(WHITE);
  doc.text('AMOUNT DUE', MARGIN + 10, summaryY + 8, { lineBreak: false });
  doc.fontSize(11).font('Helvetica-Bold').fillColor(AMBER);
  doc.text(formatKes(closing), MARGIN, summaryY + 7, { width: CONTENT_W - 10, align: 'right', lineBreak: false });
  doc.restore();
  doc.y = summaryY + 28;
};

// ── Type map (needed by toCsv / toPdf) ───────────────────────────────────────

type ReportDataByType = {
  daily_summary: DailySummaryReport;
  staff_performance: StaffPerformanceReport;
  branch_overview: BranchOverviewReport;
  director_analytics: BranchOverviewReport;
  manager_analytics: StaffPerformanceReport;
  accountant_reconciliation: AccountantReconciliationReport;
  corporate_account_statement: CorporateAccountStatementReport;
};

export const toPdf = async <T extends ReportType>(
  type: T,
  data: ReportDataByType[T],
): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: 'Wendo RMS Report',
        Author: 'Wendo Coffee Bistro',
        Subject: type.replace(/_/g, ' '),
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    if (type === 'daily_summary') {
      drawDailySummaryPdf(doc, data as ReportDataByType['daily_summary']);
    } else if (type === 'staff_performance' || type === 'manager_analytics') {
      drawStaffPerformancePdf(doc, data as ReportDataByType['staff_performance']);
    } else if (type === 'branch_overview') {
      drawBranchOverviewPdf(doc, data as ReportDataByType['branch_overview']);
    } else if (type === 'director_analytics') {
      drawDirectorAnalyticsPdf(doc, data as ReportDataByType['director_analytics']);
    } else if (type === 'accountant_reconciliation') {
      drawReconciliationPdf(doc, data as ReportDataByType['accountant_reconciliation']);
    } else if (type === 'corporate_account_statement') {
      drawCorporateStatementPdf(doc, data as ReportDataByType['corporate_account_statement']);
    }

    // With bufferPages=true, all pages are in memory. Draw footer on every page.
    // Table overflow can trigger an extra addPage() leaving a blank trailing page
    // (cursor at top with nothing drawn). PDFKit has no delete-page API, so if
    // the last page is blank we cover it with a solid white rectangle to make it
    // invisible, then draw the footer only on the real content pages.
    const range = doc.bufferedPageRange();
    const lastIdx = range.start + range.count - 1;
    const footerFn = type === 'corporate_account_statement' ? drawStatementFooter : drawFooter;

    doc.switchToPage(lastIdx);
    const lastPageIsBlank = doc.y <= MARGIN + 2;

    if (lastPageIsBlank && range.count > 1) {
      // Draw footer on all content pages (skip the blank last page).
      for (let i = range.start; i < lastIdx; i++) {
        doc.switchToPage(i);
        footerFn(doc);
      }
      // Paint the blank page white so it appears truly empty.
      doc.switchToPage(lastIdx);
      doc.save();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(WHITE);
      doc.restore();
    } else {
      // No trailing blank page — draw footer on every page.
      for (let i = range.start; i <= lastIdx; i++) {
        doc.switchToPage(i);
        footerFn(doc);
      }
    }

    doc.flushPages();
    doc.end();
  });
};
