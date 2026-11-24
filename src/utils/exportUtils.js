import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatCurrency(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const raw = String(dateStr).trim();
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dt = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatReportDate(dateStr) {
  if (!dateStr) return '—';
  const raw = String(dateStr).trim();
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dt = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

export function getRecordDisplayTitle(record, business) {
  if (!record) return 'Record';
  const legacyName = String(record.customerName || '').trim();
  if (legacyName) return legacyName;

  const fields = business?.fields || [];
  const answers = record.answers || {};
  for (const f of fields) {
    if (f.type === 'table' || f.type === 'boolean') continue;
    const val = answers[f.fieldName];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return `${f.label}: ${String(val).trim()}`;
    }
  }
  for (const [k, v] of Object.entries(answers)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      const matched = fields.find((f) => f.fieldName === k);
      const label = matched?.label || k;
      if (typeof v === 'boolean') return `${label}: ${v ? 'Yes' : 'No'}`;
      return `${label}: ${String(v).trim()}`;
    }
  }
  return `Registration #${record.id}`;
}

export function getRecordDisplaySubtitle(record, business) {
  if (!record) return '—';
  const contact = [record.customerPhone, record.customerEmail].filter(Boolean).join(' · ');
  if (contact) return contact;

  const titleUsed = getRecordDisplayTitle(record, business);
  const fields = business?.fields || [];
  const answers = record.answers || {};
  const parts = [];
  for (const f of fields) {
    if (f.type === 'table') {
      const count = (record.repeatingTables?.[f.fieldName] || []).length;
      if (count > 0) parts.push(`${f.label}: ${count} ${count === 1 ? 'row' : 'rows'}`);
      continue;
    }
    const val = answers[f.fieldName];
    if (val === undefined || val === null || String(val).trim() === '') continue;
    const formatted = f.type === 'boolean' ? (val ? 'Yes' : 'No') : String(val).trim();
    const candidate = `${f.label}: ${formatted}`;
    if (candidate === titleUsed) continue;
    parts.push(candidate);
    if (parts.length >= 2) break;
  }
  return parts.length > 0 ? parts.join(' · ') : `Record #${record.id}`;
}

export function downloadCustomerInvoicePdf(record, business) {
  const doc = new jsPDF();
  const bizName = business?.name || 'FormFlow Business';
  const displayTitle = getRecordDisplayTitle(record, business);

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(bizName, 14, 17);
  doc.setFontSize(10);
  doc.text(`INVOICE #INV-${record.id}`, 155, 16);
  doc.text(`Date: ${formatDateShort(record.payment?.paidAt || record.createdAt)}`, 155, 23);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(record.customerName ? 'Billed To:' : 'Registration Entry:', 14, 46);
  doc.setFontSize(10);
  doc.text(displayTitle, 14, 52);
  if (record.customerPhone) doc.text(`Phone: ${record.customerPhone}`, 14, 58);
  if (record.customerEmail) doc.text(`Email: ${record.customerEmail}`, 14, 64);

  if (business?.address || business?.phone) {
    doc.setFontSize(11);
    doc.text('Issued By:', 125, 46);
    doc.setFontSize(10);
    if (business.address) doc.text(business.address.slice(0, 42), 125, 52);
    if (business.phone) doc.text(`Phone: ${business.phone}`, 125, 58);
    if (business.email) doc.text(`Email: ${business.email}`, 125, 64);
  }

  let cursorY = 76;

  // Dynamic form fields
  const fields = business?.fields || [];
  const answerRows = fields
    .filter((f) => f.type !== 'table')
    .map((f) => {
      const raw = record.answers?.[f.fieldName];
      const display =
        f.type === 'boolean'
          ? raw
            ? 'Yes'
            : 'No'
          : raw === undefined || raw === ''
            ? '—'
            : String(raw);
      return [f.label, display];
    });

  if (answerRows.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Submitted Field', 'Value']],
      body: answerRows,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
    });
    cursorY = doc.lastAutoTable.finalY + 8;
  }

  // Repeating table sections
  fields
    .filter((f) => f.type === 'table')
    .forEach((tf) => {
      const rows = record.repeatingTables?.[tf.fieldName] || [];
      if (rows.length === 0) return;
      if (cursorY > 265) {
        doc.addPage();
        cursorY = 20;
      }
      doc.setFontSize(10);
      doc.text(tf.label, 14, cursorY);
      const head = [tf.columns.map((c) => c.label)];
      const body = rows.map((r) => tf.columns.map((c) => String(r[c.name] ?? '—')));
      autoTable(doc, {
        startY: cursorY + 3,
        head,
        body,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 9 },
      });
      cursorY = doc.lastAutoTable.finalY + 8;
    });

  // Payment Summary
  autoTable(doc, {
    startY: cursorY,
    head: [['Payment Method', 'Transaction ID', 'Payment Date', 'Total Amount']],
    body: [
      [
        record.payment?.method || 'Cash',
        record.payment?.transactionId || 'Not Applicable',
        formatDateShort(record.payment?.paidAt || record.createdAt),
        `INR ${(Number(record.payment?.amount) || 0).toFixed(2)}`,
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [5, 150, 105] },
    styles: { fontSize: 10, fontStyle: 'bold' },
  });

  const safeFileSlug = displayTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '') || 'entry';
  doc.save(`FormFlow_Invoice_${record.id}_${safeFileSlug}.pdf`);
}

