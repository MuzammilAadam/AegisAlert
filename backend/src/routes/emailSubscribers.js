import { Router } from "express";
import { parseEmailRecipients } from "../services/email.js";
import {
  listSubscribedEmailRecipients,
  saveEmailSubscriber,
} from "../services/emailSubscriberStore.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const { email, city, isSubscribed = true } = req.body;
    const emails = parseEmailRecipients(email);

    if (!emails.length) {
      return res.status(400).json({ message: "At least one valid email is required." });
    }

    const subscribers = await Promise.all(
      emails.map((address) => saveEmailSubscriber(address, city, Boolean(isSubscribed)))
    );
    res.status(201).json({ subscribers });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_req, res, next) => {
  try {
    const subscribers = await listSubscribedEmailRecipients();
    res.json({ subscribers });
  } catch (error) {
    next(error);
  }
});

export default router;
