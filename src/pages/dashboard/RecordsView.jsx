import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  Edit3,
  Eye,
  FileDown,
  Search,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';
import {
  downloadCustomerInvoicePdf,
  formatCurrency,
  formatDateShort,
  getLocalDateString,
  getRecordDisplaySubtitle,
  getRecordDisplayTitle,
} from '../../utils/exportUtils.js';
import DynamicFormFields from '../../components/workspace/DynamicFormFields.jsx';

export default function RecordsView() {
  const { businesses, records, setRecords, setRecycleBin } = useWorkspace();
  const [searchParams] = useSearchParams();
  const inspectParam = Number(searchParams.get('inspect'));
  const handledInspectRef = useRef(null);

  const [businessFilter, setBusinessFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [inspectRecord, setInspectRecord] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const businessMap = useMemo(
    () => Object.fromEntries(businesses.map((b) => [b.id, b])),
    [businesses]
  );

  useEffect(() => {
    if (!inspectParam) {
      handledInspectRef.current = null;
      return;
    }
    if (handledInspectRef.current !== inspectParam && records.length > 0) {
      const target = records.find((r) => r.id === inspectParam);
      if (target) {
        handledInspectRef.current = inspectParam;
        setInspectRecord(target);
      }
    }
  }, [inspectParam, records]);

  useEffect(() => {
    if (!inspectRecord && !editRecord && !deleteTarget) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setInspectRecord(null);
        setEditRecord(null);
        if (!deleting) setDeleteTarget(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [inspectRecord, editRecord, deleteTarget, deleting]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records
      .filter((r) =>
        businessFilter === 'all' ? true : String(r.businessId) === String(businessFilter)
      )
      .filter((r) => {
        if (!q) return true;
        const answersText = Object.values(r.answers || {}).join(' ');
        const tablesText = JSON.stringify(r.repeatingTables || {});
        return [
          String(r.id),
          r.customerName,
          r.customerPhone,
          r.customerEmail,
          r.payment?.transactionId,
          businessMap[r.businessId]?.name,
          answersText,
          tablesText,
        ].some((v) => String(v || '').toLowerCase().includes(q));
      });
  }, [records, businessFilter, search, businessMap]);

  function openEditModal(rec) {
    setEditError('');
    setEditFieldErrors({});
    setEditRecord(rec);
    setEditForm({
      customerName: rec.customerName || '',
      customerPhone: rec.customerPhone || '',
      customerEmail: rec.customerEmail || '',
      answers: { ...(rec.answers || {}) },
      repeatingTables: JSON.parse(JSON.stringify(rec.repeatingTables || {})),
      payment: {
        amount: rec.payment?.amount ?? 0,
        method: rec.payment?.method || 'Cash',
        transactionId: rec.payment?.transactionId || '',
        paidAt: rec.payment?.paidAt || getLocalDateString(),
      },
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editRecord || !editForm || saving) return;
    setEditError('');
    const nextFieldErrors = {};

    if (
      editForm.customerEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.customerEmail.trim())
    ) {
      setEditError('Please enter a valid email address.');
      return;
    }

    const bizFields = businessMap[editRecord.businessId]?.fields || [];
    bizFields.forEach((field) => {
      if (!field.required) return;
      if (field.type === 'table') {
        const rows = editForm.repeatingTables?.[field.fieldName] || [];
        const hasValidRow = rows.some((r) =>
          Object.values(r).some((v) => v !== '' && v !== null && v !== undefined && String(v).trim() !== '')
        );
        if (!hasValidRow) {
          nextFieldErrors[field.fieldName] = `${field.label} requires at least one populated row.`;
        }
      } else if (field.type === 'boolean') {
        if (
          editForm.answers?.[field.fieldName] === undefined ||
          editForm.answers?.[field.fieldName] === null
        ) {
          nextFieldErrors[field.fieldName] = `Please select Yes or No for ${field.label}.`;
        }
      } else {
        const val = editForm.answers?.[field.fieldName];
        if (val === undefined || val === null || String(val).trim() === '') {
          nextFieldErrors[field.fieldName] = `${field.label} is required.`;
        }
      }
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setEditFieldErrors(nextFieldErrors);
      setEditError('Please fill in all required form fields.');
      return;
    }

    const rawAmount = editForm.payment.amount;
    if (rawAmount === '' || Number.isNaN(Number(rawAmount)) || Number(rawAmount) < 0) {
      setEditError('Payment amount must be 0 or higher.');
      return;
    }
    if (editForm.payment.method === 'Online' && !editForm.payment.transactionId.trim()) {
      setEditError('Transaction ID is required for Online payments.');
      return;
    }

    setEditFieldErrors({});
    setSaving(true);
    try {
      const payload = {
        ...editForm,
        customerName: editForm.customerName.trim(),
        customerPhone: editForm.customerPhone.trim(),
        customerEmail: editForm.customerEmail.trim(),
        payment: {
          ...editForm.payment,
          amount: Number(rawAmount),
          transactionId:
            editForm.payment.method === 'Online' ? editForm.payment.transactionId.trim() : '',
        },
      };
      const res = await workspaceApi.updateRecord(editRecord.id, payload);
      const updatedTitle = getRecordDisplayTitle(res.record, businessMap[res.record.businessId]);
      setRecords((prev) => prev.map((r) => (r.id === editRecord.id ? res.record : r)));
      setEditRecord(null);
      setFeedback({ type: 'success', message: `Updated record "${updatedTitle}".` });
    } catch (err) {
      setEditError(err.message || 'Failed to update record.');
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteRecord(rec) {
    const label = getRecordDisplayTitle(rec, businessMap[rec.businessId]);
    setDeleteTarget({ record: rec, label });
  }

  async function handleConfirmDeleteRecord() {
    if (!deleteTarget || deleting) return;
    const { record: rec, label } = deleteTarget;
    setDeleting(true);
    try {
      await workspaceApi.deleteRecord(rec.id);
      setRecords((prev) => prev.filter((r) => r.id !== rec.id));
      const binRes = await workspaceApi.getRecycleBin();
      setRecycleBin(binRes.records || []);
      if (inspectRecord?.id === rec.id) setInspectRecord(null);
      setDeleteTarget(null);
      setFeedback({
        type: 'success',
        message: `"${label}" moved to Recycle Bin (retained for 30 days).`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      {feedback.message && (
        <div
          className={`alert ${feedback.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex justify-content-between align-items-center mb-0`}
          role="status"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            className="btn-close btn-sm"
            onClick={() => setFeedback({ type: '', message: '' })}
          />
        </div>
      )}

      <div className="ff-card p-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-5 col-lg-4">
            <label htmlFor="rec-biz-filter" className="form-label small fw-semibold mb-1">
              Filter by Business
            </label>
            <select
              id="rec-biz-filter"
              className="form-select form-select-sm"
              value={businessFilter}
              onChange={(e) => setBusinessFilter(e.target.value)}
            >
              <option value="all">All Businesses ({records.length})</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.archived ? '(Archived)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-7 col-lg-8">
            <label htmlFor="rec-search" className="form-label small fw-semibold mb-1">
              Search Customer Records
            </label>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <Search size={14} className="text-secondary" />
              </span>
              <input
                id="rec-search"
                type="text"
                className="form-control border-start-0"
                placeholder="Search by name, phone, transaction ID, or form entries..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="ff-card overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-4 text-center text-secondary">
            <ClipboardList size={32} className="mb-2 opacity-50" />
            <div className="fw-semibold text-dark mb-1">No matching customer records</div>
            <p className="small mb-0">
              Register a new customer or clear your search or business filter.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table ff-table align-middle mb-0">
              <thead>
                <tr>
                  <th className="px-4 py-3">Customer Record</th>
                  <th className="px-3 py-3">Business</th>
                  <th className="px-3 py-3">Payment Method</th>
                  <th className="px-3 py-3 text-end">Amount</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-4 py-3 text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => {
                  const biz = businessMap[rec.businessId];
                  return (
                    <tr key={rec.id}>
                      <td className="px-4 py-3">
                        <div className="fw-semibold text-dark">{getRecordDisplayTitle(rec, biz)}</div>
                        <div className="small text-secondary">
                          {getRecordDisplaySubtitle(rec, biz)}
                        </div>
                      </td>
                      <td className="px-3 py-3 small">{biz?.name || 'Business'}</td>
                      <td className="px-3 py-3 small">
                        <span className="fw-medium">{rec.payment?.method || 'Cash'}</span>
                        {rec.payment?.transactionId && (
                          <div className="ff-mono text-secondary" style={{ fontSize: '0.75rem' }}>
                            {rec.payment.transactionId}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-end ff-mono fw-semibold">
                        {formatCurrency(rec.payment?.amount)}
                      </td>
                      <td className="px-3 py-3 small text-secondary ff-tabular">
                        {formatDateShort(rec.payment?.paidAt || rec.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="d-inline-flex gap-1">
                          <button
                            type="button"
                            className="btn btn-sm btn-light border ff-icon-btn-sm"
                            title="View record"
                            aria-label="View record"
                            onClick={() => setInspectRecord(rec)}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border ff-icon-btn-sm"
                            title="Edit record"
                            aria-label="Edit record"
                            onClick={() => openEditModal(rec)}
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border ff-icon-btn-sm"
                            title="Download Invoice PDF"
                            aria-label="Download Invoice PDF"
                            onClick={() => downloadCustomerInvoicePdf(rec, biz)}
                          >
                            <FileDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border text-danger ff-icon-btn-sm"
                            title="Move to Recycle Bin"
                            aria-label="Move to Recycle Bin"
                            onClick={() => requestDeleteRecord(rec)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Record Modal */}
      {inspectRecord && (
        <div className="ff-modal-backdrop" onClick={() => setInspectRecord(null)}>
          <div
            className="ff-card p-3 p-sm-4 w-100 shadow-lg overflow-auto"
            style={{ maxWidth: '720px', maxHeight: '88vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const biz = businessMap[inspectRecord.businessId];
              const fields = biz?.fields || [];
              return (
                <>
                  <div className="d-flex justify-content-between align-items-start gap-2 pb-3 mb-3 border-bottom">
                    <div className="min-w-0">
                      <h3 className="h5 fw-bold mb-1 text-break">
                        {getRecordDisplayTitle(inspectRecord, biz)}
                      </h3>
                      <div className="small text-secondary">
                        {biz?.name || 'Business'} · Invoice #INV-{inspectRecord.id}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-close flex-shrink-0"
                      onClick={() => setInspectRecord(null)}
                    />
                  </div>

                  <div className="row g-3 mb-4 small">
                    {(inspectRecord.customerPhone || inspectRecord.customerEmail) && (
                      <>
                        <div className="col-sm-4">
                          <div className="text-secondary">Phone</div>
                          <div className="fw-semibold text-break">{inspectRecord.customerPhone || '—'}</div>
                        </div>
                        <div className="col-sm-4">
                          <div className="text-secondary">Email</div>
                          <div className="fw-semibold text-break">{inspectRecord.customerEmail || '—'}</div>
                        </div>
                      </>
                    )}
                    <div className={inspectRecord.customerPhone || inspectRecord.customerEmail ? 'col-sm-4' : 'col-12'}>
                      <div className="text-secondary">Payment</div>
                      <div className="ff-mono fw-semibold text-dark text-break">
                        {formatCurrency(inspectRecord.payment?.amount)} ({inspectRecord.payment?.method})
                        {inspectRecord.payment?.transactionId ? ` · ${inspectRecord.payment.transactionId}` : ''}
                      </div>
                    </div>
                  </div>

                  <h4 className="h6 fw-bold mb-2">Form Fields</h4>
                  <div className="p-3 rounded-3 border bg-light bg-opacity-50 mb-4">
                    {fields.filter((f) => f.type !== 'table').length === 0 ? (
                      <div className="small text-secondary">No form field entries recorded.</div>
                    ) : (
                      <dl className="row mb-0 small g-2">
                        {fields
                          .filter((f) => f.type !== 'table')
                          .map((f) => {
                            const val = inspectRecord.answers?.[f.fieldName];
                            const formatted =
                              f.type === 'boolean'
                                ? val
                                  ? 'Yes'
                                  : 'No'
                                : val === undefined || val === ''
                                  ? '—'
                                  : String(val);
                            return (
                              <div key={f.fieldName} className="col-sm-6">
                                <dt className="text-secondary fw-normal">{f.label}</dt>
                                <dd className="fw-semibold text-dark text-break mb-1">{formatted}</dd>
                              </div>
                            );
                          })}
                      </dl>
                    )}
                  </div>

                  {fields
                    .filter((f) => f.type === 'table')
                    .map((tf) => {
                      const rows = inspectRecord.repeatingTables?.[tf.fieldName] || [];
                      return (
                        <div key={tf.fieldName} className="mb-4">
                          <h4 className="h6 fw-bold mb-2">{tf.label}</h4>
                          {rows.length === 0 ? (
                            <div className="small text-secondary">No repeating table rows recorded.</div>
                          ) : (
                            <div className="table-responsive">
                              <table className="table table-sm table-bordered mb-0">
                                <thead>
                                  <tr className="small bg-light">
                                    {(tf.columns || []).map((c) => (
                                      <th key={c.name}>{c.label}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((r, rIdx) => (
                                    <tr key={rIdx} className="small">
                                      {(tf.columns || []).map((c) => (
                                        <td key={c.name} className={c.type === 'number' ? 'ff-mono' : ''}>
                                          {r[c.name] ?? '—'}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  <div className="d-flex flex-wrap justify-content-end gap-2 pt-3 border-top">
                    <button
                      type="button"
                      className="btn btn-ff-outline btn-sm d-inline-flex align-items-center gap-1"
                      onClick={() => downloadCustomerInvoicePdf(inspectRecord, biz)}
                    >
                      <FileDown size={15} />
                      <span>Download Invoice PDF</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ff-primary btn-sm"
                      onClick={() => {
                        const rec = inspectRecord;
                        setInspectRecord(null);
                        openEditModal(rec);
                      }}
                    >
                      Edit Record
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editRecord && editForm && (
        <div className="ff-modal-backdrop" onClick={() => setEditRecord(null)}>
          <div
            className="ff-card p-3 p-sm-4 w-100 shadow-lg overflow-auto"
            style={{ maxWidth: '780px', maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom">
              <h3 className="h5 fw-bold mb-0">
                Edit Record — {getRecordDisplayTitle(editRecord, businessMap[editRecord.businessId])}
              </h3>
              <button type="button" className="btn-close" onClick={() => setEditRecord(null)} />
            </div>

            <form onSubmit={handleSaveEdit} noValidate className="d-flex flex-column gap-4">
              {editError && (
                <div className="alert alert-danger small mb-0" role="alert">
                  {editError}
                </div>
              )}

              {(editRecord.customerName || editRecord.customerPhone || editRecord.customerEmail) && (
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Customer Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.customerName}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, customerName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editForm.customerPhone}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, customerPhone: e.target.value }))
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editForm.customerEmail}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, customerEmail: e.target.value }))
                      }
                    />
                  </div>
                </div>
              )}

              <div>
                <h4 className="h6 fw-bold mb-2">Form Fields</h4>
                <DynamicFormFields
                  key={editRecord.id}
                  fields={businessMap[editRecord.businessId]?.fields || []}
                  answers={editForm.answers}
                  repeatingTables={editForm.repeatingTables}
                  errors={editFieldErrors}
                  onAnswerChange={(k, v) => {
                    setEditForm((p) => ({
                      ...p,
                      answers: { ...p.answers, [k]: v },
                    }));
                    setEditFieldErrors((prev) => ({ ...prev, [k]: '' }));
                  }}
                  onTableChange={(k, rows) => {
                    setEditForm((p) => ({
                      ...p,
                      repeatingTables: { ...p.repeatingTables, [k]: rows },
                    }));
                    setEditFieldErrors((prev) => ({ ...prev, [k]: '' }));
                  }}
                />
              </div>

              <div className="p-3 rounded-3 border bg-light bg-opacity-50">
                <h4 className="h6 fw-bold mb-3">Payment Details</h4>
                <div className="row g-3">
                  <div className="col-sm-6 col-md-3">
                    <label className="form-label small fw-semibold">Payment Amount (INR)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-control ff-mono"
                      value={editForm.payment.amount}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          payment: {
                            ...p.payment,
                            amount: e.target.value === '' ? '' : e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <label className="form-label small fw-semibold">Payment Method</label>
                    <select
                      className="form-select"
                      value={editForm.payment.method}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          payment: { ...p.payment, method: e.target.value },
                        }))
                      }
                    >
                      <option value="Cash">Cash</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <label className="form-label small fw-semibold">Transaction ID</label>
                    <input
                      type="text"
                      disabled={editForm.payment.method !== 'Online'}
                      className="form-control ff-mono"
                      value={editForm.payment.method === 'Online' ? editForm.payment.transactionId : ''}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          payment: { ...p.payment, transactionId: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <label className="form-label small fw-semibold">Payment Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={editForm.payment.paidAt}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          payment: { ...p.payment, paidAt: e.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-ff-outline"
                  onClick={() => setEditRecord(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-ff-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Record to Recycle Bin Confirmation Modal */}
      {deleteTarget && (
        <div
          className="ff-modal-backdrop"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="ff-card p-3 p-sm-4 w-100 shadow-lg"
            style={{ maxWidth: '460px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-rec-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom gap-2">
              <h3 id="delete-rec-title" className="h5 fw-bold mb-0">
                Move Record to Recycle Bin?
              </h3>
              <button
                type="button"
                className="btn-close flex-shrink-0"
                aria-label="Close confirmation"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              />
            </div>

            <p className="small text-secondary mb-3">
              Move <strong className="text-dark">{deleteTarget.label}</strong> to the{' '}
              <strong className="text-dark">Recycle Bin</strong>? You can restore it for 30 days
              inside Settings.
            </p>

            <div className="d-flex flex-wrap justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-ff-outline btn-sm"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm d-inline-flex align-items-center gap-1"
                disabled={deleting}
                onClick={handleConfirmDeleteRecord}
              >
                <Trash2 size={14} />
                <span>{deleting ? 'Moving...' : 'Move to Recycle Bin'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
