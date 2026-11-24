import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import AuthLayout from '../../components/auth/AuthLayout.jsx';
import { authApi } from '../../services/authApi.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    setFieldError('');
    setResult(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(trimmed);
      setResult(res);
    } catch (err) {
      setServerError(err.message || 'Unable to process recovery request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email associated with your account and we will issue recovery instructions."
    >
      {serverError && (
        <div className="alert alert-danger d-flex align-items-start gap-2 small" role="alert">
          <AlertCircle size={17} className="flex-shrink-0 mt-1" />
          <span>{serverError}</span>
        </div>
      )}

      {result && (
        <div className="alert alert-success small" role="status">
          <div className="d-flex align-items-start gap-2 mb-2">
            <CheckCircle2 size={17} className="flex-shrink-0 mt-1" />
            <div>
              <div className="fw-semibold">Recovery Instructions Issued</div>
              <div>{result.message}</div>
            </div>
          </div>

          {result.resetToken ? (
            <div className="mt-2 p-2 bg-white rounded border text-dark">
              <div className="fw-semibold mb-1">Password Reset Link (Expires in 30 minutes):</div>
              <Link
                to={`/reset-password?token=${encodeURIComponent(result.resetToken)}`}
                className="btn btn-sm btn-ff-primary w-100 mt-1"
              >
                Continue to Reset Password
              </Link>
            </div>
          ) : (
            <div className="mt-2 text-secondary">
              Check your inbox or verify you entered the email used when registering.
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="d-flex flex-column gap-3">
        <div>
          <label htmlFor="forgot-email" className="form-label fw-semibold small">
            Registered Email Address
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            className={`form-control ${fieldError ? 'is-invalid' : ''}`}
            placeholder="name@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldError) setFieldError('');
            }}
          />
          {fieldError && <div className="invalid-feedback">{fieldError}</div>}
        </div>

        <button
          type="submit"
          className="btn btn-ff-primary w-100 d-inline-flex align-items-center justify-content-center gap-2"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Sending Instructions...</span>
            </>
          ) : (
            <>
              <Mail size={17} />
              <span>Send Reset Instructions</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center small mt-4 pt-3 border-top">
        <Link
          to="/login"
          className="text-decoration-none fw-semibold d-inline-flex align-items-center gap-1"
        >
          <ArrowLeft size={15} />
          <span>Back to Sign In</span>
        </Link>
      </div>
    </AuthLayout>
  );
}
