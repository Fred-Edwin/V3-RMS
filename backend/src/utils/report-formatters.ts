import PDFDocument from 'pdfkit';
import type {
  BranchOverviewReport,
  DailySummaryReport,
  ReportType,
  StaffPerformanceReport,
} from '../types/report.types';

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
  new Date().toLocaleDateString('en-KE', { day: '2-digit', month: 'long', year: 'numeric' });

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
    rev(data.revenueByPaymentMethod.CARD);

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

export const toCsv = <T extends ReportType>(type: T, data: ReportDataByType[T]): Buffer => {
  if (type === 'daily_summary') {
    return toDailySummaryCsv(data as ReportDataByType['daily_summary']);
  }
  if (type === 'staff_performance') {
    return toStaffPerformanceCsv(data as ReportDataByType['staff_performance']);
  }
  return toBranchOverviewCsv(data as ReportDataByType['branch_overview']);
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
  const totalPayments = mpesaRev + cashRev + cardRev;

  const payItems = [
    { label: 'M-Pesa', value: mpesaRev },
    { label: 'Cash', value: cashRev },
    { label: 'Card', value: cardRev },
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

  drawFooter(doc);
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
    drawFooter(doc);
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

  drawFooter(doc);
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

  drawFooter(doc);
};

// ── Type map (needed by toCsv / toPdf) ───────────────────────────────────────

type ReportDataByType = {
  daily_summary: DailySummaryReport;
  staff_performance: StaffPerformanceReport;
  branch_overview: BranchOverviewReport;
};

export const toPdf = async <T extends ReportType>(
  type: T,
  data: ReportDataByType[T],
): Promise<Buffer> => {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      margin: MARGIN,
      size: 'A4',
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
    } else if (type === 'staff_performance') {
      drawStaffPerformancePdf(doc, data as ReportDataByType['staff_performance']);
    } else {
      drawBranchOverviewPdf(doc, data as ReportDataByType['branch_overview']);
    }

    doc.end();
  });
};
