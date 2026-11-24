import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, UserPlus } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !successMsg) {
    return <Navigate to="/dashboard" replace />;
  }

  function validate() {
    const errs = {};
    if (fullName.trim().length < 2) {
      errs.fullName = 'Full name must be at least 2 characters.';
    }
    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please enter a valid email address.';
    }
    if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      errs.password = 'Password must include at least one letter and one number.';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      errs.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    setSuccessMsg('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
      });
      setSuccessMsg('Account created successfully. Redirecting to your workspace...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 650);
    } catch (err) {
      setServerError(err.message || 'Unable to create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Create your FormFlow account to manage business forms and customer records."
    >
      {serverError && (
        <div className="alert alert-danger d-flex align-items-start gap-2 small" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" />
          <span>{serverError}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert alert-success d-flex align-items-start gap-2 small" role="status">
          <CheckCircle2 size={17} className="flex-shrink-0 mt-1" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="reg-name" className="form-label fw-semibold small">
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            className={`form-control ${fieldErrors.fullName ? 'is-invalid' : ''}`}
            placeholder="Alex Morgan"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.fullName) setFieldErrors((p) => ({ ...p, fullName: '' }));
            }}
          />
          {fieldErrors.fullName && <div className="invalid-feedback">{fieldErrors.fullName}</div>}
        </div>

        <div>
          <label htmlFor="reg-email" className="form-label fw-semibold small">
            Email Address
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            className={`form-control ${fieldErrors.email ? 'is-invalid' : ''}`}
            placeholder="alex@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
            }}
          />
          {fieldErrors.email && <div className="invalid-feedback">{fieldErrors.email}</div>}
        </div>

        <div>
          <label htmlFor="reg-password" className="form-label fw-semibold small">
            Password
          </label>
          <div className="input-group">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`form-control ${fieldErrors.password ? 'is-invalid' : ''}`}
              placeholder="At least 8 characters with letters and numbers"
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

        <div>
          <label htmlFor="reg-confirm" className="form-label fw-semibold small">
            Confirm Password
          </label>
          <div className="input-group">
            <input
              id="reg-confirm"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className={`form-control ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
              }}
            />
            <button
              type="button"
              className="btn btn-outline-secondary border border-start-0"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              onClick={() => setShowConfirm((prev) => !prev)}
            >
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <div className="invalid-feedback d-block">{fieldErrors.confirmPassword}</div>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-ff-primary w-100 d-inline-flex align-items-center justify-content-center gap-2 mt-1"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Creating Account...</span>
            </>
          ) : (
            <>
              <UserPlus size={17} />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center small text-secondary mt-4 pt-3 border-top">
        Already have an account?{' '}
        <Link to="/login" className="fw-semibold text-decoration-none">
          Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}
