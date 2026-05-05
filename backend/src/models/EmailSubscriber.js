import mongoose from "mongoose";

const emailSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    city: { type: String, default: "" },
    isSubscribed: { type: Boolean, default: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.models.EmailSubscriber ||
  mongoose.model("EmailSubscriber", emailSubscriberSchema);
