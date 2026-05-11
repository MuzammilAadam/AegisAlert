import { Router } from "express";
import User from "../models/User.js";
import { parseEmailRecipients } from "../services/email.js";
import { cityFilter, normalizeCity } from "../services/city.js";
import { isDatabaseConnected } from "../services/database.js";

const router = Router();

router.post("/email", async (req, res, next) => {
  try {
    const emails = parseEmailRecipients(req.body.email);
    if (!emails.length) return res.status(400).json({ message: "A valid email is required." });

    res.status(410).json({
      message: "User email registration now requires OTP verification. Use /api/auth/signup/send-otp.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/subscribers", async (req, res, next) => {
  try {
    if (!isDatabaseConnected()) {
      return res.json({ users: [] });
    }

    const city = normalizeCity(req.query.city);
    const query = city ? { ...cityFilter(city), isVerified: true } : { isVerified: true };
    const users = await User.find(query).lean();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

export default router;
