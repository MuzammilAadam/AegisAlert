import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSendReset(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await forgotPassword(email);
      setSuccess(`Password reset code sent to ${email}`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send reset code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await resetPassword(email, otp, password);
      setSuccess("Password updated. Redirecting to sign in...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err.response?.data?.message || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-overlay" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><ShieldAlert size={28} /></div>
          <div>
            <h1 className="auth-brand">AegisAlert</h1>
            <p className="auth-brand-sub">Disaster Prediction System</p>
          </div>
        </div>

        <div className="otp-steps">
          <div className={`otp-step ${step >= 1 ? "active" : ""}`}>
            <span className="step-num">1</span>
            <span className="step-label">Email</span>
          </div>
          <div className="step-line" />
          <div className={`otp-step ${step >= 2 ? "active" : ""}`}>
            <span className="step-num">2</span>
            <span className="step-label">Reset</span>
          </div>
        </div>

        <h2 className="auth-title">{step === 1 ? "Reset password" : "Set new password"}</h2>
        <p className="auth-subtitle">
          {step === 1 ? "Enter your registered email to receive a reset code" : `Use the code sent to ${email}`}
        </p>

        {error && <div className="auth-error"><AlertCircle size={16} />{error}</div>}
        {success && <div className="auth-success"><CheckCircle size={16} />{success}</div>}

        {step === 1 ? (
          <form className="auth-form" onSubmit={handleSendReset}>
            <div className="auth-field">
              <label htmlFor="forgot-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? "Sending code..." : "Send reset code"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleResetPassword}>
            <div className="auth-field">
              <label htmlFor="reset-otp">Reset code</label>
              <div className="auth-input-wrap otp-input-wrap">
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  className="otp-input"
                  value={otp}
                  onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setError(""); }}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reset-password">New password</label>
              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="reset-password"
                  type={showPw ? "text" : "password"}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="auth-pw-toggle"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading || otp.length < 6}>
              {loading ? <span className="auth-spinner" /> : null}
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        <div className="otp-actions">
          {step === 2 && (
            <button className="otp-resend-btn" onClick={handleSendReset} disabled={loading} type="button">
              Resend code
            </button>
          )}
          <Link className="otp-back-btn" to="/login">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
