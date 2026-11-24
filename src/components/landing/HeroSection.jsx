import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  UserPlus,
} from 'lucide-react';

export default function HeroSection() {
  return (
    <section id="home" className="ff-hero">
      <div className="container">
        <div className="row align-items-center g-5">
          <div className="col-lg-5 ff-fade-up">
            <span className="ff-lp-kicker">Business Form &amp; Customer Workspace</span>
            <h1 className="ff-hero-title mb-3">
              Manage Your Business Forms and Customer Records in One Place.
            </h1>
            <p className="lead text-secondary mb-4" style={{ maxWidth: '48ch' }}>
              Create custom forms, register customers, manage records and generate reports easily.
            </p>

            <div className="d-flex flex-wrap align-items-center gap-3">
              <Link
                to="/register"
                className="btn btn-ff-purple btn-lg d-inline-flex align-items-center gap-2"
              >
                <span>Get Started</span>
                <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="btn btn-ff-outline btn-lg">
                Login
              </Link>
            </div>
          </div>

          <div className="col-lg-7 ff-fade-up" style={{ animationDelay: '80ms' }}>
            <div className="ff-media-frame">
              {/* Application Window Bar */}
              <div className="px-3 py-2 border-bottom bg-light d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="rounded-circle d-inline-block"
                    style={{ width: 9, height: 9, backgroundColor: '#cbd5e1' }}
                  />
                  <span
                    className="rounded-circle d-inline-block"
                    style={{ width: 9, height: 9, backgroundColor: '#cbd5e1' }}
                  />
                  <span
                    className="rounded-circle d-inline-block"
                    style={{ width: 9, height: 9, backgroundColor: '#cbd5e1' }}
                  />
                </div>
                <div className="ff-mono text-secondary" style={{ fontSize: '0.72rem' }}>
                  FormFlow Dashboard
                </div>
                <div style={{ width: 32 }} />
              </div>

              {/* Actual Dashboard Layout Preview */}
              <div className="row g-0 bg-white">
                {/* Sidebar Preview */}
                <div
                  className="col-md-4 p-3 text-light d-none d-md-flex flex-column justify-content-between"
                  style={{ backgroundColor: '#0f172a' }}
                >
                  <div>
                    <div className="fw-bold small text-white pb-2 mb-3 border-bottom border-secondary border-opacity-25">
                      FormFlow
                    </div>
                    <div className="d-flex flex-column gap-1" style={{ fontSize: '0.78rem' }}>
                      <div
                        className="px-2 py-2 rounded d-flex align-items-center gap-2 text-white fw-semibold"
                        style={{ backgroundColor: '#2563EB' }}
                      >
                        <LayoutDashboard size={14} />
                        <span>Dashboard</span>
                      </div>
                      <div className="px-2 py-2 rounded d-flex align-items-center gap-2" style={{ color: '#cbd5e1' }}>
                        <Building2 size={14} />
                        <span>Create Forms</span>
                      </div>
                      <div className="px-2 py-2 rounded d-flex align-items-center gap-2" style={{ color: '#cbd5e1' }}>
                        <UserPlus size={14} />
                        <span>Register Forms</span>
                      </div>
                      <div className="px-2 py-2 rounded d-flex align-items-center gap-2" style={{ color: '#cbd5e1' }}>
                        <ClipboardList size={14} />
                        <span>Records</span>
                      </div>
                      <div className="px-2 py-2 rounded d-flex align-items-center gap-2" style={{ color: '#cbd5e1' }}>
                        <BarChart3 size={14} />
                        <span>Reports</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Dashboard Canvas Preview */}
                <div className="col-md-8 p-3 p-sm-4 ff-preview-canvas">
                  <div className="mb-3">
                    <div className="fw-bold small text-dark">Business Overview</div>
                    <div className="text-secondary" style={{ fontSize: '0.74rem' }}>
                      Live metrics from saved business &amp; customer records
                    </div>
                  </div>

                  {/* 4 Real Metric Cards */}
                  <div className="row g-2 mb-3">
                    {[
                      { label: 'Active Businesses', value: 'Active & Archived' },
                      { label: 'Customer Records', value: 'Saved Entries' },
                      { label: 'Total Collected', value: 'Cash & Online' },
                      { label: "Today's Registrations", value: 'Date Filtered' },
                    ].map((card) => (
                      <div key={card.label} className="col-6">
                        <div className="p-2 rounded border bg-white h-100">
                          <div className="text-secondary" style={{ fontSize: '0.7rem' }}>
                            {card.label}
                          </div>
                          <div className="fw-bold text-dark mt-1" style={{ fontSize: '0.8rem' }}>
                            {card.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Configured Modules Quick View */}
                  <div className="p-3 rounded border bg-white">
                    <div className="fw-semibold text-dark mb-2" style={{ fontSize: '0.78rem' }}>
                      Core Workspace Features
                    </div>
                    <div className="d-flex flex-column gap-2" style={{ fontSize: '0.74rem' }}>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 pb-1 border-bottom">
                        <span className="text-dark fw-medium">Custom Business Forms</span>
                        <span className="text-secondary">Text · Number · Dropdown · Date · Yes / No · Table</span>
                      </div>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-1 pb-1 border-bottom">
                        <span className="text-dark fw-medium">Customer Payment Tracking</span>
                        <span className="text-secondary">Cash &amp; Online + Transaction ID</span>
                      </div>
                      <div className="d-flex flex-wrap justify-content-between align-items-center gap-1">
                        <span className="text-dark fw-medium">Reports &amp; Data Recovery</span>
                        <span className="text-secondary">PDF Invoices · Excel Reports · Recycle Bin</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
