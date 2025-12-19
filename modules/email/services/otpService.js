import crypto from "crypto";


/**
 * Generates a secure OTP string.
 * @param {number} [length=6] - Number of characters in the OTP.
 * @param {"numeric"|"alphanumeric"} [type="numeric"] - OTP character set.
 * @returns {string} The generated OTP.
 */
export function generateOTP(length = 6, type = "numeric") {
  // 1. Define character set
  const digits = "0123456789";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const charset = type === "alphanumeric" ? digits + letters : digits;

  // 2. Generate random OTP
  let otp = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += charset[bytes[i] % charset.length];
  }
  return otp;
}


/**
 * Validates a stored OTP against user input and expiration.
 * Uses a timing-safe comparison to prevent timing attacks.
 * @param {string} storedOtp - OTP stored in the database.
 * @param {Date|number|string} expiry - Expiry timestamp (date, ms, or ISO string).
 * @param {string} providedOtp - OTP provided by the user.
 * @returns {boolean} True if OTP is valid and not expired, else false.
 */
export function isOTPValid(storedOtp, expiry, providedOtp) {
  // 1. Check for missing values
  if (!storedOtp || !expiry || !providedOtp) return false;

  // 2. Check expiration
  const hasExpired = Date.now() > new Date(expiry).getTime();
  if (hasExpired) return false;

  // 3. Timing-safe OTP comparison
  const bufferA = Buffer.from(storedOtp);
  const bufferB = Buffer.from(providedOtp);

  return (
    bufferA.length === bufferB.length &&
    crypto.timingSafeEqual(bufferA, bufferB)
  );
}
