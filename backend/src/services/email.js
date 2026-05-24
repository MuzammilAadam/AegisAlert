import nodemailer from "nodemailer";

const precautionMap = {
  heatwave: [
    "Stay hydrated — drink at least 3 litres of water daily",
    "Avoid direct sunlight between 11 AM – 4 PM",
    "Wear light-colored, loose-fitting clothing",
    "Never leave children or pets in parked vehicles",
    "Use fans, air conditioning, or cool damp cloths",
  ],
  flood: [
    "Move to higher ground immediately if flooding begins",
    "Avoid walking or driving through floodwater",
    "Keep an emergency kit ready (torch, water, first aid)",
    "Turn off electricity at the main switch if safe to do so",
    "Follow instructions from local authorities",
  ],
  cyclone: [
    "Stay indoors and away from windows and doors",
    "Secure all loose objects around your home",
    "Fill containers with clean water and store food",
    "Keep battery-powered radio for official updates",
    "Evacuate if authorities issue an evacuation order",
  ],
  earthquake: [
    "Drop, Cover, and Hold On — get under sturdy furniture",
    "Stay away from windows, exterior walls, and doors",
    "Do not use elevators during or after shaking",
    "Move to open area once shaking stops",
    "Check for gas leaks and structural damage before re-entering",
  ],
};

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
    "Stock emergency supplies: food, water, first-aid kit",
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

function getRiskColor(probability) {
  if (probability > 70) return "#dc2626";
  if (probability >= 40) return "#d97706";
  return "#16a34a";
}

function getRiskLabel(probability) {
  if (probability > 70) return "HIGH RISK";
  if (probability >= 40) return "MODERATE RISK";
  return "LOW RISK";
}

