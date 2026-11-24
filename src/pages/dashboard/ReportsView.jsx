import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  FileDown,
  FileSpreadsheet,
  History,
  IndianRupee,
  Printer,
  RefreshCw,
  Search,
  Table2,
  X,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';
import {
  downloadCustomerHistoryExcel,
  downloadCustomerHistoryPdf,
  downloadFormSummaryExcel,
  downloadFormSummaryPdf,
  downloadPaymentsExcel,
  downloadPaymentsPdf,
  downloadTableRecordsExcel,
  downloadTableRecordsPdf,
  formatCurrency,
  formatReportDate,
  getLocalDateString,
} from '../../utils/exportUtils.js';

const REPORT_TABS = [
  { id: 'table-records', label: 'Table Records', icon: Table2 },
  { id: 'form-summary', label: 'Form Summary', icon: BarChart3 },
  { id: 'payments', label: 'Payments', icon: IndianRupee },
  { id: 'customer-history', label: 'Customer History', icon: History },
  { id: 'exports', label: 'Exports', icon: Download },
];

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_3_months', label: 'Last 3 Months' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

const PAGE_SIZE = 25;

function resolveDateRange(preset, customStart, customEnd) {
  const now = new Date();
  const today = getLocalDateString(now);

  if (preset === 'all') {
    return { startDate: '', endDate: '', label: 'All Time', invalid: false };
  }
  if (preset === 'today') {
    return { startDate: today, endDate: today, label: 'Today', invalid: false };
  }
  if (preset === 'yesterday') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const yStr = getLocalDateString(y);
    return { startDate: yStr, endDate: yStr, label: 'Yesterday', invalid: false };
  }
  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { startDate: getLocalDateString(start), endDate: today, label: 'This Week', invalid: false };
  }
  if (preset === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: getLocalDateString(start), endDate: today, label: 'This Month', invalid: false };
  }
  if (preset === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: getLocalDateString(start),
      endDate: getLocalDateString(end),
      label: 'Last Month',
      invalid: false,
    };
  }
  if (preset === 'last_3_months') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      startDate: getLocalDateString(start),
      endDate: today,
      label: 'Last 3 Months',
      invalid: false,
    };
  }
  if (preset === 'year') {
    const start = new Date(now.getFullYear(), 0, 1);
    return { startDate: getLocalDateString(start), endDate: today, label: 'This Year', invalid: false };
  }
  const invalid = Boolean(customStart && customEnd && customStart > customEnd);
  return {
    startDate: customStart || '',
    endDate: customEnd || '',
    label: `${customStart ? formatReportDate(customStart) : 'Start'} to ${customEnd ? formatReportDate(customEnd) : 'Present'}`,
    invalid,
  };
}

function formatTableCell(value, col) {
  if (value === '' || value === undefined || value === null) return '—';
  const num = Number(value);
  if (col.isMoney && !Number.isNaN(num)) {
    return formatCurrency(num);
  }
  if (col.type === 'number' && !Number.isNaN(num)) {
    return num.toLocaleString('en-IN');
  }
  return String(value);
}

function ExportActionButtons({ disabled, exporting, onPdf, onExcel, onPrint }) {
  return (
    <div className="ff-rep-export-group ff-no-print">
      <button
        type="button"
        className="ff-rep-export-btn"
        disabled={disabled || exporting}
        onClick={onPdf}
      >
        <FileDown size={14} aria-hidden="true" />
        <span>Export PDF</span>
      </button>
      <button
        type="button"
        className="ff-rep-export-btn ff-rep-export-btn-accent"
        disabled={disabled || exporting}
        onClick={onExcel}
      >
        <FileSpreadsheet size={14} aria-hidden="true" />
        <span>Export Excel</span>
      </button>
      <button
        type="button"
        className="ff-rep-export-btn"
        disabled={disabled || exporting}
        onClick={onPrint}
      >
        <Printer size={14} aria-hidden="true" />
        <span>Print</span>
      </button>
    </div>
  );
}

