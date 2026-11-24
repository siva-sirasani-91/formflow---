import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cameFromLogout] = useState(() => {
    try {
      const flag = window.sessionStorage.getItem('ff_explicit_logout') === '1';
      if (flag) window.sessionStorage.removeItem('ff_explicit_logout');
      return flag;
    } catch {
      return false;
    }
  });
  const fromLoc = cameFromLogout ? null : location.state?.from;
  const redirectTarget = fromLoc?.pathname
    ? `${fromLoc.pathname}${fromLoc.search || ''}`
    : '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  function validate() {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!password) {
      errs.password = 'Password is required.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await login({
        email: email.trim(),
        password,
        rememberMe,
      });
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      setServerError(err.message || 'Unable to sign in. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemoCredentials() {
    setEmail('demo@formflow.io');
    setPassword('Demo@1234');
    setFieldErrors({});
    setServerError('');
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to access your FormFlow workspace."
    >
      {serverError && (
        <div className="alert alert-danger d-flex align-items-start gap-2 small" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="login-email" className="form-label fw-semibold small">
            Email Address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
            }}
          />
          {fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}
        </div>

        <div>
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label htmlFor="login-password" className="form-label fw-semibold small mb-0">
              Password
            </label>
            <Link to="/forgot-password" className="small text-decoration-none fw-medium">
              Forgot Password?
            </Link>
          </div>
          <div className="input-group">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: '' }));
              }}
            />
            <button
              type="button"
              className="btn btn-outline-secondary border border-start-0"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fieldErrors.password && <div className="invalid-feedback d-block">{fieldErrors.password}</div>}
        </div>

        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="form-check">
            <input
              id="login-remember"
              type="checkbox"
              className="form-check-input"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="login-remember" className="form-check-label small text-secondary">
              Remember me for 30 days
            </label>
          </div>

          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none"
            onClick={fillDemoCredentials}
          >
            Use Demo Account
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-ff-primary w-100 d-inline-flex align-items-center justify-content-center gap-2 mt-1"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Signing In...</span>
            </>
          ) : (
            <>
              <LogIn size={17} />
              <span>Sign In</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center small text-secondary mt-4 pt-3 border-top">
        Don&apos;t have an account yet?{' '}
        <Link to="/register" className="fw-semibold text-decoration-none">
          Create Account
        </Link>
      </div>
    </AuthLayout>
  );
}
