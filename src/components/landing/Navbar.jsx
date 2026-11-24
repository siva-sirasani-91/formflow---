import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
];

export default function Navbar() {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 12);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className={`sticky-top ff-navbar ${scrolled ? 'ff-navbar-scrolled' : ''}`}>
      <nav className="navbar navbar-expand-lg py-2 py-lg-3" aria-label="Main navigation">
        <div className="container">
          <Link
            to="/"
            className="navbar-brand d-flex align-items-center gap-2 text-decoration-none m-0"
            onClick={closeMobile}
          >
            <svg
              width="30"
              height="30"
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

          <button
            type="button"
            className="navbar-toggler d-lg-none border-0 shadow-none p-2"
            aria-controls="ffNavbarCollapse"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div
            id="ffNavbarCollapse"
            className={`collapse navbar-collapse ${mobileOpen ? 'show' : ''}`}
          >
            <ul className="navbar-nav mx-auto my-3 my-lg-0 gap-lg-3 align-items-lg-center">
              {NAV_LINKS.map((item) => (
                <li key={item.href} className="nav-item">
                  <a
                    href={item.href}
                    className="nav-link ff-nav-link"
                    onClick={closeMobile}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <div className="d-flex flex-wrap align-items-center gap-2 pb-2 pb-lg-0">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="btn btn-ff-purple"
                  onClick={closeMobile}
                >
                  Open Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="btn btn-ff-outline"
                    onClick={closeMobile}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="btn btn-ff-purple"
                    onClick={closeMobile}
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
