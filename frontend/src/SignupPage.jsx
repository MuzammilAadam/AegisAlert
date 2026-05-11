import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Select from "react-select";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  ShieldAlert,
  User,
} from "lucide-react";
import { useAuth } from "./AuthContext";
import { searchCityOptions } from "./cities";

function Steps({ step }) {
  return (
    <div className="otp-steps">
      <div className={`otp-step ${step >= 1 ? "active" : ""}`}>
        <span className="step-num">1</span>
        <span className="step-label">Account</span>
      </div>
      <div className="step-line" />
      <div className={`otp-step ${step >= 2 ? "active" : ""}`}>
        <span className="step-num">2</span>
        <span className="step-label">Verify OTP</span>
      </div>
    </div>
  );
}

export default function SignupPage() {
  const { signupSendOtp, signupVerifyOtp } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", city: "" });
  const [cityOption, setCityOption] = useState(null);
  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    setCitiesLoading(true);

    searchCityOptions(cityInput)
      .then((options) => {
        if (active) setCityOptions(options);
      })
      .catch(() => {
        if (active) setCityOptions([]);
      })
      .finally(() => {
        if (active) setCitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cityInput]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  function handleCityChange(option) {
    setCityOption(option);
    setForm((prev) => ({ ...prev, city: option?.value || "" }));
    setError("");
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    if (!form.city) {
      setError("Please select your city.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await signupSendOtp(form.name, form.email, form.password, form.city);
      setSuccess(`Verification code sent to ${form.email}`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await signupVerifyOtp(form.email, otp);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired code. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await signupSendOtp(form.name, form.email, form.password, form.city);
      setSuccess("New code sent. Check your inbox.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code.");
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

        <Steps step={step} />

        {step === 1 && (
          <>
            <h2 className="auth-title">Create your account</h2>
            <p className="auth-subtitle">Register to receive city-specific disaster alerts</p>

            {error && <div className="auth-error"><AlertCircle size={16} />{error}</div>}
            {success && <div className="auth-success"><CheckCircle size={16} />{success}</div>}

            <form className="auth-form" onSubmit={handleSendOtp}>
              <div className="auth-field">
                <label htmlFor="signup-name">Full name</label>
                <div className="auth-input-wrap">
                  <User size={18} className="auth-input-icon" />
                  <input
                    id="signup-name"
                    type="text"
                    name="name"
                    placeholder="Your full name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="signup-email">Email address</label>
                <div className="auth-input-wrap">
                  <Mail size={18} className="auth-input-icon" />
                  <input
                    id="signup-email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="signup-password">Password</label>
                <div className="auth-input-wrap">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    id="signup-password"
                    type={showPw ? "text" : "password"}
                    name="password"
                    placeholder="At least 6 characters"
                    value={form.password}
                    onChange={handleChange}
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

              <div className="auth-field">
                <label htmlFor="signup-city">Your city</label>
                <div className="auth-select-wrap">
                  <MapPin size={18} className="auth-input-icon auth-select-icon" />
                  <Select
                    inputId="signup-city"
                    classNamePrefix="city-select"
                    value={cityOption}
                    onChange={handleCityChange}
                    onInputChange={(value, meta) => {
                      if (meta.action === "input-change") setCityInput(value);
                    }}
                    options={cityOptions}
                    placeholder="Search any city worldwide"
                    isLoading={citiesLoading}
                    noOptionsMessage={({ inputValue }) =>
                      inputValue.length < 2 ? "Loading popular cities" : "No cities found"
                    }
                    isClearable
                    isSearchable
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? <span className="auth-spinner" /> : null}
                {loading ? "Sending code..." : "Send verification code"}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="auth-title">Verify your email</h2>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{form.email}</strong>
            </p>

            {error && <div className="auth-error"><AlertCircle size={16} />{error}</div>}
            {success && <div className="auth-success"><CheckCircle size={16} />{success}</div>}

            <form className="auth-form" onSubmit={handleVerifyOtp}>
              <div className="auth-field">
                <label htmlFor="signup-otp">Verification code</label>
                <div className="auth-input-wrap otp-input-wrap">
                  <input
                    id="signup-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    className="otp-input"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ""));
                      setError("");
                    }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading || otp.length < 6}>
                {loading ? <span className="auth-spinner" /> : null}
                {loading ? "Verifying..." : "Verify & Create account"}
              </button>
            </form>

            <div className="otp-actions">
              <button className="otp-resend-btn" onClick={handleResend} disabled={loading} type="button">
                Resend code
              </button>
              <button
                className="otp-back-btn"
                onClick={() => {
                  setStep(1);
                  setOtp("");
                  setError("");
                }}
                type="button"
              >
                <ArrowLeft size={14} /> Edit details
              </button>
            </div>
          </>
        )}

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