export async function sendAlertEmail({
  to,
  city,
  disasterType,
  probability,
  weather = {},
  environmental = {},
  precautions = getPrecautionsForDisaster(disasterType),
  isDemo = false,
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

  const safeCity = escapeHtml(city);
  const safeDisasterType = escapeHtml(disasterType);
  const safeProbability = escapeHtml(probability);
  const riskColor = getRiskColor(probability);
  const riskLabel = getRiskLabel(probability);
  const titlePrefix = isDemo ? "Demo/Test " : "";
  const demoNotice = isDemo
    ? `
              <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:16px 20px; margin-bottom:22px;">
                <p style="margin:0; color:#9a3412; font-size:14px; font-weight:700;">
                  This is a demo/test disaster alert for presentation and system testing only. No real emergency has been confirmed.
                </p>
              </div>`
    : "";

  const precautionItems = precautions
    .map(
      (p) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9;">
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${riskColor}; margin-right:10px; vertical-align:middle;"></span>
          <span style="color:#334155; font-size:14px;">${escapeHtml(p)}</span>
        </td>
      </tr>`
    )
    .join("");

  const weatherRows = [
    ["🌡️ Temperature", `${weather.temperature ?? "N/A"} °C`],
    ["💧 Humidity",    `${weather.humidity ?? "N/A"}%`],
    ["🌧️ Rainfall",   `${weather.rainfall ?? "N/A"} mm`],
    ["💨 Wind Speed",  `${weather.wind_speed ?? "N/A"} km/h`],
    ["📊 Pressure",    `${weather.pressure ?? "N/A"} hPa`],
    ["🌊 Sea Level Anomaly", `${environmental.sea_level_anomaly ?? "N/A"} m`],
    ["🪨 Soil Moisture",     `${environmental.soil_moisture ?? "N/A"}%`],
    ["📡 Seismic Index",     `${environmental.seismic_activity_index ?? "N/A"}`],
  ]
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 14px; color:#64748b; font-size:13px; width:50%;">${escapeHtml(label)}</td>
        <td style="padding:8px 14px; color:#0f172a; font-weight:600; font-size:13px;">${escapeHtml(value)}</td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titlePrefix}Disaster Alert - ${safeCity}</title>
</head>
<body style="margin:0; padding:0; background:#f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9; padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius:16px 16px 0 0; padding:32px 32px 28px; text-align:center;">
              <div style="display:inline-block; background:${riskColor}; color:white; font-size:11px; font-weight:800; letter-spacing:2px; text-transform:uppercase; padding:6px 14px; border-radius:20px; margin-bottom:16px;">${riskLabel}</div>
              <h1 style="margin:0; color:white; font-size:28px; font-weight:800; line-height:1.2;">⚠️ ${titlePrefix}Disaster Alert</h1>
              <p style="margin:10px 0 0; color:#94a3b8; font-size:16px;">AegisAlert Early Warning System</p>
            </td>
          </tr>

          <!-- City & Type Banner -->
          <tr>
            <td style="background:${riskColor}; padding:20px 32px; text-align:center;">
              <h2 style="margin:0; color:white; font-size:22px; font-weight:700;">📍 ${safeCity}</h2>
              <p style="margin:8px 0 0; color:rgba(255,255,255,0.9); font-size:15px;">
                Predicted: <strong>${safeDisasterType}</strong> — Probability: <strong>${safeProbability}%</strong>
              </p>
            </td>
          </tr>

          <!-- Body Card -->
          <tr>
            <td style="background:white; padding:32px; border-radius:0 0 16px 16px; box-shadow: 0 4px 32px rgba(0,0,0,0.08);">

              <!-- Risk Indicator -->
              ${demoNotice}
              <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:12px; padding:16px 20px; margin-bottom:28px;">
                <p style="margin:0; color:#7f1d1d; font-size:14px; font-weight:600;">
                  🚨 Disaster probability has exceeded the <strong>70% critical threshold</strong> for <strong>${safeCity}</strong>. Immediate precautions are strongly advised.
                </p>
              </div>

              <!-- Weather Conditions -->
              <h3 style="margin:0 0 14px; color:#0f172a; font-size:17px; font-weight:700; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">🌤️ Current Weather Conditions</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:28px;">
                ${weatherRows}
              </table>

              <!-- Safety Precautions -->
              <h3 style="margin:0 0 14px; color:#0f172a; font-size:17px; font-weight:700; border-bottom:2px solid #f1f5f9; padding-bottom:10px;">🛡️ Safety Precautions</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; margin-bottom:28px;">
                ${precautionItems}
              </table>

              <!-- Footer Note -->
              <div style="background:#f8fafc; border-radius:10px; padding:16px 20px; text-align:center;">
                <p style="margin:0; color:#64748b; font-size:13px; line-height:1.6;">
                  You are receiving this alert because you registered in <strong>${safeCity}</strong> on AegisAlert.<br />
                  Stay safe and follow official government instructions.
                </p>
              </div>
            </td>
          </tr>

          <!-- Email Footer -->
          <tr>
            <td style="padding:20px 0; text-align:center;">
              <p style="margin:0; color:#94a3b8; font-size:12px;">
                © 2026 AegisAlert Disaster Prediction System · Automated early-warning alert
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"AegisAlert ⚠️" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: recipients,
    subject: `${isDemo ? "[DEMO/TEST] " : ""}⚠️ [${riskLabel}] Disaster Alert for ${city} — ${disasterType} ${probability}%`,
    text: [
      `${isDemo ? "DEMO/TEST " : ""}DISASTER ALERT — ${city}`,
      ...(isDemo
        ? [
            "This is a demo/test disaster alert for presentation and system testing only.",
            "No real emergency has been confirmed.",
            "",
          ]
        : []),
      `Risk level: ${riskLabel}`,
      `Predicted disaster: ${disasterType}`,
      `Probability: ${probability}%`,
      "",
      "Weather conditions:",
      `Temperature: ${weather.temperature ?? "N/A"} °C`,
      `Humidity: ${weather.humidity ?? "N/A"}%`,
      `Rainfall: ${weather.rainfall ?? "N/A"} mm`,
      `Wind speed: ${weather.wind_speed ?? "N/A"} km/h`,
      `Pressure: ${weather.pressure ?? "N/A"} hPa`,
      `Sea level anomaly: ${environmental.sea_level_anomaly ?? "N/A"} m`,
      `Soil moisture: ${environmental.soil_moisture ?? "N/A"}%`,
      `Seismic activity index: ${environmental.seismic_activity_index ?? "N/A"}`,
      "",
      "Safety precautions:",
      ...precautions.map((p) => `• ${p}`),
    ].join("\n"),
    html,
  });

  return true;
}
