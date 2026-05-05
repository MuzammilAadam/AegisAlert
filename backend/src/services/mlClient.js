import axios from "axios";

export async function predictDisaster(input) {
  const baseUrl = process.env.ML_API_URL || "http://localhost:8000";

  try {
    const response = await axios.post(`${baseUrl}/predict`, input, {
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.detail || error.message;
    console.warn(`ML prediction failed, using rule-based fallback: ${message}`);
    return getFallbackPrediction(input);
  }
}

function getFallbackPrediction(input) {
  const heatScore = clamp((input.temperature - 32) * 9 + Math.max(0, 45 - input.humidity) * 0.8);
  const floodScore = clamp(input.rainfall * 2.2 + input.soil_moisture * 0.45);
  const cycloneScore = clamp(input.wind_speed * 1.8 + input.sea_level_anomaly * 120);
  const earthquakeScore = clamp(
    input.seismic_activity_index * 5 +
      input.tectonic_stress * 4.5 +
      input.historical_earthquake_frequency * 3.5
  );
  const scores = {
    heatwave: heatScore,
    flood: floodScore,
    cyclone: cycloneScore,
    earthquake: earthquakeScore,
  };
  const disasterType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const disasterProbability = Math.round(scores[disasterType] * 100) / 100;

  return {
    disaster_probability: disasterProbability,
    disaster_type: disasterProbability < 25 ? "none" : disasterType,
    class_probabilities: scores,
    fallback: true,
  };
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}
