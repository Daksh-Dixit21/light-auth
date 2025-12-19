import express from "express";
import { generateOTP, isOTPValid } from "../services/otpService.js";
import { emailValidators } from "../validators/emailValidators.js";
import { validationResult } from "express-validator";
import bcrypt from "bcryptjs"; 

/**
 * Internal helper for extracting clean OTP config.
 * @param {Object} config - Main config object.
 * @param {string} type - Config section (e.g., 'emailVerification', 'forgotPassword').
 * @returns {Object} OTP config: { length, basis, expiry, sendMail, url }
 */
function getOTPConfig(config, type) {
  // 1. Extract sub-config for the given type
  const sub = config?.[type] || {};
  return {
    length: sub.otpLength || 6,
    basis: sub.otpType || "numeric", // numeric | alphanumeric
    expiry: sub.otpExpiryMinutes || 5,
    sendMail: sub.sendMail,
    url: sub.url || null,
  };
}


/**
 * Sets up email-based OTP and password reset routes.
 * @param {import('express').Application} app - Express app instance.
 * @param {Object} UserModel - User model for DB operations.
 * @param {Object} config - Configuration object.
 */
export function setupEmailRoutes(app, UserModel, config) {
  // 1. Create router and determine base route
  const router = express.Router();
  const base = config.route || "/auth";

  // 2. Feature toggles
  const enableVerify = config.emailVerification?.enabled;
  const enableForgot = config.forgotPassword?.enabled;

  // 3. Email Verification OTP routes
  if (enableVerify) {
    // 3.1 Send verification OTP
    router.post("/send-verification-otp", emailValidators.sendOtp, async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email } = req.body;
      const user = await UserModel.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });

      // 3.1.1 Generate and store OTP
      const { length, basis, expiry, sendMail, url } = getOTPConfig(config, "emailVerification");
      const otp = generateOTP(length, basis);

      user.emailOtp = otp;
      user.emailOtpExpires = Date.now() + expiry * 60000;
      await user.save();

      // 3.1.2 Send OTP email
      await sendMail?.({ email, otp, type: "verify", url });
      res.json({ message: "Verification OTP sent." });
    });

    // 3.2 Verify email with OTP
    router.post("/verify-email", emailValidators.verifyOtp(config), async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, otp } = req.body;
      const user = await UserModel.findOne({ email });
      if (!user || !isOTPValid(user.emailOtp, user.emailOtpExpires, otp)) {
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      // 3.2.1 Mark user as verified and clear OTP
      user.verified = true;
      user.emailOtp = undefined;
      user.emailOtpExpires = undefined;
      await user.save();

      // 3.2.2 Call optional hook
      if (typeof config.hooks?.onVerify === "function") {
        await config.hooks.onVerify(user);
      }

      res.json({ message: "Email verified successfully." });
    });
  }

  // 4. Forgot Password OTP routes
  if (enableForgot) {
    // 4.1 Send forgot password OTP
    router.post("/send-forgot-otp", emailValidators.sendOtp, async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email } = req.body;
      const user = await UserModel.findOne({ email });
      if (!user) return res.status(404).json({ error: "User not found" });

      // 4.1.1 Generate and store OTP
      const { length, basis, expiry, sendMail, url } = getOTPConfig(config, "forgotPassword");
      const otp = generateOTP(length, basis);

      user.resetOtp = otp;
      user.resetOtpExpires = Date.now() + expiry * 60000;
      await user.save();

      // 4.1.2 Send OTP email
      await sendMail?.({ email, otp, type: "reset", url });
      res.json({ message: "Password reset OTP sent." });
    });

    // 4.2 Reset password with OTP
    router.post("/reset-password", emailValidators.resetPassword(config), async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, otp, newPassword } = req.body;
      const user = await UserModel.findOne({ email }).select("+password");

      if (!user || !isOTPValid(user.resetOtp, user.resetOtpExpires, otp)) {
        return res.status(400).json({ error: "Invalid or expired OTP." });
      }

      // 4.2.1 Hash and update password, clear OTP
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
      user.resetOtp = undefined;
      user.resetOtpExpires = undefined;
      await user.save();

      res.json({ message: "Password reset successful." });
    });
  }

  // 5. Register router with app
  app.use(base, router);
}