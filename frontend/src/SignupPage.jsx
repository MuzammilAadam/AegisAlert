import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, User, Mail, Lock, MapPin, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";

const CITIES = [
  "Solapur", "Mumbai", "Pune", "Delhi", "Bangalore", "Chennai", "Kolkata",
  "Hyderabad", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Nagpur",
  "Guwahati", "Srinagar", "Dehradun", "Shimla", "Kochi", "Visakhapatnam",
  "Bhopal", "Indore", "Chandigarh", "Patna", "Ranchi", "Bhubaneswar",
];

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate   = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", password: "", city: "" });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.city) { setError("Please select your city."); return; }
    setLoading(true);
    setError("");
    try {
      await signup(form.name, form.email, form.password, form.city);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Please try again.");
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

        <h2 className="auth-title">Create your account</h2>
        <p className="auth-subtitle">Register to receive city-specific disaster alerts</p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
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
            <div className="auth-input-wrap">
              <MapPin size={18} className="auth-input-icon" />
              <select
                id="signup-city"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
              >
                <option value="">— Select your city —</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <span className="auth-spinner" /> : null}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
