import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import User from "../models/User.js";
import { isDatabaseConnected } from "../services/database.js";
import {
  PASSWORD_RESET_EXPIRY_MINUTES,
  generateOtp,
  getOtpExpiry,
  hashOtp,
  isOtpValid,
  sendOtpEmail,
  sendPasswordResetEmail,
} from "../services/otp.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "aegisalert_super_secret_key";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const pendingSignups = new Map();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN?.split(",")[0]?.trim() || "http://localhost:5173";
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;

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

function validatePassword(password) {
  if (!password) return "Password is required.";
  if (String(password).length < 6) return "Password must be at least 6 characters.";
  return "";
}

function buildToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, city: user.city, authProvider: user.authProvider },
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
    authProvider: user.authProvider,
    isVerified: user.isVerified,
  };
}

function redirectWithError(res, message) {
  const params = new URLSearchParams({ error: message });
  return res.redirect(`${FRONTEND_ORIGIN}/login?${params.toString()}`);
}

function redirectAfterOAuth(res, user) {
  const token = buildToken(user);
  const params = new URLSearchParams({ token });
  const path = user.city ? "/oauth/success" : "/oauth/city";
  return res.redirect(`${FRONTEND_ORIGIN}${path}?${params.toString()}`);
}

async function findOrCreateOAuthUser(profile, provider) {
  const email = normalizeEmail(profile.emails?.[0]?.value);
  if (!email || !EMAIL_REGEX.test(email)) {
    const error = new Error(`${provider} did not provide a verified email address.`);
    error.status = 400;
    throw error;
  }

  const oauthId = String(profile.id || "");
  const displayName = String(profile.displayName || profile.username || email.split("@")[0]).trim();
  const existing = await User.findOne({ email });
  if (existing) {
    if (!existing.authProvider || existing.authProvider === "local") {
      existing.authProvider = provider;
    }
    if (!existing.oauthId && oauthId) existing.oauthId = oauthId;
    existing.isVerified = true;
    await existing.save();
    return existing;
  }

  return User.create({
    name: displayName,
    email,
    password: "",
    city: "",
    authProvider: provider,
    oauthId,
    isVerified: true,
    otp: null,
    otpExpiry: null,
  });
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `${BACKEND_PUBLIC_URL}/api/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          done(null, await findOrCreateOAuthUser(profile, "google"));
        } catch (error) {
          done(error);
        }
      }
    )
  );
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || `${BACKEND_PUBLIC_URL}/api/auth/github/callback`,
        scope: ["user:email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          done(null, await findOrCreateOAuthUser(profile, "github"));
        } catch (error) {
          done(error);
        }
      }
    )
  );
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

router.post("/password/forgot", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const normalizedEmail = normalizeEmail(req.body.email);
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ message: "Please provide a valid registered email address." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.password) {
      return res.status(404).json({ message: "No password-based account exists for this email." });
    }

    const otp = generateOtp();
    user.resetPasswordOtp = hashOtp(otp);
    user.resetPasswordExpiry = getOtpExpiry(PASSWORD_RESET_EXPIRY_MINUTES);
    await user.save();

    await sendPasswordResetEmail({ to: normalizedEmail, otp, name: user.name });

    res.json({ message: `Password reset code sent to ${normalizedEmail}.` });
  } catch (error) {
    next(error);
  }
});

router.post("/password/reset", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const normalizedEmail = normalizeEmail(req.body.email);
    const submittedOtp = String(req.body.otp || "").trim();
    const password = String(req.body.password || "");
    const passwordError = validatePassword(password);

    if (!normalizedEmail || !submittedOtp) {
      return res.status(400).json({ message: "Email and reset code are required." });
    }
    if (passwordError) return res.status(400).json({ message: passwordError });

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.password) {
      return res.status(404).json({ message: "No password-based account exists for this email." });
    }

    if (!isOtpValid(user.resetPasswordOtp, user.resetPasswordExpiry, submittedOtp)) {
      return res.status(400).json({ message: "Invalid or expired password reset code." });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordOtp = null;
    user.resetPasswordExpiry = null;
    await user.save();

    res.json({ message: "Password updated successfully. You can now sign in." });
  } catch (error) {
    next(error);
  }
});

router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ message: "Google OAuth is not configured." });
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", { session: false }, (error, user) => {
    if (error) return redirectWithError(res, error.message || "Google login failed.");
    if (!user) return redirectWithError(res, "Google login failed.");
    return redirectAfterOAuth(res, user);
  })(req, res, next);
});

router.get("/github", (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ message: "GitHub OAuth is not configured." });
  }
  passport.authenticate("github", { scope: ["user:email"], session: false })(req, res, next);
});

router.get("/github/callback", (req, res, next) => {
  passport.authenticate("github", { session: false }, (error, user) => {
    if (error) return redirectWithError(res, error.message || "GitHub login failed.");
    if (!user) return redirectWithError(res, "GitHub login failed.");
    return redirectAfterOAuth(res, user);
  })(req, res, next);
});

router.post("/oauth/city", async (req, res, next) => {
  try {
    if (!dbCheck(res)) return;

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }

    const city = String(req.body.city || "").trim();
    if (city.length < 2) {
      return res.status(400).json({ message: "Please select a valid city." });
    }

    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user || !user.isVerified || !["google", "github"].includes(user.authProvider)) {
      return res.status(404).json({ message: "OAuth user not found." });
    }

    user.city = city;
    await user.save();

    res.json({
      token: buildToken(user),
      user: userPayload(user),
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token is invalid or expired." });
    }
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
    const user = await User.findById(decoded.userId)
      .select("-password -otp -otpExpiry -resetPasswordOtp -resetPasswordExpiry -oauthId")
      .lean();
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
