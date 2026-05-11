import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { isDatabaseConnected } from "../services/database.js";
import { generateOtp, getOtpExpiry, hashOtp, isOtpValid, sendOtpEmail } from "../services/otp.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "aegisalert_super_secret_key";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pendingSignups = new Map();

function dbCheck(res) {
  if (!isDatabaseConnected()) {
    res.status(503).json({ message: "Database is not connected." });
    return false;
  }
  return true;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validateSignup({ name, email, password, city }) {
  if (!name || !email || !password || !city) {
    return "All fields (name, email, password, city) are required.";
  }
  if (!EMAIL_REGEX.test(email)) return "Please provide a valid email address.";
  if (String(password).length < 6) return "Password must be at least 6 characters.";
  if (String(name).trim().length < 2) return "Name must be at least 2 characters.";
  if (String(city).trim().length < 2) return "Please select a valid city.";
  return "";
}

function buildToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, city: user.city },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function userPayload(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    city: user.city,
    isVerified: user.isVerified,
  };
}

function cleanupExpiredPendingSignups() {
  const now = Date.now();
  for (const [email, pending] of pendingSignups.entries()) {
    if (!pending.otpExpiry || new Date(pending.otpExpiry).getTime() <= now) {
      pendingSignups.delete(email);
    }
  }
}

router.post("/signup/send-otp", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const normalizedEmail = normalizeEmail(req.body.email);
    const validationError = validateSignup({ ...req.body, email: normalizedEmail });
    if (validationError) return res.status(400).json({ message: validationError });

    cleanupExpiredPendingSignups();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const otp = generateOtp();
    const otpExpiry = getOtpExpiry();
    const passwordHash = await bcrypt.hash(req.body.password, 12);

    pendingSignups.set(normalizedEmail, {
      name: String(req.body.name).trim(),
      email: normalizedEmail,
      password: passwordHash,
      city: String(req.body.city).trim(),
      otp: hashOtp(otp),
      otpExpiry,
    });

    await sendOtpEmail({
      to: normalizedEmail,
      otp,
      purpose: "signup",
      name: String(req.body.name).trim(),
    });

    res.json({ message: `Verification code sent to ${normalizedEmail}. Please check your inbox.` });
  } catch (error) {
    next(error);
  }
});

router.post("/signup/verify-otp", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const normalizedEmail = normalizeEmail(req.body.email);
    const submittedOtp = String(req.body.otp || "").trim();
    if (!normalizedEmail || !submittedOtp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    cleanupExpiredPendingSignups();

    const pending = pendingSignups.get(normalizedEmail);
    if (!pending) {
      return res.status(404).json({ message: "No pending registration found. Please sign up again." });
    }

    if (!isOtpValid(pending.otp, pending.otpExpiry, submittedOtp)) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      pendingSignups.delete(normalizedEmail);
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const user = await User.create({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      city: pending.city,
      isVerified: true,
      otp: null,
      otpExpiry: null,
    });

    pendingSignups.delete(normalizedEmail);

    res.status(201).json({
      token: buildToken(user),
      user: userPayload(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    next(error);
  }
});

router.post("/login/send-otp", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const normalizedEmail = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const otp = generateOtp();
    user.otp = hashOtp(otp);
    user.otpExpiry = getOtpExpiry();
    await user.save();

    await sendOtpEmail({ to: normalizedEmail, otp, purpose: "login", name: user.name });

    res.json({ message: `Verification code sent to ${normalizedEmail}.` });
  } catch (error) {
    next(error);
  }
});

router.post("/login/verify-otp", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const normalizedEmail = normalizeEmail(req.body.email);
    const submittedOtp = String(req.body.otp || "").trim();
    if (!normalizedEmail || !submittedOtp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.isVerified) {
      return res.status(404).json({ message: "Account not found." });
    }

    if (!isOtpValid(user.otp, user.otpExpiry, submittedOtp)) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({
      token: buildToken(user),
      user: userPayload(user),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password -otp -otpExpiry").lean();
    if (!user || !user.isVerified) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ user });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token is invalid or expired." });
    }
    next(error);
  }
});

export default router;
