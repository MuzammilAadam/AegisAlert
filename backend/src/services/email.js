import nodemailer from "nodemailer";

const precautionMap = {
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
};

export function getPrecautionsForDisaster(disasterType = "") {
  const normalizedType = disasterType.toLowerCase();

  if (normalizedType.includes("heat")) return precautionMap.heatwave;
  if (normalizedType.includes("flood")) return precautionMap.flood;
  if (normalizedType.includes("cyclone")) return precautionMap.cyclone;
  if (normalizedType.includes("earthquake")) return precautionMap.earthquake;

  return [
    "Monitor official weather and disaster alerts",
    "Keep phones charged and emergency contacts ready",
    "Avoid unnecessary travel until risk decreases",
  ];
}

export function parseEmailRecipients(value) {
  const recipients = Array.isArray(value) ? value : String(value || "").split(",");

  return [
    ...new Set(
      recipients
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ),
  ];
}

export async function sendAlertEmail({
  to,
  city,
  disasterType,
  probability,
  weather = {},
  environmental = {},
  precautions = getPrecautionsForDisaster(disasterType),
}) {
  const recipients = parseEmailRecipients(to);

  if (!recipients.length || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Alert skipped because SMTP credentials or recipient are missing.");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject: `Disaster alert for ${city}`,
    text: [
      `High disaster risk detected for ${city}.`,
      `Predicted type: ${disasterType}`,
      `Probability: ${probability}%`,
      "",
      "Weather conditions:",
      `Temperature: ${weather.temperature ?? "N/A"} C`,
      `Humidity: ${weather.humidity ?? "N/A"}%`,
      `Rainfall: ${weather.rainfall ?? "N/A"} mm`,
      `Wind speed: ${weather.wind_speed ?? "N/A"} km/h`,
      `Pressure: ${weather.pressure ?? "N/A"} hPa`,
      `Sea level anomaly: ${environmental.sea_level_anomaly ?? "N/A"} m`,
      `Soil moisture: ${environmental.soil_moisture ?? "N/A"}%`,
      `Seismic activity index: ${environmental.seismic_activity_index ?? "N/A"}`,
      `Tectonic stress: ${environmental.tectonic_stress ?? "N/A"}`,
      `Historical earthquake frequency: ${
        environmental.historical_earthquake_frequency ?? "N/A"
      }`,
      "",
      "Precaution suggestions:",
      ...precautions.map((precaution) => `- ${precaution}`),
    ].join("\n"),
  });

  return true;
}