export function downloadBusinessReportPdf({
  businessLabel,
  dateLabel,
  summary,
  fieldSummaries,
  tableSummaries,
  records,
  businessMap,
}) {
  const doc = new jsPDF();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text(`FormFlow Business Report — ${businessLabel}`, 14, 15);
  doc.setFontSize(9.5);
  doc.text(`Range: ${dateLabel}  |  Generated: ${new Date().toLocaleDateString()}`, 14, 23);

  let cursorY = 38;
  autoTable(doc, {
    startY: cursorY,
    head: [['Summary Item', 'Value']],
    body: [
      ['Total Customer Records', String(summary.totalCustomers)],
      ['Total Amount Collected', `INR ${summary.totalAmount.toFixed(2)}`],
      ['Cash Payments', `${summary.cashCount} ${summary.cashCount === 1 ? 'record' : 'records'} — INR ${summary.cashAmount.toFixed(2)}`],
      ['Online Payments', `${summary.onlineCount} ${summary.onlineCount === 1 ? 'record' : 'records'} — INR ${summary.onlineAmount.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9.5 },
  });
  cursorY = doc.lastAutoTable.finalY + 8;

  if (fieldSummaries.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Form Field', 'Summary']],
      body: fieldSummaries.map((f) => [f.label, f.summaryText]),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 9 },
    });
    cursorY = doc.lastAutoTable.finalY + 8;
  }

  if (tableSummaries.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Repeating Table', 'Rows & Numeric Totals']],
      body: tableSummaries.map((t) => [t.label, t.summaryText]),
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 9 },
    });
    cursorY = doc.lastAutoTable.finalY + 8;
  }

  autoTable(doc, {
    startY: cursorY,
    head: [['Customer Record', 'Business', 'Method', 'Transaction ID', 'Date', 'Amount (INR)']],
    body: records.map((r) => [
      getRecordDisplayTitle(r, businessMap[r.businessId]),
      businessMap[r.businessId]?.name || '—',
      r.payment?.method || 'Cash',
      r.payment?.transactionId || '—',
      formatDateShort(r.payment?.paidAt || r.createdAt),
      (Number(r.payment?.amount) || 0).toFixed(2),
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8.5 },
  });

  doc.save(`FormFlow_Report_${businessLabel.replace(/\s+/g, '_')}.pdf`);
}

export function downloadBusinessReportExcel({
  businessLabel,
  dateLabel,
  summary,
  fieldSummaries,
  tableSummaries,
  records,
  businessMap,
}) {
  const wb = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.json_to_sheet([
    { 'Summary Item': 'Business Scope', Value: businessLabel },
    { 'Summary Item': 'Date Range', Value: dateLabel },
    { 'Summary Item': 'Total Customer Records', Value: summary.totalCustomers },
    { 'Summary Item': 'Total Amount (INR)', Value: summary.totalAmount },
    { 'Summary Item': 'Cash Payments Count', Value: summary.cashCount },
    { 'Summary Item': 'Cash Payments Total (INR)', Value: summary.cashAmount },
    { 'Summary Item': 'Online Payments Count', Value: summary.onlineCount },
    { 'Summary Item': 'Online Payments Total (INR)', Value: summary.onlineAmount },
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  const recordsSheet = XLSX.utils.json_to_sheet(
    records.map((r) => {
      const biz = businessMap[r.businessId];
      const row = {
        Record_ID: r.id,
        Customer_Record: getRecordDisplayTitle(r, biz),
        Business: biz?.name || '',
      };
      (biz?.fields || []).forEach((f) => {
        if (f.type === 'table') {
          const rows = r.repeatingTables?.[f.fieldName] || [];
          row[f.label] = `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`;
        } else {
          const val = r.answers?.[f.fieldName];
          row[f.label] =
            f.type === 'boolean'
              ? val === true
                ? 'Yes'
                : val === false
                  ? 'No'
                  : ''
              : val ?? '';
        }
      });
      row.Payment_Method = r.payment?.method || 'Cash';
      row.Transaction_ID = r.payment?.transactionId || '';
      row.Payment_Amount = Number(r.payment?.amount) || 0;
      row.Payment_Date = r.payment?.paidAt || r.createdAt?.slice(0, 10);
      return row;
    })
  );
  XLSX.utils.book_append_sheet(wb, recordsSheet, 'Customer Records');

  const fieldSheet = XLSX.utils.json_to_sheet([
    ...fieldSummaries.map((f) => ({ Category: 'Form Field', Name: f.label, Summary: f.summaryText })),
    ...tableSummaries.map((t) => ({ Category: 'Repeating Table', Name: t.label, Summary: t.summaryText })),
  ]);
  XLSX.utils.book_append_sheet(wb, fieldSheet, 'Field & Table Totals');

  XLSX.writeFile(wb, `FormFlow_Report_${businessLabel.replace(/\s+/g, '_')}.xlsx`);
}

function safeSlug(text, fallback = 'Report') {
  return String(text || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function formatPdfMoney(value) {
  const num = Number(value) || 0;
  return `INR ${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num)}`;
}

export function downloadTableRecordsPdf({
  businessName,
  tableLabel,
  dateLabel,
  searchQuery,
  columns,
  rows,
  totals,
  hasMoneyColumns,
}) {
  const doc = new jsPDF({ orientation: columns.length > 4 ? 'landscape' : 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(`${tableLabel} — ${businessName}`, 14, 14);
  doc.setFontSize(9.5);
  const metaParts = [`Range: ${dateLabel}`, `Matching Rows: ${rows.length}`];
  if (searchQuery) metaParts.push(`Search: "${searchQuery}"`);
  metaParts.push(`Generated: ${formatReportDate(getLocalDateString())}`);
  doc.text(metaParts.join('  |  '), 14, 23);

  const head = [['Date', ...columns.map((c) => c.label)]];
  const body = rows.map((row) => [
    formatReportDate(row.date),
    ...columns.map((col) => {
      const val = row.cells?.[col.name];
      if (val === '' || val === undefined || val === null) return '—';
      if (col.isMoney && !Number.isNaN(Number(val))) return formatPdfMoney(val);
      if (col.type === 'number' && !Number.isNaN(Number(val))) return Number(val).toLocaleString('en-IN');
      return String(val);
    }),
  ]);

  const hasSummableCols = columns.some((c) => c.isSummable);
  const foot = hasSummableCols
    ? [
        [
          hasMoneyColumns ? 'Total Payment' : 'Total',
          ...columns.map((col) => {
            if (!col.isSummable) return '';
            const totalVal = Number(totals?.[col.name]) || 0;
            return col.isMoney ? formatPdfMoney(totalVal) : totalVal.toLocaleString('en-IN');
          }),
        ],
      ]
    : undefined;

  const columnStyles = {};
  columns.forEach((col, idx) => {
    if (col.type === 'number') {
      columnStyles[idx + 1] = { halign: 'right' };
    }
  });

  autoTable(doc, {
    startY: 38,
    head,
    body,
    foot,
    theme: 'grid',
    headStyles: { fillColor: [91, 33, 182], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [245, 243, 255], textColor: [30, 27, 75], fontStyle: 'bold' },
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles,
  });

  const fileSuffix = searchQuery ? `_${safeSlug(searchQuery)}` : '';
  doc.save(`FormFlow_${safeSlug(businessName)}_${safeSlug(tableLabel)}${fileSuffix}.pdf`);
}

export function downloadTableRecordsExcel({
  businessName,
  tableLabel,
  dateLabel,
  searchQuery,
  columns,
  rows,
  totals,
  hasMoneyColumns,
}) {
  const wb = XLSX.utils.book_new();
  const sheetRows = rows.map((row) => {
    const entry = { Date: formatReportDate(row.date) };
    columns.forEach((col) => {
      const val = row.cells?.[col.name];
      if (val === '' || val === undefined || val === null) {
        entry[col.label] = '';
      } else if (col.type === 'number' && !Number.isNaN(Number(val))) {
        entry[col.label] = Number(val);
      } else {
        entry[col.label] = String(val);
      }
    });
    return entry;
  });

  if (columns.some((c) => c.isSummable) && sheetRows.length > 0) {
    const totalRow = { Date: hasMoneyColumns ? 'Total Payment' : 'Total' };
    columns.forEach((col) => {
      totalRow[col.label] = col.isSummable ? Number(totals?.[col.name]) || 0 : '';
    });
    sheetRows.push(totalRow);
  }

  const ws = XLSX.utils.json_to_sheet(sheetRows);
  const sheetName = String(tableLabel || 'Table Records').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const metaSheet = XLSX.utils.json_to_sheet([
    { Field: 'Form', Value: businessName },
    { Field: 'Repeating Table', Value: tableLabel },
    { Field: 'Date Range', Value: dateLabel },
    { Field: 'Search Filter', Value: searchQuery || 'None' },
    { Field: 'Matching Rows', Value: rows.length },
  ]);
  XLSX.utils.book_append_sheet(wb, metaSheet, 'Filter Details');

  const fileSuffix = searchQuery ? `_${safeSlug(searchQuery)}` : '';
  XLSX.writeFile(wb, `FormFlow_${safeSlug(businessName)}_${safeSlug(tableLabel)}${fileSuffix}.xlsx`);
}

export function downloadFormSummaryPdf({
  businessLabel,
  dateLabel,
  summary,
  formSummaries,
  fieldSummaries,
}) {
  const doc = new jsPDF();
  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(`Form Summary Report — ${businessLabel}`, 14, 14);
  doc.setFontSize(9.5);
  doc.text(
    `Range: ${dateLabel}  |  Submissions: ${summary.totalRecords}  |  Generated: ${formatReportDate(getLocalDateString())}`,
    14,
    23
  );

  let cursorY = 38;
  autoTable(doc, {
    startY: cursorY,
    head: [['Metric', 'Value']],
    body: [
      ['Total Submissions', String(summary.totalRecords)],
      ['Repeating Table Entries', String(summary.totalRepeatingEntries || 0)],
      ['Total Collected', formatPdfMoney(summary.totalAmount)],
      ['Cash Payments', `${summary.cashCount} — ${formatPdfMoney(summary.cashAmount)}`],
      ['Online Payments', `${summary.onlineCount} — ${formatPdfMoney(summary.onlineAmount)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: [91, 33, 182] },
    styles: { fontSize: 9.5 },
  });
  cursorY = doc.lastAutoTable.finalY + 8;

  if (formSummaries.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Form', 'Fields', 'Tables', 'Submissions', 'Table Rows', 'Total Collected']],
      body: formSummaries.map((f) => [
        f.name,
        String(f.fieldCount),
        String(f.repeatingTableCount),
        String(f.recordCount),
        String(f.repeatingRowCount),
        formatPdfMoney(f.totalAmount),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });
    cursorY = doc.lastAutoTable.finalY + 8;
  }

  if (fieldSummaries.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Form Field', 'Summary']],
      body: fieldSummaries.map((fs) => [fs.label, fs.summaryText]),
      theme: 'striped',
      headStyles: { fillColor: [91, 33, 182] },
      styles: { fontSize: 9 },
    });
  }

  doc.save(`FormFlow_FormSummary_${safeSlug(businessLabel)}.pdf`);
}

