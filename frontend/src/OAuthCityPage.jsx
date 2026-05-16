import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Select from "react-select";
import { AlertCircle, CheckCircle, MapPin, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";
import { searchCityOptions } from "./cities";

export default function OAuthCityPage() {
  const { completeOAuthCity } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [cityOption, setCityOption] = useState(null);
  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!cityOption?.value) {
      setError("Please select your city.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await completeOAuthCity(cityOption.value, token);
      setSuccess("City saved. Opening dashboard...");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Could not save your city.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="auth-screen">
      <div className="auth-bg-overlay" />
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><ShieldAlert size={28} /></div>
          <div>
            <h1 className="auth-brand">AegisAlert</h1>
            <p className="auth-brand-sub">Complete social registration</p>
          </div>
        </div>

        <h2 className="auth-title">Select your city</h2>
        <p className="auth-subtitle">City-based disaster alerts need your current registration city</p>

        {error && <div className="auth-error"><AlertCircle size={16} />{error}</div>}
        {success && <div className="auth-success"><CheckCircle size={16} />{success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="oauth-city">Your city</label>
            <div className="auth-select-wrap">
              <MapPin size={18} className="auth-input-icon auth-select-icon" />
              <Select
                inputId="oauth-city"
                classNamePrefix="city-select"
                value={cityOption}
                onChange={(option) => {
                  setCityOption(option);
                  setError("");
                }}
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

          <button type="submit" className="auth-submit-btn" disabled={loading || !cityOption?.value}>
            {loading ? <span className="auth-spinner" /> : null}
            {loading ? "Saving..." : "Continue to dashboard"}
          </button>
        </form>
      </div>
    </div>
  );
}
