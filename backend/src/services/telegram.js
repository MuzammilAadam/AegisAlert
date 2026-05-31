import TelegramBot from "node-telegram-bot-api";
import { getPrecautionsForDisaster } from "./email.js";

let bot = null;
let botInfoPromise = null;

function getBot() {
  if (bot) return bot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  bot = new TelegramBot(token, { polling: false });
  return bot;
}

export async function getTelegramBotInfo() {
  const instance = getBot();
  if (!instance) return null;

  if (!botInfoPromise) {
    botInfoPromise = instance.getMe().catch((error) => {
      botInfoPromise = null;
      throw error;
    });
  }

  return botInfoPromise;
}

export function buildTelegramMessage({ city, disasterType, probability, precautions = [], isDemo = false }) {
  const resolvedPrecautions = precautions.length
    ? precautions
    : getPrecautionsForDisaster(disasterType);
  const demoTag = isDemo
    ? "DEMO / TEST ALERT\nNo real emergency has been confirmed.\n\n"
    : "";
  const precautionLines = resolvedPrecautions.map((item) => `- ${item}`).join("\n");

  return [
    `${demoTag}DISASTER ALERT`,
    "",
    `City: ${city}`,
    `Disaster: ${disasterType}`,
    `Risk Level: ${probability}%`,
    "",
    "Precautions:",
    precautionLines,
    "",
    "Stay safe and follow official government instructions.",
    "- AegisAlert Early Warning System",
  ].join("\n");
}

export async function sendTelegramMessage(chatId, text) {
  const instance = getBot();
  if (!instance) {
    console.warn("[Telegram] TELEGRAM_BOT_TOKEN not set; skipping Telegram alert.");
    return false;
  }

  const normalizedChatId = String(chatId || "").trim();
  if (!normalizedChatId) return false;

  try {
    await instance.sendMessage(normalizedChatId, text, {
      disable_web_page_preview: true,
    });
    return true;
  } catch (error) {
    console.error(`[Telegram] Failed to send to chatId ${normalizedChatId}:`, error.message);
    return false;
  }
}

export async function sendTelegramTestMessage({ chatId, name = "there" }) {
  const text = [
    `Hi ${name || "there"}, Telegram alerts are connected.`,
    "",
    "You will receive AegisAlert disaster alerts here when your saved city crosses the alert threshold.",
    "",
    "- AegisAlert Early Warning System",
  ].join("\n");

  return sendTelegramMessage(chatId, text);
}

export async function sendTelegramAlerts({
  users,
  city,
  disasterType,
  probability,
  precautions = [],
  isDemo = false,
}) {
  const eligibleUsers = users.filter((user) => user.telegramEnabled && user.telegramChatId);
  if (!eligibleUsers.length) return 0;

  const text = buildTelegramMessage({ city, disasterType, probability, precautions, isDemo });
  const results = await Promise.allSettled(
    eligibleUsers.map((user) => sendTelegramMessage(user.telegramChatId, text))
  );

  return results.filter((result) => result.status === "fulfilled" && result.value === true).length;
}
