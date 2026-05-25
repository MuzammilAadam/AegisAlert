import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { getPrecautionsForDisaster, parseEmailRecipients, sendAlertEmail } from "../services/email.js";
import { getEnvironmentalIndicators, getWeatherForCity } from "../services/weather.js";
import { predictDisaster } from "../services/mlClient.js";
import { savePrediction, listPredictions } from "../services/predictionStore.js";
import { cityFilter, normalizeCity } from "../services/city.js";
import { isDatabaseConnected } from "../services/database.js";

const router = Router();
const ALERT_THRESHOLD = 70;
const ALERT_COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MS || 15 * 60 * 1000);
const JWT_SECRET = process.env.JWT_SECRET || "aegisalert_super_secret_key";
const recentAlerts = new Map();
const DEMO_ALERT_PAYLOAD = {
  disasterType: "Flood",
  probability: 92,
  temperature: 39,
  humidity: 88,
  rainfall: 240,
  windSpeed: 70,
  pressure: 995,
};

function alertKey(city, disasterType) {
  return `${city.toLowerCase()}::${String(disasterType || "unknown").toLowerCase()}`;
}

function shouldSendAlert(city, disasterType, now = Date.now()) {
  const key = alertKey(city, disasterType);
  const lastSentAt = recentAlerts.get(key) || 0;

  if (now - lastSentAt < ALERT_COOLDOWN_MS) {
    return false;
  }

  recentAlerts.set(key, now);
  return true;
}

function buildDemoAlert(city) {
  const alertCity = normalizeCity(city);
  const weather = {
    temperature: DEMO_ALERT_PAYLOAD.temperature,
    humidity: DEMO_ALERT_PAYLOAD.humidity,
    rainfall: DEMO_ALERT_PAYLOAD.rainfall,
    wind_speed: DEMO_ALERT_PAYLOAD.windSpeed,
    pressure: DEMO_ALERT_PAYLOAD.pressure,
  };
  const environmental = {
    sea_level_anomaly: 0.6,
    soil_moisture: 94,
    seismic_activity_index: 2,
    tectonic_stress: 3,
  };
  const prediction = {
    disaster_type: DEMO_ALERT_PAYLOAD.disasterType,
    disaster_probability: DEMO_ALERT_PAYLOAD.probability,
  };

  return {
    city: alertCity,
    weather,
    environmental,
    prediction,
    precautions: getPrecautionsForDisaster(prediction.disaster_type),
    isDemo: true,
    demoExpiresInMs: Number(process.env.DEMO_ALERT_TTL_MS || 45 * 1000),
  };
}

async function getLoggedInUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    const error = new Error("Please log in to run a demo alert.");
    error.status = 401;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch {
    const error = new Error("Your session is invalid or expired. Please log in again.");
    error.status = 401;
    throw error;
  }
  const user = isDatabaseConnected()
    ? await User.findById(decoded.userId).lean()
    : null;

  if (!user?.isVerified || !user.email) {
    const error = new Error("Logged-in user could not be verified.");
    error.status = 401;
    throw error;
  }

  if (!normalizeCity(user.city)) {
    const error = new Error("Please update your profile city before running a demo alert.");
    error.status = 400;
    throw error;
  }

  return user;
}

router.post("/", async (req, res, next) => {
  try {
    const city = normalizeCity(req.body.city, "Solapur");

    const weather = await getWeatherForCity(city);
    const environmental = getEnvironmentalIndicators(city, weather);
    const input = { ...weather, ...environmental };
    const prediction = await predictDisaster(input);
    const precautions = getPrecautionsForDisaster(prediction.disaster_type);

    const record = await savePrediction({
      city,
      input,
      prediction,
      createdAt: new Date(),
    });

    let alertSent = false;
    let alertedUsers = 0;
    let alertSuppressed = false;
    if (prediction.disaster_probability > ALERT_THRESHOLD) {
      const cityUsers = isDatabaseConnected()
        ? await User.find({ ...cityFilter(city), isVerified: true }).lean()
        : [];
      const alertRecipients = parseEmailRecipients(cityUsers.map((user) => user.email));
      alertedUsers = alertRecipients.length;

      if (shouldSendAlert(city, prediction.disaster_type)) {
        alertSent = await sendAlertEmail({
          to: alertRecipients,
          city,
          disasterType: prediction.disaster_type,
          probability: prediction.disaster_probability,
          weather,
          environmental,
          precautions,
        });
      } else {
        alertSuppressed = true;
      }
    }

    res.json({
      city,
      weather,
      environmental,
      prediction,
      precautions,
      alertSent,
      alertSuppressed,
      alertedUsers,
      record,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/demo-alert", async (req, res, next) => {
  try {
    const loggedInUser = await getLoggedInUser(req);
    const city = normalizeCity(loggedInUser.city);
    const demoAlert = buildDemoAlert(city);
    const cityUsers = await User.find({ ...cityFilter(city), isVerified: true }).lean();
    const alertRecipients = parseEmailRecipients(cityUsers.map((user) => user.email));

    const alertSent = await sendAlertEmail({
      to: alertRecipients,
      city: demoAlert.city,
      disasterType: demoAlert.prediction.disaster_type,
      probability: demoAlert.prediction.disaster_probability,
      weather: demoAlert.weather,
      environmental: demoAlert.environmental,
      precautions: demoAlert.precautions,
      isDemo: true,
    });

    res.json({
      ...demoAlert,
      alertSent,
      alertSuppressed: false,
      alertedUsers: alertRecipients.length,
      record: {
        id: `demo-${Date.now()}`,
        city: demoAlert.city,
        input: { ...demoAlert.weather, ...demoAlert.environmental },
        prediction: demoAlert.prediction,
        createdAt: new Date(),
        isDemo: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const city = normalizeCity(req.query.city, "Solapur");
    const requestedLimit = Number(req.query.limit || 20);
    const limit = Math.min(Math.max(requestedLimit || 20, 1), 100);
    const history = await listPredictions(city, limit);
    res.json({ city, history });
  } catch (error) {
    next(error);
  }
});

export default router;
