import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name:       { type: String, default: "", trim: true },
    email:      { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    password:   { type: String, default: "" },
    hasPassword: { type: Boolean, default: false },
    city:       { type: String, default: "", trim: true, index: true },
    authProvider: { type: String, enum: ["local", "google", "github"], default: "local", index: true },
    oauthId:    { type: String, default: "", trim: true },
    profilePicture: { type: String, default: "", trim: true },
    isVerified: { type: Boolean, default: false },
    otp:        { type: String, default: null },
    otpExpiry:  { type: Date, default: null },
    resetPasswordOtp: { type: String, default: null },
    resetPasswordExpiry: { type: Date, default: null },
    createdAt:  { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
