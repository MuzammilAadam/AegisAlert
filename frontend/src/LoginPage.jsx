import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldAlert, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle, ArrowLeft, Github, Chrome } from "lucide-react";
import { useAuth } from "./AuthContext";

// ── Step indicator ──────────────────────────────
function Steps({ step }) {
  return (
    <div className="otp-steps">
      <div className={`otp-step ${step >= 1 ? "active" : ""}`}>
        <span className="step-num">1</span>
        <span className="step-label">Credentials</span>
      </div>
      <div className="step-line" />
      <div className={`otp-step ${step >= 2 ? "active" : ""}`}>
        <span className="step-num">2</span>
        <span className="step-label">Verify OTP</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { loginSendOtp, loginVerifyOtp, startOAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep]         = useState(1);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp]           = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(searchParams.get("error") || "");
  const [success, setSuccess]   = useState("");

  // Step 1 — send OTP
  async function handleSendOtp(e) {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      await loginSendOtp(email, password);
      setSuccess(`Verification code sent to ${email}`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send code. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2 — verify OTP
  async function handleVerifyOtp(e) {
    e.preventDefault();
    setLoading(true); setError(""); setSuccess("");
    try {
      await loginVerifyOtp(email, otp);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true); setError(""); setSuccess("");
    try {
      await loginSendOtp(email, password);
      setSuccess("New code sent! Check your inbox.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-bg-overlay" />
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon"><ShieldAlert size={28} /></div>
          <div>
            <h1 className="auth-brand">AegisAlert</h1>
            <p className="auth-brand-sub">Disaster Prediction System</p>
          </div>
        </div>

        <Steps step={step} />

        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <h2 className="auth-title">Welcome back</h2>
            <p className="auth-subtitle">Sign in to access your dashboard</p>

            {error   && <div className="auth-error"><AlertCircle size={16}/>{error}</div>}
            {success && <div className="auth-success"><CheckCircle size={16}/>{success}</div>}

            <div className="oauth-grid">
              <button type="button" className="oauth-btn" onClick={() => startOAuth("google")} disabled={loading}>
                <Chrome size={18} /> Google
              </button>
              <button type="button" className="oauth-btn" onClick={() => startOAuth("github")} disabled={loading}>
                <Github size={18} /> GitHub
              </button>
            </div>

            <div className="auth-divider"><span>or continue with email</span></div>

            <form className="auth-form" onSubmit={handleSendOtp}>
              <div className="auth-field">
                <label htmlFor="login-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-input-icon"/>
                  <input id="login-email" type="email" placeholder="you@example.com"
                    value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    required autoComplete="email"/>
                </div>
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label htmlFor="login-pw">Password</label>
                  <Link to="/forgot-password">Forgot Password?</Link>
                </div>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon"/>
                  <input id="login-pw" type={showPw ? "text" : "password"} placeholder="Your password"
                    value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    required autoComplete="current-password"/>
                  <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)}>
                    {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="auth-spinner"/> : null}
                {loading ? "Sending code…" : "Send verification code"}
              </button>
            </form>

            <p className="auth-secondary-action">
              Used Google or GitHub before? <Link to="/set-password">Set a password</Link>
            </p>
          </>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <>
            <h2 className="auth-title">Check your inbox</h2>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            {error   && <div className="auth-error"><AlertCircle size={16}/>{error}</div>}
            {success && <div className="auth-success"><CheckCircle size={16}/>{success}</div>}

            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <div className="auth-field">
                <label htmlFor="login-otp">Verification code</label>
                <div className="auth-input-wrap otp-input-wrap">
                  <input id="login-otp" type="text" inputMode="numeric" maxLength={6}
                    placeholder="000000" className="otp-input"
                    value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g,"")); setError(""); }}
                    required autoFocus/>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading || otp.length < 6}>
                {loading ? <span className="auth-spinner"/> : null}
                {loading ? "Verifying…" : "Verify & Sign in"}
              </button>
            </form>

            <div className="otp-actions">
              <button className="otp-resend-btn" onClick={handleResend} disabled={loading} type="button">
                Resend code
              </button>
              <button className="otp-back-btn" onClick={() => { setStep(1); setOtp(""); setError(""); }} type="button">
                <ArrowLeft size={14}/> Change email
              </button>
            </div>
          </>
        )}

        <p className="auth-switch">
          Don't have an account? <Link to="/signup">Create one</Link>
        </p>
      </div>
    </div>
  );
}
