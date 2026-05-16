import crypto from "crypto";
import nodemailer from "nodemailer";

export const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
export const PASSWORD_RESET_EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES || 10);

export function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

export function getOtpExpiry(minutes = OTP_EXPIRY_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function hashOtp(otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || "aegisalert_otp_secret";
  return crypto.createHmac("sha256", secret).update(String(otp)).digest("hex");
}

export function isOtpExpired(storedExpiry) {
  return !storedExpiry || new Date() > new Date(storedExpiry);
}

export function isOtpValid(storedOtpHash, storedExpiry, submittedOtp) {
  if (!storedOtpHash || isOtpExpired(storedExpiry)) return false;

  const submittedHash = hashOtp(String(submittedOtp || "").trim());
  const storedBuffer = Buffer.from(storedOtpHash, "hex");
  const submittedBuffer = Buffer.from(submittedHash, "hex");

  return storedBuffer.length === submittedBuffer.length &&
    crypto.timingSafeEqual(storedBuffer, submittedBuffer);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendOtpEmail({ to, otp, purpose = "verify", name = "" }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("OTP email skipped because SMTP credentials are missing.");
    return false;
  }

  const transporter = createTransporter();
  const isSignup = purpose === "signup";
  const heading = isSignup ? "Verify your email" : "Login verification code";
  const action = isSignup ? "complete your account registration" : "sign in to your account";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:white;font-size:22px;">AegisAlert</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Disaster Prediction System</p>
        </td></tr>
        <tr><td style="background:white;padding:32px;border-radius:0 0 14px 14px;">
          <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">${heading}</h2>
          ${name ? `<p style="margin:0 0 20px;color:#475569;font-size:15px;">Hi <strong>${name}</strong>,</p>` : ""}
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Use this one-time code to ${action}. It expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:#0f172a;border-radius:12px;padding:18px 34px;">
              <span style="font-size:38px;font-weight:800;letter-spacing:10px;color:white;font-family:monospace;">${otp}</span>
            </div>
          </div>
          <p style="margin:0;color:#64748b;font-size:13px;text-align:center;">
            Do not share this code. Ignore this email if you did not request it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"AegisAlert" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${otp} is your AegisAlert ${isSignup ? "registration" : "login"} code`,
    text: `Your AegisAlert verification code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    html,
  });

  return true;
}

export async function sendPasswordResetEmail({ to, otp, name = "" }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Password reset email skipped because SMTP credentials are missing.");
    return false;
  }

  const transporter = createTransporter();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
        <tr><td style="background:#0f172a;border-radius:14px 14px 0 0;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:white;font-size:22px;">AegisAlert</h1>
          <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Password reset request</p>
        </td></tr>
        <tr><td style="background:white;padding:32px;border-radius:0 0 14px 14px;">
          <h2 style="margin:0 0 8px;color:#0f172a;font-size:22px;">Reset your password</h2>
          ${name ? `<p style="margin:0 0 20px;color:#475569;font-size:15px;">Hi <strong>${name}</strong>,</p>` : ""}
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            Use this one-time code to set a new password. It expires in <strong>${PASSWORD_RESET_EXPIRY_MINUTES} minutes</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:#0f172a;border-radius:12px;padding:18px 34px;">
              <span style="font-size:38px;font-weight:800;letter-spacing:10px;color:white;font-family:monospace;">${otp}</span>
            </div>
          </div>
          <p style="margin:0;color:#64748b;font-size:13px;text-align:center;">
            Ignore this email if you did not request a password reset.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"AegisAlert" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${otp} is your AegisAlert password reset code`,
    text: `Your AegisAlert password reset code is: ${otp}\n\nThis code expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes.`,
    html,
  });

  return true;
}
