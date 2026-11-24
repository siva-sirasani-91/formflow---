import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const [legalModal, setLegalModal] = useState(null);

  useEffect(() => {
    if (!legalModal) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setLegalModal(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [legalModal]);

  return (
    <footer className="bg-white border-top pt-5 pb-4">
      <div className="container">
        <div className="row g-4 pb-4 border-bottom align-items-start justify-content-between">
          <div className="col-lg-5">
            <Link to="/" className="d-inline-flex align-items-center gap-2 text-decoration-none mb-2">
              <svg
                width="26"
                height="26"
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
            <p className="text-secondary small mb-0" style={{ maxWidth: '40ch' }}>
              Create custom business forms, register customers, manage records, and export PDF or Excel reports from one workspace.
            </p>
          </div>

          <div className="col-6 col-sm-4 col-lg-3">
            <h4 className="h6 fw-bold mb-3">Navigation</h4>
            <ul className="list-unstyled d-flex flex-column gap-2 small mb-0">
              <li><a href="#home" className="text-decoration-none text-secondary">Home</a></li>
              <li><a href="#features" className="text-decoration-none text-secondary">Features</a></li>
              <li><a href="#how-it-works" className="text-decoration-none text-secondary">How It Works</a></li>
              <li><a href="#preview" className="text-decoration-none text-secondary">Application Preview</a></li>
              <li><a href="#faq" className="text-decoration-none text-secondary">FAQ</a></li>
            </ul>
          </div>

          <div className="col-6 col-sm-4 col-lg-3">
            <h4 className="h6 fw-bold mb-3">Account &amp; Legal</h4>
            <ul className="list-unstyled d-flex flex-column gap-2 small mb-0">
              <li><Link to="/login" className="text-decoration-none text-secondary fw-medium">Login</Link></li>
              <li><Link to="/register" className="text-decoration-none text-secondary fw-medium">Get Started</Link></li>
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
                >
                  Terms and Conditions
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-4 d-flex flex-column flex-sm-row justify-content-between align-items-center gap-2 small text-secondary text-center text-sm-start">
          <div>&copy; {new Date().getFullYear()} FormFlow. All rights reserved.</div>
          <div className="d-flex flex-wrap justify-content-center gap-3">
            <button
              type="button"
              onClick={() => setLegalModal('privacy')}
              className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setLegalModal('terms')}
              className="btn btn-link btn-sm p-0 text-decoration-none text-secondary"
            >
              Terms and Conditions
            </button>
            <Link to="/login" className="text-decoration-none text-secondary">
              Login
            </Link>
          </div>
        </div>
      </div>

      {legalModal && (
        <div
          className="ff-modal-backdrop"
          role="dialog"
          aria-modal="true"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="ff-card p-3 p-sm-4 w-100 shadow-lg"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center pb-3 mb-3 border-bottom">
              <h3 className="h5 fw-bold mb-0">
                {legalModal === 'privacy' ? 'Privacy Policy' : 'Terms and Conditions'}
              </h3>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setLegalModal(null)}
              />
            </div>

            {legalModal === 'privacy' ? (
              <div className="small text-secondary d-flex flex-column gap-2">
                <p className="mb-0">
                  FormFlow keeps your account password protected and keeps all businesses, saved forms, customer records, support tickets, and settings private to your account.
                </p>
                <p className="mb-0">
                  Deleted customer records and businesses stay in the Recycle Bin for up to 30 days so you can restore them anytime, and you can download a full workspace backup from Settings.
                </p>
              </div>
            ) : (
              <div className="small text-secondary d-flex flex-column gap-2">
                <p className="mb-0">
                  By creating an account in FormFlow, you are responsible for the accuracy of the business forms, customer registrations, and payment records entered under your workspace.
                </p>
                <p className="mb-0">
                  Access to internal workspace routes requires valid authentication, and account holders may update profile details, passwords, or export workspace records at any time.
                </p>
              </div>
            )}

            <div className="d-flex justify-content-end mt-4">
              <button
                type="button"
                className="btn btn-ff-purple btn-sm"
                onClick={() => setLegalModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
