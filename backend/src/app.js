import cors from "cors";
import express from "express";
import emailSubscriberRoutes from "./routes/emailSubscribers.js";
import predictionRoutes from "./routes/predictions.js";
import userRoutes from "./routes/users.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

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
