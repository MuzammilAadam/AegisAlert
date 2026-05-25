import axios from "axios";
import {
  AlertTriangle,
  Bell,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Siren,
  Thermometer,
  User,
  Waves,
  Wind,
  Zap,
  Activity,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const AUTO_REFRESH_INTERVAL = 5000;
const DEMO_ALERTS_ENABLED = import.meta.env.VITE_ENABLE_DEMO_ALERTS !== "false";
const DEMO_ADMIN_EMAILS = String(import.meta.env.VITE_DEMO_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const CITIES = [
  "Solapur", "Mumbai", "Pune", "Delhi", "Bangalore", "Chennai", "Kolkata",
  "Hyderabad", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Nagpur",
  "Guwahati", "Srinagar", "Dehradun", "Shimla", "Kochi", "Visakhapatnam",
  "Bhopal", "Indore", "Chandigarh", "Patna", "Ranchi", "Bhubaneswar",
];

const fallbackPrecautions = {
  heatwave: ["Stay hydrated — drink 3L water daily", "Avoid sun between 11 AM–4 PM", "Wear light-colored clothing"],
  flood: ["Move to higher ground immediately", "Avoid floodwater on foot or in vehicle", "Keep emergency kit ready"],
  cyclone: ["Stay indoors away from windows", "Secure loose objects around home", "Follow official evacuation orders"],
  earthquake: ["Drop, Cover, and Hold On", "Stay away from windows and exterior walls", "Do not use elevators"],
  general: ["Monitor official disaster alerts", "Keep phone charged and contacts ready", "Avoid unnecessary travel"],
};

function getRiskLevel(probability) {
  if (probability > 70) return "high";
  if (probability >= 40) return "moderate";
  return "low";
}

function getPrecautions(disasterType = "", apiPrecautions = []) {
  if (apiPrecautions.length) return apiPrecautions;
  const t = disasterType.toLowerCase();
  if (t.includes("heat")) return fallbackPrecautions.heatwave;
  if (t.includes("flood")) return fallbackPrecautions.flood;
  if (t.includes("cyclone")) return fallbackPrecautions.cyclone;
  if (t.includes("earthquake")) return fallbackPrecautions.earthquake;
  return fallbackPrecautions.general;
}

function fmt(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "--";
  return `${value}${suffix}`;
}

function DisasterIcon({ type }) {
  const t = String(type || "").toLowerCase();
  if (t.includes("heat")) return <span className="disaster-emoji">🔥</span>;
  if (t.includes("flood")) return <span className="disaster-emoji">🌊</span>;
  if (t.includes("cyclone")) return <span className="disaster-emoji">🌀</span>;
  if (t.includes("earthquake")) return <span className="disaster-emoji">⚡</span>;
  return <span className="disaster-emoji">🛡️</span>;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="chart-tooltip">
      <p className="tooltip-time">{label}</p>
      {row.disasterType && <p className="tooltip-type">{row.disasterType}</p>}
      {payload.map((entry) => (
        <div key={entry.dataKey} className="tooltip-row" style={{ color: entry.color }}>
          <span className="tooltip-dot" style={{ background: entry.color }} />
          <span>{entry.name}: <strong>{entry.value}</strong></span>
        </div>
      ))}
    </div>
  );
}

function LivePulseDot() {
  return (
    <span className="live-indicator" title="Live — auto-refreshing every 5s">
      <span className="live-dot" />
      LIVE
    </span>
  );
}

export default function Dashboard() {
  const { user, token, logout, getProfile } = useAuth();
  const navigate = useNavigate();

  const defaultCity = user?.city || "Solapur";
  const [city, setCity]             = useState(defaultCity);
  const [searchCity, setSearchCity] = useState(defaultCity);
  const [current, setCurrent]       = useState(null);
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [silentLoading, setSilentLoading] = useState(false);
  const [error, setError]           = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [demoModeActive, setDemoModeActive] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const intervalRef = useRef(null);
  const demoTimeoutRef = useRef(null);
  const demoModeRef = useRef(false);

  const canRunDemoAlert = useMemo(() => {
    if (!DEMO_ALERTS_ENABLED) return false;
    if (!DEMO_ADMIN_EMAILS.length) return true;

    const email = String(user?.email || "").toLowerCase();
    return DEMO_ADMIN_EMAILS.includes(email);
  }, [user?.email]);

  const trendData = useMemo(() => {
    return [...history].reverse().map((item) => ({
      time: new Date(item.createdAt).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      }),
      temperature: item.input?.temperature ?? 0,
      humidity:    item.input?.humidity ?? 0,
      probability: item.prediction?.disaster_probability ?? 0,
      rainfall:    item.input?.rainfall ?? 0,
      wind:        item.input?.wind_speed ?? 0,
      seismic:     item.input?.seismic_activity_index ?? 0,
      disasterType: item.prediction?.disaster_type || "None",
    }));
  }, [history]);

  const fetchHistory = useCallback(async (selectedCity) => {
    const res = await axios.get(`${API_BASE_URL}/api/predictions/history`, {
      params: { city: selectedCity, limit: 12 },
    });
    setHistory(res.data.history);
  }, []);

  const fetchPrediction = useCallback(async (selectedCity, silent = false) => {
    if (silent && demoModeRef.current) return;

    const normalizedCity = selectedCity.trim() || "Solapur";
    if (silent) setSilentLoading(true);
    else { setLoading(true); setError(""); }

    try {
      const res = await axios.post(`${API_BASE_URL}/api/predictions`, { city: normalizedCity });
      setCurrent(res.data);
      setLastUpdated(new Date());
      await fetchHistory(normalizedCity);
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
      setSilentLoading(false);
    }
  }, [fetchHistory]);

  function handleSubmit(e) {
    e.preventDefault();
    const c = searchCity.trim() || "Solapur";
    if (demoModeRef.current) clearDemoMode(false);
    setCity(c);
  }

  const clearDemoMode = useCallback((refreshRealData = true, targetCity = city) => {
    clearTimeout(demoTimeoutRef.current);
    clearInterval(intervalRef.current);
    demoModeRef.current = false;
    setDemoModeActive(false);

    if (refreshRealData) {
      fetchPrediction(targetCity, false);
      intervalRef.current = setInterval(() => fetchPrediction(targetCity, true), AUTO_REFRESH_INTERVAL);
    }
  }, [city, fetchPrediction]);

  useEffect(() => {
    const latestCity = user?.city?.trim();
    if (!latestCity || demoModeRef.current) return;

    setCity(latestCity);
    setSearchCity(latestCity);
    setCurrent((item) => (item?.isDemo ? null : item));
  }, [user?.city]);

  const handleDemoAlert = useCallback(async () => {
    setDemoLoading(true);
    setError("");

    try {
      await getProfile();
      const res = await axios.post(
        `${API_BASE_URL}/api/predictions/demo-alert`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const demoCity = res.data.city || user?.city || city;
      const demoTtl = Number(res.data.demoExpiresInMs || 45000);

      clearTimeout(demoTimeoutRef.current);
      clearInterval(intervalRef.current);
      demoModeRef.current = true;
      setDemoModeActive(true);
      setCity(demoCity);
      setSearchCity(demoCity);
      setCurrent(res.data);
      setLastUpdated(new Date());
      setHistory((items) => [res.data.record, ...items].slice(0, 12));
      demoTimeoutRef.current = setTimeout(() => clearDemoMode(true, demoCity), demoTtl);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      demoModeRef.current = false;
      setDemoModeActive(false);
    } finally {
      setDemoLoading(false);
    }
  }, [city, clearDemoMode, getProfile, token, user?.city]);

  // Trigger fetch when city changes
  useEffect(() => {
    if (demoModeRef.current) return;

    clearInterval(intervalRef.current);
    fetchPrediction(city, false);
    intervalRef.current = setInterval(() => fetchPrediction(city, true), AUTO_REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [city, fetchPrediction]);

  useEffect(() => {
    return () => clearTimeout(demoTimeoutRef.current);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const probability  = current?.prediction?.disaster_probability ?? 0;
  const disasterType = current?.prediction?.disaster_type || "Monitoring";
  const riskLevel    = getRiskLevel(probability);
  const isHighRisk   = probability > 70;
  const isDemoAlert  = demoModeActive || current?.isDemo;
  const precautions  = getPrecautions(disasterType, current?.precautions);

  const metrics = [
    {
      label: "Temperature",
      value: fmt(current?.weather?.temperature, "°C"),
      detail: `Humidity ${fmt(current?.weather?.humidity, "%")}`,
      icon: Thermometer, tone: "temp",
    },
    {
      label: "Rainfall",
      value: fmt(current?.weather?.rainfall, " mm"),
      detail: "Recent observed rain",
      icon: CloudRain, tone: "rain",
    },
    {
      label: "Wind Speed",
      value: fmt(current?.weather?.wind_speed, " km/h"),
      detail: `Pressure ${fmt(current?.weather?.pressure, " hPa")}`,
      icon: Wind, tone: "wind",
    },
    {
      label: "Soil Moisture",
      value: fmt(current?.environmental?.soil_moisture, "%"),
      detail: `Sea anomaly ${fmt(current?.environmental?.sea_level_anomaly, " m")}`,
      icon: Leaf, tone: "env",
    },
    {
      label: "Seismic Index",
      value: fmt(current?.environmental?.seismic_activity_index, "/10"),
      detail: `Tectonic stress ${fmt(current?.environmental?.tectonic_stress, "/10")}`,
      icon: Activity, tone: "seismic",
    },
  ];

  return (
    <div className="dash-root">
      {/* === SIDEBAR === */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon"><ShieldAlert size={24} /></div>
          <span>AegisAlert</span>
        </div>

        <nav className="sidebar-nav">
          <a className="sidebar-link active" href="#">
            <Gauge size={20} /> Dashboard
          </a>
          <a className="sidebar-link" href="#" onClick={(e) => { e.preventDefault(); navigate("/profile"); }}>
            <User size={20} /> Profile
          </a>
          <a className="sidebar-link" href="#" onClick={(e) => { e.preventDefault(); alert("Coming soon!"); }}>
            <Bell size={20} /> Alerts
          </a>
          <a className="sidebar-link" href="#" onClick={(e) => { e.preventDefault(); alert("Coming soon!"); }}>
            <MapPin size={20} /> Cities
          </a>
        </nav>

        {user && (
          <button className="sidebar-user sidebar-user-button" onClick={() => navigate("/profile")} aria-label="Open profile">
            <div className="sidebar-avatar">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={`${user.name || "User"} profile`} referrerPolicy="no-referrer" />
              ) : (
                <User size={18} />
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user.name || "User"}</span>
              <span className="sidebar-user-city">{user.city || "—"}</span>
            </div>
          </button>
        )}

        <button className="sidebar-logout" onClick={handleLogout}>
          <LogOut size={18} /> Sign out
        </button>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* === MAIN CONTENT === */}
      <main className="dash-main">
        {/* Top Navbar */}
        <header className="dash-topnav">
          <div className="dash-topnav-left">
            <button className="hamburger" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle menu">
              <span /><span /><span />
            </button>
            <div className="topnav-title">
              <p className="eyebrow">Natural Disaster Prediction</p>
              <h1>Advanced Risk Dashboard</h1>
            </div>
          </div>

          <div className="topnav-right">
            <LivePulseDot />
            {lastUpdated && (
              <span className="last-updated">
                <RefreshCw size={14} />
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <div className={`risk-pill ${riskLevel}`}>
              <ShieldAlert size={16} />
              {riskLevel} risk
            </div>
            {isDemoAlert && (
              <div className="demo-mode-pill">
                <Siren size={16} />
                Demo Mode Active
              </div>
            )}
            {silentLoading && <span className="silent-spinner" />}
          </div>
        </header>

        <div className="dash-body">
          {/* Search bar */}
          <form className="search-panel" onSubmit={handleSubmit}>
            <div className="search-field">
              <MapPin size={18} className="search-icon" />
              <input
                id="city-search"
                list="city-suggestions"
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
                placeholder="Search any city…"
              />
              <datalist id="city-suggestions">
                {CITIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <button type="submit" className="search-btn" disabled={loading || !searchCity.trim()}>
              {loading ? <span className="btn-spinner" /> : <Search size={18} />}
              {loading ? "Searching" : "Search"}
            </button>
            {canRunDemoAlert && (
              <button
                type="button"
                className="demo-alert-btn"
                onClick={handleDemoAlert}
                disabled={demoLoading}
              >
                {demoLoading ? <span className="btn-spinner" /> : <Siren size={18} />}
                {demoLoading ? "Starting" : "Run Demo Alert"}
              </button>
            )}
          </form>

          {/* Error */}
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}

          {isDemoAlert && (
            <div className="demo-alert-banner" role="status">
              <Siren size={22} />
              <div>
                <strong>Demo Mode Active</strong>
                <span>
                  Simulated {disasterType} alert for {current?.city || city}. Demo emails are marked as test alerts and sent only to users currently registered in this city.
                </span>
              </div>
            </div>
          )}

          {/* High-risk alert banner */}
          {isHighRisk && (
            <div className="alert-banner">
              <div className="alert-banner-inner">
                <div className="alert-title">
                  <Zap size={20} />
                  High Disaster Alert — {current?.city || city}
                </div>
                <p className="alert-body">
                  <DisasterIcon type={disasterType} />
                  <strong>{disasterType}</strong> probability is{" "}
                  <strong className="prob-highlight">{probability}%</strong>.
                  {isDemoAlert ? (
                    <>
                      Demo emails sent to{" "}
                      <strong>{current?.alertedUsers ?? 0}</strong> registered users in {current?.city || city}.
                    </>
                  ) : (
                    <>
                      Alert emails sent to{" "}
                      <strong>{current?.alertedUsers ?? 0}</strong> registered users in {current?.city || city}.
                    </>
                  )}
                  {current?.alertSuppressed && " (Cooldown active — next alert after 15 min)"}
                </p>
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <section className="metrics-grid" aria-label="Live weather metrics">
            {/* Probability card */}
            <article className={`metric-card probability-card ${riskLevel} ${isDemoAlert ? "demo-pulse" : ""}`}>
              <div className="mc-top">
                <span className="mc-label">Disaster Probability</span>
                <DisasterIcon type={disasterType} />
              </div>
              <strong className="mc-value">{probability}%</strong>
              <p className="mc-detail">{disasterType}</p>
              <div className="risk-track">
                <div
                  className="risk-fill"
                  style={{ width: `${Math.min(100, probability)}%` }}
                />
              </div>
            </article>

            {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
              <article className={`metric-card ${isDemoAlert ? "demo-pulse-soft" : ""}`} key={label}>
                <div className="mc-top">
                  <span className="mc-label">{label}</span>
                  <span className={`mc-icon-wrap ${tone}`}>
                    <Icon size={20} />
                  </span>
                </div>
                <strong className="mc-value">{value}</strong>
                <p className="mc-detail">{detail}</p>
              </article>
            ))}
          </section>

          {/* Chart + Precautions */}
          <section className="dash-grid" aria-label="Trend analysis">
            <article className={`chart-card ${isDemoAlert ? "demo-chart-highlight" : ""}`}>
              <div className="card-header">
                <div>
                  <p className="eyebrow">Monitoring — {current?.city || city}</p>
                  <h2>Trend Analysis</h2>
                </div>
                <Activity size={22} className="header-icon" />
              </div>

              {trendData.length === 0 && !loading ? (
                <div className="chart-empty">
                  <CloudRain size={40} />
                  <p>No trend data yet — first prediction loading…</p>
                </div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trendData}
                      margin={{ top: 10, right: 20, bottom: 5, left: 0 }}
                    >
                      <defs>
                        <linearGradient id="probGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ea580c" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.15)" />
                      <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 11 }} tickMargin={8} />
                      <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} tickMargin={6} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
                      <Area
                        type="monotone" dataKey="probability" name="Probability %"
                        stroke="#dc2626" strokeWidth={2.5} fill="url(#probGrad)"
                        dot={{ r: 3 }} activeDot={{ r: 6 }}
                      />
                      <Area
                        type="monotone" dataKey="temperature" name="Temperature °C"
                        stroke="#ea580c" strokeWidth={2} fill="url(#tempGrad)"
                        dot={{ r: 3 }}
                      />
                      <Area
                        type="monotone" dataKey="humidity" name="Humidity %"
                        stroke="#0284c7" strokeWidth={2} fill="url(#humGrad)"
                        dot={{ r: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </article>

            <aside className={`precautions-card ${riskLevel}`}>
              <div className="card-header">
                <div>
                  <p className="eyebrow">Safety guide</p>
                  <h2>{disasterType}</h2>
                </div>
                <ShieldAlert size={22} className="header-icon" />
              </div>

              <div className={`city-alert-note ${isDemoAlert ? "demo-note" : ""}`}>
                <MapPin size={15} />
                {isDemoAlert ? "Demo emails sent only to users registered in " : "Alerts sent only to users registered in "}
                <strong>{current?.city || city}</strong>
              </div>

              {isHighRisk ? (
                <ul className="precautions-list">
                  {precautions.map((p) => (
                    <li key={p} className="precaution-item">
                      <span className="precaution-bullet" />
                      {p}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted-note">
                  Precautions appear automatically when probability exceeds <strong>70%</strong>.
                </p>
              )}

              {isHighRisk && current?.alertSent && (
                <div className="alert-sent-badge">
                  <Bell size={14} /> Email alerts dispatched!
                </div>
              )}
            </aside>
          </section>

          {/* Stats footer */}
          <footer className="dash-footer">
            <span>AegisAlert · Disaster Prediction System</span>
            <span>Auto-refresh every {AUTO_REFRESH_INTERVAL / 1000}s · City: <strong>{current?.city || city}</strong></span>
          </footer>
        </div>
      </main>
    </div>
  );
}
