import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { isDatabaseConnected } from "../services/database.js";
import { buildAssistantReply } from "../services/disasterAssistant.js";
import { appendChatExchange, clearChatHistory, getChatHistory } from "../services/chatHistory.js";
import { normalizeCity } from "../services/city.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "aegisalert_super_secret_key";

async function requireChatUser(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "No token provided." });
    return null;
  }

  let decoded;
  try {
    decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
  } catch {
    res.status(401).json({ message: "Token is invalid or expired." });
    return null;
  }

  if (!isDatabaseConnected()) {
    return {
      id: decoded.userId,
      _id: decoded.userId,
      city: decoded.city || "",
      isVerified: true,
    };
  }

  const user = await User.findById(decoded.userId).lean();
  if (!user || !user.isVerified) {
    res.status(404).json({ message: "User not found." });
    return null;
  }

  return user;
}

router.get("/history", async (req, res, next) => {
  try {
    const user = await requireChatUser(req, res);
    if (!user) return;

    const messages = await getChatHistory(user._id || user.id);
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

router.post("/message", async (req, res, next) => {
  try {
    const user = await requireChatUser(req, res);
    if (!user) return;

    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Message is required." });
    }
    if (message.length > 1000) {
      return res.status(400).json({ message: "Message is too long." });
    }

    const assistant = await buildAssistantReply({
      message,
      userCity: normalizeCity(user.city, "Solapur"),
    });
    const messages = await appendChatExchange({
      userId: user._id || user.id,
      city: assistant.city || user.city,
      userMessage: message,
      assistantMessage: assistant.reply,
    });

    res.json({
      reply: assistant.reply,
      city: assistant.city,
      messages,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/history", async (req, res, next) => {
  try {
    const user = await requireChatUser(req, res);
    if (!user) return;

    await clearChatHistory(user._id || user.id);
    res.json({ messages: [] });
  } catch (error) {
    next(error);
  }
});

export default router;
