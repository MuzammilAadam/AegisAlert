import { Router } from "express";
import User from "../models/User.js";
import { parseEmailRecipients } from "../services/email.js";
import { cityFilter, normalizeCity } from "../services/city.js";
import { isDatabaseConnected } from "../services/database.js";

const router = Router();

router.post("/email", async (req, res, next) => {
  try {
    const emails = parseEmailRecipients(req.body.email);
    const city = normalizeCity(req.body.city);
    const name = String(req.body.name || "").trim();

    if (!emails.length) {
      return res.status(400).json({ message: "A valid email is required." });
    }

    if (!isDatabaseConnected()) {
      return res.status(503).json({ message: "Database is not connected." });
    }

    const users = await Promise.all(
      emails.map((email) =>
        User.findOneAndUpdate(
          { email },
          { email, city, ...(name ? { name } : {}) },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean()
      )
    );

    res.status(201).json({ users });
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
    const query = city ? cityFilter(city) : {};
    const users = await User.find(query).lean();
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

export default router;