function PaginationFooter({ page, totalPages, totalItems, pageSize, itemLabel, onPageChange }) {
  if (!totalItems || totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);
  return (
    <div className="ff-rep-pagination ff-no-print">
      <div className="ff-tabular">
        Showing {start}–{end} of {totalItems} {itemLabel}
      </div>
      <div className="d-inline-flex align-items-center gap-2">
        <button
          type="button"
          className="ff-rep-page-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} aria-hidden="true" />
          <span>Previous</span>
        </button>
        <span className="ff-tabular fw-semibold text-body">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className="ff-rep-page-btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <span>Next</span>
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function ReportsView() {
  const { businesses } = useWorkspace();
  const [searchParams] = useSearchParams();
  const queryBizId = searchParams.get('businessId');

  // Active Reports Tab
  const [activeTab, setActiveTab] = useState('table-records');

  // Shared Date Range Filter (preserved across tabs and filters)
  const [datePreset, setDatePreset] = useState('all');
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return getLocalDateString(d);
  });
  const [customEnd, setCustomEnd] = useState(() => getLocalDateString());

  // Table Records State
  const [trFormId, setTrFormId] = useState('');
  const [trTableField, setTrTableField] = useState('');
  const [trSearchInput, setTrSearchInput] = useState('');
  const [trAppliedSearch, setTrAppliedSearch] = useState('');
  const [trPage, setTrPage] = useState(1);
  const [trData, setTrData] = useState(null);
  const [trLoading, setTrLoading] = useState(false);
  const [trError, setTrError] = useState('');

  // Overview Tabs State (Form Summary, Payments, Customer History)
  const [overviewFormId, setOverviewFormId] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentSearchInput, setPaymentSearchInput] = useState('');
  const [paymentAppliedSearch, setPaymentAppliedSearch] = useState('');
  const [historySearchInput, setHistorySearchInput] = useState('');
  const [historyAppliedSearch, setHistoryAppliedSearch] = useState('');
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [expandedHistoryIds, setExpandedHistoryIds] = useState({});

  // Exports Tab Selection
  const [exportSection, setExportSection] = useState('table-records');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);

  // Initialize form selection from query param or first form with a repeating table
  useEffect(() => {
    if (businesses.length === 0) {
      setTrFormId('');
      setTrTableField('');
      return;
    }

    if (queryBizId && businesses.some((b) => String(b.id) === String(queryBizId))) {
      setTrFormId(String(queryBizId));
      setOverviewFormId(String(queryBizId));
      return;
    }

    setTrFormId((prev) => {
      if (prev && businesses.some((b) => String(b.id) === String(prev))) return prev;
      const withTable = businesses.find((b) => (b.fields || []).some((f) => f.type === 'table'));
      return String((withTable || businesses[0]).id);
    });

    setOverviewFormId((prev) => {
      if (prev === 'all') return 'all';
      return businesses.some((b) => String(b.id) === String(prev)) ? prev : 'all';
    });
  }, [businesses, queryBizId]);

  const selectedTrForm = useMemo(
    () => businesses.find((b) => String(b.id) === String(trFormId)) || null,
    [businesses, trFormId]
  );

  const availableRepeatingTables = useMemo(
    () => (selectedTrForm?.fields || []).filter((f) => f.type === 'table'),
    [selectedTrForm]
  );

  // Keep selected repeating table valid when the selected form changes
  useEffect(() => {
    if (availableRepeatingTables.length === 0) {
      setTrTableField('');
      return;
    }
    setTrTableField((prev) => {
      if (prev && availableRepeatingTables.some((f) => f.fieldName === prev)) return prev;
      return availableRepeatingTables[0].fieldName;
    });
  }, [availableRepeatingTables]);

  const selectedRepeatingTableDef = useMemo(
    () => availableRepeatingTables.find((f) => f.fieldName === trTableField) || null,
    [availableRepeatingTables, trTableField]
  );

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd]
  );

  const overviewFormLabel = useMemo(() => {
    if (overviewFormId === 'all') return 'All Forms';
    return businesses.find((b) => String(b.id) === String(overviewFormId))?.name || 'All Forms';
  }, [businesses, overviewFormId]);

  // Dynamic contextual placeholder based on the selected repeating table's columns
  const trSearchPlaceholder = useMemo(() => {
    if (!selectedRepeatingTableDef) return 'Search table records...';
    const cols = Array.isArray(selectedRepeatingTableDef.columns)
      ? selectedRepeatingTableDef.columns
      : [];
    const textCol = cols.find((c) => c.type !== 'number') || cols[0];
    if (textCol?.label) {
      return `Search ${selectedRepeatingTableDef.label} by ${textCol.label}...`;
    }
    return `Search ${selectedRepeatingTableDef.label}...`;
  }, [selectedRepeatingTableDef]);

  // Fetch Table Records from backend API
  const shouldFetchTableRecords =
    (activeTab === 'table-records' || (activeTab === 'exports' && exportSection === 'table-records')) &&
    Boolean(trFormId) &&
    !dateRange.invalid;

  useEffect(() => {
    if (!shouldFetchTableRecords) return;
    const controller = new AbortController();
    setTrLoading(true);
    setTrError('');

    workspaceApi
      .getTableRecordsReport({
        businessId: trFormId,
        tableField: trTableField,
        q: trAppliedSearch,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        page: trPage,
        pageSize: PAGE_SIZE,
        signal: controller.signal,
      })
      .then((res) => {
        setTrData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setTrError(err.message || 'Unable to load repeating table records.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setTrLoading(false);
      });

    return () => controller.abort();
  }, [
    shouldFetchTableRecords,
    trFormId,
    trTableField,
    trAppliedSearch,
    dateRange.startDate,
    dateRange.endDate,
    trPage,
    reloadNonce,
  ]);

  // Determine active overview context (Form Summary, Payments, Customer History, or Exports)
  const effectiveOverviewSection =
    activeTab === 'exports' ? exportSection : activeTab;

  const shouldFetchOverview =
    (effectiveOverviewSection === 'form-summary' ||
      effectiveOverviewSection === 'payments' ||
      effectiveOverviewSection === 'customer-history') &&
    !dateRange.invalid;

  const activeOverviewSearch =
    effectiveOverviewSection === 'payments'
      ? paymentAppliedSearch
      : effectiveOverviewSection === 'customer-history'
        ? historyAppliedSearch
        : '';

  const activeOverviewPaymentMethod =
    effectiveOverviewSection === 'payments' ? paymentMethodFilter : 'all';

  useEffect(() => {
    if (!shouldFetchOverview) return;
    const controller = new AbortController();
    setOverviewLoading(true);
    setOverviewError('');

    workspaceApi
      .getReportsOverview({
        businessId: overviewFormId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        paymentMethod: activeOverviewPaymentMethod,
        q: activeOverviewSearch,
        page: overviewPage,
        pageSize: PAGE_SIZE,
        signal: controller.signal,
      })
      .then((res) => {
        setOverviewData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setOverviewError(err.message || 'Unable to load report data.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setOverviewLoading(false);
      });

    return () => controller.abort();
  }, [
    shouldFetchOverview,
    overviewFormId,
    dateRange.startDate,
    dateRange.endDate,
    activeOverviewPaymentMethod,
    activeOverviewSearch,
    overviewPage,
    reloadNonce,
  ]);

  // Handlers
  function handleTrFormChange(nextId) {
    setTrFormId(nextId);
    setTrPage(1);
    const nextBiz = businesses.find((b) => String(b.id) === String(nextId));
    const nextTables = (nextBiz?.fields || []).filter((f) => f.type === 'table');
    setTrTableField(nextTables[0]?.fieldName || '');
    setTrSearchInput('');
    setTrAppliedSearch('');
    setTrError('');
    if (nextTables.length === 0) {
      setTrData(null);
    }
  }

  function handleTrTableChange(nextTableField) {
    setTrTableField(nextTableField);
    setTrPage(1);
    setTrSearchInput('');
    setTrAppliedSearch('');
  }

  function handleTrSearchSubmit(e) {
    e.preventDefault();
    setTrPage(1);
    setTrAppliedSearch(trSearchInput.trim());
  }

  function handleClearTrSearch() {
    setTrSearchInput('');
    setTrAppliedSearch('');
    setTrPage(1);
  }

  function handleDatePresetChange(nextPreset) {
    setDatePreset(nextPreset);
    setTrPage(1);
    setOverviewPage(1);
  }

  function handleOverviewFormChange(nextFormId) {
    setOverviewFormId(nextFormId);
    setOverviewPage(1);
  }

  function handlePaymentSearchSubmit(e) {
    e.preventDefault();
    setOverviewPage(1);
    setPaymentAppliedSearch(paymentSearchInput.trim());
  }

  function handleHistorySearchSubmit(e) {
    e.preventDefault();
    setOverviewPage(1);
    setHistoryAppliedSearch(historySearchInput.trim());
  }

  function toggleHistoryDetails(recId) {
    setExpandedHistoryIds((prev) => ({ ...prev, [recId]: !prev[recId] }));
  }

  function handleTabChange(nextTab) {
    setActiveTab(nextTab);
    setExportError('');
    setOverviewPage(1);
  }

  // Export handlers (fetch complete filtered dataset if multi-page so totals & rows always match 100%)
  const exportTableRecords = useCallback(
    async (format) => {
      if (!trFormId || !trData?.table || dateRange.invalid) return;
      setExporting(true);
      setExportError('');
      try {
        let payload = trData;
        if ((trData.pagination?.totalRows || 0) > (trData.rows?.length || 0)) {
          payload = await workspaceApi.getTableRecordsReport({
            businessId: trFormId,
            tableField: trTableField,
            q: trAppliedSearch,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            page: 1,
            pageSize: 5000,
          });
        }
        const args = {
          businessName: payload.business?.name || selectedTrForm?.name || 'Form',
          tableLabel: payload.table?.label || selectedRepeatingTableDef?.label || 'Table Records',
          dateLabel: dateRange.label,
          searchQuery: trAppliedSearch,
          columns: payload.table?.columns || [],
          rows: payload.rows || [],
          totals: payload.totals || {},
          hasMoneyColumns: Boolean(payload.hasMoneyColumns),
        };
        if (format === 'pdf') downloadTableRecordsPdf(args);
        else downloadTableRecordsExcel(args);
      } catch (err) {
        setExportError(err.message || 'Export failed. Please try again.');
      } finally {
        setExporting(false);
      }
    },
    [
      trFormId,
      trTableField,
      trAppliedSearch,
      trData,
      dateRange,
      selectedTrForm,
      selectedRepeatingTableDef,
    ]
  );

  const exportOverviewSection = useCallback(
    async (section, format) => {
      if (!overviewData || dateRange.invalid) return;
      setExporting(true);
      setExportError('');
      try {
        let payload = overviewData;
        const needsAllRecords =
          section !== 'form-summary' &&
          (overviewData.pagination?.totalRecords || 0) > (overviewData.records?.length || 0);
        if (needsAllRecords) {
          payload = await workspaceApi.getReportsOverview({
            businessId: overviewFormId,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            paymentMethod: section === 'payments' ? paymentMethodFilter : 'all',
            q: section === 'payments' ? paymentAppliedSearch : section === 'customer-history' ? historyAppliedSearch : '',
            page: 1,
            pageSize: 5000,
          });
        }

        if (section === 'form-summary') {
          const args = {
            businessLabel: overviewFormLabel,
            dateLabel: dateRange.label,
            summary: payload.summary,
            formSummaries: payload.formSummaries || [],
            fieldSummaries: payload.fieldSummaries || [],
          };
          if (format === 'pdf') downloadFormSummaryPdf(args);
          else downloadFormSummaryExcel(args);
        } else if (section === 'payments') {
          const methodLabel =
            paymentMethodFilter === 'all' ? 'All Methods' : paymentMethodFilter;
          const args = {
            businessLabel: overviewFormLabel,
            dateLabel: dateRange.label,
            methodLabel,
            searchQuery: paymentAppliedSearch,
            summary: payload.summary,
            records: payload.records || [],
          };
          if (format === 'pdf') downloadPaymentsPdf(args);
          else downloadPaymentsExcel(args);
        } else if (section === 'customer-history') {
          const args = {
            businessLabel: overviewFormLabel,
            dateLabel: dateRange.label,
            searchQuery: historyAppliedSearch,
            records: payload.records || [],
            totalAmount: payload.summary?.totalAmount || 0,
          };
          if (format === 'pdf') downloadCustomerHistoryPdf(args);
          else downloadCustomerHistoryExcel(args);
        }
      } catch (err) {
        setExportError(err.message || 'Export failed. Please try again.');
      } finally {
        setExporting(false);
      }
    },
    [
      overviewData,
      overviewFormId,
      overviewFormLabel,
      dateRange,
      paymentMethodFilter,
      paymentAppliedSearch,
      historyAppliedSearch,
    ]
  );

  function handlePrint() {
    window.print();
  }

  // Reusable custom date row
  function renderCustomDateInputs(idPrefix) {
    if (datePreset !== 'custom') return null;
    return (
      <div className="row g-2 mt-2 pt-2 border-top">
        <div className="col-sm-6 col-md-4 col-lg-3">
          <label htmlFor={`${idPrefix}-start`} className="ff-rep-filter-label">
            Start Date
          </label>
          <input
            id={`${idPrefix}-start`}
            type="date"
            className="form-control form-control-sm ff-rep-control"
            value={customStart}
            onChange={(e) => {
              setCustomStart(e.target.value);
              setTrPage(1);
              setOverviewPage(1);
            }}
          />
        </div>
        <div className="col-sm-6 col-md-4 col-lg-3">
          <label htmlFor={`${idPrefix}-end`} className="ff-rep-filter-label">
            End Date
          </label>
          <input
            id={`${idPrefix}-end`}
            type="date"
            className="form-control form-control-sm ff-rep-control"
            value={customEnd}
            onChange={(e) => {
              setCustomEnd(e.target.value);
              setTrPage(1);
              setOverviewPage(1);
            }}
          />
        </div>
        {dateRange.invalid && (
          <div className="col-12">
            <div className="alert alert-warning small py-2 mb-0 d-flex align-items-center gap-2" role="alert">
              <AlertCircle size={15} className="flex-shrink-0" aria-hidden="true" />
              <span>Start Date cannot be after End Date. Adjust the range to view matching records.</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Reusable Table Records results table renderer (used in both Table Records tab and Exports preview)
  function renderTableRecordsResults({ compactPreview = false } = {}) {
    const hasNoTables = availableRepeatingTables.length === 0;
    const columns = hasNoTables ? [] : (trData?.table?.columns || []);
    const rows = hasNoTables ? [] : (trData?.rows || []);
    const totals = hasNoTables ? {} : (trData?.totals || {});
    const hasMoneyColumns = !hasNoTables && Boolean(trData?.hasMoneyColumns);
    const hasSummableCols = columns.some((c) => c.isSummable);
    const totalRowsCount = hasNoTables ? 0 : (trData?.pagination?.totalRows || 0);
    const displayRows = compactPreview ? rows.slice(0, 10) : rows;
    const tableTitle = hasNoTables
      ? 'Table Records'
      : (trData?.table?.label || selectedRepeatingTableDef?.label || 'Table Records');
    const bizName = selectedTrForm?.name || trData?.business?.name || '';

    return (
      <div className="ff-rep-table-card">
        <div className="ff-print-only px-3 pt-3">
          <h2 className="h5 fw-bold mb-1">
            {tableTitle} {bizName ? `— ${bizName}` : ''}
          </h2>
          <div className="small text-secondary">
            Range: {dateRange.label}
            {trAppliedSearch ? ` · Search: "${trAppliedSearch}"` : ''}
            {` · ${totalRowsCount} matching ${totalRowsCount === 1 ? 'record' : 'records'}`}
            {` · Generated ${formatReportDate(getLocalDateString())}`}
          </div>
        </div>

        <div className="ff-rep-table-headbar">
          <div className="min-w-0">
            <h2 className="h6 fw-bold mb-0 text-truncate">
              {tableTitle}
            </h2>
            <div className="ff-rep-meta-line">
              {bizName && <span>{bizName}</span>}
              {bizName && <span aria-hidden="true">·</span>}
              <span>{dateRange.label}</span>
              <span aria-hidden="true">·</span>
              <span className="ff-tabular">
                {totalRowsCount} matching {totalRowsCount === 1 ? 'record' : 'records'}
              </span>
              {trAppliedSearch && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Search: &ldquo;{trAppliedSearch}&rdquo;</span>
                </>
              )}
            </div>
          </div>

          {!compactPreview && (
            <ExportActionButtons
              disabled={trLoading || dateRange.invalid || hasNoTables || totalRowsCount === 0}
              exporting={exporting}
              onPdf={() => exportTableRecords('pdf')}
              onExcel={() => exportTableRecords('excel')}
              onPrint={handlePrint}
            />
          )}
        </div>

        {trError ? (
          <div className="p-4 text-center">
            <div className="text-danger small fw-medium mb-2 d-inline-flex align-items-center gap-2">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{trError}</span>
            </div>
            <div>
              <button
                type="button"
                className="ff-rep-page-btn"
                onClick={() => setReloadNonce((n) => n + 1)}
              >
                <RefreshCw size={13} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        ) : businesses.length === 0 ? (
          <div className="p-5 text-center text-secondary small">
            No forms found yet. Create a form with a repeating table to view table records here.
          </div>
        ) : availableRepeatingTables.length === 0 ? (
          <div className="p-5 text-center text-secondary small">
            <strong>{selectedTrForm?.name || 'This form'}</strong> has no repeating tables configured.
            Select another form or add a repeating table in Create Forms.
          </div>
        ) : trLoading ? (
          <div className="p-5 text-center text-secondary small">
            <div className="spinner-border spinner-border-sm me-2" style={{ color: 'var(--ff-rep-accent)' }} role="status" />
            <span>Loading {tableTitle} records...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-5 text-center">
            <div className="text-secondary small mb-3">
              {trAppliedSearch ? (
                <>
                  No matching records found for <strong>&ldquo;{trAppliedSearch}&rdquo;</strong> in{' '}
                  <strong>{tableTitle}</strong> ({dateRange.label}).
                </>
              ) : (
                <>
                  No saved records found in <strong>{tableTitle}</strong> for {dateRange.label}.
                </>
              )}
            </div>
            {(trAppliedSearch || datePreset !== 'all') && (
              <div className="d-inline-flex flex-wrap justify-content-center gap-2 ff-no-print">
                {trAppliedSearch && (
                  <button
                    type="button"
                    className="ff-rep-page-btn"
                    onClick={handleClearTrSearch}
                  >
                    Clear Search
                  </button>
                )}
                {datePreset !== 'all' && (
                  <button
                    type="button"
                    className="ff-rep-page-btn"
                    onClick={() => handleDatePresetChange('all')}
                  >
                    Show All Time
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table ff-rep-ledger align-middle">
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Date</th>
                    {columns.map((col) => (
                      <th
                        key={col.id || col.name}
                        className={col.type === 'number' ? 'text-end' : ''}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr key={row.id}>
                      <td className="ff-tabular text-nowrap text-secondary">
                        {formatReportDate(row.date)}
                      </td>
                      {columns.map((col, idx) => (
                        <td
                          key={col.id || col.name}
                          className={
                            col.type === 'number'
                              ? 'text-end ff-mono fw-medium'
                              : idx === 0
                                ? 'fw-medium'
                                : ''
                          }
                        >
                          {formatTableCell(row.cells?.[col.name], col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {hasSummableCols && (
                  <tfoot>
                    <tr>
                      <td>{hasMoneyColumns ? 'Total Payment' : 'Total'}</td>
                      {columns.map((col) => (
                        <td
                          key={col.id || col.name}
                          className={col.type === 'number' ? 'text-end ff-mono' : ''}
                        >
                          {col.isSummable
                            ? col.isMoney
                              ? formatCurrency(totals[col.name] || 0)
                              : Number(totals[col.name] || 0).toLocaleString('en-IN')
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {compactPreview && totalRowsCount > displayRows.length && (
              <div className="px-3 py-2 border-top small text-secondary ff-no-print">
                Previewing first {displayRows.length} of {totalRowsCount} matching rows. Exporting includes all {totalRowsCount} filtered rows and totals.
              </div>
            )}

            {!compactPreview && (
              <PaginationFooter
                page={trData?.pagination?.page || 1}
                totalPages={trData?.pagination?.totalPages || 1}
                totalItems={totalRowsCount}
                pageSize={PAGE_SIZE}
                itemLabel="rows"
                onPageChange={setTrPage}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="ff-reports-shell">
      {/* Section Tabs — Only the selected tab's content renders below */}
      <div className="ff-reports-tabs-bar ff-no-print" role="tablist" aria-label="Reports sections">
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`rep-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`rep-panel-${tab.id}`}
              className={`ff-reports-tab ${isActive ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <Icon size={15} className="flex-shrink-0" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {exportError && (
        <div className="alert alert-danger small py-2 mb-0 d-flex align-items-center justify-content-between gap-2 ff-no-print" role="alert">
          <span className="d-inline-flex align-items-center gap-2">
            <AlertCircle size={15} aria-hidden="true" />
            <span>{exportError}</span>
          </span>
          <button
            type="button"
            className="btn-close btn-sm"
            aria-label="Dismiss error"
            onClick={() => setExportError('')}
          />
        </div>
      )}

      {/* ==================== TAB 1: TABLE RECORDS ==================== */}
      {activeTab === 'table-records' && (
        <section
          id="rep-panel-table-records"
          role="tabpanel"
          aria-labelledby="rep-tab-table-records"
          className="d-flex flex-column gap-3"
        >
          <form className="ff-rep-filter-card ff-no-print" onSubmit={handleTrSearchSubmit}>
            <div className="row g-2 align-items-end">
              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-tr-form" className="ff-rep-filter-label">
                  Form
                </label>
                <select
                  id="rep-tr-form"
                  className="form-select form-select-sm ff-rep-control"
                  value={trFormId}
                  onChange={(e) => handleTrFormChange(e.target.value)}
                  disabled={businesses.length === 0}
                >
                  {businesses.length === 0 ? (
                    <option value="">No forms available</option>
                  ) : (
                    businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.archived ? '(Archived)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-tr-table" className="ff-rep-filter-label">
                  Repeating Table
                </label>
                <select
                  id="rep-tr-table"
                  className="form-select form-select-sm ff-rep-control"
                  value={trTableField}
                  onChange={(e) => handleTrTableChange(e.target.value)}
                  disabled={availableRepeatingTables.length === 0}
                >
                  {availableRepeatingTables.length === 0 ? (
                    <option value="">No repeating tables</option>
                  ) : (
                    availableRepeatingTables.map((f) => (
                      <option key={f.fieldName} value={f.fieldName}>
                        {f.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="col-sm-6 col-lg-2">
                <label htmlFor="rep-tr-date" className="ff-rep-filter-label">
                  Date Range
                </label>
                <select
                  id="rep-tr-date"
                  className="form-select form-select-sm ff-rep-control"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-sm-6 col-lg-4">
                <label htmlFor="rep-tr-search" className="ff-rep-filter-label">
                  Search {selectedRepeatingTableDef?.label || 'Records'}
                </label>
                <div className="d-flex align-items-center gap-2">
                  <div className="ff-rep-search-wrap">
                    <Search size={14} className="ff-rep-search-icon" aria-hidden="true" />
                    <input
                      id="rep-tr-search"
                      type="text"
                      className="form-control form-control-sm ff-rep-control ff-rep-search-input"
                      placeholder={trSearchPlaceholder}
                      value={trSearchInput}
                      onChange={(e) => setTrSearchInput(e.target.value)}
                      disabled={availableRepeatingTables.length === 0}
                    />
                    {(trSearchInput || trAppliedSearch) && (
                      <button
                        type="button"
                        className="ff-rep-search-clear"
                        aria-label="Clear search"
                        onClick={handleClearTrSearch}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    id="rep-tr-search-btn"
                    type="submit"
                    className="ff-rep-btn-primary"
                    disabled={availableRepeatingTables.length === 0 || dateRange.invalid}
                  >
                    <Search size={14} aria-hidden="true" />
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>

            {renderCustomDateInputs('rep-tr')}
          </form>

          {renderTableRecordsResults()}
        </section>
      )}

      {/* ==================== TAB 2: FORM SUMMARY ==================== */}
      {activeTab === 'form-summary' && (
        <section
          id="rep-panel-form-summary"
          role="tabpanel"
          aria-labelledby="rep-tab-form-summary"
          className="d-flex flex-column gap-3"
        >
          <div className="ff-rep-filter-card ff-no-print">
            <div className="row g-2 align-items-end">
              <div className="col-sm-6 col-md-4 col-lg-3">
                <label htmlFor="rep-fs-form" className="ff-rep-filter-label">
                  Form
                </label>
                <select
                  id="rep-fs-form"
                  className="form-select form-select-sm ff-rep-control"
                  value={overviewFormId}
                  onChange={(e) => handleOverviewFormChange(e.target.value)}
                >
                  <option value="all">All Forms</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.archived ? '(Archived)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6 col-md-4 col-lg-3">
                <label htmlFor="rep-fs-date" className="ff-rep-filter-label">
                  Date Range
                </label>
                <select
                  id="rep-fs-date"
                  className="form-select form-select-sm ff-rep-control"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4 col-lg-6 d-flex justify-content-start justify-content-md-end">
                <ExportActionButtons
                  disabled={overviewLoading || dateRange.invalid || !overviewData}
                  exporting={exporting}
                  onPdf={() => exportOverviewSection('form-summary', 'pdf')}
                  onExcel={() => exportOverviewSection('form-summary', 'excel')}
                  onPrint={handlePrint}
                />
              </div>
            </div>
            {renderCustomDateInputs('rep-fs')}
          </div>

          <div className="ff-print-only">
            <h2 className="h5 fw-bold mb-1">Form Summary — {overviewFormLabel}</h2>
            <div className="small text-secondary">
              Range: {dateRange.label} · Generated {formatReportDate(getLocalDateString())}
            </div>
          </div>

          {overviewError ? (
            <div className="ff-rep-table-card p-4 text-center">
              <div className="text-danger small fw-medium mb-2">{overviewError}</div>
              <button
                type="button"
                className="ff-rep-page-btn"
                onClick={() => setReloadNonce((n) => n + 1)}
              >
                <RefreshCw size={13} aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          ) : overviewLoading && !overviewData ? (
            <div className="ff-rep-table-card p-5 text-center text-secondary small">
              <div className="spinner-border spinner-border-sm me-2" style={{ color: 'var(--ff-rep-accent)' }} role="status" />
              <span>Loading form summary...</span>
            </div>
          ) : (
            <>
              <div className="ff-rep-stat-strip">
                <div className="ff-rep-stat-cell">
                  <div className="ff-rep-stat-label">Forms in Scope</div>
                  <div className="ff-rep-stat-num">{overviewData?.formSummaries?.length || 0}</div>
                  <div className="ff-rep-stat-sub">{overviewFormLabel}</div>
                </div>
                <div className="ff-rep-stat-cell">
                  <div className="ff-rep-stat-label">Total Submissions</div>
                  <div className="ff-rep-stat-num">{overviewData?.summary?.totalRecords || 0}</div>
                  <div className="ff-rep-stat-sub">{dateRange.label}</div>
                </div>
                <div className="ff-rep-stat-cell">
                  <div className="ff-rep-stat-label">Repeating Entries</div>
                  <div className="ff-rep-stat-num">{overviewData?.summary?.totalRepeatingEntries || 0}</div>
                  <div className="ff-rep-stat-sub">Across configured tables</div>
                </div>
                <div className="ff-rep-stat-cell">
                  <div className="ff-rep-stat-label">Total Collected</div>
                  <div className="ff-rep-stat-num">{formatCurrency(overviewData?.summary?.totalAmount || 0)}</div>
                  <div className="ff-rep-stat-sub ff-tabular">
                    {overviewData?.summary?.cashCount || 0} Cash · {overviewData?.summary?.onlineCount || 0} Online
                  </div>
                </div>
              </div>

              <div className="ff-rep-table-card">
                <div className="ff-rep-table-headbar">
                  <div>
                    <h2 className="h6 fw-bold mb-0">Form Activity Breakdown</h2>
                    <div className="ff-rep-meta-line">
                      <span>{overviewFormLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{dateRange.label}</span>
                    </div>
                  </div>
                </div>

                {(overviewData?.formSummaries || []).length === 0 ? (
                  <div className="p-4 text-center text-secondary small">
                    No forms available to summarize.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table ff-rep-ledger align-middle">
                      <thead>
                        <tr>
                          <th>Form Name</th>
                          <th className="text-end">Fields</th>
                          <th className="text-end">Repeating Tables</th>
                          <th className="text-end">Submissions</th>
                          <th className="text-end">Repeating Rows</th>
                          <th className="text-end">Total Collected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(overviewData?.formSummaries || []).map((fs) => (
                          <tr key={fs.businessId}>
                            <td>
                              <div className="fw-semibold">{fs.name}</div>
                              <div className="small text-secondary">
                                {fs.category}
                                {fs.archived ? ' · Archived' : ''}
                              </div>
                            </td>
                            <td className="text-end ff-mono text-secondary">{fs.fieldCount}</td>
                            <td className="text-end ff-mono text-secondary">{fs.repeatingTableCount}</td>
                            <td className="text-end ff-mono fw-semibold">{fs.recordCount}</td>
                            <td className="text-end ff-mono">{fs.repeatingRowCount}</td>
                            <td className="text-end ff-mono fw-semibold">{formatCurrency(fs.totalAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>Total</td>
                          <td className="text-end ff-mono" />
                          <td className="text-end ff-mono" />
                          <td className="text-end ff-mono">{overviewData?.summary?.totalRecords || 0}</td>
                          <td className="text-end ff-mono">{overviewData?.summary?.totalRepeatingEntries || 0}</td>
                          <td className="text-end ff-mono">{formatCurrency(overviewData?.summary?.totalAmount || 0)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {(overviewData?.fieldSummaries || []).length > 0 && (
                <div className="ff-rep-table-card">
                  <div className="ff-rep-table-headbar">
                    <div>
                      <h2 className="h6 fw-bold mb-0">Configured Field Aggregates</h2>
                      <div className="ff-rep-meta-line">
                        <span>Numeric totals, selections, and Yes/No counts from submitted entries</span>
                      </div>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table ff-rep-ledger align-middle">
                      <thead>
                        <tr>
                          <th style={{ width: '38%' }}>Field</th>
                          <th>Calculated Summary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overviewData.fieldSummaries.map((item) => (
                          <tr key={item.key}>
                            <td className="fw-medium">{item.label}</td>
                            <td className="ff-tabular text-secondary">{item.summaryText}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ==================== TAB 3: PAYMENTS ==================== */}
      {activeTab === 'payments' && (
        <section
          id="rep-panel-payments"
          role="tabpanel"
          aria-labelledby="rep-tab-payments"
          className="d-flex flex-column gap-3"
        >
          <form className="ff-rep-filter-card ff-no-print" onSubmit={handlePaymentSearchSubmit}>
            <div className="row g-2 align-items-end">
              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-pay-form" className="ff-rep-filter-label">
                  Form
                </label>
                <select
                  id="rep-pay-form"
                  className="form-select form-select-sm ff-rep-control"
                  value={overviewFormId}
                  onChange={(e) => handleOverviewFormChange(e.target.value)}
                >
                  <option value="all">All Forms</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.archived ? '(Archived)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6 col-lg-2">
                <label htmlFor="rep-pay-date" className="ff-rep-filter-label">
                  Date Range
                </label>
                <select
                  id="rep-pay-date"
                  className="form-select form-select-sm ff-rep-control"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6 col-lg-2">
                <label htmlFor="rep-pay-method" className="ff-rep-filter-label">
                  Method
                </label>
                <select
                  id="rep-pay-method"
                  className="form-select form-select-sm ff-rep-control"
                  value={paymentMethodFilter}
                  onChange={(e) => {
                    setPaymentMethodFilter(e.target.value);
                    setOverviewPage(1);
                  }}
                >
                  <option value="all">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="Online">Online</option>
                </select>
              </div>
              <div className="col-sm-6 col-lg-5">
                <label htmlFor="rep-pay-search" className="ff-rep-filter-label">
                  Search Payments
                </label>
                <div className="d-flex align-items-center gap-2">
                  <div className="ff-rep-search-wrap">
                    <Search size={14} className="ff-rep-search-icon" aria-hidden="true" />
                    <input
                      id="rep-pay-search"
                      type="text"
                      className="form-control form-control-sm ff-rep-control ff-rep-search-input"
                      placeholder="Search by customer, record, or Transaction ID..."
                      value={paymentSearchInput}
                      onChange={(e) => setPaymentSearchInput(e.target.value)}
                    />
                    {(paymentSearchInput || paymentAppliedSearch) && (
                      <button
                        type="button"
                        className="ff-rep-search-clear"
                        aria-label="Clear payment search"
                        onClick={() => {
                          setPaymentSearchInput('');
                          setPaymentAppliedSearch('');
                          setOverviewPage(1);
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="ff-rep-btn-primary"
                    disabled={dateRange.invalid}
                  >
                    <Search size={14} aria-hidden="true" />
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>
            {renderCustomDateInputs('rep-pay')}
          </form>

          <div className="ff-print-only">
            <h2 className="h5 fw-bold mb-1">Payments Report — {overviewFormLabel}</h2>
            <div className="small text-secondary">
              Range: {dateRange.label} · Method: {paymentMethodFilter === 'all' ? 'All Methods' : paymentMethodFilter}
              {paymentAppliedSearch ? ` · Search: "${paymentAppliedSearch}"` : ''}
            </div>
          </div>

          <div className="ff-rep-stat-strip">
            <div className="ff-rep-stat-cell">
              <div className="ff-rep-stat-label">Total Payments</div>
              <div className="ff-rep-stat-num">{overviewData?.summary?.totalPayments || 0}</div>
              <div className="ff-rep-stat-sub">{dateRange.label}</div>
            </div>
            <div className="ff-rep-stat-cell">
              <div className="ff-rep-stat-label">Total Collected</div>
              <div className="ff-rep-stat-num">{formatCurrency(overviewData?.summary?.totalAmount || 0)}</div>
              <div className="ff-rep-stat-sub">{overviewFormLabel}</div>
            </div>
            <div className="ff-rep-stat-cell">
              <div className="ff-rep-stat-label">Cash Payments</div>
              <div className="ff-rep-stat-num">{formatCurrency(overviewData?.summary?.cashAmount || 0)}</div>
              <div className="ff-rep-stat-sub ff-tabular">
                {overviewData?.summary?.cashCount || 0}{' '}
                {overviewData?.summary?.cashCount === 1 ? 'record' : 'records'}
              </div>
            </div>
            <div className="ff-rep-stat-cell">
              <div className="ff-rep-stat-label">Online Payments</div>
              <div className="ff-rep-stat-num">{formatCurrency(overviewData?.summary?.onlineAmount || 0)}</div>
              <div className="ff-rep-stat-sub ff-tabular">
                {overviewData?.summary?.onlineCount || 0}{' '}
                {overviewData?.summary?.onlineCount === 1 ? 'record' : 'records'}
              </div>
            </div>
          </div>

          <div className="ff-rep-table-card">
            <div className="ff-rep-table-headbar">
              <div>
                <h2 className="h6 fw-bold mb-0">Payments Ledger</h2>
                <div className="ff-rep-meta-line">
                  <span>{overviewFormLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{dateRange.label}</span>
                  <span aria-hidden="true">·</span>
                  <span>{paymentMethodFilter === 'all' ? 'All Methods' : paymentMethodFilter}</span>
                  {paymentAppliedSearch && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Search: &ldquo;{paymentAppliedSearch}&rdquo;</span>
                    </>
                  )}
                </div>
              </div>
              <ExportActionButtons
                disabled={overviewLoading || dateRange.invalid || (overviewData?.records || []).length === 0}
                exporting={exporting}
                onPdf={() => exportOverviewSection('payments', 'pdf')}
                onExcel={() => exportOverviewSection('payments', 'excel')}
                onPrint={handlePrint}
              />
            </div>

            {overviewError ? (
              <div className="p-4 text-center">
                <div className="text-danger small fw-medium mb-2">{overviewError}</div>
                <button
                  type="button"
                  className="ff-rep-page-btn"
                  onClick={() => setReloadNonce((n) => n + 1)}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  <span>Retry</span>
                </button>
              </div>
            ) : overviewLoading ? (
              <div className="p-5 text-center text-secondary small">
                <div className="spinner-border spinner-border-sm me-2" style={{ color: 'var(--ff-rep-accent)' }} role="status" />
                <span>Loading payments...</span>
              </div>
            ) : (overviewData?.records || []).length === 0 ? (
              <div className="p-5 text-center text-secondary small">
                No payment records match the current filters.
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table ff-rep-ledger align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: '135px' }}>Date</th>
                        <th>Record / Customer</th>
                        <th>Form</th>
                        <th>Method</th>
                        <th>Transaction ID</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overviewData?.records || []).map((rec) => (
                        <tr key={rec.id}>
                          <td className="ff-tabular text-nowrap text-secondary">
                            {formatReportDate(rec.date)}
                          </td>
                          <td className="fw-medium">{rec.displayTitle}</td>
                          <td className="text-secondary">{rec.businessName}</td>
                          <td>{rec.payment?.method || 'Cash'}</td>
                          <td className="ff-mono small text-secondary">
                            {rec.payment?.transactionId || '—'}
                          </td>
                          <td className="text-end ff-mono fw-semibold">
                            {formatCurrency(rec.payment?.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={5}>
                          Total Payment ({overviewData?.summary?.totalPayments || 0}{' '}
                          {overviewData?.summary?.totalPayments === 1 ? 'record' : 'records'})
                        </td>
                        <td className="text-end ff-mono">
                          {formatCurrency(overviewData?.summary?.totalAmount || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <PaginationFooter
                  page={overviewData?.pagination?.page || 1}
                  totalPages={overviewData?.pagination?.totalPages || 1}
                  totalItems={overviewData?.pagination?.totalRecords || 0}
                  pageSize={PAGE_SIZE}
                  itemLabel="payments"
                  onPageChange={setOverviewPage}
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* ==================== TAB 4: CUSTOMER HISTORY ==================== */}
      {activeTab === 'customer-history' && (
        <section
          id="rep-panel-customer-history"
          role="tabpanel"
          aria-labelledby="rep-tab-customer-history"
          className="d-flex flex-column gap-3"
        >
          <form className="ff-rep-filter-card ff-no-print" onSubmit={handleHistorySearchSubmit}>
            <div className="row g-2 align-items-end">
              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-ch-form" className="ff-rep-filter-label">
                  Form
                </label>
                <select
                  id="rep-ch-form"
                  className="form-select form-select-sm ff-rep-control"
                  value={overviewFormId}
                  onChange={(e) => handleOverviewFormChange(e.target.value)}
                >
                  <option value="all">All Forms</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.archived ? '(Archived)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-ch-date" className="ff-rep-filter-label">
                  Date Range
                </label>
                <select
                  id="rep-ch-date"
                  className="form-select form-select-sm ff-rep-control"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-6">
                <label htmlFor="rep-ch-search" className="ff-rep-filter-label">
                  Search Customer History
                </label>
                <div className="d-flex align-items-center gap-2">
                  <div className="ff-rep-search-wrap">
                    <Search size={14} className="ff-rep-search-icon" aria-hidden="true" />
                    <input
                      id="rep-ch-search"
                      type="text"
                      className="form-control form-control-sm ff-rep-control ff-rep-search-input"
                      placeholder="Search by customer name, phone, email, or submitted field..."
                      value={historySearchInput}
                      onChange={(e) => setHistorySearchInput(e.target.value)}
                    />
                    {(historySearchInput || historyAppliedSearch) && (
                      <button
                        type="button"
                        className="ff-rep-search-clear"
                        aria-label="Clear customer history search"
                        onClick={() => {
                          setHistorySearchInput('');
                          setHistoryAppliedSearch('');
                          setOverviewPage(1);
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="ff-rep-btn-primary"
                    disabled={dateRange.invalid}
                  >
                    <Search size={14} aria-hidden="true" />
                    <span>Search</span>
                  </button>
                </div>
              </div>
            </div>
            {renderCustomDateInputs('rep-ch')}
          </form>

          <div className="ff-rep-table-card">
            <div className="ff-print-only px-3 pt-3">
              <h2 className="h5 fw-bold mb-1">Customer History — {overviewFormLabel}</h2>
              <div className="small text-secondary">
                Range: {dateRange.label}
                {historyAppliedSearch ? ` · Search: "${historyAppliedSearch}"` : ''}
                {` · ${overviewData?.pagination?.totalRecords || 0} records`}
              </div>
            </div>

            <div className="ff-rep-table-headbar">
              <div>
                <h2 className="h6 fw-bold mb-0">Customer Registration History</h2>
                <div className="ff-rep-meta-line">
                  <span>{overviewFormLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>{dateRange.label}</span>
                  <span aria-hidden="true">·</span>
                  <span className="ff-tabular">
                    {overviewData?.pagination?.totalRecords || 0}{' '}
                    {overviewData?.pagination?.totalRecords === 1 ? 'record' : 'records'}
                  </span>
                  {historyAppliedSearch && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Search: &ldquo;{historyAppliedSearch}&rdquo;</span>
                    </>
                  )}
                </div>
              </div>
              <ExportActionButtons
                disabled={overviewLoading || dateRange.invalid || (overviewData?.records || []).length === 0}
                exporting={exporting}
                onPdf={() => exportOverviewSection('customer-history', 'pdf')}
                onExcel={() => exportOverviewSection('customer-history', 'excel')}
                onPrint={handlePrint}
              />
            </div>

            {overviewError ? (
              <div className="p-4 text-center">
                <div className="text-danger small fw-medium mb-2">{overviewError}</div>
                <button
                  type="button"
                  className="ff-rep-page-btn"
                  onClick={() => setReloadNonce((n) => n + 1)}
                >
                  <RefreshCw size={13} aria-hidden="true" />
                  <span>Retry</span>
                </button>
              </div>
            ) : overviewLoading ? (
              <div className="p-5 text-center text-secondary small">
                <div className="spinner-border spinner-border-sm me-2" style={{ color: 'var(--ff-rep-accent)' }} role="status" />
                <span>Loading customer history...</span>
              </div>
            ) : (overviewData?.records || []).length === 0 ? (
              <div className="p-5 text-center text-secondary small">
                No historical customer registrations found for these filters.
              </div>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table ff-rep-ledger align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Date</th>
                        <th>Customer / Entry</th>
                        <th>Form</th>
                        <th>Submitted Summary</th>
                        <th className="text-end">Payment</th>
                        <th className="text-end ff-no-print" style={{ width: '90px' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overviewData?.records || []).map((rec) => {
                        const isExpanded = Boolean(expandedHistoryIds[rec.id]);
                        const contactLine = [rec.customerPhone, rec.customerEmail]
                          .filter(Boolean)
                          .join(' · ');
                        const summaryPreview = (rec.details || [])
                          .slice(0, 2)
                          .map((d) => `${d.label}: ${d.value}`)
                          .join(' · ');

                        return (
                          <tr key={rec.id}>
                            <td className="ff-tabular text-nowrap text-secondary">
                              {formatReportDate(rec.date)}
                            </td>
                            <td>
                              <div className="fw-semibold">{rec.displayTitle}</div>
                              {contactLine && (
                                <div className="small text-secondary">{contactLine}</div>
                              )}
                            </td>
                            <td className="text-secondary">{rec.businessName}</td>
                            <td>
                              <div className="small text-secondary">
                                {summaryPreview || '—'}
                              </div>
                              {isExpanded && (rec.details || []).length > 2 && (
                                <div className="mt-2 pt-2 border-top small">
                                  {(rec.details || []).slice(2).map((d, idx) => (
                                    <div key={idx} className="text-secondary">
                                      <span className="fw-medium text-body">{d.label}:</span> {d.value}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="text-end">
                              <div className="ff-mono fw-semibold">
                                {formatCurrency(rec.payment?.amount)}
                              </div>
                              <div className="small text-secondary">
                                {rec.payment?.method || 'Cash'}
                              </div>
                            </td>
                            <td className="text-end ff-no-print">
                              {(rec.details || []).length > 2 ? (
                                <button
                                  type="button"
                                  className="ff-rep-page-btn"
                                  aria-expanded={isExpanded}
                                  onClick={() => toggleHistoryDetails(rec.id)}
                                >
                                  <span>{isExpanded ? 'Less' : 'More'}</span>
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              ) : (
                                <span className="text-secondary small">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>
                          Total ({overviewData?.pagination?.totalRecords || 0}{' '}
                          {overviewData?.pagination?.totalRecords === 1 ? 'registration' : 'registrations'})
                        </td>
                        <td className="text-end ff-mono">
                          {formatCurrency(overviewData?.summary?.totalAmount || 0)}
                        </td>
                        <td className="ff-no-print" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <PaginationFooter
                  page={overviewData?.pagination?.page || 1}
                  totalPages={overviewData?.pagination?.totalPages || 1}
                  totalItems={overviewData?.pagination?.totalRecords || 0}
                  pageSize={PAGE_SIZE}
                  itemLabel="records"
                  onPageChange={setOverviewPage}
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* ==================== TAB 5: EXPORTS ==================== */}
      {activeTab === 'exports' && (
        <section
          id="rep-panel-exports"
          role="tabpanel"
          aria-labelledby="rep-tab-exports"
          className="d-flex flex-column gap-3"
        >
          <div className="ff-rep-filter-card ff-no-print">
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3 pb-3 border-bottom">
              <div>
                <h2 className="h6 fw-bold mb-1">Export Filtered Report</h2>
                <p className="small text-secondary mb-0">
                  Choose the report section and filters below. Exported files and printouts include only the selected report&apos;s filtered records and totals.
                </p>
              </div>
              <ExportActionButtons
                disabled={
                  dateRange.invalid ||
                  (exportSection === 'table-records'
                    ? trLoading || availableRepeatingTables.length === 0 || !trData?.table || (trData?.pagination?.totalRows || 0) === 0
                    : overviewLoading ||
                      (exportSection === 'form-summary'
                        ? !overviewData
                        : (overviewData?.pagination?.totalRecords || 0) === 0))
                }
                exporting={exporting}
                onPdf={() =>
                  exportSection === 'table-records'
                    ? exportTableRecords('pdf')
                    : exportOverviewSection(exportSection, 'pdf')
                }
                onExcel={() =>
                  exportSection === 'table-records'
                    ? exportTableRecords('excel')
                    : exportOverviewSection(exportSection, 'excel')
                }
                onPrint={handlePrint}
              />
            </div>

            <div className="row g-2 align-items-end">
              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-exp-section" className="ff-rep-filter-label">
                  Report Section
                </label>
                <select
                  id="rep-exp-section"
                  className="form-select form-select-sm ff-rep-control"
                  value={exportSection}
                  onChange={(e) => {
                    setExportSection(e.target.value);
                    setOverviewPage(1);
                    setExportError('');
                  }}
                >
                  <option value="table-records">Table Records</option>
                  <option value="form-summary">Form Summary</option>
                  <option value="payments">Payments</option>
                  <option value="customer-history">Customer History</option>
                </select>
              </div>

              {exportSection === 'table-records' ? (
                <>
                  <div className="col-sm-6 col-lg-3">
                    <label htmlFor="rep-exp-tr-form" className="ff-rep-filter-label">
                      Form
                    </label>
                    <select
                      id="rep-exp-tr-form"
                      className="form-select form-select-sm ff-rep-control"
                      value={trFormId}
                      onChange={(e) => handleTrFormChange(e.target.value)}
                    >
                      {businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.archived ? '(Archived)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-sm-6 col-lg-3">
                    <label htmlFor="rep-exp-tr-table" className="ff-rep-filter-label">
                      Repeating Table
                    </label>
                    <select
                      id="rep-exp-tr-table"
                      className="form-select form-select-sm ff-rep-control"
                      value={trTableField}
                      onChange={(e) => handleTrTableChange(e.target.value)}
                      disabled={availableRepeatingTables.length === 0}
                    >
                      {availableRepeatingTables.length === 0 ? (
                        <option value="">No repeating tables</option>
                      ) : (
                        availableRepeatingTables.map((f) => (
                          <option key={f.fieldName} value={f.fieldName}>
                            {f.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </>
              ) : (
                <div className="col-sm-6 col-lg-3">
                  <label htmlFor="rep-exp-form" className="ff-rep-filter-label">
                    Form
                  </label>
                  <select
                    id="rep-exp-form"
                    className="form-select form-select-sm ff-rep-control"
                    value={overviewFormId}
                    onChange={(e) => handleOverviewFormChange(e.target.value)}
                  >
                    <option value="all">All Forms</option>
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.archived ? '(Archived)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="col-sm-6 col-lg-3">
                <label htmlFor="rep-exp-date" className="ff-rep-filter-label">
                  Date Range
                </label>
                <select
                  id="rep-exp-date"
                  className="form-select form-select-sm ff-rep-control"
                  value={datePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value)}
                >
                  {DATE_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {exportSection === 'payments' && (
                <div className="col-sm-6 col-lg-3">
                  <label htmlFor="rep-exp-method" className="ff-rep-filter-label">
                    Payment Method
                  </label>
                  <select
                    id="rep-exp-method"
                    className="form-select form-select-sm ff-rep-control"
                    value={paymentMethodFilter}
                    onChange={(e) => {
                      setPaymentMethodFilter(e.target.value);
                      setOverviewPage(1);
                    }}
                  >
                    <option value="all">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              )}
            </div>

            {renderCustomDateInputs('rep-exp')}
          </div>

          {/* Live preview of the exact filtered dataset ready for PDF / Excel / Print */}
          {exportSection === 'table-records' ? (
            renderTableRecordsResults({ compactPreview: true })
          ) : (
            <div className="ff-rep-table-card">
              <div className="ff-print-only px-3 pt-3">
                <h2 className="h5 fw-bold mb-1">
                  {exportSection === 'form-summary'
                    ? 'Form Summary'
                    : exportSection === 'payments'
                      ? 'Payments Report'
                      : 'Customer History'}{' '}
                  — {overviewFormLabel}
                </h2>
                <div className="small text-secondary">
                  Range: {dateRange.label} · Generated {formatReportDate(getLocalDateString())}
                </div>
              </div>

              <div className="ff-rep-table-headbar">
                <div>
                  <h2 className="h6 fw-bold mb-0">
                    Export Preview:{' '}
                    {exportSection === 'form-summary'
                      ? 'Form Summary'
                      : exportSection === 'payments'
                        ? 'Payments'
                        : 'Customer History'}
                  </h2>
                  <div className="ff-rep-meta-line">
                    <span>{overviewFormLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{dateRange.label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="ff-tabular">
                      {overviewData?.pagination?.totalRecords || 0}{' '}
                      {overviewData?.pagination?.totalRecords === 1 ? 'record' : 'records'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="ff-mono fw-semibold text-body">
                      Total: {formatCurrency(overviewData?.summary?.totalAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {overviewLoading ? (
                <div className="p-4 text-center text-secondary small">
                  <div className="spinner-border spinner-border-sm me-2" style={{ color: 'var(--ff-rep-accent)' }} role="status" />
                  <span>Preparing export preview...</span>
                </div>
              ) : exportSection === 'form-summary' ? (
                <div className="table-responsive">
                  <table className="table ff-rep-ledger align-middle">
                    <thead>
                      <tr>
                        <th>Form Name</th>
                        <th className="text-end">Submissions</th>
                        <th className="text-end">Repeating Rows</th>
                        <th className="text-end">Total Collected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overviewData?.formSummaries || []).map((fs) => (
                        <tr key={fs.businessId}>
                          <td className="fw-medium">{fs.name}</td>
                          <td className="text-end ff-mono">{fs.recordCount}</td>
                          <td className="text-end ff-mono">{fs.repeatingRowCount}</td>
                          <td className="text-end ff-mono fw-semibold">{formatCurrency(fs.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="text-end ff-mono">{overviewData?.summary?.totalRecords || 0}</td>
                        <td className="text-end ff-mono">{overviewData?.summary?.totalRepeatingEntries || 0}</td>
                        <td className="text-end ff-mono">{formatCurrency(overviewData?.summary?.totalAmount || 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (overviewData?.records || []).length === 0 ? (
                <div className="p-4 text-center text-secondary small">
                  No matching records available to export for this filter scope.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table ff-rep-ledger align-middle">
                    <thead>
                      <tr>
                        <th style={{ width: '130px' }}>Date</th>
                        <th>Record / Customer</th>
                        <th>Form</th>
                        <th>Method</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(overviewData?.records || []).slice(0, 10).map((rec) => (
                        <tr key={rec.id}>
                          <td className="ff-tabular text-secondary">{formatReportDate(rec.date)}</td>
                          <td className="fw-medium">{rec.displayTitle}</td>
                          <td className="text-secondary">{rec.businessName}</td>
                          <td>{rec.payment?.method || 'Cash'}</td>
                          <td className="text-end ff-mono fw-semibold">
                            {formatCurrency(rec.payment?.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4}>
                          Total Payment ({overviewData?.pagination?.totalRecords || 0}{' '}
                          {overviewData?.pagination?.totalRecords === 1 ? 'record' : 'records'})
                        </td>
                        <td className="text-end ff-mono">
                          {formatCurrency(overviewData?.summary?.totalAmount || 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
