import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="ff-auth-shell d-flex flex-column justify-content-between py-4 px-3">
      <div className="container">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
          <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none">
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="28" height="28" rx="7" fill="#2563EB" />
              <rect x="7" y="7.5" width="14" height="3" rx="1.5" fill="#FFFFFF" />
              <rect x="7" y="13" width="10" height="3" rx="1.5" fill="#DBEAFE" />
              <rect x="7" y="18.5" width="6" height="3" rx="1.5" fill="#FFFFFF" />
            </svg>
            <span className="ff-display fw-bold fs-5 text-dark">FormFlow</span>
          </Link>

          <Link
            to="/"
            className="btn btn-sm btn-ff-outline d-inline-flex align-items-center gap-1"
          >
            <ArrowLeft size={15} />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>

      <main className="container my-4">
        <div className="row justify-content-center">
          <div className="col-12 col-sm-10 col-md-8 col-lg-6 col-xl-5">
            <div className="ff-auth-card p-3 p-sm-4 p-md-5">
              <div className="mb-4">
                <h1 className="h3 fw-bold mb-1">{title}</h1>
                <p className="text-secondary small mb-0">{subtitle}</p>
              </div>
              {children}
            </div>
          </div>
        </div>
      </main>

      <footer className="container text-center small text-secondary py-2">
        <span className="d-inline-flex align-items-center gap-1">
          <ShieldCheck size={14} className="text-primary flex-shrink-0" />
          <span>Protected account sign-in and private workspace security</span>
        </span>
      </footer>
    </div>
  );
}