export function downloadFormSummaryExcel({
  businessLabel,
  dateLabel,
  summary,
  formSummaries,
  fieldSummaries,
}) {
  const wb = XLSX.utils.book_new();
  const overviewWs = XLSX.utils.json_to_sheet([
    { Metric: 'Form Scope', Value: businessLabel },
    { Metric: 'Date Range', Value: dateLabel },
    { Metric: 'Total Submissions', Value: summary.totalRecords },
    { Metric: 'Repeating Table Entries', Value: summary.totalRepeatingEntries || 0 },
    { Metric: 'Total Collected (INR)', Value: summary.totalAmount },
    { Metric: 'Cash Payments (INR)', Value: summary.cashAmount },
    { Metric: 'Online Payments (INR)', Value: summary.onlineAmount },
  ]);
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview');

  const formsWs = XLSX.utils.json_to_sheet(
    formSummaries.map((f) => ({
      Form: f.name,
      Category: f.category,
      Configured_Fields: f.fieldCount,
      Repeating_Tables: f.repeatingTableCount,
      Submissions: f.recordCount,
      Repeating_Rows: f.repeatingRowCount,
      Cash_INR: f.cashAmount,
      Online_INR: f.onlineAmount,
      Total_INR: f.totalAmount,
    }))
  );
  XLSX.utils.book_append_sheet(wb, formsWs, 'Forms Breakdown');

  if (fieldSummaries.length > 0) {
    const fieldsWs = XLSX.utils.json_to_sheet(
      fieldSummaries.map((fs) => ({
        Form_Field: fs.label,
        Summary: fs.summaryText,
      }))
    );
    XLSX.utils.book_append_sheet(wb, fieldsWs, 'Field Aggregates');
  }

  XLSX.writeFile(wb, `FormFlow_FormSummary_${safeSlug(businessLabel)}.xlsx`);
}

