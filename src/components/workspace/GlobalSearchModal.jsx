import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, FileText, HelpCircle, Search, Users, X } from 'lucide-react';
import { workspaceApi } from '../../services/workspaceApi.js';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import {
  formatCurrency,
  getRecordDisplaySubtitle,
  getRecordDisplayTitle,
} from '../../utils/exportUtils.js';

export default function GlobalSearchModal({ open, onClose }) {
  const navigate = useNavigate();
  const { businesses, records, tickets } = useWorkspace();
  const inputRef = useRef(null);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [results, setResults] = useState({ businesses: [], customers: [], tickets: [] });
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCategory('all');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({
        businesses: businesses.slice(0, 4),
        customers: records.slice(0, 4).map((r) => ({
          ...r,
          businessName: businesses.find((b) => b.id === r.businessId)?.name || 'Business',
        })),
        tickets: tickets.slice(0, 3),
      });
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      workspaceApi
        .globalSearch(trimmed)
        .then((res) => {
          if (active) setResults(res);
        })
        .catch(() => {
          if (!active) return;
          const q = trimmed.toLowerCase();
          setResults({
            businesses: businesses.filter((b) =>
              [b.name, b.category, b.phone].some((v) => String(v || '').toLowerCase().includes(q))
            ),
            customers: records
              .filter((r) =>
                [
                  r.customerName,
                  r.customerPhone,
                  r.customerEmail,
                  r.payment?.transactionId,
                  Object.values(r.answers || {}).join(' '),
                  JSON.stringify(r.repeatingTables || {}),
                ].some((v) => String(v || '').toLowerCase().includes(q))
              )
              .map((r) => ({
                ...r,
                businessName: businesses.find((b) => b.id === r.businessId)?.name || 'Business',
              })),
            tickets: tickets.filter((t) =>
              [t.subject, t.description].some((v) => String(v || '').toLowerCase().includes(q))
            ),
          });
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, businesses, records, tickets]);

  if (!open) return null;

  const showBusinesses = category === 'all' || category === 'businesses';
  const showCustomers = category === 'all' || category === 'customers';
  const showTickets = category === 'all' || category === 'tickets';

  const totalCount =
    (showBusinesses ? results.businesses.length : 0) +
    (showCustomers ? results.customers.length : 0) +
    (showTickets ? results.tickets.length : 0);

  function goTo(path) {
    onClose();
    navigate(path);
  }

  return (
    <div
      className="ff-search-backdrop px-3"
      role="dialog"
      aria-modal="true"
      aria-label="Global workspace search"
      onClick={onClose}
    >
      <div
        className="ff-card w-100 shadow-lg overflow-hidden"
        style={{ maxWidth: '680px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-bottom d-flex align-items-center gap-2 bg-white">
          <Search size={18} className="text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="form-control border-0 shadow-none p-1"
            placeholder="Search businesses, customer records, transaction IDs, or support tickets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="small text-secondary bg-light border rounded px-2 py-1 d-none d-sm-inline-block">Esc</kbd>
          <button
            type="button"
            className="btn btn-sm btn-light border-0"
            aria-label="Close search"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </div>

        <div className="px-3 py-2 border-bottom bg-light bg-opacity-50 d-flex flex-wrap gap-2 align-items-center justify-content-between">
          <div className="ff-tab-group">
            {[
              { id: 'all', label: 'All' },
              { id: 'businesses', label: `Businesses (${results.businesses.length})` },
              { id: 'customers', label: `Customer Records (${results.customers.length})` },
              { id: 'tickets', label: `Tickets (${results.tickets.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`ff-tab-btn py-1 px-2 ${category === tab.id ? 'active' : ''}`}
                style={{ fontSize: '0.8rem' }}
                onClick={() => setCategory(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {searching && <span className="small text-secondary">Searching...</span>}
        </div>

        <div className="p-3 overflow-auto" style={{ maxHeight: '55vh' }}>
          {totalCount === 0 ? (
            <div className="text-center py-5 text-secondary">
              <FileText size={28} className="mb-2 opacity-50" />
              <div className="fw-semibold text-dark">No matching records found</div>
              <div className="small">Try searching by business name, customer phone, or invoice ID.</div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {showBusinesses && results.businesses.length > 0 && (
                <div>
                  <div className="small fw-semibold text-secondary mb-2">Businesses</div>
                  <div className="d-flex flex-column gap-1">
                    {results.businesses.map((biz) => {
                      const fieldCount = (biz.fields || []).length;
                      return (
                        <button
                          key={biz.id}
                          type="button"
                          onClick={() => goTo(`/dashboard/businesses?id=${biz.id}`)}
                          className="btn btn-light bg-white border text-start p-2 px-3 d-flex align-items-center justify-content-between gap-2"
                        >
                          <div className="d-flex align-items-center gap-2 min-w-0">
                            <Building2 size={16} className="text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="fw-semibold small text-dark text-truncate">{biz.name}</div>
                              <div className="text-secondary text-truncate" style={{ fontSize: '0.78rem' }}>
                                {biz.category} · {fieldCount} {fieldCount === 1 ? 'Form Field' : 'Form Fields'}
                              </div>
                            </div>
                          </div>
                          <span className="small text-primary fw-medium flex-shrink-0">Open Form</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {showCustomers && results.customers.length > 0 && (
                <div>
                  <div className="small fw-semibold text-secondary mb-2">Customer Records</div>
                  <div className="d-flex flex-column gap-1">
                    {results.customers.map((rec) => {
                      const biz = businesses.find((b) => b.id === rec.businessId);
                      return (
                        <button
                          key={rec.id}
                          type="button"
                          onClick={() => goTo(`/dashboard/records?inspect=${rec.id}`)}
                          className="btn btn-light bg-white border text-start p-2 px-3 d-flex align-items-center justify-content-between gap-2"
                        >
                          <div className="d-flex align-items-center gap-2 min-w-0">
                            <Users size={16} className="text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="fw-semibold small text-dark text-truncate">
                                {getRecordDisplayTitle(rec, biz)}
                              </div>
                              <div className="text-secondary text-truncate" style={{ fontSize: '0.78rem' }}>
                                {rec.businessName} · {getRecordDisplaySubtitle(rec, biz)}
                              </div>
                            </div>
                          </div>
                          <span className="ff-mono small fw-semibold text-dark flex-shrink-0">
                            {formatCurrency(rec.payment?.amount)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {showTickets && results.tickets.length > 0 && (
                <div>
                  <div className="small fw-semibold text-secondary mb-2">Support Tickets</div>
                  <div className="d-flex flex-column gap-1">
                    {results.tickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => goTo('/dashboard/help')}
                        className="btn btn-light bg-white border text-start p-2 px-3 d-flex align-items-center justify-content-between gap-2"
                      >
                        <div className="d-flex align-items-center gap-2 min-w-0">
                          <HelpCircle size={16} className="text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="fw-semibold small text-dark text-truncate">{t.subject}</div>
                            <div className="text-secondary text-truncate" style={{ fontSize: '0.78rem' }}>
                              Ticket #{t.id} · {t.status}
                            </div>
                          </div>
                        </div>
                        <span className="small text-secondary flex-shrink-0">View Ticket</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
