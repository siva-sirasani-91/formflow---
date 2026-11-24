import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router-dom';
import { AlertCircle, AlertTriangle, Building2, CheckCircle2, RotateCcw, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';
import BusinessFilter from '../../components/workspace/BusinessFilter.jsx';
import DynamicFormFields from '../../components/workspace/DynamicFormFields.jsx';
import { getLocalDateString } from '../../utils/exportUtils.js';

const DRAFT_STORAGE_PREFIX = 'formflow_customer_drafts_v1';

function getDraftStorageKey(userId) {
  return `${DRAFT_STORAGE_PREFIX}:u_${userId || 'anon'}`;
}

function readUserDraftStore(userId) {
  if (!userId || typeof window === 'undefined') {
    return { byBusiness: {} };
  }
  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(userId));
    if (!raw) return { byBusiness: {} };
    const parsed = JSON.parse(raw);
    return {
      byBusiness:
        parsed?.byBusiness && typeof parsed.byBusiness === 'object' ? parsed.byBusiness : {},
    };
  } catch {
    return { byBusiness: {} };
  }
}

function writeUserDraftStore(userId, store) {
  if (!userId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(getDraftStorageKey(userId), JSON.stringify(store));
  } catch {
    // Ignore storage quota or private mode errors gracefully
  }
}

function buildInitialFieldState(fields = []) {
  const initAnswers = {};
  const initTables = {};
  fields.forEach((f) => {
    if (f.type === 'boolean' && !f.required) {
      initAnswers[f.fieldName] = false;
    }
    if (f.type === 'table') {
      const row = {};
      (f.columns || []).forEach((c) => {
        row[c.name] = '';
      });
      initTables[f.fieldName] = [row];
    }
  });
  return { initAnswers, initTables };
}

function mergeStateWithFields(fields = [], existingAnswers = {}, existingTables = {}) {
  const { initAnswers, initTables } = buildInitialFieldState(fields);
  const mergedAnswers = { ...initAnswers };
  const mergedTables = { ...initTables };

  fields.forEach((f) => {
    if (f.type === 'table') {
      const savedRows = existingTables?.[f.fieldName];
      if (Array.isArray(savedRows) && savedRows.length > 0) {
        mergedTables[f.fieldName] = savedRows.map((row) => {
          const normalizedRow = {};
          (f.columns || []).forEach((col) => {
            normalizedRow[col.name] = row && row[col.name] !== undefined ? row[col.name] : '';
          });
          return normalizedRow;
        });
      }
    } else if (existingAnswers && existingAnswers[f.fieldName] !== undefined) {
      mergedAnswers[f.fieldName] = existingAnswers[f.fieldName];
    }
  });

  return { mergedAnswers, mergedTables };
}

function isDraftDirty(biz, answers, repeatingTables, payment) {
  if (!biz) return false;

  for (const field of biz.fields || []) {
    if (field.type === 'table') {
      const rows = Array.isArray(repeatingTables?.[field.fieldName])
        ? repeatingTables[field.fieldName]
        : [];
      if (rows.length > 1) return true;
      const hasCellValue = rows.some(
        (r) =>
          r &&
          typeof r === 'object' &&
          Object.values(r).some(
            (v) => v !== '' && v !== null && v !== undefined && String(v).trim() !== ''
          )
      );
      if (hasCellValue) return true;
    } else if (field.type === 'boolean') {
      const val = answers?.[field.fieldName];
      if (field.required) {
        if (val === true || val === false) return true;
      } else if (val === true) {
        return true;
      }
    } else {
      const val = answers?.[field.fieldName];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        return true;
      }
    }
  }

  if (String(payment?.amount ?? '').trim() !== '') return true;
  if (payment?.method === 'Online') return true;
  if (String(payment?.transactionId ?? '').trim() !== '') return true;
  if (payment?.paidAt && payment.paidAt !== getLocalDateString()) return true;

  return false;
}

