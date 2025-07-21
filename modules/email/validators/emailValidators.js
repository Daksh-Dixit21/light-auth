
import { body } from "express-validator";


/**
 * Email-related express-validator chains for OTP and password flows.
 * @namespace emailValidators
 */
export const emailValidators = {
  /**
   * Validator for sending OTP to email.
   * @returns {Array} Express-validator chain for email field.
   */
  sendOtp: [
    // 1. Validate and normalize email
    body("email")
      .isEmail().withMessage("Valid email required")
      .normalizeEmail(),
  ],

  /**
   * Validator for verifying OTP sent to email.
   * @param {Object} [config] - Optional config object.
   * @param {Object} [config.emailVerification] - Email verification config.
   * @param {number} [config.emailVerification.otpLength=6] - OTP length.
   * @returns {Array} Express-validator chain for email and otp fields.
   */
  verifyOtp: (config = {}) => {
    // 1. Get OTP length from config
    const len = config?.emailVerification?.otpLength || 6;

    return [
      // 2. Validate and normalize email
      body("email")
        .isEmail().withMessage("Email is required")
        .normalizeEmail(),

      // 3. Validate OTP length and sanitize
      body("otp")
        .isLength({ min: len, max: len })
        .withMessage(`OTP must be exactly ${len} characters.`)
        .trim()
        .escape(),
    ];
  },

  /**
   * Validator for resetting password using OTP.
   * @param {Object} [config] - Optional config object.
   * @param {Object} [config.forgotPassword] - Forgot password config.
   * @param {number} [config.forgotPassword.otpLength=6] - OTP length.
   * @param {Object} [config.passwordPolicy] - Password policy config.
   * @param {number} [config.passwordPolicy.minLength=8] - Minimum password length.
   * @param {boolean} [config.passwordPolicy.requireUppercase] - Require uppercase letter.
   * @param {boolean} [config.passwordPolicy.requireLowercase] - Require lowercase letter.
   * @param {boolean} [config.passwordPolicy.requireNumbers] - Require number.
   * @param {boolean} [config.passwordPolicy.requireSymbols] - Require symbol.
   * @returns {Array} Express-validator chain for email, otp, and newPassword fields.
   */
  resetPassword: (config = {}) => {
    // 1. Get OTP length and password policy from config
    const len = config?.forgotPassword?.otpLength || 6;
    const policy = config?.passwordPolicy || { minLength: 8 };

    return [
      // 2. Validate and normalize email
      body("email")
        .isEmail().withMessage("Email is required")
        .normalizeEmail(),

      // 3. Validate OTP length and sanitize
      body("otp")
        .isLength({ min: len, max: len })
        .withMessage(`OTP must be exactly ${len} characters.`)
        .trim()
        .escape(),

      // 4. Validate new password against policy
      body("newPassword")
        .isString().withMessage("Password is required")
        .custom((val) => {
          // 4.1 Check minimum length
          if (val.length < policy.minLength) {
            throw new Error(`Password must be at least ${policy.minLength} characters.`);
          }
          // 4.2 Require uppercase
          if (policy.requireUppercase && !/[A-Z]/.test(val)) {
            throw new Error("Password must include an uppercase letter.");
          }
          // 4.3 Require lowercase
          if (policy.requireLowercase && !/[a-z]/.test(val)) {
            throw new Error("Password must include a lowercase letter.");
          }
          // 4.4 Require number
          if (policy.requireNumbers && !/\d/.test(val)) {
            throw new Error("Password must include a number.");
          }
          // 4.5 Require symbol
          if (policy.requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(val)) {
            throw new Error("Password must include a symbol.");
          }
          return true;
        }),
    ];
  },
};