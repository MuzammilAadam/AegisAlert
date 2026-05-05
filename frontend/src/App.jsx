import axios from "axios";
import {
  AlertTriangle,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  MapPin,
  Search,
  ShieldAlert,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const fallbackPrecautions = {
  heatwave: ["Stay hydrated", "Avoid direct sunlight", "Wear light clothing"],
  flood: [
    "Move to higher ground",
    "Avoid walking or driving through water",
    "Keep an emergency kit ready",
  ],
  cyclone: ["Stay indoors", "Secure loose objects", "Follow government alerts"],
  earthquake: [
    "Drop, Cover, and Hold",
    "Stay away from windows",
    "Do not use elevators",
    "Move to open area after shaking stops",
  ],
  general: [
    "Monitor official weather and disaster alerts",
    "Keep phones charged and emergency contacts ready",
    "Avoid unnecessary travel until risk decreases",
  ],
};

function getRiskLevel(probability) {
  if (probability > 70) return "high";
  if (probability >= 40) return "moderate";
  return "low";
}

function getPrecautions(disasterType = "", apiPrecautions = []) {
  if (apiPrecautions.length) return apiPrecautions;

  const normalizedType = disasterType.toLowerCase();
  if (normalizedType.includes("heat")) return fallbackPrecautions.heatwave;
  if (normalizedType.includes("flood")) return fallbackPrecautions.flood;
  if (normalizedType.includes("cyclone")) return fallbackPrecautions.cyclone;
  if (normalizedType.includes("earthquake")) return fallbackPrecautions.earthquake;
  return fallbackPrecautions.general;
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "--";
  return `${value}${suffix}`;
}

export default function App() {
  const [city, setCity] = useState("Solapur");
  const [searchCity, setSearchCity] = useState("Solapur");
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trendData = useMemo(() => {
    return [...history]
      .reverse()
      .map((item) => ({
        time: new Date(item.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        temperature: item.input?.temperature ?? 0,
        humidity: item.input?.humidity ?? 0,
        probability: item.prediction?.disaster_probability ?? 0,
        rainfall: item.input?.rainfall ?? 0,
        wind: item.input?.wind_speed ?? 0,
        seismic: item.input?.seismic_activity_index ?? 0,
      }));
  }, [history]);

  async function fetchPrediction(selectedCity = city) {
    const normalizedCity = selectedCity.trim() || "Solapur";

    setLoading(true);
    setError("");
    try {
      const response = await axios.post(`${API_BASE_URL}/api/predictions`, {
        city: normalizedCity,
      });
      setCity(normalizedCity);
      setSearchCity(normalizedCity);
      setCurrent(response.data);
      await fetchHistory(normalizedCity);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory(selectedCity = city) {
    const response = await axios.get(`${API_BASE_URL}/api/predictions/history`, {
      params: { city: selectedCity, limit: 12 },
    });
    setHistory(response.data.history);
  }

  function handleSubmit(event) {
    event.preventDefault();
    fetchPrediction(searchCity);
  }

  useEffect(() => {
    fetchPrediction("Solapur");
  }, []);

  const probability = current?.prediction?.disaster_probability ?? 0;
  const disasterType = current?.prediction?.disaster_type || "Monitoring";
  const riskLevel = getRiskLevel(probability);
  const isHighRisk = probability > 70;
  const precautions = getPrecautions(disasterType, current?.precautions);

  const metrics = [
    {
      label: "Temperature",
      value: formatNumber(current?.weather?.temperature, " C"),
      detail: `Humidity ${formatNumber(current?.weather?.humidity, "%")}`,
      icon: Thermometer,
      tone: "temp",
    },
    {
      label: "Rainfall",
      value: formatNumber(current?.weather?.rainfall, " mm"),
      detail: "Recent observed rain",
      icon: CloudRain,
      tone: "rain",
    },
    {
      label: "Wind",
      value: formatNumber(current?.weather?.wind_speed, " km/h"),
      detail: `Pressure ${formatNumber(current?.weather?.pressure, " hPa")}`,
      icon: Wind,
      tone: "wind",
    },
    {
      label: "Environment",
      value: formatNumber(current?.environmental?.soil_moisture, "%"),
      detail: `Sea anomaly ${formatNumber(current?.environmental?.sea_level_anomaly, " m")}`,
      icon: Leaf,
      tone: "environment",
    },
    {
      label: "Seismic",
      value: formatNumber(current?.environmental?.seismic_activity_index, "/10"),
      detail: `Stress ${formatNumber(current?.environmental?.tectonic_stress, "/10")}`,
      icon: Waves,
      tone: "seismic",
    },
  ];

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Natural disaster prediction</p>
          <h1>Advanced risk dashboard</h1>
        </div>
        <div className={`risk-pill ${riskLevel}`}>
          <ShieldAlert size={18} />
          {riskLevel} risk
        </div>
      </section>

      <form className="controls-panel" onSubmit={handleSubmit}>
        <label className="control-field city-field">
          <span>City selection</span>
          <div className="input-icon">
            <MapPin size={18} />
            <input
              value={searchCity}
              onChange={(event) => setSearchCity(event.target.value)}
              placeholder="Search any city"
            />
          </div>
        </label>
        <button type="submit" disabled={loading || !searchCity.trim()}>
          <Search size={18} />
          {loading ? "Searching" : "Search"}
        </button>
      </form>

      {error && <div className="error-banner">{error}</div>}

      {isHighRisk && (
        <section className="alert-banner">
          <div className="alert-title">
            <AlertTriangle size={22} />
            High alert for {current?.city || city}
          </div>
          <p>
            {disasterType} probability is {probability}%. Alert emails target{" "}
            {current?.alertedUsers ?? 0} subscribed email recipients.
          </p>
        </section>
      )}

      <section className="summary-grid">
        <article className={`metric-card probability ${riskLevel}`}>
          <div className="metric-top">
            <span>Disaster probability</span>
            <AlertTriangle size={22} />
          </div>
          <strong>{probability}%</strong>
          <p>{disasterType}</p>
          <div className="risk-track">
            <span style={{ width: `${Math.min(100, probability)}%` }} />
          </div>
        </article>

        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="metric-card" key={metric.label}>
              <div className="metric-top">
                <span>{metric.label}</span>
                <span className={`metric-icon ${metric.tone}`}>
                  <Icon size={22} />
                </span>
              </div>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          );
        })}
      </section>

      <section className="dashboard-grid">
        <article className="chart-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current city</p>
              <h2>{current?.city || city}</h2>
            </div>
            <Droplets size={24} />
          </div>

          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="time" stroke="#64748b" tickMargin={10} />
                <YAxis domain={[0, 100]} stroke="#64748b" tickMargin={8} />
                <Tooltip
                  contentStyle={{
                    border: "1px solid #dbe3ee",
                    borderRadius: 8,
                    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.16)",
                  }}
                />
                <Legend verticalAlign="top" height={36} />
                <Line
                  type="monotone"
                  dataKey="probability"
                  name="Probability"
                  stroke="#dc2626"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 7 }}
                />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature"
                  stroke="#ea580c"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="rainfall"
                  name="Rainfall"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="wind"
                  name="Wind"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="seismic"
                  name="Seismic index"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <aside className={`precautions-card ${riskLevel}`}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Precaution suggestions</p>
              <h2>{disasterType}</h2>
            </div>
            <ShieldAlert size={24} />
          </div>
          <div className="subscriber-note">
            <Gauge size={18} />
            Alerts use the separate email subscriber collection.
          </div>
          <ul>
            {precautions.map((precaution) => (
              <li key={precaution}>{precaution}</li>
            ))}
          </ul>
        </aside>
      </section>
    </main>
  );
}
