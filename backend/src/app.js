import cors from "cors";
import express from "express";
import passport from "passport";
import authRoutes from "./routes/auth.js";
import emailSubscriberRoutes from "./routes/emailSubscribers.js";
import predictionRoutes from "./routes/predictions.js";
import userRoutes from "./routes/users.js";

const app = express();

const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  ...configuredOrigins,
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    const { hostname, port, protocol } = new URL(origin);
    const isLocalVite =
      protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(hostname) &&
      /^517\d$/.test(port);

    return isLocalVite;
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
  })
);
app.use(express.json());
app.use(passport.initialize());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/email-subscribers", emailSubscriberRoutes);
app.use("/api/users", userRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || "Unexpected server error",
  });
});

export default app;
