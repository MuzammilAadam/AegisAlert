import Prediction from "../models/Prediction.js";
import { randomUUID } from "crypto";
import { isDatabaseConnected } from "./database.js";

const memoryPredictions = [];

export async function savePrediction(record) {
  if (isDatabaseConnected()) {
    return Prediction.create(record);
  }

  const memoryRecord = { id: randomUUID(), ...record };
  memoryPredictions.unshift(memoryRecord);
  return memoryRecord;
}

export async function listPredictions(city, limit = 20) {
  if (isDatabaseConnected()) {
    return Prediction.find({ city })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  return memoryPredictions
    .filter((record) => record.city.toLowerCase() === city.toLowerCase())
    .slice(0, limit);
}
