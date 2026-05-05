import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not set. Using in-memory stores.");
    return;
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB");
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
