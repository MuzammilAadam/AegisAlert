import { Router } from "express";
import { getPrecautionsForDisaster, parseEmailRecipients, sendAlertEmail } from "../services/email.js";
import { getEnvironmentalIndicators, getWeatherForCity } from "../services/weather.js";
import { predictDisaster } from "../services/mlClient.js";
import { savePrediction, listPredictions } from "../services/predictionStore.js";
import { listSubscribedEmailRecipients } from "../services/emailSubscriberStore.js";

const router = Router();
const ALERT_THRESHOLD = 70;

router.post("/", async (req, res, next) => {
  try {
    const city = req.body.city || "Solapur";

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
    if (prediction.disaster_probability >= ALERT_THRESHOLD) {
      const subscribedEmailRecipients = await listSubscribedEmailRecipients();
      const alertRecipients = parseEmailRecipients([
        ...subscribedEmailRecipients.map((subscriber) => subscriber.email),
        ...parseEmailRecipients(process.env.ALERT_EMAIL_TO),
      ]);
      alertedUsers = alertRecipients.length;
      alertSent = await sendAlertEmail({
        to: alertRecipients,
        city,
        disasterType: prediction.disaster_type,
        probability: prediction.disaster_probability,
        weather,
        environmental,
        precautions,
      });
    }

    res.json({
      city,
      weather,
      environmental,
      prediction,
      precautions,
      alertSent,
      alertedUsers,
      record,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/history", async (req, res, next) => {
  try {
    const city = req.query.city || "Solapur";
    const limit = Number(req.query.limit || 20);
    const history = await listPredictions(city, limit);
    res.json({ city, history });
  } catch (error) {
    next(error);
  }
});

export default router;
