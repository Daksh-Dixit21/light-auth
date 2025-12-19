
/**
 * Returns a password validation function based on the given policy.
 * @param {Object} policy - Password policy options.
 * @param {number} [policy.minLength=8] - Minimum password length.
 * @param {boolean} [policy.requireUppercase] - Require at least one uppercase letter.
 * @param {boolean} [policy.requireLowercase] - Require at least one lowercase letter.
 * @param {boolean} [policy.requireNumbers] - Require at least one number.
 * @param {boolean} [policy.requireSymbols] - Require at least one symbol.
 * @returns {(password: string) => string|null} Validator function. Returns error string or null if valid.
 */
export function validatePassword(policy = {}) {
  // 1. Extract policy options
  const {
    minLength = 8,
    requireUppercase,
    requireLowercase,
    requireNumbers,
    requireSymbols
  } = policy;

  // 2. Return validator function
  return (password) => {
    if (typeof password !== "string") return "Password must be a string.";
    if (password.length < minLength) return `Password must be at least ${minLength} characters long.`;
    if (requireUppercase && !/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
    if (requireLowercase && !/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
    if (requireNumbers && !/[0-9]/.test(password)) return "Password must contain at least one number.";
    if (requireSymbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Password must contain at least one symbol.";

    return null;
  };
}


/**
 * Validates an email address string.
 * @param {string} email - Email address to validate.
 * @returns {boolean} True if valid, else false.
 */
export function validateEmail(email) {
  // 1. Check type and pattern
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}


/**
 * Default password policy options.
 * @type {{ minLength: number, requireUppercase: boolean, requireLowercase: boolean, requireNumbers: boolean, requireSymbols: boolean }}
 */
export const defaultPasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumbers: false,
  requireSymbols: false,
};
