import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set. Users collection was not reset.");
  process.exit(1);
}

await mongoose.connect(uri);

const result = await User.deleteMany({});
await User.syncIndexes();

console.log(`Users collection reset. Deleted ${result.deletedCount} user record(s).`);

await mongoose.disconnect();