export function downloadPaymentsPdf({
  businessLabel,
  dateLabel,
  methodLabel,
  searchQuery,
  summary,
  records,
}) {
  const doc = new jsPDF();
  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(`Payments Report — ${businessLabel}`, 14, 14);
  doc.setFontSize(9.5);
  const meta = [`Range: ${dateLabel}`, `Method: ${methodLabel}`];
  if (searchQuery) meta.push(`Search: "${searchQuery}"`);
  doc.text(meta.join('  |  '), 14, 23);

  autoTable(doc, {
    startY: 38,
    head: [['Date', 'Record / Customer', 'Form', 'Method', 'Transaction ID', 'Amount']],
    body: records.map((r) => [
      formatReportDate(r.date || r.payment?.paidAt || r.createdAt),
      r.displayTitle || r.customerName || `Record #${r.id}`,
      r.businessName || '—',
      r.payment?.method || 'Cash',
      r.payment?.transactionId || '—',
      formatPdfMoney(r.payment?.amount),
    ]),
    foot: [
      [
        'Total Payment',
        `${records.length} ${records.length === 1 ? 'payment' : 'payments'}`,
        '',
        `Cash: ${summary.cashCount} | Online: ${summary.onlineCount}`,
        '',
        formatPdfMoney(summary.totalAmount),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [91, 33, 182] },
    footStyles: { fillColor: [245, 243, 255], textColor: [30, 27, 75], fontStyle: 'bold' },
    styles: { fontSize: 8.8 },
    columnStyles: { 5: { halign: 'right' } },
  });

  doc.save(`FormFlow_Payments_${safeSlug(businessLabel)}.pdf`);
}

export function downloadPaymentsExcel({
  businessLabel,
  dateLabel,
  methodLabel,
  searchQuery,
  summary,
  records,
}) {
  const wb = XLSX.utils.book_new();
  const rows = records.map((r) => ({
    Date: formatReportDate(r.date || r.payment?.paidAt || r.createdAt),
    Record: r.displayTitle || r.customerName || `Record #${r.id}`,
    Form: r.businessName || '',
    Method: r.payment?.method || 'Cash',
    Transaction_ID: r.payment?.transactionId || '',
    Amount_INR: Number(r.payment?.amount) || 0,
  }));
  if (rows.length > 0) {
    rows.push({
      Date: 'Total Payment',
      Record: `${records.length} payments`,
      Form: '',
      Method: '',
      Transaction_ID: '',
      Amount_INR: Number(summary.totalAmount) || 0,
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Payments');

  const meta = XLSX.utils.json_to_sheet([
    { Field: 'Form Scope', Value: businessLabel },
    { Field: 'Date Range', Value: dateLabel },
    { Field: 'Payment Method', Value: methodLabel },
    { Field: 'Search Filter', Value: searchQuery || 'None' },
    { Field: 'Total Payments', Value: summary.totalPayments },
    { Field: 'Total Amount (INR)', Value: summary.totalAmount },
    { Field: 'Cash Total (INR)', Value: summary.cashAmount },
    { Field: 'Online Total (INR)', Value: summary.onlineAmount },
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Summary');

  XLSX.writeFile(wb, `FormFlow_Payments_${safeSlug(businessLabel)}.xlsx`);
}

export function downloadCustomerHistoryPdf({
  businessLabel,
  dateLabel,
  searchQuery,
  records,
  totalAmount,
}) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(109, 40, 217);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text(`Customer History — ${businessLabel}`, 14, 14);
  doc.setFontSize(9.5);
  const meta = [`Range: ${dateLabel}`, `Records: ${records.length}`];
  if (searchQuery) meta.push(`Search: "${searchQuery}"`);
  doc.text(meta.join('  |  '), 14, 23);

  autoTable(doc, {
    startY: 38,
    head: [['Date', 'Customer / Entry', 'Contact', 'Form', 'Submitted Summary', 'Method', 'Amount']],
    body: records.map((r) => [
      formatReportDate(r.date || r.payment?.paidAt || r.createdAt),
      r.displayTitle || r.customerName || `Record #${r.id}`,
      [r.customerPhone, r.customerEmail].filter(Boolean).join(' / ') || '—',
      r.businessName || '—',
      (r.details || [])
        .slice(0, 3)
        .map((d) => `${d.label}: ${d.value}`)
        .join('; ') || '—',
      r.payment?.method || 'Cash',
      formatPdfMoney(r.payment?.amount),
    ]),
    foot: [
      [
        'Total',
        `${records.length} ${records.length === 1 ? 'record' : 'records'}`,
        '',
        '',
        '',
        '',
        formatPdfMoney(totalAmount),
      ],
    ],
    theme: 'grid',
    headStyles: { fillColor: [91, 33, 182] },
    footStyles: { fillColor: [245, 243, 255], textColor: [30, 27, 75], fontStyle: 'bold' },
    styles: { fontSize: 8.5 },
    columnStyles: { 6: { halign: 'right' } },
  });

  doc.save(`FormFlow_CustomerHistory_${safeSlug(businessLabel)}.pdf`);
}

export function downloadCustomerHistoryExcel({
  businessLabel,
  dateLabel,
  searchQuery,
  records,
  totalAmount,
}) {
  const wb = XLSX.utils.book_new();
  const rows = records.map((r) => ({
    Date: formatReportDate(r.date || r.payment?.paidAt || r.createdAt),
    Customer_Entry: r.displayTitle || r.customerName || `Record #${r.id}`,
    Phone: r.customerPhone || '',
    Email: r.customerEmail || '',
    Form: r.businessName || '',
    Submitted_Details: (r.details || []).map((d) => `${d.label}: ${d.value}`).join(' | '),
    Payment_Method: r.payment?.method || 'Cash',
    Transaction_ID: r.payment?.transactionId || '',
    Payment_Amount_INR: Number(r.payment?.amount) || 0,
  }));
  if (rows.length > 0) {
    rows.push({
      Date: 'Total',
      Customer_Entry: `${records.length} records`,
      Phone: '',
      Email: '',
      Form: '',
      Submitted_Details: '',
      Payment_Method: '',
      Transaction_ID: '',
      Payment_Amount_INR: Number(totalAmount) || 0,
    });
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Customer History');

  const meta = XLSX.utils.json_to_sheet([
    { Field: 'Form Scope', Value: businessLabel },
    { Field: 'Date Range', Value: dateLabel },
    { Field: 'Search Filter', Value: searchQuery || 'None' },
    { Field: 'Total Records', Value: records.length },
    { Field: 'Total Amount (INR)', Value: totalAmount },
  ]);
  XLSX.utils.book_append_sheet(wb, meta, 'Filter Details');

  XLSX.writeFile(wb, `FormFlow_CustomerHistory_${safeSlug(businessLabel)}.xlsx`);
}