export default function CustomersView() {
  const { user, isAuthenticated } = useAuth();
  const { businesses, setBusinesses, setRecords, loading: workspaceLoading } = useWorkspace();

  const userId = user?.id || null;

  // Refresh saved businesses & form configurations from backend on page open
  // without wiping in-progress user entries
  useEffect(() => {
    let active = true;
    workspaceApi
      .getBusinesses()
      .then((res) => {
        if (active && Array.isArray(res?.businesses)) {
          setBusinesses(res.businesses);
        }
      })
      .catch(() => {
        // WorkspaceContext state remains available if background refresh fails
      });
    return () => {
      active = false;
    };
  }, [setBusinesses]);

  const savedBusinesses = useMemo(() => {
    return [...businesses].sort(
      (a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived))
    );
  }, [businesses]);

  // Always start with no form selected so the user explicitly chooses a form
  const [selectedBizId, setSelectedBizId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [repeatingTables, setRepeatingTables] = useState({});

  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [paidAt, setPaidAt] = useState(() => getLocalDateString());

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [hydratedBizKey, setHydratedBizKey] = useState('');

  const submittingRef = useRef(false);
  const hydratedSchemaKeyRef = useRef('');

  // Clear selection only if the currently selected form was removed; never auto-select a form
  useEffect(() => {
    if (workspaceLoading) return;
    if (savedBusinesses.length === 0) {
      setSelectedBizId(null);
      return;
    }
    if (
      selectedBizId !== null &&
      !savedBusinesses.some((b) => String(b.id) === String(selectedBizId))
    ) {
      setSelectedBizId(null);
    }
  }, [savedBusinesses, selectedBizId, workspaceLoading]);

  const selectedBiz = useMemo(
    () =>
      selectedBizId !== null
        ? savedBusinesses.find((b) => String(b.id) === String(selectedBizId)) || null
        : null,
    [savedBusinesses, selectedBizId]
  );

  const selectedSchemaKey = useMemo(
    () => (selectedBiz ? `${selectedBiz.id}:${JSON.stringify(selectedBiz.fields || [])}` : ''),
    [selectedBiz]
  );

  // Hydrate draft or merge schema updates safely without losing in-progress values
  useEffect(() => {
    if (!selectedBiz) {
      hydratedSchemaKeyRef.current = '';
      setHydratedBizKey('');
      setAnswers({});
      setRepeatingTables({});
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setTransactionId('');
      setPaidAt(getLocalDateString());
      setErrors({});
      return;
    }

    const bizKey = String(selectedBiz.id);
    const fields = selectedBiz.fields || [];

    if (hydratedBizKey !== bizKey) {
      // Switching to or returning to this business: load saved draft if present
      const store = readUserDraftStore(userId);
      const savedDraft = store.byBusiness?.[bizKey];

      if (savedDraft) {
        const { mergedAnswers, mergedTables } = mergeStateWithFields(
          fields,
          savedDraft.answers || {},
          savedDraft.repeatingTables || {}
        );
        setAnswers(mergedAnswers);
        setRepeatingTables(mergedTables);
        setPaymentAmount(
          savedDraft.payment?.amount !== undefined ? String(savedDraft.payment.amount) : ''
        );
        setPaymentMethod(savedDraft.payment?.method === 'Online' ? 'Online' : 'Cash');
        setTransactionId(savedDraft.payment?.transactionId || '');
        setPaidAt(savedDraft.payment?.paidAt || getLocalDateString());
      } else {
        const { initAnswers, initTables } = buildInitialFieldState(fields);
        setAnswers(initAnswers);
        setRepeatingTables(initTables);
        setPaymentAmount('');
        setPaymentMethod('Cash');
        setTransactionId('');
        setPaidAt(getLocalDateString());
      }
      setErrors({});
      hydratedSchemaKeyRef.current = selectedSchemaKey;
      setHydratedBizKey(bizKey);
      return;
    }

    if (hydratedSchemaKeyRef.current !== selectedSchemaKey) {
      // Same business refreshed from backend (or fields edited): preserve all current user inputs
      hydratedSchemaKeyRef.current = selectedSchemaKey;
      setAnswers((prevAnswers) => {
        const { mergedAnswers } = mergeStateWithFields(fields, prevAnswers, {});
        return mergedAnswers;
      });
      setRepeatingTables((prevTables) => {
        const { mergedTables } = mergeStateWithFields(fields, {}, prevTables);
        return mergedTables;
      });
    }
  }, [selectedBiz, selectedSchemaKey, hydratedBizKey, userId]);

  const hasUnsavedChanges = useMemo(() => {
    if (!selectedBiz || hydratedBizKey !== String(selectedBiz.id)) return false;
    return isDraftDirty(selectedBiz, answers, repeatingTables, {
      amount: paymentAmount,
      method: paymentMethod,
      transactionId,
      paidAt,
    });
  }, [
    selectedBiz,
    hydratedBizKey,
    answers,
    repeatingTables,
    paymentAmount,
    paymentMethod,
    transactionId,
    paidAt,
  ]);

  // Autosave temporary draft per user & business whenever values change
  useEffect(() => {
    if (!userId || !selectedBiz) return;
    const bizKey = String(selectedBiz.id);
    if (hydratedBizKey !== bizKey) return;

    const store = readUserDraftStore(userId);
    const nextByBusiness = { ...store.byBusiness };

    if (hasUnsavedChanges) {
      nextByBusiness[bizKey] = {
        answers,
        repeatingTables,
        payment: {
          amount: paymentAmount,
          method: paymentMethod,
          transactionId,
          paidAt,
        },
        updatedAt: new Date().toISOString(),
      };
      writeUserDraftStore(userId, {
        byBusiness: nextByBusiness,
      });
    } else {
      delete nextByBusiness[bizKey];
      writeUserDraftStore(userId, {
        byBusiness: nextByBusiness,
      });
    }
  }, [
    userId,
    selectedBiz,
    hydratedBizKey,
    answers,
    repeatingTables,
    paymentAmount,
    paymentMethod,
    transactionId,
    paidAt,
    hasUnsavedChanges,
  ]);

  // Warn user before in-app navigation when unsaved information exists
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        Boolean(hasUnsavedChanges && isAuthenticated) &&
        nextLocation.pathname !== '/login' &&
        (currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search),
      [hasUnsavedChanges, isAuthenticated]
    )
  );

  // Allow Escape key to stay on page when navigation warning modal is visible
  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') {
        blocker.reset();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [blocker]);

  // Warn user on browser refresh or tab close when unsaved information exists
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const clearCurrentBusinessDraft = useCallback(
    (bizIdToClear) => {
      if (!userId || !bizIdToClear) return;
      const store = readUserDraftStore(userId);
      const nextByBusiness = { ...store.byBusiness };
      delete nextByBusiness[String(bizIdToClear)];
      writeUserDraftStore(userId, {
        byBusiness: nextByBusiness,
      });
    },
    [userId]
  );

  const handleBusinessChange = useCallback(
    (nextBizId) => {
      const normalizedId = nextBizId ? String(nextBizId) : null;
      if (selectedBizId !== null && String(selectedBizId) !== String(normalizedId)) {
        clearCurrentBusinessDraft(selectedBizId);
      }
      hydratedSchemaKeyRef.current = '';
      setHydratedBizKey('');
      setAnswers({});
      setRepeatingTables({});
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setTransactionId('');
      setPaidAt(getLocalDateString());
      setErrors({});
      setServerError('');
      setSuccessMsg('');
      setSelectedBizId(normalizedId);
    },
    [selectedBizId, clearCurrentBusinessDraft]
  );

  function handleAnswerChange(fieldName, val) {
    setAnswers((prev) => ({ ...prev, [fieldName]: val }));
    setErrors((prev) => ({ ...prev, [fieldName]: '' }));
  }

  function handleTableChange(fieldName, rows) {
    setRepeatingTables((prev) => ({ ...prev, [fieldName]: rows }));
    setErrors((prev) => ({ ...prev, [fieldName]: '' }));
  }

  function handleResetForm() {
    if (selectedBiz) {
      clearCurrentBusinessDraft(selectedBiz.id);
    }
    setPaymentAmount('');
    setPaymentMethod('Cash');
    setTransactionId('');
    setPaidAt(getLocalDateString());
    const { initAnswers, initTables } = buildInitialFieldState(selectedBiz?.fields || []);
    setAnswers(initAnswers);
    setRepeatingTables(initTables);
    setErrors({});
    setServerError('');
    setSuccessMsg('');
  }

  function handleFormKeyDown(e) {
    if (e.key === 'Enter' && e.target?.tagName === 'INPUT') {
      e.preventDefault();
    }
  }

  function validate() {
    const nextErrors = {};
    if (!selectedBiz) {
      nextErrors.businessId = 'Please select a form to continue.';
    }

    (selectedBiz?.fields || []).forEach((field) => {
      if (!field.required) return;
      if (field.type === 'table') {
        const rows = repeatingTables[field.fieldName] || [];
        const hasValidRow = rows.some((r) =>
          Object.values(r).some(
            (v) => v !== '' && v !== null && v !== undefined && String(v).trim() !== ''
          )
        );
        if (!hasValidRow) {
          nextErrors[field.fieldName] = `${field.label} requires at least one populated row.`;
        }
      } else if (field.type === 'boolean') {
        if (answers[field.fieldName] === undefined || answers[field.fieldName] === null) {
          nextErrors[field.fieldName] = `Please select Yes or No for ${field.label}.`;
        }
      } else {
        const val = answers[field.fieldName];
        if (val === undefined || val === null || String(val).trim() === '') {
          nextErrors[field.fieldName] = `${field.label} is required.`;
        }
      }
    });

    if (paymentAmount === '' || Number.isNaN(Number(paymentAmount)) || Number(paymentAmount) < 0) {
      nextErrors.paymentAmount = 'Enter a valid payment amount (0 or higher).';
    }
    if (paymentMethod === 'Online' && !transactionId.trim()) {
      nextErrors.transactionId = 'Transaction ID is required for Online payments.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting || submittingRef.current) return;
    setServerError('');
    setSuccessMsg('');
    if (!validate()) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await workspaceApi.createRecord({
        businessId: Number(selectedBiz.id),
        answers,
        repeatingTables,
        payment: {
          amount: Number(paymentAmount),
          method: paymentMethod,
          transactionId: paymentMethod === 'Online' ? transactionId.trim() : '',
          paidAt,
        },
      });
      setRecords((prev) => [res.record, ...prev]);
      clearCurrentBusinessDraft(selectedBiz.id);
      setSuccessMsg(`Registration #${res.record.id} saved under ${selectedBiz.name}.`);
      setPaymentAmount('');
      setPaymentMethod('Cash');
      setTransactionId('');
      setPaidAt(getLocalDateString());

      const { initAnswers, initTables } = buildInitialFieldState(selectedBiz.fields || []);
      setAnswers(initAnswers);
      setRepeatingTables(initTables);
    } catch (err) {
      setServerError(err.message || 'Failed to save customer registration.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-column flex-md-row align-items-stretch align-items-md-start justify-content-between gap-3">
        <div className="min-w-0">
          <h2 className="h5 fw-bold mb-1">Register Forms</h2>
          <p className="text-secondary small mb-0">
            Select a saved form to load its form fields and record payment details.
          </p>
        </div>

        <div className="ff-register-forms-wrap">
          <BusinessFilter
            businesses={savedBusinesses}
            selectedBusinessId={selectedBizId}
            onChange={handleBusinessChange}
            error={errors.businessId}
          />
        </div>
      </div>

      <div className="w-100">
        {savedBusinesses.length === 0 ? (
          <div className="ff-card p-4 text-center">
            <Building2 size={32} className="text-secondary mb-2" />
            <h3 className="h6 fw-bold mb-1">No Saved Forms Available</h3>
            <p className="text-secondary small mb-3">
              Create a form and add its fields first before registering customers.
            </p>
            <Link to="/dashboard/businesses" className="btn btn-ff-primary btn-sm">
              Go to Create Forms
            </Link>
          </div>
        ) : !selectedBiz ? (
          <div className="ff-card p-4 text-center">
            <Building2 size={32} className="text-secondary mb-2" />
            <h3 className="h6 fw-bold mb-1">Please select a form to continue.</h3>
            <p className="text-secondary small mb-0">
              Choose a saved form from the dropdown above to load its form fields.
            </p>
          </div>
        ) : (
          <div className="ff-card p-3 p-sm-4">
            {serverError && (
              <div
                className="alert alert-danger d-flex align-items-center gap-2 small mb-4"
                role="alert"
              >
                <AlertCircle size={17} />
                <span>{serverError}</span>
              </div>
            )}

            {successMsg && (
              <div
                className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2 small mb-4"
                role="status"
              >
                <span className="d-inline-flex align-items-center gap-2">
                  <CheckCircle2 size={17} />
                  <span>{successMsg}</span>
                </span>
                <Link to="/dashboard/records" className="fw-semibold text-decoration-none">
                  View Records &rarr;
                </Link>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              onKeyDown={handleFormKeyDown}
              noValidate
              className="d-flex flex-column gap-4"
            >
              {/* Selected Form's Configured Fields */}
              <div>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                  <h3 className="h6 fw-bold mb-0">
                    1. {selectedBiz.name} — Form Fields
                  </h3>
                  <Link
                    to={`/dashboard/businesses?id=${selectedBiz.id}`}
                    className="small text-decoration-none"
                  >
                    Edit Form
                  </Link>
                </div>
                <DynamicFormFields
                  key={selectedBiz.id}
                  fields={selectedBiz.fields || []}
                  answers={answers}
                  repeatingTables={repeatingTables}
                  errors={errors}
                  onAnswerChange={handleAnswerChange}
                  onTableChange={handleTableChange}
                />
              </div>

              {/* Payment Details */}
              <div className="p-3 p-md-4 rounded-3 border bg-light bg-opacity-50">
                <h3 className="h6 fw-bold mb-3">2. Payment Details</h3>
                <div className="row g-3">
                  <div className="col-sm-6 col-xl-3">
                    <label htmlFor="pay-amount" className="form-label small fw-semibold">
                      Payment Amount (INR) <span className="text-danger">*</span>
                    </label>
                    <input
                      id="pay-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className={`form-control ff-mono ${errors.paymentAmount ? 'is-invalid' : ''}`}
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => {
                        setPaymentAmount(e.target.value);
                        if (errors.paymentAmount) setErrors((p) => ({ ...p, paymentAmount: '' }));
                      }}
                    />
                    {errors.paymentAmount && (
                      <div className="invalid-feedback">{errors.paymentAmount}</div>
                    )}
                  </div>

                  <div className="col-sm-6 col-xl-3">
                    <label htmlFor="pay-method" className="form-label small fw-semibold">
                      Payment Method
                    </label>
                    <select
                      id="pay-method"
                      className="form-select"
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        setErrors((p) => ({ ...p, transactionId: '' }));
                      }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Online">Online (UPI / Card / Bank Transfer)</option>
                    </select>
                  </div>

                  <div className="col-sm-6 col-xl-3">
                    <label htmlFor="pay-txn" className="form-label small fw-semibold">
                      Transaction ID {paymentMethod === 'Online' && <span className="text-danger">*</span>}
                    </label>
                    <input
                      id="pay-txn"
                      type="text"
                      disabled={paymentMethod !== 'Online'}
                      className={`form-control ff-mono ${errors.transactionId ? 'is-invalid' : ''}`}
                      placeholder={
                        paymentMethod === 'Online' ? 'e.g. UPI-84920184' : 'Not required for Cash'
                      }
                      value={paymentMethod === 'Online' ? transactionId : ''}
                      onChange={(e) => {
                        setTransactionId(e.target.value);
                        if (errors.transactionId) setErrors((p) => ({ ...p, transactionId: '' }));
                      }}
                    />
                    {errors.transactionId && (
                      <div className="invalid-feedback">{errors.transactionId}</div>
                    )}
                  </div>

                  <div className="col-sm-6 col-xl-3">
                    <label htmlFor="pay-date" className="form-label small fw-semibold">
                      Payment Date
                    </label>
                    <input
                      id="pay-date"
                      type="date"
                      className="form-control"
                      value={paidAt}
                      onChange={(e) => setPaidAt(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="d-flex flex-wrap justify-content-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleResetForm}
                  className="btn btn-ff-outline d-inline-flex align-items-center gap-2"
                >
                  <RotateCcw size={15} />
                  <span>Reset</span>
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-ff-primary d-inline-flex align-items-center gap-2"
                >
                  <UserPlus size={15} />
                  <span>{submitting ? 'Saving...' : 'Submit Registration'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Navigation Protection Confirmation Modal */}
      {blocker.state === 'blocked' && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-registration-modal-title"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          onClick={() => blocker.reset()}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h5
                  id="leave-registration-modal-title"
                  className="modal-title h6 fw-bold d-inline-flex align-items-center gap-2 mb-0"
                >
                  <AlertTriangle size={18} className="text-warning flex-shrink-0" />
                  <span>Unsaved Registration Details</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Stay on page"
                  onClick={() => blocker.reset()}
                />
              </div>
              <div className="modal-body small text-secondary">
                <p className="mb-2 text-dark">
                  You have unsaved customer registration information for{' '}
                  <strong>{selectedBiz?.name || 'this form'}</strong>.
                </p>
                <p className="mb-0">
                  Your progress is saved as a temporary draft and will be restored when you return
                  to Register Forms. Do you want to leave this page?
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-ff-primary"
                  onClick={() => blocker.reset()}
                >
                  Stay on Page
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ff-outline"
                  onClick={() => blocker.proceed()}
                >
                  Leave Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
