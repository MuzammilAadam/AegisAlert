import { randomUUID } from "crypto";
import EmailSubscriber from "../models/EmailSubscriber.js";
import { isDatabaseConnected } from "./database.js";

const memoryEmailSubscribers = new Map();

export async function saveEmailSubscriber(email, city = "", isSubscribed = true) {
  const normalizedEmail = email.trim().toLowerCase();
  const subscriberCity = String(city || "").trim();

  if (isDatabaseConnected()) {
    return EmailSubscriber.findOneAndUpdate(
      { email: normalizedEmail },
      { email: normalizedEmail, city: subscriberCity, isSubscribed },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  const subscriber = memoryEmailSubscribers.get(normalizedEmail) || {
    id: randomUUID(),
    email: normalizedEmail,
    createdAt: new Date(),
  };
  subscriber.city = subscriberCity;
  subscriber.isSubscribed = isSubscribed;
  memoryEmailSubscribers.set(normalizedEmail, subscriber);
  return subscriber;
}

export async function listSubscribedEmailRecipients() {
  if (isDatabaseConnected()) {
    return EmailSubscriber.find({ isSubscribed: true }).lean();
  }

  return [...memoryEmailSubscribers.values()].filter((subscriber) => subscriber.isSubscribed);
}
