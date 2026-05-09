import Prediction from "../models/Prediction.js";
import { randomUUID } from "crypto";
import { cityFilter, normalizeCity } from "./city.js";
import { isDatabaseConnected } from "./database.js";

const memoryPredictions = [];
const MAX_MEMORY_PREDICTIONS = 500;

export async function savePrediction(record) {
  if (isDatabaseConnected()) {
    return Prediction.create(record);
  }

  const memoryRecord = { id: randomUUID(), ...record };
  memoryPredictions.unshift(memoryRecord);
  memoryPredictions.splice(MAX_MEMORY_PREDICTIONS);
  return memoryRecord;
}

export async function listPredictions(city, limit = 20) {
  const normalizedCity = normalizeCity(city);

  if (isDatabaseConnected()) {
    return Prediction.find(cityFilter(normalizedCity))
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  return memoryPredictions
    .filter((record) => record.city.toLowerCase() === normalizedCity.toLowerCase())
    .slice(0, limit);
}
