import { useState } from 'react';
import {
  BarChart3,
  Building2,
  FileDown,
  FileSpreadsheet,
  LayoutDashboard,
  Plus,
  UserPlus,
} from 'lucide-react';

const SCREENS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    title: 'Dashboard Overview',
    description:
      'Displays live counts of Active and Archived Businesses, Customer Records, Total Collected Revenue, and Today’s Registrations.',
  },
  {
    id: 'builder',
    label: 'Create Forms',
    icon: Building2,
    title: 'Create Forms',
    description:
      'Manage active and archived businesses and build custom forms with Short Text, Number, Select Dropdown, Date, Yes / No, and Repeating Table fields.',
  },
  {
    id: 'registration',
    label: 'Register Forms',
    icon: UserPlus,
    title: 'Register Forms',
    description:
      'Automatically loads only the selected business’s saved form fields, validates required entries and repeating table rows, and records Cash or Online payments.',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    title: 'Date-Filtered Reports & Exports',
    description:
      'Filter customer records by business and date range (Today, Yesterday, This Week, This Month, This Year, Custom) to review Cash/Online totals and export PDF or Excel.',
  },
];

export default function ProductShowcaseSection() {
  const [activeId, setActiveId] = useState('dashboard');
  const activeScreen = SCREENS.find((s) => s.id === activeId) || SCREENS[0];

  return (
    <section id="preview" className="ff-landing-section bg-white">
      <div className="container">
        <div className="text-center mx-auto mb-4" style={{ maxWidth: '640px' }}>
          <span className="ff-lp-kicker">Application Preview</span>
          <h2 className="h1 fw-bold mb-2">
            Explore the actual workspace screens.
          </h2>
          <p className="text-secondary mb-0">
            Select a module below to preview the exact interface available after signing in.
          </p>
        </div>

        <div className="d-flex justify-content-center mb-4">
          <div className="ff-tab-group flex-wrap justify-content-center" role="tablist" aria-label="Application preview screens">
            {SCREENS.map((screen) => {
              const Icon = screen.icon;
              const isActive = screen.id === activeId;
              return (
                <button
                  key={screen.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`ff-tab-btn d-inline-flex align-items-center gap-2 ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveId(screen.id)}
                >
                  <Icon size={15} />
                  <span>{screen.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-10">
            <div className="ff-media-frame">
              {/* Top Window Header */}
              <div className="px-3 px-sm-4 py-3 border-bottom bg-light d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <div className="fw-bold text-dark">{activeScreen.title}</div>
                  <div className="small text-secondary">{activeScreen.description}</div>
                </div>
                <span className="ff-mono small text-secondary">/dashboard{activeId === 'dashboard' ? '' : activeId === 'builder' ? '/businesses' : activeId === 'registration' ? '/customers' : '/reports'}</span>
              </div>

              {/* Screen Mockup Body */}
              <div className="p-3 p-sm-4 p-md-5 ff-preview-canvas">
                {activeId === 'dashboard' && (
                  <div className="d-flex flex-column gap-3">
                    <div className="row g-3">
                      {[
                        'Active Businesses',
                        'Customer Records',
                        'Total Collected',
                        "Today's Registrations",
                      ].map((kpi) => (
                        <div key={kpi} className="col-6 col-md-3">
                          <div className="ff-card p-3 h-100">
                            <div className="small text-secondary mb-1">{kpi}</div>
                            <div className="fw-semibold text-dark small">Calculated from saved records</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="row g-3">
                      <div className="col-md-7">
                        <div className="ff-card p-3 h-100">
                          <div className="fw-bold small mb-2">Workspace Summary</div>
                          <div className="p-2 rounded border bg-light bg-opacity-50 small d-flex justify-content-between align-items-center mb-2">
                            <span>Active &amp; Archived Businesses</span>
                            <span className="text-primary fw-medium">Saved Forms &amp; Fields</span>
                          </div>
                          <div className="p-2 rounded border bg-light bg-opacity-50 small d-flex justify-content-between align-items-center">
                            <span>Payment Breakdown</span>
                            <span className="text-secondary">Cash &amp; Online Totals</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-md-5">
                        <div className="ff-card p-3 h-100">
                          <div className="fw-bold small mb-2">Quick Workspace Search</div>
                          <div className="small text-secondary">
                            Press Ctrl + K anytime to search across businesses, customer records, transaction IDs, and support tickets.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeId === 'builder' && (
                  <div className="row g-3">
                    <div className="col-md-4">
                      <div className="ff-card p-3 h-100">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <span className="fw-bold small">Businesses</span>
                          <span className="btn btn-sm btn-ff-purple pe-none py-0 px-2" style={{ fontSize: '0.75rem' }}>
                            + Create
                          </span>
                        </div>
                        <div className="d-flex gap-1 mb-2 small">
                          <span className="px-2 py-1 rounded bg-light border fw-semibold">Active</span>
                          <span className="px-2 py-1 rounded text-secondary">Archived</span>
                        </div>
                        <div className="p-2 rounded border border-primary bg-primary bg-opacity-10 small">
                          <div className="fw-semibold text-dark">Selected Business</div>
                          <div className="text-secondary" style={{ fontSize: '0.75rem' }}>
                            View · Edit · Archive · Delete
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-8">
                      <div className="ff-card p-3 h-100">
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pb-2 mb-3 border-bottom">
                          <span className="fw-bold small">Saved Form Fields</span>
                          <span className="small fw-semibold text-primary">Save Business / Form</span>
                        </div>
                        <div className="row g-2 small">
                          {[
                            { type: 'Short Text', desc: 'Short notes & text entries' },
                            { type: 'Number', desc: 'Numeric values & quantities' },
                            { type: 'Select Dropdown', desc: 'Custom list of options' },
                            { type: 'Date', desc: 'Calendar date picker' },
                            { type: 'Yes / No', desc: 'Simple Yes or No choice' },
                            { type: 'Repeating Table', desc: 'Multi-row Text & Number columns' },
                          ].map((ft) => (
                            <div key={ft.type} className="col-sm-6">
                              <div className="p-2 rounded border bg-light bg-opacity-50">
                                <div className="fw-semibold text-dark">{ft.type}</div>
                                <div className="text-secondary" style={{ fontSize: '0.74rem' }}>
                                  {ft.desc}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeId === 'registration' && (
                  <div className="ff-card p-3 p-sm-4">
                    <div className="row g-3 small">
                      <div className="col-12">
                        <div className="p-2 px-3 rounded border bg-light">
                          <span className="fw-semibold text-dark">1. Select a Business</span>
                          <span className="text-secondary ms-2">
                            — Automatically loads only the saved form fields for that business
                          </span>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-2 rounded border bg-white">
                          <div className="text-secondary">Form Field 1 *</div>
                          <div className="fw-medium text-dark mt-1">Short Text / Number</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-2 rounded border bg-white">
                          <div className="text-secondary">Form Field 2 *</div>
                          <div className="fw-medium text-dark mt-1">Select Dropdown / Date</div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="p-2 rounded border bg-white">
                          <div className="text-secondary">Form Field 3</div>
                          <div className="fw-medium text-dark mt-1">Yes / No Choice</div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="p-3 rounded border bg-light bg-opacity-50">
                          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <span className="fw-semibold text-dark">2. Repeating Table Rows</span>
                            <span className="d-inline-flex align-items-center gap-1 text-primary fw-medium">
                              <Plus size={13} /> Add Row
                            </span>
                          </div>
                          <div className="text-secondary">
                            Validates only the required fields configured for the selected business across Text, Number, Select Dropdown, Date, Yes / No, and Repeating Tables.
                          </div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="p-3 rounded border bg-light bg-opacity-50 d-flex flex-wrap justify-content-between gap-2">
                          <div>
                            <div className="fw-semibold text-dark">3. Payment Details</div>
                            <div className="text-secondary">Amount · Method (Cash / Online) · Transaction ID · Payment Date</div>
                          </div>
                          <span className="btn btn-sm btn-ff-purple pe-none align-self-center">
                            Register Customer
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeId === 'reports' && (
                  <div className="d-flex flex-column gap-3">
                    <div className="ff-card p-3 d-flex flex-wrap justify-content-between align-items-center gap-2 small">
                      <div className="d-flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded border bg-light">Filter: Business</span>
                        <span className="px-2 py-1 rounded border bg-light">
                          Range: Today · Yesterday · Week · Month · Year · Custom
                        </span>
                      </div>
                      <div className="d-flex gap-2">
                        <span className="btn btn-sm btn-ff-outline pe-none d-inline-flex align-items-center gap-1 py-1">
                          <FileDown size={14} /> Export PDF
                        </span>
                        <span className="btn btn-sm btn-ff-purple pe-none d-inline-flex align-items-center gap-1 py-1">
                          <FileSpreadsheet size={14} /> Export Excel
                        </span>
                      </div>
                    </div>

                    <div className="row g-3 small">
                      <div className="col-md-4">
                        <div className="ff-card p-3 h-100">
                          <div className="fw-bold mb-1">Payment Summaries</div>
                          <div className="text-secondary">
                            Total Customer Records, Total Collected, Cash breakdown, and Online breakdown.
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="ff-card p-3 h-100">
                          <div className="fw-bold mb-1">Form Field Summaries</div>
                          <div className="text-secondary">
                            Totals for Number fields, Yes / No counts, and dropdown breakdowns without counting phone numbers or IDs.
                          </div>
                        </div>
                      </div>
                      <div className="col-md-4">
                        <div className="ff-card p-3 h-100">
                          <div className="fw-bold mb-1">Repeating Tables &amp; Records</div>
                          <div className="text-secondary">
                            Totals numeric repeating table columns and lists every matching customer record.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
