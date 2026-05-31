import { getPrecautionsForDisaster } from "./email.js";
import { getEnvironmentalIndicators, getWeatherForCity } from "./weather.js";
import { predictDisaster } from "./mlClient.js";
import { listPredictions, savePrediction } from "./predictionStore.js";
import { normalizeCity } from "./city.js";

const RECENT_PREDICTION_MS = Number(process.env.CHATBOT_RECENT_PREDICTION_MS || 10 * 60 * 1000);

const disasterInfo = {
  flood:
    "Floods happen when water covers normally dry land after intense rainfall, river overflow, storm surge, or poor drainage. Main risks include drowning, electrocution, contaminated water, road collapse, and disease after water recedes.",
  cyclone:
    "Cyclones are rotating storm systems with strong winds, heavy rain, storm surge, and dangerous coastal flooding. The biggest risks are flying debris, structural damage, power failure, and rapid flooding.",
  earthquake:
    "Earthquakes are sudden ground movements caused by stress release along faults. They can damage buildings, roads, gas lines, and power systems, and aftershocks may follow the first tremor.",
  heatwave:
    "Heatwaves are extended periods of unusually high temperature. They increase the risk of dehydration, heat exhaustion, heatstroke, power demand spikes, and stress on elderly people, children, outdoor workers, and people with illness.",
};

const emergencyGuidance = [
  "India emergency number: 112",
  "Ambulance: 108",
  "Fire: 101",
  "Police: 100",
  "Move away from immediate danger, call local emergency services, and share your exact location.",
  "For first aid, check breathing, control bleeding with firm pressure, avoid moving injured people unless the area is unsafe, and keep them warm until help arrives.",
];

const cityAliases = new Map([
  ["bengaluru", "Bangalore"],
  ["bangalore", "Bangalore"],
]);

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function riskLevel(probability) {
  if (probability > 70) return "high";
  if (probability >= 40) return "moderate";
  return "low";
}

function fmt(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "N/A";
  return `${value}${suffix}`;
}

function canonicalCity(city) {
  const normalized = normalizeCity(city);
  return cityAliases.get(normalized.toLowerCase()) || normalized;
}

function extractCity(message, fallbackCity) {
  const text = String(message || "");
  const lower = text.toLowerCase();
  for (const [alias, city] of cityAliases.entries()) {
    if (lower.includes(alias)) return city;
  }

  const patterns = [
    /\bin\s+([a-zA-Z ]{2,40})\??$/i,
    /\bfor\s+([a-zA-Z ]{2,40})\??$/i,
    /\bis\s+([a-zA-Z ]{2,40})\s+(safe|risky|at risk)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return canonicalCity(match[1].replace(/\b(today|now|currently)\b/gi, "").trim());
  }

  return canonicalCity(fallbackCity || "Solapur");
}

function getDisasterType(message, predictionType = "") {
  const text = String(message || "").toLowerCase();
  if (text.includes("flood")) return "flood";
  if (text.includes("cyclone")) return "cyclone";
  if (text.includes("earthquake")) return "earthquake";
  if (text.includes("heatwave") || text.includes("heat wave") || text.includes("heat")) return "heatwave";
  const normalizedPrediction = String(predictionType || "").toLowerCase();
  if (normalizedPrediction.includes("flood")) return "flood";
  if (normalizedPrediction.includes("cyclone")) return "cyclone";
  if (normalizedPrediction.includes("earthquake")) return "earthquake";
  if (normalizedPrediction.includes("heat")) return "heatwave";
  return "general";
}

