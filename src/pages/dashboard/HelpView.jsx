import { useState } from 'react';
import { CheckCircle2, ChevronDown, LifeBuoy, Send } from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { workspaceApi } from '../../services/workspaceApi.js';
import { formatDateShort } from '../../utils/exportUtils.js';

const HELP_FAQS = [
  {
    q: 'How do I create a custom form for my business?',
    a: 'Open Create Forms from the sidebar, select a business or click Create Form, and add Short Text, Number, Select Dropdown, Date, Yes / No, or Repeating Table fields. Click Save Form or Save Changes to apply it right away.',
  },
  {
    q: 'How do Repeating Tables work in Register Forms?',
    a: 'When a business form includes a Repeating Table field (such as procedures, cargo items, or line items), click Add Row in Register Forms to enter multiple items under that customer record.',
  },
  {
    q: 'How are payment totals calculated in Reports?',
    a: 'Reports calculate payment totals from recorded payment amounts and separate number fields, so phone numbers or ID numbers never affect your totals.',
  },
  {
    q: 'How can I recover a deleted customer record or business?',
    a: 'Deleted customer records and businesses move to Settings → Recycle Bin and can be restored within 30 days. Click Restore to bring them back to active Records and Reports.',
  },
];

export default function HelpView() {
  const { tickets, setTickets } = useWorkspace();
  const [openFaq, setOpenFaq] = useState(0);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Create Forms');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [ticketError, setTicketError] = useState('');
  const [updatingTicketId, setUpdatingTicketId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmitTicket(e) {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (subject.trim().length < 3) {
      setStatus({ type: 'error', message: 'Subject must be at least 3 characters.' });
      return;
    }
    if (description.trim().length < 10) {
      setStatus({ type: 'error', message: 'Please describe your issue (at least 10 characters).' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await workspaceApi.createTicket({
        subject: subject.trim(),
        category,
        description: description.trim(),
      });
      setTickets((prev) => [res.ticket, ...prev]);
      setSubject('');
      setDescription('');
      setStatus({ type: 'success', message: 'Support ticket submitted and logged to your history.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCycleStatus(ticket) {
    if (updatingTicketId === ticket.id) return;
    const order = ['Open', 'In Progress', 'Resolved'];
    const nextStatus = order[(order.indexOf(ticket.status) + 1) % order.length];
    setTicketError('');
    setUpdatingTicketId(ticket.id);
    try {
      const res = await workspaceApi.updateTicketStatus(ticket.id, nextStatus);
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? res.ticket : t)));
    } catch (err) {
      setTicketError(err.message || 'Unable to update ticket status.');
    } finally {
      setUpdatingTicketId(null);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-lg-6">
        <div className="ff-card p-3 p-sm-4 h-100">
          <h2 className="h5 fw-bold mb-1">Frequently Asked Questions</h2>
          <p className="text-secondary small mb-3">
            Quick guidance on creating forms, managing records, reporting, and data recovery.
          </p>
          <div className="d-flex flex-column gap-2">
            {HELP_FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="ff-accordion-item">
                  <button
                    type="button"
                    className="ff-accordion-btn py-2 px-3 small"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      size={15}
                      style={{
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 180ms ease',
                      }}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2 pt-2 border-top small text-secondary">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="col-lg-6">
        <div className="ff-card p-3 p-sm-4 h-100 d-flex flex-column">
          <div className="d-flex align-items-center gap-2 mb-1">
            <LifeBuoy size={18} className="text-primary" />
            <h2 className="h5 fw-bold mb-0">Create Support Ticket</h2>
          </div>
          <p className="text-secondary small mb-3">
            Need assistance with your workspace? Send a support request and track its status below.
          </p>

          {status.message && (
            <div
              className={`alert ${status.type === 'error' ? 'alert-danger' : 'alert-success'} small d-flex align-items-center gap-2`}
              role="status"
            >
              {status.type === 'success' && <CheckCircle2 size={16} />}
              <span>{status.message}</span>
            </div>
          )}

          <form onSubmit={handleSubmitTicket} className="d-flex flex-column gap-3 flex-grow-1">
            <div className="row g-3">
              <div className="col-sm-7">
                <label className="form-label small fw-semibold">Subject *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Brief summary of your question"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="col-sm-5">
                <label className="form-label small fw-semibold">Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Create Forms">Create Forms</option>
                  <option value="Payments & Invoices">Payments &amp; Invoices</option>
                  <option value="Reports & Exports">Reports &amp; Exports</option>
                  <option value="Account & Security">Account &amp; Security</option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label small fw-semibold">Description *</label>
              <textarea
                rows={4}
                className="form-control"
                placeholder="Describe your question or issue with the business name or page details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="mt-auto pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-ff-primary d-inline-flex align-items-center gap-2"
              >
                <Send size={15} />
                <span>{submitting ? 'Submitting...' : 'Submit Ticket'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Ticket History */}
      <div className="col-12">
        <div className="ff-card overflow-hidden">
          <div className="p-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
            <h3 className="h6 fw-bold mb-0">Support Ticket History</h3>
            {ticketError && <span className="small text-danger">{ticketError}</span>}
          </div>
          {tickets.length === 0 ? (
            <div className="p-4 text-center text-secondary small">
              You have not submitted any support tickets yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table ff-table align-middle mb-0">
                <thead>
                  <tr>
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-3 py-3">Subject &amp; Details</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Created</th>
                    <th className="px-4 py-3 text-end">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => {
                    const statusClass =
                      t.status === 'Resolved'
                        ? 'text-success'
                        : t.status === 'In Progress'
                          ? 'text-primary'
                          : 'text-warning-emphasis';
                    return (
                      <tr key={t.id}>
                        <td className="px-4 py-3 ff-mono small">#{t.id}</td>
                        <td className="px-3 py-3" style={{ minWidth: '220px' }}>
                          <div className="fw-semibold text-dark">{t.subject}</div>
                          <div className="small text-secondary">{t.description}</div>
                        </td>
                        <td className="px-3 py-3 small">{t.category}</td>
                        <td className="px-3 py-3 small ff-tabular text-secondary">
                          {formatDateShort(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <button
                            type="button"
                            disabled={updatingTicketId === t.id}
                            title="Click to update ticket status"
                            onClick={() => handleCycleStatus(t)}
                            className={`btn btn-sm btn-light border fw-semibold ${statusClass}`}
                          >
                            {updatingTicketId === t.id ? 'Updating...' : t.status}
                          </button>
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
    </div>
  );
}
