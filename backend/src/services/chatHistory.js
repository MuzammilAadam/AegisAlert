import { randomUUID } from "crypto";
import ChatConversation from "../models/ChatConversation.js";
import { isDatabaseConnected } from "./database.js";
import { normalizeCity } from "./city.js";

const memoryConversations = new Map();
const MAX_MESSAGES = 120;

function keyForUser(userId) {
  return String(userId || "anonymous");
}

function trimMessages(messages) {
  return messages.slice(-MAX_MESSAGES);
}

function normalizeMessage(message) {
  return {
    role: message.role,
    content: String(message.content || ""),
    createdAt: message.createdAt || new Date(),
  };
}

export async function getChatHistory(userId) {
  if (isDatabaseConnected()) {
    const conversation = await ChatConversation.findOne({ userId }).lean();
    return conversation?.messages || [];
  }

  return memoryConversations.get(keyForUser(userId))?.messages || [];
}

export async function appendChatExchange({ userId, city, userMessage, assistantMessage }) {
  const messages = [
    normalizeMessage({ role: "user", content: userMessage }),
    normalizeMessage({ role: "assistant", content: assistantMessage }),
  ];

  if (isDatabaseConnected()) {
    const conversation = await ChatConversation.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId },
        $set: { city: normalizeCity(city), updatedAt: new Date() },
        $push: { messages: { $each: messages, $slice: -MAX_MESSAGES } },
      },
      { new: true, upsert: true }
    ).lean();

    return conversation.messages || [];
  }

  const key = keyForUser(userId);
  const existing = memoryConversations.get(key) || {
    id: randomUUID(),
    userId,
    city: normalizeCity(city),
    messages: [],
  };
  existing.city = normalizeCity(city);
  existing.messages = trimMessages([...existing.messages, ...messages]);
  existing.updatedAt = new Date();
  memoryConversations.set(key, existing);
  return existing.messages;
}

export async function clearChatHistory(userId) {
  if (isDatabaseConnected()) {
    await ChatConversation.deleteOne({ userId });
    return;
  }

  memoryConversations.delete(keyForUser(userId));
}
