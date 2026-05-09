import { Router } from "express";
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
const recentAlerts = new Map();

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
        ? await User.find(cityFilter(city)).lean()
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
