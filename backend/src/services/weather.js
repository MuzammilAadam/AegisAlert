import axios from "axios";

const citySeeds = {
  solapur: { lat: 17.6599, lon: 75.9064, baselineTemp: 36 },
  mumbai: { lat: 19.076, lon: 72.8777, baselineTemp: 31 },
  chennai: { lat: 13.0827, lon: 80.2707, baselineTemp: 33 },
  kolkata: { lat: 22.5726, lon: 88.3639, baselineTemp: 32 },
};

export async function getWeatherForCity(city) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return getMockWeather(city);
  }

  const response = await axios.get("https://api.openweathermap.org/data/2.5/weather", {
    params: {
      q: city,
      appid: apiKey,
      units: "metric",
    },
    timeout: 8000,
  });

  const data = response.data;
  return {
    temperature: data.main.temp,
    humidity: data.main.humidity,
    rainfall: data.rain?.["1h"] || data.rain?.["3h"] || 0,
    wind_speed: Math.round((data.wind.speed || 0) * 3.6 * 100) / 100,
    pressure: data.main.pressure,
  };
}

export function getEnvironmentalIndicators(city, weather) {
  const normalizedCity = city.toLowerCase();
  const coastalCity = ["mumbai", "chennai", "kolkata", "kochi", "visakhapatnam"].includes(
    normalizedCity
  );
  const seismic = getSeismicIndicators(normalizedCity);

  return {
    sea_level_anomaly: coastalCity
      ? round(0.15 + weather.wind_speed / 300 + weather.rainfall / 1000)
      : round(0.02 + weather.rainfall / 2000),
    soil_moisture: Math.min(100, round(25 + weather.humidity * 0.45 + weather.rainfall * 0.35)),
    ...seismic,
  };
}

function getSeismicIndicators(normalizedCity) {
  const seismicProfiles = {
    guwahati: { seismic_activity_index: 8.4, tectonic_stress: 8.1, historical_earthquake_frequency: 7.8 },
    srinagar: { seismic_activity_index: 8.1, tectonic_stress: 8.3, historical_earthquake_frequency: 7.4 },
    dehradun: { seismic_activity_index: 7.3, tectonic_stress: 7.6, historical_earthquake_frequency: 6.8 },
    shimla: { seismic_activity_index: 7.6, tectonic_stress: 7.8, historical_earthquake_frequency: 7.1 },
    delhi: { seismic_activity_index: 5.6, tectonic_stress: 5.9, historical_earthquake_frequency: 4.7 },
  };

  if (seismicProfiles[normalizedCity]) return seismicProfiles[normalizedCity];

  const hash = [...normalizedCity].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    seismic_activity_index: round(1.4 + (hash % 28) / 10),
    tectonic_stress: round(1.8 + (hash % 24) / 10),
    historical_earthquake_frequency: round(0.8 + (hash % 18) / 10),
  };
}

function getMockWeather(city) {
  const seed = citySeeds[city.toLowerCase()] || citySeeds.solapur;
  const hour = new Date().getHours();
  const dayWave = Math.sin((hour / 24) * Math.PI * 2);
  const rainfall = city.toLowerCase() === "solapur" ? 4 : 28;

  return {
    temperature: round(seed.baselineTemp + dayWave * 4),
    humidity: round(48 - dayWave * 8),
    rainfall,
    wind_speed: round(14 + Math.abs(dayWave) * 8),
    pressure: round(1007 - Math.max(0, rainfall - 20) / 5),
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
