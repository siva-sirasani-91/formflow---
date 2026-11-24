import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';

const FORM_CATEGORIES = [
  'General Services',
  'Healthcare & Clinics',
  'Retail & Commerce',
  'Logistics & Supply Chain',
  'Agriculture & Nursery',
  'Education & Training',
  'Hospitality & Services',
  'Real Estate & Operations',
  'Manufacturing & Trade',
];

const CUSTOM_CATEGORY_VALUE = '__custom__';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select Dropdown' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'table', label: 'Repeating Table' },
];

const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
];

const EMPTY_BASIC_DETAILS = {
  name: '',
  category: 'General Services',
  customCategory: '',
  description: '',
};

function slugifyName(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function normalizeColumnType(type) {
  if (type === 'number') return 'number';
  if (type === 'date') return 'date';
  return 'text';
}

function formatErrorMessage(rawMessage, fallback) {
  return (rawMessage || fallback)
    .replace(/\bA business\b/g, 'A form')
    .replace(/\bBusiness name\b/g, 'Form name');
}

function cloneFields(fields = []) {
  return (fields || []).map((f) => ({
    ...f,
    options: Array.isArray(f.options) ? [...f.options] : [],
    optionsText: Array.isArray(f.options) ? f.options.join(', ') : '',
    columns: Array.isArray(f.columns)
      ? f.columns.map((c) => ({
          id: c.id || `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: c.name || slugifyName(c.label),
          label: c.label || '',
          type: normalizeColumnType(c.type),
          required: Boolean(c.required),
        }))
      : [],
  }));
}

function splitCategoryState(rawCategory) {
  const cleaned = String(rawCategory || '').trim() || 'General Services';
  if (FORM_CATEGORIES.includes(cleaned)) {
    return { category: cleaned, customCategory: '' };
  }
  return { category: CUSTOM_CATEGORY_VALUE, customCategory: cleaned };
}

function resolveCategoryValue(details) {
  if (details.category === CUSTOM_CATEGORY_VALUE) {
    return String(details.customCategory || '').trim() || 'General Services';
  }
  return String(details.category || '').trim() || 'General Services';
}

function createDefaultTableColumns() {
  const ts = Date.now();
  return [
    { id: `c_${ts}_1`, label: 'Item Name', name: 'item_name', type: 'text', required: true },
    { id: `c_${ts}_2`, label: 'Quantity', name: 'quantity', type: 'number', required: false },
  ];
}

function validateAndNormalizeFields(fieldsToCheck) {
  const normalizedFields = [];
  const seenFieldKeys = new Set();

  for (let i = 0; i < fieldsToCheck.length; i += 1) {
    const f = fieldsToCheck[i];
    const label = String(f.label || '').trim();
    const key = slugifyName(f.fieldName || label);
    if (!label) {
      return { error: `Field #${i + 1} requires a Field Label.` };
    }
    if (!key) {
      return { error: `Field "${label}" requires a valid Field Key.` };
    }
    if (seenFieldKeys.has(key)) {
      return {
        error: `Duplicate field key "${key}". Each field key must be unique.`,
      };
    }
    seenFieldKeys.add(key);

    let options = Array.isArray(f.options) ? f.options : [];
    if (f.type === 'select') {
      const rawText = typeof f.optionsText === 'string' ? f.optionsText : options.join(', ');
      options = rawText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length === 0) {
        return { error: `Select field "${label}" must include at least one option.` };
      }
    }

    let columns = Array.isArray(f.columns) ? f.columns : [];
    if (f.type === 'table') {
      if (columns.length === 0 || columns.some((c) => !String(c.label || '').trim())) {
        return {
          error: `Repeating Table "${label}" requires non-empty column labels.`,
        };
      }
      const seenCols = new Set();
      columns = columns.map((c, ci) => {
        const baseCol = slugifyName(c.name || c.label) || `col_${ci + 1}`;
        let colKey = baseCol;
        let suffix = 2;
        while (seenCols.has(colKey)) {
          colKey = `${baseCol}_${suffix++}`;
        }
        seenCols.add(colKey);
        return {
          id: c.id || `col_${Date.now()}_${ci}`,
          label: String(c.label).trim(),
          name: colKey,
          type: normalizeColumnType(c.type),
          required: Boolean(c.required),
        };
      });
    }

    normalizedFields.push({
      id: f.id,
      fieldName: key,
      label,
      type: f.type,
      required: Boolean(f.required),
      options: f.type === 'select' ? options : [],
      columns: f.type === 'table' ? columns : [],
    });
  }

  return { normalizedFields };
}

export default function BusinessView() {
  const { isAuthenticated } = useAuth();
  const { businesses, setBusinesses, records, refreshAll } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();

  const queryId = Number(searchParams.get('id'));
  const prevQueryIdRef = useRef(0);
  const fetchSeqRef = useRef(0);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const nameInputRef = useRef(null);
  const newFieldLabelRef = useRef(null);

  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');

  // Step 1 default: selectedId = null, creatingNew = false -> Empty Starting Screen on right
  const [selectedId, setSelectedId] = useState(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Form details & fields state (shared by Create New Form and Edit Saved Form)
  const [formDetails, setFormDetails] = useState(EMPTY_BASIC_DETAILS);
  const [draftFields, setDraftFields] = useState([]);
  const [dirty, setDirty] = useState(false);

  // Inline Add Field / Repeating Table composer
  const [showFieldComposer, setShowFieldComposer] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldNameTouched, setNewFieldNameTouched] = useState(false);
  const [newType, setNewType] = useState('text');
  const [newRequired, setNewRequired] = useState(true);
  const [newOptionsText, setNewOptionsText] = useState('Option A, Option B, Option C');
  const [newColumns, setNewColumns] = useState(() => createDefaultTableColumns());

  // Feedback & saving state
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // In-page unsaved changes confirmation modal
  const [discardAction, setDiscardAction] = useState(null);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const activeCount = useMemo(
    () => businesses.filter((b) => !b.archived).length,
    [businesses]
  );
  const archivedCount = useMemo(
    () => businesses.filter((b) => Boolean(b.archived)).length,
    [businesses]
  );

  const visibleForms = useMemo(() => {
    const isArch = tab === 'archived';
    const q = search.trim().toLowerCase();
    return businesses
      .filter((b) => Boolean(b.archived) === isArch)
      .filter((b) =>
        !q
          ? true
          : [b.name, b.category, b.description].some((v) =>
              String(v || '').toLowerCase().includes(q)
            )
      );
  }, [businesses, tab, search]);

  const selectedForm = useMemo(
    () => (selectedId ? businesses.find((b) => b.id === selectedId) || null : null),
    [businesses, selectedId]
  );

  const displayFormName = useMemo(() => {
    const typed = formDetails.name.trim();
    if (typed) return typed;
    return selectedForm?.name || 'Untitled Form';
  }, [formDetails.name, selectedForm]);

  const resetComposerInputs = useCallback(() => {
    setNewLabel('');
    setNewFieldName('');
    setNewFieldNameTouched(false);
    setNewType('text');
    setNewRequired(true);
    setNewOptionsText('Option A, Option B, Option C');
    setNewColumns(createDefaultTableColumns());
  }, []);

  const clearQueryParamIfPresent = useCallback(() => {
    if (searchParams.get('id')) {
      prevQueryIdRef.current = 0;
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Resets the right panel cleanly to the Empty Starting Screen (Step 1 / Step 3)
  const resetToEmptyStartingScreen = useCallback(
    ({ clearFeedback = false } = {}) => {
      fetchSeqRef.current += 1;
      setCreatingNew(false);
      setSelectedId(null);
      setLoadingDetail(false);
      setFormDetails({ ...EMPTY_BASIC_DETAILS });
      setDraftFields([]);
      setDirty(false);
      setShowFieldComposer(false);
      resetComposerInputs();
      clearQueryParamIfPresent();
      if (clearFeedback) {
        setFeedback({ type: '', message: '' });
      }
    },
    [resetComposerInputs, clearQueryParamIfPresent]
  );

  const populateFromSavedForm = useCallback(
    (item) => {
      if (!item) return;
      const catParts = splitCategoryState(item.category);
      setFormDetails({
        name: item.name || '',
        category: catParts.category,
        customCategory: catParts.customCategory,
        description: item.description || '',
      });
      setDraftFields(cloneFields(item.fields || []));
      setDirty(false);
      setShowFieldComposer(false);
      resetComposerInputs();
    },
    [resetComposerInputs]
  );

  const selectFormImmediate = useCallback(
    async (item, { clearFeedback = true, syncTab = false } = {}) => {
      if (!item) return;
      setCreatingNew(false);
      setSelectedId(item.id);
      if (syncTab) {
        setTab(item.archived ? 'archived' : 'active');
      }
      populateFromSavedForm(item);
      if (clearFeedback) setFeedback({ type: '', message: '' });

      const reqSeq = ++fetchSeqRef.current;
      setLoadingDetail(true);
      try {
        const res = await workspaceApi.getBusiness(item.id);
        if (fetchSeqRef.current === reqSeq && res?.business) {
          setBusinesses((prev) =>
            prev.map((entry) => (entry.id === res.business.id ? res.business : entry))
          );
          if (!dirtyRef.current) {
            populateFromSavedForm(res.business);
          }
        }
      } catch {
        // Keep current snapshot if background refresh fails
      } finally {
        if (fetchSeqRef.current === reqSeq) {
          setLoadingDetail(false);
        }
      }
    },
    [populateFromSavedForm, setBusinesses]
  );

  const startNewFormImmediate = useCallback(
    ({ clearFeedback = true } = {}) => {
      fetchSeqRef.current += 1;
      setCreatingNew(true);
      setSelectedId(null);
      setLoadingDetail(false);
      setFormDetails({ ...EMPTY_BASIC_DETAILS });
      setDraftFields([]);
      setDirty(false);
      setShowFieldComposer(false);
      resetComposerInputs();
      clearQueryParamIfPresent();
      if (clearFeedback) setFeedback({ type: '', message: '' });
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    },
    [resetComposerInputs, clearQueryParamIfPresent]
  );

  function requestSelectForm(item) {
    if (!item) return;
    if (!creatingNew && item.id === selectedForm?.id) return;
    if (dirty) {
      setDiscardAction({
        title: 'Discard Unsaved Changes?',
        message: creatingNew
          ? 'You have unsaved details for a new form. Switching now will discard those unsaved inputs.'
          : `You have unsaved changes on "${selectedForm?.name || 'this form'}". Switching forms now will discard those edits.`,
        onConfirm: () => {
          setDiscardAction(null);
          selectFormImmediate(item);
        },
      });
      return;
    }
    selectFormImmediate(item);
  }

  function requestStartNewForm() {
    if (creatingNew) return;
    if (dirty) {
      setDiscardAction({
        title: 'Discard Unsaved Changes?',
        message: `You have unsaved changes on "${selectedForm?.name || 'this form'}". Starting a new form now will discard those unsaved edits.`,
        onConfirm: () => {
          setDiscardAction(null);
          startNewFormImmediate();
        },
      });
      return;
    }
    startNewFormImmediate();
  }

  function requestCancel() {
    if (saving) return;
    if (dirty) {
      setDiscardAction({
        title: 'Discard Unsaved Changes?',
        message: creatingNew
          ? 'Are you sure you want to cancel? Your entered form details and fields will be cleared.'
          : `Are you sure you want to discard your unsaved changes to "${selectedForm?.name || 'this form'}"?`,
        onConfirm: () => {
          setDiscardAction(null);
          resetToEmptyStartingScreen({ clearFeedback: true });
        },
      });
      return;
    }
    resetToEmptyStartingScreen({ clearFeedback: true });
  }

  // Only open a form automatically if navigated explicitly with ?id=<formId> (e.g., from Register Forms "Edit Form").
  // Otherwise, ALWAYS stay on Step 1 (empty starting screen on the right) until the user clicks a saved form card.
  useEffect(() => {
    if (queryId && businesses.length > 0 && prevQueryIdRef.current !== queryId) {
      const target = businesses.find((b) => b.id === queryId);
      if (target) {
        prevQueryIdRef.current = queryId;
        selectFormImmediate(target, { clearFeedback: true, syncTab: true });
      }
    }
  }, [queryId, businesses, selectFormImmediate]);

  // If the currently open saved form was removed externally, reset cleanly to the empty starting screen
  useEffect(() => {
    if (selectedId && !businesses.some((b) => b.id === selectedId)) {
      resetToEmptyStartingScreen({ clearFeedback: false });
    }
  }, [selectedId, businesses, resetToEmptyStartingScreen]);

  // Warn user before navigating to another route when unsaved changes exist
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        Boolean(dirty && isAuthenticated) &&
        nextLocation.pathname !== '/login' &&
        (currentLocation.pathname !== nextLocation.pathname ||
          currentLocation.search !== nextLocation.search),
      [dirty, isAuthenticated]
    )
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') blocker.reset();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!deleteTarget && !discardAction) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (deleteTarget && !deleting) setDeleteTarget(null);
        if (discardAction) setDiscardAction(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteTarget, deleting, discardAction]);

  function openFieldComposer() {
    setShowFieldComposer(true);
    setFeedback((prev) => (prev.type === 'error' ? { type: '', message: '' } : prev));
    requestAnimationFrame(() => {
      newFieldLabelRef.current?.focus();
    });
  }

  function closeFieldComposer() {
    setShowFieldComposer(false);
    resetComposerInputs();
  }

  // Build a validated field object from the inline Add Field composer
  function buildComposerField() {
    const label = newLabel.trim();
    if (!label) {
      return {
        error: newType === 'table' ? 'Repeating Table Name is required.' : 'Field Label is required.',
      };
    }

    const fieldName = slugifyName(newFieldName || label) || `field_${Date.now()}`;
    if (draftFields.some((f) => f.fieldName === fieldName)) {
      return { error: `Field Key "${fieldName}" already exists in this form.` };
    }

    const options =
      newType === 'select'
        ? newOptionsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (newType === 'select' && options.length === 0) {
      return { error: 'Select Dropdown requires at least one option.' };
    }

    const seenColNames = new Set();
    const columns =
      newType === 'table'
        ? newColumns
            .filter((c) => c.label.trim())
            .map((c, idx) => {
              let colKey = slugifyName(c.name || c.label) || `col_${idx + 1}`;
              let suffix = 2;
              while (seenColNames.has(colKey)) {
                colKey = `${slugifyName(c.name || c.label) || `col_${idx + 1}`}_${suffix++}`;
              }
              seenColNames.add(colKey);
              return {
                id: `col_${Date.now()}_${idx}`,
                label: c.label.trim(),
                name: colKey,
                type: normalizeColumnType(c.type),
                required: Boolean(c.required),
              };
            })
        : [];
    if (newType === 'table' && columns.length === 0) {
      return { error: 'Repeating Table requires at least one column.' };
    }

    return {
      field: {
        id: `f_${Date.now()}`,
        fieldName,
        label,
        type: newType,
        required: newRequired,
        options,
        optionsText: options.join(', '),
        columns,
      },
    };
  }

  // Add a custom field or repeating table into the current form draft (works identically in Create and Edit)
  function handleAddFieldToDraft(e) {
    e.preventDefault();
    if (saving) return;

    const { field, error } = buildComposerField();
    if (error) {
      setFeedback({ type: 'error', message: error });
      newFieldLabelRef.current?.focus();
      return;
    }

    setDraftFields((prev) => [...prev, field]);
    setDirty(true);
    setShowFieldComposer(false);
    resetComposerInputs();
    setFeedback({ type: '', message: '' });
  }

  function updateDraftField(idx, patch) {
    setDraftFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    setDirty(true);
  }

  function moveDraftField(idx, dir) {
    const target = idx + dir;
    if (target < 0 || target >= draftFields.length) return;
    const copy = [...draftFields];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setDraftFields(copy);
    setDirty(true);
  }

  function removeDraftField(idx) {
    setDraftFields((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }

  function moveDraftColumn(fieldIdx, colIdx, dir) {
    const field = draftFields[fieldIdx];
    const cols = [...(field?.columns || [])];
    const target = colIdx + dir;
    if (target < 0 || target >= cols.length) return;
    const [col] = cols.splice(colIdx, 1);
    cols.splice(target, 0, col);
    updateDraftField(fieldIdx, { columns: cols });
  }

  function moveNewColumn(colIdx, dir) {
    const target = colIdx + dir;
    if (target < 0 || target >= newColumns.length) return;
    const copy = [...newColumns];
    const [col] = copy.splice(colIdx, 1);
    copy.splice(target, 0, col);
    setNewColumns(copy);
  }

  // Step 2 -> Step 3 (Create) AND Step 4 -> Step 3 (Edit):
  // Persists form + all custom fields & repeating tables, updates left Forms list immediately,
  // and AUTOMATICALLY resets the right panel to the Empty Starting Screen without auto-selecting the form.
  async function handleSaveForm() {
    if (saving || savingRef.current) return;
    if (!creatingNew && !selectedForm) return;

    const trimmedName = formDetails.name.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'Form Name is required.' });
      nameInputRef.current?.focus();
      return;
    }
    if (trimmedName.length < 2) {
      setFeedback({ type: 'error', message: 'Form Name must be at least 2 characters.' });
      nameInputRef.current?.focus();
      return;
    }

    const fieldsToSave = [...draftFields];
    if (showFieldComposer && newLabel.trim()) {
      const { field: pendingField, error: pendingError } = buildComposerField();
      if (pendingError) {
        setFeedback({ type: 'error', message: pendingError });
        return;
      }
      fieldsToSave.push(pendingField);
    }

    const { normalizedFields, error } = validateAndNormalizeFields(fieldsToSave);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }

    const payload = {
      name: trimmedName,
      category: resolveCategoryValue(formDetails),
      phone: creatingNew ? '' : selectedForm?.phone || '',
      email: creatingNew ? '' : selectedForm?.email || '',
      address: creatingNew ? '' : selectedForm?.address || '',
      description: formDetails.description.trim(),
      fields: normalizedFields,
    };

    savingRef.current = true;
    setSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      if (creatingNew) {
        const res = await workspaceApi.createBusiness(payload);
        const created = res.business;
        const fieldCount = (created.fields || []).length;
        setBusinesses((prev) =>
          prev.some((b) => b.id === created.id)
            ? prev.map((b) => (b.id === created.id ? created : b))
            : [created, ...prev]
        );
        setTab('active');
        // Step 3 mandatory reset: never auto-select the newly saved form
        resetToEmptyStartingScreen({ clearFeedback: false });
        setFeedback({
          type: 'success',
          message: `Form "${created.name}" saved (${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}). Click it in the Forms list to view or edit.`,
        });
      } else {
        const res = await workspaceApi.updateBusiness(selectedForm.id, payload);
        const updated = res.business;
        const fieldCount = (updated.fields || []).length;
        setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        // Step 3 mandatory reset: return cleanly to the empty starting screen after saving
        resetToEmptyStartingScreen({ clearFeedback: false });
        setFeedback({
          type: 'success',
          message: `Saved changes to "${updated.name}" (${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'}).`,
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: formatErrorMessage(
          err.message,
          creatingNew
            ? 'Unable to save form. Please review your details and try again.'
            : 'Unable to save changes. Please review your details and try again.'
        ),
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function handleToggleArchive(item) {
    try {
      const res = item.archived
        ? await workspaceApi.restoreBusiness(item.id)
        : await workspaceApi.archiveBusiness(item.id);
      const updatedBiz = res.business;
      setBusinesses((prev) => prev.map((b) => (b.id === item.id ? updatedBiz : b)));

      // If the currently open form was archived, reset right panel cleanly to the empty starting screen
      if (updatedBiz.archived && selectedId === item.id) {
        resetToEmptyStartingScreen({ clearFeedback: false });
      }

      setFeedback({
        type: 'success',
        message: updatedBiz.archived
          ? `"${item.name}" moved to Archived.`
          : `"${item.name}" restored to Active.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: formatErrorMessage(err.message, 'Unable to update archive status.'),
      });
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;
    setDeleting(true);
    try {
      await workspaceApi.deleteBusiness(target.id);
      if (selectedId === target.id) {
        resetToEmptyStartingScreen({ clearFeedback: false });
      }
      await refreshAll({ silent: true });
      setDeleteTarget(null);
      setFeedback({
        type: 'success',
        message: `Form "${target.name}" moved to Recycle Bin (retained for 30 days).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: formatErrorMessage(err.message, 'Unable to delete form.'),
      });
    } finally {
      setDeleting(false);
    }
  }

  const isEditorOpen = creatingNew || Boolean(selectedForm);

  return (
    <div className="d-flex flex-column gap-3">
      {feedback.message && (
        <div
          className={`alert ${feedback.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex justify-content-between align-items-center mb-0`}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          <span className="d-inline-flex align-items-center gap-2">
            {feedback.type === 'success' && <CheckCircle2 size={17} className="flex-shrink-0" />}
            <span>{feedback.message}</span>
          </span>
          <button
            type="button"
            className="btn-close btn-sm"
            aria-label="Dismiss"
            onClick={() => setFeedback({ type: '', message: '' })}
          />
        </div>
      )}

      <div className="row g-3 g-lg-4 align-items-stretch">
        {/* Left Panel – Saved Forms List */}
        <div className="col-lg-4">
          <div
            className="ff-card ff-forms-panel p-3 p-sm-4 h-100 d-flex flex-column gap-3"
            data-testid="forms-list-panel"
          >
            <div className="d-flex justify-content-between align-items-center gap-2">
              <h2 className="h5 fw-bold mb-0">Forms</h2>
              <span className="small text-secondary" data-testid="total-saved-count">
                {businesses.length} saved
              </span>
            </div>

            <div className="ff-tab-group w-100">
              <button
                type="button"
                className={`ff-tab-btn flex-grow-1 ${tab === 'active' ? 'active' : ''}`}
                onClick={() => setTab('active')}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                className={`ff-tab-btn flex-grow-1 ${tab === 'archived' ? 'active' : ''}`}
                onClick={() => setTab('archived')}
              >
                Archived ({archivedCount})
              </button>
            </div>

            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <Search size={14} className="text-secondary" />
              </span>
              <input
                type="text"
                className={`form-control border-start-0 ${search ? 'border-end-0' : ''}`}
                placeholder="Search forms..."
                aria-label="Search forms"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="btn btn-light border border-start-0 text-secondary px-2"
                  aria-label="Clear search"
                  title="Clear search"
                  onClick={() => setSearch('')}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div
              className="d-flex flex-column gap-2 ff-scroll-clean flex-grow-1"
              style={{ maxHeight: '620px' }}
            >
              {visibleForms.length === 0 ? (
                <div className="text-center py-4 px-3 text-secondary small border rounded-3 bg-light bg-opacity-50">
                  {search.trim() ? (
                    <div className="d-flex flex-column align-items-center gap-2">
                      <span>No matching forms found.</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-ff-outline"
                        onClick={() => setSearch('')}
                      >
                        Clear search
                      </button>
                    </div>
                  ) : tab === 'active' ? (
                    'No active forms yet. Click Create Form to get started.'
                  ) : (
                    'No archived forms available.'
                  )}
                </div>
              ) : (
                visibleForms.map((item) => {
                  const isSel = !creatingNew && item.id === selectedForm?.id;
                  const recCount = records.filter((r) => r.businessId === item.id).length;
                  const fieldCount = (item.fields || []).length;
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      data-testid={`saved-form-card-${item.id}`}
                      className={`ff-form-card p-3 rounded-3 border ${
                        isSel ? 'ff-form-card-selected' : 'bg-white'
                      }`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => requestSelectForm(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          requestSelectForm(item);
                        }
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div className="min-w-0">
                          <div className="fw-bold text-dark text-truncate">{item.name}</div>
                          <div className="small text-secondary text-truncate">
                            {item.category || 'General Services'}
                          </div>
                        </div>
                        <span className="ff-mono small ff-create-accent-text fw-semibold flex-shrink-0">
                          {fieldCount} {fieldCount === 1 ? 'Field' : 'Fields'}
                        </span>
                      </div>

                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2 pt-2 border-top small">
                        <span className="text-secondary text-nowrap" style={{ fontSize: '0.8rem' }}>
                          {recCount} {recCount === 1 ? 'Customer Record' : 'Customer Records'}
                        </span>
                        <div
                          className="d-flex align-items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="btn btn-sm btn-light border d-inline-flex align-items-center gap-1 px-2"
                            style={{ minHeight: '31px' }}
                            title={`Edit ${item.name}`}
                            aria-label={`Edit ${item.name}`}
                            data-testid={`edit-form-btn-${item.id}`}
                            onClick={() => requestSelectForm(item)}
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border ff-icon-btn-sm"
                            title={item.archived ? 'Restore Form' : 'Archive Form'}
                            aria-label={
                              item.archived ? `Restore ${item.name}` : `Archive ${item.name}`
                            }
                            onClick={() => handleToggleArchive(item)}
                          >
                            {item.archived ? <RotateCcw size={14} /> : <Archive size={14} />}
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border text-danger ff-icon-btn-sm"
                            title="Delete Form"
                            aria-label={`Delete ${item.name}`}
                            onClick={() => setDeleteTarget(item)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Panel – Empty Starting Screen (Step 1 & 3) | Create New Form (Step 2) | Edit Saved Form (Step 4) */}
        <div className="col-lg-8">
          {!isEditorOpen ? (
            /* Empty Starting Screen – Default when no form is selected and immediately after saving */
            <div
              className="ff-card ff-forms-panel p-4 p-sm-5 h-100 d-flex flex-column align-items-center justify-content-center text-center"
              data-testid="empty-workspace-state"
            >
              <div className="ff-create-icon-box-lg mb-3" aria-hidden="true">
                <FileText size={25} />
              </div>
              <h2 className="h5 fw-bold mb-2">Create Your First Form</h2>
              <p className="text-secondary small mb-4" style={{ maxWidth: '430px' }}>
                Start by entering a form name and basic details, then configure custom fields and
                repeating tables step by step.
              </p>
              <button
                type="button"
                onClick={requestStartNewForm}
                className="btn btn-ff-create-purple d-inline-flex align-items-center gap-2"
                data-testid="create-form-btn"
              >
                <Plus size={16} />
                <span>Create Form</span>
              </button>
            </div>
          ) : (
            /* Create New Form (Step 2) OR Edit Saved Form (Step 4) */
            <div
              className="ff-card ff-forms-panel p-3 p-sm-4 h-100 d-flex flex-column gap-4"
              data-testid={creatingNew ? 'create-new-form-panel' : 'form-editor-panel'}
            >
              {/* Editor Header */}
              <div className="d-flex flex-wrap flex-sm-nowrap justify-content-between align-items-start gap-3 pb-3 border-bottom">
                <div className="d-flex align-items-start gap-3 flex-grow-1 min-w-0">
                  <div className="ff-create-icon-box flex-shrink-0" aria-hidden="true">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-grow-1">
                    <h2 className="h5 fw-bold mb-1 text-break" data-testid="form-editor-heading">
                      {creatingNew ? 'Create New Form' : displayFormName}
                    </h2>
                    <p className="small text-secondary mb-1">
                      {creatingNew
                        ? 'Enter a form name and basic details, then add custom fields and repeating tables before saving.'
                        : 'Update form details, custom fields, and repeating tables.'}
                    </p>
                    <div className="small text-secondary ff-tabular d-flex flex-wrap align-items-center gap-1">
                      <span
                        className="fw-semibold ff-create-accent-text"
                        data-testid="header-field-count"
                      >
                        {draftFields.length} {draftFields.length === 1 ? 'Field' : 'Fields'}
                      </span>
                      {!creatingNew && selectedForm && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{selectedForm.archived ? 'Archived' : 'Active'}</span>
                        </>
                      )}
                      {loadingDetail && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Refreshing...</span>
                        </>
                      )}
                      {dirty && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span
                            className="text-warning-emphasis fw-semibold"
                            data-testid="unsaved-indicator"
                          >
                            Unsaved changes
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {!creatingNew && selectedForm && (
                  <button
                    type="button"
                    onClick={requestStartNewForm}
                    className="btn btn-sm btn-ff-create-purple d-inline-flex align-items-center gap-1 flex-shrink-0"
                    data-testid="create-form-btn"
                  >
                    <Plus size={14} />
                    <span>Create Form</span>
                  </button>
                )}
              </div>

              {/* Form Details Section */}
              <div className="d-flex flex-column gap-3">
                <h3 className="h6 fw-bold mb-0">Form Details</h3>
                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <label htmlFor="ff-form-name" className="form-label small fw-semibold mb-1">
                      Form Name <span className="text-danger">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      id="ff-form-name"
                      type="text"
                      required
                      className="form-control form-control-sm"
                      placeholder="e.g. Nursery, Worker Register, Patient Intake"
                      value={formDetails.name}
                      onChange={(e) => {
                        setFormDetails((p) => ({ ...p, name: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label htmlFor="ff-form-category" className="form-label small fw-semibold mb-1">
                      Form Category
                    </label>
                    <select
                      id="ff-form-category"
                      className="form-select form-select-sm"
                      value={formDetails.category}
                      onChange={(e) => {
                        setFormDetails((p) => ({ ...p, category: e.target.value }));
                        setDirty(true);
                      }}
                    >
                      {FORM_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value={CUSTOM_CATEGORY_VALUE}>Other (Custom Category)</option>
                    </select>
                  </div>
                  {formDetails.category === CUSTOM_CATEGORY_VALUE && (
                    <div className="col-12">
                      <label
                        htmlFor="ff-form-custom-category"
                        className="form-label small fw-semibold mb-1"
                      >
                        Custom Category Name
                      </label>
                      <input
                        id="ff-form-custom-category"
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Enter custom category"
                        value={formDetails.customCategory}
                        onChange={(e) => {
                          setFormDetails((p) => ({ ...p, customCategory: e.target.value }));
                          setDirty(true);
                        }}
                      />
                    </div>
                  )}
                  <div className="col-12">
                    <label htmlFor="ff-form-desc" className="form-label small fw-semibold mb-1">
                      Description
                    </label>
                    <textarea
                      id="ff-form-desc"
                      rows={2}
                      className="form-control form-control-sm"
                      placeholder="Optional description of what this form collects"
                      value={formDetails.description}
                      onChange={(e) => {
                        setFormDetails((p) => ({ ...p, description: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Form Fields & Repeating Tables Section */}
              <div className="d-flex flex-column gap-3 pt-3 border-top">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div className="d-flex align-items-baseline gap-2">
                    <h3 className="h6 fw-bold mb-0">Form Fields</h3>
                    <span
                      className="small text-secondary ff-tabular"
                      data-testid="fields-configured-count"
                    >
                      {draftFields.length} configured
                    </span>
                  </div>
                  {draftFields.length > 0 && !showFieldComposer && (
                    <button
                      type="button"
                      onClick={openFieldComposer}
                      className="btn btn-sm btn-ff-outline d-inline-flex align-items-center gap-1"
                      data-testid="open-add-field-btn"
                    >
                      <Plus size={14} />
                      <span>Add Field</span>
                    </button>
                  )}
                </div>

                {draftFields.length === 0 && !showFieldComposer ? (
                  <div
                    className="p-4 text-center border rounded-3 bg-light bg-opacity-50 d-flex flex-column align-items-center gap-3"
                    data-testid="empty-fields-state"
                  >
                    <div className="small text-secondary">
                      No fields added yet. Click Add Field to add custom fields or repeating tables.
                    </div>
                    <button
                      type="button"
                      onClick={openFieldComposer}
                      className="btn btn-sm btn-ff-outline d-inline-flex align-items-center gap-1"
                      data-testid="open-add-field-btn"
                    >
                      <Plus size={14} />
                      <span>Add Field</span>
                    </button>
                  </div>
                ) : (
                  draftFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="ff-field-card p-3 rounded-3 border bg-light bg-opacity-25"
                    >
                      <div className="ff-field-row-grid">
                        <div className="ff-field-col-label">
                          <label className="form-label small text-secondary">
                            {field.type === 'table' ? 'Table Name' : 'Field Label'}
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={field.label}
                            onChange={(e) => updateDraftField(idx, { label: e.target.value })}
                          />
                        </div>
                        <div className="ff-field-col-key">
                          <label className="form-label small text-secondary">Field Key (Auto)</label>
                          <input
                            type="text"
                            className="form-control form-control-sm ff-mono"
                            value={field.fieldName}
                            onChange={(e) =>
                              updateDraftField(idx, { fieldName: slugifyName(e.target.value) })
                            }
                          />
                        </div>
                        <div className="ff-field-col-type">
                          <label className="form-label small text-secondary">Field Type</label>
                          <select
                            className="form-select form-select-sm"
                            value={field.type}
                            onChange={(e) => {
                              const nextType = e.target.value;
                              const fallbackOpts = ['Option 1', 'Option 2'];
                              const nextOpts =
                                nextType === 'select' && !field.options?.length
                                  ? fallbackOpts
                                  : field.options || [];
                              updateDraftField(idx, {
                                type: nextType,
                                options: nextOpts,
                                optionsText:
                                  typeof field.optionsText === 'string' && field.optionsText.trim()
                                    ? field.optionsText
                                    : nextOpts.join(', '),
                                columns:
                                  nextType === 'table' && !field.columns?.length
                                    ? createDefaultTableColumns()
                                    : field.columns || [],
                              });
                            }}
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="ff-field-col-req">
                          <button
                            type="button"
                            className={`btn btn-sm ff-field-req-btn ${
                              field.required ? 'ff-req-active' : 'btn-light border'
                            }`}
                            onClick={() => updateDraftField(idx, { required: !field.required })}
                            title="Toggle Required or Optional"
                          >
                            {field.required ? 'Required' : 'Optional'}
                          </button>
                        </div>
                        <div className="ff-field-col-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-light border ff-field-action-btn"
                            disabled={idx === 0}
                            onClick={() => moveDraftField(idx, -1)}
                            title="Move field up"
                            aria-label={`Move ${field.label} up`}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border ff-field-action-btn"
                            disabled={idx === draftFields.length - 1}
                            onClick={() => moveDraftField(idx, 1)}
                            title="Move field down"
                            aria-label={`Move ${field.label} down`}
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border text-danger ff-field-action-btn"
                            onClick={() => removeDraftField(idx)}
                            title="Delete field"
                            aria-label={`Delete ${field.label}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {field.type === 'select' && (
                        <div className="mt-2 pt-2 border-top">
                          <label className="form-label small text-secondary mb-1">
                            Dropdown Options (separated by commas)
                          </label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={
                              typeof field.optionsText === 'string'
                                ? field.optionsText
                                : (field.options || []).join(', ')
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateDraftField(idx, {
                                optionsText: raw,
                                options: raw
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              });
                            }}
                          />
                        </div>
                      )}

                      {field.type === 'table' && (
                        <div className="mt-2 pt-2 border-top">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <span className="small fw-semibold text-secondary">
                              Repeating Table Columns ({(field.columns || []).length})
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-light border py-0 px-2"
                              onClick={() =>
                                updateDraftField(idx, {
                                  columns: [
                                    ...(field.columns || []),
                                    {
                                      id: `col_${Date.now()}`,
                                      label: 'New Column',
                                      name: `col_${(field.columns || []).length + 1}`,
                                      type: 'text',
                                      required: false,
                                    },
                                  ],
                                })
                              }
                            >
                              + Add Column
                            </button>
                          </div>
                          <div className="d-flex flex-column gap-2">
                            {(field.columns || []).map((col, cIdx) => (
                              <div key={col.id} className="row g-2 align-items-center">
                                <div className="col-12 col-md-4">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Column name"
                                    aria-label={`Column ${cIdx + 1} label`}
                                    value={col.label}
                                    onChange={(e) => {
                                      const cols = [...field.columns];
                                      cols[cIdx] = {
                                        ...col,
                                        label: e.target.value,
                                        name: slugifyName(e.target.value) || col.name,
                                      };
                                      updateDraftField(idx, { columns: cols });
                                    }}
                                  />
                                </div>
                                <div className="col-6 col-md-3">
                                  <select
                                    className="form-select form-select-sm"
                                    aria-label={`Column ${cIdx + 1} type`}
                                    value={normalizeColumnType(col.type)}
                                    onChange={(e) => {
                                      const cols = [...field.columns];
                                      cols[cIdx] = { ...col, type: e.target.value };
                                      updateDraftField(idx, { columns: cols });
                                    }}
                                  >
                                    {COLUMN_TYPES.map((ct) => (
                                      <option key={ct.value} value={ct.value}>
                                        {ct.label} Column
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-6 col-md-2">
                                  <button
                                    type="button"
                                    className={`btn btn-sm w-100 ${
                                      col.required ? 'ff-req-active' : 'btn-light border'
                                    }`}
                                    aria-label={`Toggle column ${col.label || cIdx + 1} required`}
                                    onClick={() => {
                                      const cols = [...field.columns];
                                      cols[cIdx] = { ...col, required: !col.required };
                                      updateDraftField(idx, { columns: cols });
                                    }}
                                  >
                                    {col.required ? 'Required' : 'Optional'}
                                  </button>
                                </div>
                                <div className="col-12 col-md-3 d-flex justify-content-md-end gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light border ff-icon-btn-sm"
                                    disabled={cIdx === 0}
                                    aria-label={`Move column ${col.label || cIdx + 1} up`}
                                    title="Move column up"
                                    onClick={() => moveDraftColumn(idx, cIdx, -1)}
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light border ff-icon-btn-sm"
                                    disabled={cIdx === (field.columns || []).length - 1}
                                    aria-label={`Move column ${col.label || cIdx + 1} down`}
                                    title="Move column down"
                                    onClick={() => moveDraftColumn(idx, cIdx, 1)}
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                  {(field.columns || []).length > 1 && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-light border text-danger ff-icon-btn-sm"
                                      aria-label={`Remove column ${col.label || cIdx + 1}`}
                                      title="Delete column"
                                      onClick={() => {
                                        const cols = field.columns.filter((_, ci) => ci !== cIdx);
                                        updateDraftField(idx, { columns: cols });
                                      }}
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Inline Add Field / Repeating Table Composer */}
                {showFieldComposer && (
                  <form
                    onSubmit={handleAddFieldToDraft}
                    className="p-3 rounded-3 border bg-white"
                    data-testid="add-field-composer"
                  >
                    <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                      <h4 className="h6 fw-bold mb-0">
                        {newType === 'table' ? 'Add Repeating Table' : 'Add New Field'}
                      </h4>
                      <button
                        type="button"
                        className="btn btn-sm btn-light border p-1 d-inline-flex align-items-center justify-content-center"
                        aria-label="Close new field editor"
                        onClick={closeFieldComposer}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="d-flex flex-column gap-3">
                      <div className="ff-add-field-grid">
                        <div className="ff-add-field-item">
                          <label htmlFor="new-field-label" className="form-label small fw-semibold">
                            {newType === 'table' ? 'Table Name *' : 'Field Label *'}
                          </label>
                          <input
                            ref={newFieldLabelRef}
                            id="new-field-label"
                            type="text"
                            className="form-control form-control-sm"
                            placeholder={
                              newType === 'table' ? 'e.g. Order Items' : 'e.g. Customer Name'
                            }
                            value={newLabel}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewLabel(val);
                              if (!newFieldNameTouched) setNewFieldName(slugifyName(val));
                            }}
                          />
                        </div>
                        <div className="ff-add-field-item">
                          <label htmlFor="new-field-key" className="form-label small fw-semibold">
                            Field Key (Optional)
                          </label>
                          <input
                            id="new-field-key"
                            type="text"
                            className="form-control form-control-sm ff-mono"
                            placeholder={newType === 'table' ? 'order_items' : 'customer_name'}
                            value={newFieldName}
                            onChange={(e) => {
                              const cleaned = slugifyName(e.target.value);
                              setNewFieldNameTouched(Boolean(cleaned));
                              setNewFieldName(cleaned);
                            }}
                          />
                        </div>
                        <div className="ff-add-field-item">
                          <label htmlFor="new-field-type" className="form-label small fw-semibold">
                            Field Type
                          </label>
                          <select
                            id="new-field-type"
                            className="form-select form-select-sm"
                            value={newType}
                            onChange={(e) => setNewType(e.target.value)}
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="ff-add-field-req">
                          <div className="form-check">
                            <input
                              id="new-field-req"
                              type="checkbox"
                              className="form-check-input"
                              checked={newRequired}
                              onChange={(e) => setNewRequired(e.target.checked)}
                            />
                            <label
                              htmlFor="new-field-req"
                              className="form-check-label small fw-semibold"
                            >
                              Required
                            </label>
                          </div>
                        </div>
                      </div>

                      {newType === 'select' && (
                        <div>
                          <label
                            htmlFor="new-field-options"
                            className="form-label small fw-semibold"
                          >
                            Dropdown Options (separated by commas)
                          </label>
                          <input
                            id="new-field-options"
                            type="text"
                            className="form-control form-control-sm"
                            value={newOptionsText}
                            onChange={(e) => setNewOptionsText(e.target.value)}
                          />
                        </div>
                      )}

                      {newType === 'table' && (
                        <div>
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <label className="form-label small fw-semibold mb-0">
                              Repeating Table Columns
                            </label>
                            <button
                              type="button"
                              className="btn btn-sm btn-light border py-0 px-2"
                              onClick={() =>
                                setNewColumns((prev) => [
                                  ...prev,
                                  {
                                    id: `c_${Date.now()}`,
                                    label: '',
                                    name: '',
                                    type: 'text',
                                    required: false,
                                  },
                                ])
                              }
                            >
                              + Add Column
                            </button>
                          </div>
                          <div className="d-flex flex-column gap-2">
                            {newColumns.map((col, idx) => (
                              <div key={col.id} className="row g-2 align-items-center">
                                <div className="col-12 col-md-4">
                                  <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Column name"
                                    value={col.label}
                                    onChange={(e) => {
                                      const next = [...newColumns];
                                      next[idx] = {
                                        ...col,
                                        label: e.target.value,
                                        name: slugifyName(e.target.value),
                                      };
                                      setNewColumns(next);
                                    }}
                                  />
                                </div>
                                <div className="col-6 col-md-3">
                                  <select
                                    className="form-select form-select-sm"
                                    value={normalizeColumnType(col.type)}
                                    onChange={(e) => {
                                      const next = [...newColumns];
                                      next[idx] = { ...col, type: e.target.value };
                                      setNewColumns(next);
                                    }}
                                  >
                                    {COLUMN_TYPES.map((ct) => (
                                      <option key={ct.value} value={ct.value}>
                                        {ct.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-6 col-md-2">
                                  <button
                                    type="button"
                                    className={`btn btn-sm w-100 ${
                                      col.required ? 'ff-req-active' : 'btn-light border'
                                    }`}
                                    onClick={() => {
                                      const next = [...newColumns];
                                      next[idx] = { ...col, required: !col.required };
                                      setNewColumns(next);
                                    }}
                                  >
                                    {col.required ? 'Required' : 'Optional'}
                                  </button>
                                </div>
                                <div className="col-12 col-md-3 d-flex justify-content-md-end gap-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light border ff-icon-btn-sm"
                                    disabled={idx === 0}
                                    aria-label="Move new column up"
                                    onClick={() => moveNewColumn(idx, -1)}
                                  >
                                    <ArrowUp size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-light border ff-icon-btn-sm"
                                    disabled={idx === newColumns.length - 1}
                                    aria-label="Move new column down"
                                    onClick={() => moveNewColumn(idx, 1)}
                                  >
                                    <ArrowDown size={13} />
                                  </button>
                                  {newColumns.length > 1 && (
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-light border text-danger ff-icon-btn-sm"
                                      aria-label="Remove new column"
                                      onClick={() =>
                                        setNewColumns((prev) => prev.filter((_, ci) => ci !== idx))
                                      }
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="d-flex flex-wrap justify-content-end gap-2">
                        <button
                          type="button"
                          onClick={closeFieldComposer}
                          className="btn btn-sm btn-ff-outline"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="btn btn-sm btn-ff-create-purple d-inline-flex align-items-center gap-1"
                          data-testid="submit-add-field-btn"
                        >
                          <Plus size={14} />
                          <span>{newType === 'table' ? 'Add Table' : 'Add Field'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Save & Cancel Footer */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3 mt-auto border-top">
                <span className="small text-secondary">
                  {dirty
                    ? creatingNew
                      ? 'Ready to save your new form configuration.'
                      : 'You have unsaved changes.'
                    : creatingNew
                      ? 'Enter a form name, add fields, and click Save Form.'
                      : 'All changes saved.'}
                </span>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={requestCancel}
                    className="btn btn-ff-outline"
                    data-testid="cancel-editor-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveForm}
                    className="btn btn-ff-create-purple d-inline-flex align-items-center gap-2"
                    data-testid={creatingNew ? 'save-form-btn' : 'save-changes-btn'}
                  >
                    {saving ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>{creatingNew ? 'Save Form' : 'Save Changes'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Form Confirmation Modal (30-Day Recycle Bin) */}
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
            aria-labelledby="delete-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom gap-2">
              <h3 id="delete-form-title" className="h5 fw-bold mb-0">
                Move Form to Recycle Bin?
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
              Move <strong className="text-dark">{deleteTarget.name}</strong> and its linked
              customer records to the <strong className="text-dark">Recycle Bin</strong>? You can
              restore it anytime within 30 days inside Settings.
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
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} />
                <span>{deleting ? 'Moving...' : 'Move to Recycle Bin'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-Page Discard Unsaved Changes Confirmation Modal */}
      {discardAction && (
        <div className="ff-modal-backdrop" onClick={() => setDiscardAction(null)}>
          <div
            className="ff-card p-3 p-sm-4 w-100 shadow-lg"
            style={{ maxWidth: '460px' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-changes-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom gap-2">
              <h3
                id="discard-changes-title"
                className="h6 fw-bold mb-0 d-inline-flex align-items-center gap-2"
              >
                <AlertTriangle size={18} className="text-warning flex-shrink-0" />
                <span>{discardAction.title}</span>
              </h3>
              <button
                type="button"
                className="btn-close flex-shrink-0"
                aria-label="Keep editing"
                onClick={() => setDiscardAction(null)}
              />
            </div>

            <p className="small text-secondary mb-4">{discardAction.message}</p>

            <div className="d-flex flex-wrap justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-sm btn-ff-create-purple"
                onClick={() => setDiscardAction(null)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ff-outline"
                onClick={() => discardAction.onConfirm()}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Route Navigation Blocker Modal when Unsaved Changes Exist */}
      {blocker.state === 'blocked' && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-form-editor-modal-title"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
          onClick={() => blocker.reset()}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h5
                  id="leave-form-editor-modal-title"
                  className="modal-title h6 fw-bold d-inline-flex align-items-center gap-2 mb-0"
                >
                  <AlertTriangle size={18} className="text-warning flex-shrink-0" />
                  <span>Unsaved Form Changes</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Stay on page"
                  onClick={() => blocker.reset()}
                />
              </div>
              <div className="modal-body small text-secondary">
                <p className="mb-0 text-dark">
                  You have unsaved changes for{' '}
                  <strong>
                    {creatingNew ? formDetails.name.trim() || 'your new form' : displayFormName}
                  </strong>
                  . Leaving this page now will discard your unsaved edits.
                </p>
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-ff-create-purple"
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
