
/**
 * Default mail sender for OTP and verification emails.
 * Logs email details to the console (for development/testing).
 * @param {Object} params - Mail parameters.
 * @param {string} params.email - Recipient email address.
 * @param {string} params.otp - OTP code to send.
 * @param {string} params.type - Type of OTP (e.g., 'login', 'reset').
 * @param {string} [params.url] - Optional URL for verification/reset.
 * @returns {Promise<void>} Resolves when logging is complete.
 */
export async function defaultSendMail({ email, otp, type, url }) {
  // 1. Determine sender address
  const from = process.env.AUTH_ENGINE_EMAIL_FROM || "noreply@authengine.com";

  // 2. Log email details
  console.log(`[EmailService] Sending ${type.toUpperCase()} OTP to: ${email}`);
  console.log(`[EmailService] From: ${from}`);
  console.log(`[EmailService] OTP: ${otp}`);
  if (url) console.log(`[EmailService] URL: ${url}`);
}
