import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  DatabaseBackup,
  Globe,
  Moon,
  RotateCcw,
  Save,
  Shield,
  Sun,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';
import {
  formatCurrency,
  formatDateShort,
  getLocalDateString,
  getRecordDisplaySubtitle,
  getRecordDisplayTitle,
} from '../../utils/exportUtils.js';

export default function SettingsView() {
  const {
    businesses,
    deletedBusinesses,
    settings,
    setSettings,
    recycleBin,
    refreshAll,
    setRecycleBin,
    setRecords,
  } = useWorkspace();
  const { isDark, setTheme } = useTheme();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'recycle-bin' ? 'recycle-bin' : 'preferences';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [draft, setDraft] = useState(settings);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleting, setConfirmDeleting] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (searchParams.get('tab') === 'recycle-bin') {
      setActiveTab('recycle-bin');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!confirmDelete) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape' && !confirmDeleting) {
        setConfirmDelete(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [confirmDelete, confirmDeleting]);

  async function handleSavePreferences(e) {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: '', message: '' });
    try {
      const res = await workspaceApi.updateSettings(draft);
      setSettings(res.settings);
      setStatus({ type: 'success', message: res.message || 'Settings saved.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleBackupNow() {
    setSaving(true);
    setStatus({ type: '', message: '' });
    try {
      const res = await workspaceApi.backupNow();
      setSettings(res.settings);
      const blob = new Blob([JSON.stringify(res.snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `FormFlow_Backup_${getLocalDateString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Workspace backup downloaded and timestamp updated.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreRecord(rec) {
    const biz = businesses.find((b) => b.id === rec.businessId);
    const label = getRecordDisplayTitle(rec, biz);
    try {
      const res = await workspaceApi.restoreRecord(rec.id);
      setRecycleBin((prev) => prev.filter((item) => item.id !== rec.id));
      setRecords((prev) => [res.record, ...prev]);
      setStatus({ type: 'success', message: `Restored "${label}" back to Records.` });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  }

  function requestPermanentDeleteRecord(rec) {
    const biz = businesses.find((b) => b.id === rec.businessId);
    const label = getRecordDisplayTitle(rec, biz);
    setConfirmDelete({ kind: 'record', item: rec, label });
  }

  async function handleRestoreBusiness(biz) {
    try {
      await workspaceApi.restoreBusiness(biz.id);
      await refreshAll();
      setStatus({
        type: 'success',
        message: `Restored "${biz.name}" and its retained customer records.`,
      });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
  }

  function requestPermanentDeleteBusiness(biz) {
    setConfirmDelete({ kind: 'business', item: biz, label: biz.name });
  }

  async function handleExecutePermanentDelete() {
    if (!confirmDelete || confirmDeleting) return;
    setConfirmDeleting(true);
    try {
      if (confirmDelete.kind === 'record') {
        await workspaceApi.permanentDeleteRecord(confirmDelete.item.id);
        setRecycleBin((prev) => prev.filter((item) => item.id !== confirmDelete.item.id));
        setStatus({ type: 'success', message: `Permanently deleted "${confirmDelete.label}".` });
      } else {
        await workspaceApi.permanentDeleteBusiness(confirmDelete.item.id);
        await refreshAll();
        setStatus({ type: 'success', message: `Permanently deleted "${confirmDelete.label}".` });
      }
      setConfirmDelete(null);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setConfirmDeleting(false);
    }
  }

  const totalBinCount = recycleBin.length + deletedBusinesses.length;

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="ff-tab-group">
          <button
            type="button"
            className={`ff-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            General &amp; Security
          </button>
          <button
            type="button"
            className={`ff-tab-btn ${activeTab === 'recycle-bin' ? 'active' : ''}`}
            onClick={() => setActiveTab('recycle-bin')}
          >
            Recycle Bin ({totalBinCount})
          </button>
        </div>
      </div>

      {status.message && (
        <div
          className={`alert ${status.type === 'error' ? 'alert-danger' : 'alert-success'} d-flex justify-content-between align-items-center mb-0`}
          role="status"
        >
          <span className="d-inline-flex align-items-center gap-2">
            {status.type === 'success' && <CheckCircle2 size={17} />}
            <span>{status.message}</span>
          </span>
          <button
            type="button"
            className="btn-close btn-sm"
            onClick={() => setStatus({ type: '', message: '' })}
          />
        </div>
      )}

      {activeTab === 'preferences' ? (
        <form onSubmit={handleSavePreferences} className="row g-3">
          <div className="col-12">
            <div className="ff-card p-3 p-sm-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    {isDark ? (
                      <Sun size={18} className="text-primary" />
                    ) : (
                      <Moon size={18} className="text-primary" />
                    )}
                    <h2 className="h6 fw-bold mb-0">Appearance</h2>
                  </div>
                  <p className="small text-secondary mb-0">
                    Enable Dark Mode for a low-glare workspace interface. Your theme preference is saved automatically.
                  </p>
                </div>
                <div className="form-check form-switch m-0 d-flex align-items-center gap-2">
                  <input
                    id="set-dark-mode"
                    type="checkbox"
                    role="switch"
                    className="form-check-input mt-0"
                    checked={isDark}
                    onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                  />
                  <label htmlFor="set-dark-mode" className="form-check-label small fw-semibold">
                    Dark Mode
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="ff-card p-3 p-sm-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <Globe size={18} className="text-primary" />
                <h2 className="h6 fw-bold mb-0">Language</h2>
              </div>
              <label htmlFor="set-lang" className="form-label small text-secondary">
                Choose display language
              </label>
              <select
                id="set-lang"
                className="form-select"
                value={draft.language || 'en'}
                onChange={(e) => setDraft((p) => ({ ...p, language: e.target.value }))}
              >
                <option value="en">English</option>
                <option value="te">Telugu (తెలుగు)</option>
              </select>
            </div>
          </div>

          <div className="col-md-6">
            <div className="ff-card p-3 p-sm-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <Bell size={18} className="text-primary" />
                <h2 className="h6 fw-bold mb-0">Notifications</h2>
              </div>
              <div className="form-check form-switch mb-2">
                <input
                  id="set-phone-alerts"
                  type="checkbox"
                  className="form-check-input"
                  checked={Boolean(draft.phoneAlerts)}
                  onChange={(e) => setDraft((p) => ({ ...p, phoneAlerts: e.target.checked }))}
                />
                <label htmlFor="set-phone-alerts" className="form-check-label small">
                  Phone SMS alerts on new customer registrations
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  id="set-email-receipts"
                  type="checkbox"
                  className="form-check-input"
                  checked={Boolean(draft.emailReceipts)}
                  onChange={(e) => setDraft((p) => ({ ...p, emailReceipts: e.target.checked }))}
                />
                <label htmlFor="set-email-receipts" className="form-check-label small">
                  Send automated email receipts for Online payments
                </label>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="ff-card p-3 p-sm-4 h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <Shield size={18} className="text-primary" />
                <h2 className="h6 fw-bold mb-0">Security</h2>
              </div>
              <div className="form-check form-switch">
                <input
                  id="set-2fa"
                  type="checkbox"
                  className="form-check-input"
                  checked={Boolean(draft.twoFactorOtp)}
                  onChange={(e) => setDraft((p) => ({ ...p, twoFactorOtp: e.target.checked }))}
                />
                <label htmlFor="set-2fa" className="form-check-label small">
                  Require Two-Factor OTP verification on new devices
                </label>
              </div>
              <p className="small text-secondary mt-2 mb-0">
                Adds an extra verification step when signing in from an unrecognized browser.
              </p>
            </div>
          </div>

          <div className="col-md-6">
            <div className="ff-card p-3 p-sm-4 h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <DatabaseBackup size={18} className="text-primary" />
                  <h2 className="h6 fw-bold mb-0">Backup &amp; Recovery</h2>
                </div>
                <div className="form-check form-switch mb-2">
                  <input
                    id="set-backup"
                    type="checkbox"
                    className="form-check-input"
                    checked={Boolean(draft.dailyBackup)}
                    onChange={(e) => setDraft((p) => ({ ...p, dailyBackup: e.target.checked }))}
                  />
                  <label htmlFor="set-backup" className="form-check-label small">
                    Enable daily automated workspace backup
                  </label>
                </div>
                <div className="small text-secondary mb-3">
                  Last backup:{' '}
                  <span className="ff-mono">
                    {settings.lastBackupAt ? formatDateShort(settings.lastBackupAt) : 'Never'}
                  </span>
                </div>
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleBackupNow}
                  className="btn btn-sm btn-ff-outline"
                  disabled={saving}
                >
                  Download Workspace Backup
                </button>
              </div>
            </div>
          </div>

          <div className="col-12 d-flex justify-content-end">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-ff-primary d-inline-flex align-items-center gap-2"
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="d-flex flex-column gap-3">
          {deletedBusinesses.length > 0 && (
            <div className="ff-card overflow-hidden">
              <div className="p-3 border-bottom">
                <h2 className="h5 fw-bold mb-1">Deleted Businesses (30-Day Recovery)</h2>
                <p className="text-secondary small mb-0">
                  Deleted businesses and their customer records can be restored within 30 days.
                </p>
              </div>
              <div className="table-responsive">
                <table className="table ff-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Business</th>
                      <th className="px-3 py-3">Form Fields</th>
                      <th className="px-3 py-3">Customer Records</th>
                      <th className="px-3 py-3">Deleted On</th>
                      <th className="px-3 py-3">Time Remaining</th>
                      <th className="px-4 py-3 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deletedBusinesses.map((biz) => (
                      <tr key={biz.id}>
                        <td className="px-4 py-3">
                          <div className="fw-semibold text-dark">{biz.name}</div>
                          <div className="small text-secondary">{biz.category}</div>
                        </td>
                        <td className="px-3 py-3 ff-mono small">
                          {(biz.fields || []).length}
                        </td>
                        <td className="px-3 py-3 ff-mono small">
                          {biz.recordCount || 0}
                        </td>
                        <td className="px-3 py-3 small ff-tabular text-secondary">
                          {formatDateShort(biz.deletedAt)}
                        </td>
                        <td className="px-3 py-3 ff-mono small fw-semibold text-warning-emphasis">
                          {biz.remainingDays} {biz.remainingDays === 1 ? 'day' : 'days'} left
                        </td>
                        <td className="px-4 py-3 text-end">
                          <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-ff-outline d-inline-flex align-items-center gap-1"
                              onClick={() => handleRestoreBusiness(biz)}
                            >
                              <RotateCcw size={14} />
                              <span>Restore</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                              onClick={() => requestPermanentDeleteBusiness(biz)}
                            >
                              <Trash2 size={14} />
                              <span>Delete Forever</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="ff-card overflow-hidden">
            <div className="p-3 border-bottom">
              <h2 className="h5 fw-bold mb-1">Deleted Customer Records (30-Day Recovery)</h2>
              <p className="text-secondary small mb-0">
                Deleted customer records can be restored for up to 30 days before permanent removal.
              </p>
            </div>

            {recycleBin.length === 0 ? (
              <div className="p-4 text-center text-secondary small">
                Recycle Bin has no deleted customer records.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table ff-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th className="px-4 py-3">Customer Record</th>
                      <th className="px-3 py-3">Business</th>
                      <th className="px-3 py-3 text-end">Payment Amount</th>
                      <th className="px-3 py-3">Deleted On</th>
                      <th className="px-3 py-3">Time Remaining</th>
                      <th className="px-4 py-3 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recycleBin.map((item) => {
                      const biz =
                        businesses.find((b) => b.id === item.businessId) ||
                        deletedBusinesses.find((b) => b.id === item.businessId);
                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <div className="fw-semibold text-dark">{getRecordDisplayTitle(item, biz)}</div>
                            <div className="small text-secondary">{getRecordDisplaySubtitle(item, biz)}</div>
                          </td>
                          <td className="px-3 py-3 small">{item.businessName}</td>
                          <td className="px-3 py-3 text-end ff-mono small">
                            {formatCurrency(item.payment?.amount)}
                          </td>
                          <td className="px-3 py-3 small ff-tabular text-secondary">
                            {formatDateShort(item.deletedAt)}
                          </td>
                          <td className="px-3 py-3 ff-mono small fw-semibold text-warning-emphasis">
                            {item.remainingDays} {item.remainingDays === 1 ? 'day' : 'days'} left
                          </td>
                          <td className="px-4 py-3 text-end">
                            <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-ff-outline d-inline-flex align-items-center gap-1"
                                onClick={() => handleRestoreRecord(item)}
                              >
                                <RotateCcw size={14} />
                                <span>Restore</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                                onClick={() => requestPermanentDeleteRecord(item)}
                              >
                                <Trash2 size={14} />
                                <span>Delete Forever</span>
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
        </div>
      )}

      {confirmDelete && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          aria-modal="true"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
          onClick={() => !confirmDeleting && setConfirmDelete(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header border-bottom">
                <h3 className="h6 fw-bold mb-0">
                  {confirmDelete.kind === 'business'
                    ? 'Permanently Delete Business'
                    : 'Permanently Delete Record'}
                </h3>
                <button
                  type="button"
                  className="btn-close btn-sm"
                  aria-label="Close"
                  disabled={confirmDeleting}
                  onClick={() => setConfirmDelete(null)}
                />
              </div>
              <div className="modal-body small text-secondary">
                {confirmDelete.kind === 'business' ? (
                  <p className="mb-0">
                    Permanently delete <strong>{confirmDelete.label}</strong> and all its associated
                    records? This action cannot be undone.
                  </p>
                ) : (
                  <p className="mb-0">
                    Permanently delete <strong>{confirmDelete.label}</strong>? This action cannot be
                    undone.
                  </p>
                )}
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-sm btn-ff-outline"
                  disabled={confirmDeleting}
                  onClick={() => setConfirmDelete(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={confirmDeleting}
                  onClick={handleExecutePermanentDelete}
                >
                  {confirmDeleting ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
