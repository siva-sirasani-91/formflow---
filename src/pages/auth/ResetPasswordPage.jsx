import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { authApi } from '../../services/authApi.js';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlToken = searchParams.get('token') || '';

  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (!token.trim()) {
      errs.token = 'A valid reset code is required. Request one from the Forgot Password page.';
    }
    if (newPassword.length < 8) {
      errs.newPassword = 'Password must be at least 8 characters long.';
    } else if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      errs.newPassword = 'Password must include at least one letter and one number.';
    }
    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password.';
    } else if (confirmPassword !== newPassword) {
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
      const res = await authApi.resetPassword({
        token: token.trim(),
        newPassword,
      });
      setSuccessMsg(res.message || 'Password updated successfully.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1400);
    } catch (err) {
      setServerError(err.message || 'Reset failed. Your reset code may be invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password to secure your FormFlow workspace."
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
          <div>
            <div className="fw-semibold">{successMsg}</div>
            <div>Redirecting to Sign In...</div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
        {!urlToken && (
          <div>
            <label htmlFor="reset-token" className="form-label fw-semibold small">
              Reset Code
            </label>
            <input
              id="reset-token"
              type="text"
              className={`form-control ff-mono small ${fieldErrors.token ? 'is-invalid' : ''}`}
              placeholder="Paste your password reset code"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (fieldErrors.token) setFieldErrors((p) => ({ ...p, token: '' }));
              }}
            />
            {fieldErrors.token && <div className="invalid-feedback">{fieldErrors.token}</div>}
          </div>
        )}

        <div>
          <label htmlFor="reset-new-password" className="form-label fw-semibold small">
            New Password
          </label>
          <div className="input-group">
            <input
              id="reset-new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className={`form-control ${fieldErrors.newPassword ? 'is-invalid' : ''}`}
              placeholder="At least 8 characters with letters and numbers"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (fieldErrors.newPassword) setFieldErrors((p) => ({ ...p, newPassword: '' }));
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
          {fieldErrors.newPassword && (
            <div className="invalid-feedback d-block">{fieldErrors.newPassword}</div>
          )}
        </div>

        <div>
          <label htmlFor="reset-confirm-password" className="form-label fw-semibold small">
            Confirm New Password
          </label>
          <div className="input-group">
            <input
              id="reset-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className={`form-control ${fieldErrors.confirmPassword ? 'is-invalid' : ''}`}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((p) => ({ ...p, confirmPassword: '' }));
                }
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
          disabled={submitting || Boolean(successMsg)}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Updating Password...</span>
            </>
          ) : (
            <>
              <KeyRound size={17} />
              <span>Update Password</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center small text-secondary mt-4 pt-3 border-top">
        Need a new link?{' '}
        <Link to="/forgot-password" className="fw-semibold text-decoration-none">
          Request Reset Code
        </Link>{' '}
        ·{' '}
        <Link to="/login" className="fw-semibold text-decoration-none">
          Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}