function getTopFactors(weather = {}, environmental = {}) {
  return [
    { label: "rainfall", value: asNumber(weather.rainfall), text: `${fmt(weather.rainfall, " mm")} rainfall` },
    { label: "humidity", value: asNumber(weather.humidity), text: `${fmt(weather.humidity, "%")} humidity` },
    { label: "wind speed", value: asNumber(weather.wind_speed), text: `${fmt(weather.wind_speed, " km/h")} wind speed` },
    { label: "temperature", value: asNumber(weather.temperature), text: `${fmt(weather.temperature, " C")} temperature` },
    { label: "soil moisture", value: asNumber(environmental.soil_moisture), text: `${fmt(environmental.soil_moisture, "%")} soil moisture` },
    { label: "seismic index", value: asNumber(environmental.seismic_activity_index) * 10, text: `${fmt(environmental.seismic_activity_index, "/10")} seismic index` },
  ]
    .filter((factor) => factor.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

async function getCurrentContext(city) {
  const normalizedCity = canonicalCity(city);
  const [latest] = await listPredictions(normalizedCity, 1);
  const latestTime = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;

  if (latest && Date.now() - latestTime <= RECENT_PREDICTION_MS) {
    const weather = latest.input || {};
    const environmental = latest.input || {};
    return {
      city: normalizedCity,
      weather,
      environmental,
      prediction: latest.prediction || {},
      createdAt: latest.createdAt,
      source: "latest system prediction",
    };
  }

  const weather = await getWeatherForCity(normalizedCity);
  const environmental = getEnvironmentalIndicators(normalizedCity, weather);
  const prediction = await predictDisaster({ ...weather, ...environmental });
  const record = await savePrediction({
    city: normalizedCity,
    input: { ...weather, ...environmental },
    prediction,
    createdAt: new Date(),
  });

  return {
    city: normalizedCity,
    weather,
    environmental,
    prediction,
    createdAt: record.createdAt,
    source: "fresh system prediction",
  };
}

function buildWeatherResponse(context) {
  const { city, weather } = context;
  return `${city} weather now: temperature ${fmt(weather.temperature, " C")}, humidity ${fmt(weather.humidity, "%")}, rainfall ${fmt(weather.rainfall, " mm")}, wind speed ${fmt(weather.wind_speed, " km/h")}, and pressure ${fmt(weather.pressure, " hPa")}.`;
}

function buildRiskResponse(context) {
  const probability = asNumber(context.prediction?.disaster_probability);
  const disasterType = context.prediction?.disaster_type || "disaster";
  const level = riskLevel(probability);
  return `${context.city} currently has a ${level} ${disasterType} risk of ${probability}%. This is based on the ${context.source}.`;
}

function buildExplanationResponse(context) {
  const probability = asNumber(context.prediction?.disaster_probability);
  const disasterType = context.prediction?.disaster_type || "disaster";
  const factors = getTopFactors(context.weather, context.environmental);
  const factorText = factors.length ? factors.map((factor) => factor.text).join(", ") : "the available weather and environmental indicators";
  return `${disasterType} risk is currently ${riskLevel(probability)} at ${probability}% because the strongest contributing signals are ${factorText}.`;
}

function buildAlertResponse(context) {
  const probability = asNumber(context.prediction?.disaster_probability);
  const disasterType = context.prediction?.disaster_type || "disaster";
  const precautions = getPrecautionsForDisaster(disasterType).slice(0, 4);

  if (probability <= 70) {
    return `No active high-risk alert is showing for ${context.city}. Current ${disasterType} probability is ${probability}% (${riskLevel(probability)} risk). Keep monitoring the dashboard for updates.`;
  }

  return [
    `Active alert condition for ${context.city}: ${disasterType} risk is ${probability}%.`,
    `Recommended precautions: ${precautions.join("; ")}.`,
  ].join(" ");
}

export async function buildAssistantReply({ message, userCity }) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();
  const city = extractCity(text, userCity);
  const needsContext =
    lower.includes("safe") ||
    lower.includes("risk") ||
    lower.includes("probability") ||
    lower.includes("weather") ||
    lower.includes("temperature") ||
    lower.includes("humidity") ||
    lower.includes("rainfall") ||
    lower.includes("wind") ||
    lower.includes("alert") ||
    lower.includes("predicted") ||
    lower.includes("why") ||
    lower.includes("my city");

  const context = needsContext ? await getCurrentContext(city) : null;

  if (lower.includes("emergency") || lower.includes("first aid") || lower.includes("number")) {
    return { city, reply: `Emergency information: ${emergencyGuidance.join("; ")}.` };
  }

  if (lower.includes("precaution") || lower.includes("safety") || lower.includes("guidance")) {
    const type = getDisasterType(text, context?.prediction?.disaster_type);
    const precautions = getPrecautionsForDisaster(type).join("; ");
    return { city, reply: `${type === "general" ? "General disaster" : type} precautions: ${precautions}.` };
  }

  if (lower.includes("flood") || lower.includes("cyclone") || lower.includes("earthquake") || lower.includes("heatwave") || lower.includes("heat wave")) {
    const type = getDisasterType(text, context?.prediction?.disaster_type);
    return { city, reply: disasterInfo[type] || disasterInfo.heatwave };
  }

  if (context && (lower.includes("weather") || lower.includes("temperature") || lower.includes("humidity") || lower.includes("rainfall") || lower.includes("wind"))) {
    return { city: context.city, reply: buildWeatherResponse(context) };
  }

  if (context && lower.includes("alert")) {
    return { city: context.city, reply: buildAlertResponse(context) };
  }

  if (context && (lower.includes("why") || lower.includes("factor") || lower.includes("contributed") || lower.includes("predicted"))) {
    return { city: context.city, reply: buildExplanationResponse(context) };
  }

  if (context && (lower.includes("safe") || lower.includes("risk") || lower.includes("probability") || lower.includes("my city"))) {
    return { city: context.city, reply: buildRiskResponse(context) };
  }

  return {
    city,
    reply:
      "I can help with current city risk, live weather, active alerts, disaster precautions, emergency contacts, and prediction explanations. Try asking: Is my city safe? or Why was this disaster predicted?",
  };
}
