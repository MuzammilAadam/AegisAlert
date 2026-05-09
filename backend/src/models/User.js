import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, default: "", trim: true, lowercase: true, index: true },
    city: { type: String, default: "", trim: true, index: true },
    name: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
