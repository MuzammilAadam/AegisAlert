import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, Lock, Mail, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function SetPasswordPage() {
  const { requestSetPassword, confirmSetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleRequestOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await requestSetPassword(email);
      setSuccess(`Password setup code sent to ${email}`);
      setStep(2);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || "Could not send password setup code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await confirmSetPassword(email, otp, password);
      setSuccess("Password created. Redirecting to sign in...");
      setTimeout(() => navigate("/login"), 900);
    } catch (err) {
      setError(err.response?.data?.message || "Could not create password.");
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
            <span className="step-label">Verify</span>
          </div>
          <div className="step-line" />
          <div className={`otp-step ${step >= 2 ? "active" : ""}`}>
            <span className="step-num">2</span>
            <span className="step-label">Password</span>
          </div>
        </div>

        <h2 className="auth-title">{step === 1 ? "Set password" : "Create your password"}</h2>
        <p className="auth-subtitle">
          {step === 1
            ? "For Google or GitHub accounts, verify your email before creating a password"
            : `Use the code sent to ${email}`}
        </p>

        {error && <div className="auth-error"><AlertCircle size={16} />{error}</div>}
        {success && <div className="auth-success"><CheckCircle size={16} />{success}</div>}

        {step === 1 ? (
          <form className="auth-form" onSubmit={handleRequestOtp}>
            <div className="auth-field">
              <label htmlFor="set-password-email">Email address</label>
              <div className="auth-input-wrap">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="set-password-email"
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
              {loading ? "Sending code..." : "Send setup code"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleConfirm}>
            <div className="auth-field">
              <label htmlFor="set-password-otp">Setup code</label>
              <div className="auth-input-wrap otp-input-wrap">
                <input
                  id="set-password-otp"
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
              <label htmlFor="set-password-new">New password</label>
              <div className="auth-input-wrap">
                <Lock size={18} className="auth-input-icon" />
                <input
                  id="set-password-new"
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
              {loading ? "Creating..." : "Create password"}
            </button>
          </form>
        )}

        <div className="otp-actions">
          {step === 2 && (
            <button className="otp-resend-btn" onClick={handleRequestOtp} disabled={loading} type="button">
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
