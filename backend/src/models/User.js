import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, default: "", trim: true },
    email:    { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password: { type: String, default: "" },
    city:     { type: String, default: "", trim: true, index: true },
    createdAt:{ type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
