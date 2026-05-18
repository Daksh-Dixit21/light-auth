import bcrypt from "bcryptjs";

/**
 * Resolves the hashing engine based on the configured algorithm.
 * Supports 'bcrypt' (default) and 'argon2' (optional).
 * Argon2 is loaded dynamically to avoid hard dependency.
 *
 * @param {string} algorithm - Hashing algorithm: 'bcrypt' | 'argon2'.
 * @returns {Promise<{hash: Function, verify: Function}>} Hashing engine.
 */
async function resolveEngine(algorithm) {
  if (algorithm === "argon2") {
    try {
      const argon2 = await import("argon2");
      return {
        hash: (password) => argon2.default.hash(password),
        verify: (hash, password) => argon2.default.verify(hash, password),
      };
    } catch {
      throw new Error(
        "[light-auth] 'argon2' is not installed. Install it with: npm install argon2"
      );
    }
  }

  // Default: bcrypt
  return {
    hash: (password) => bcrypt.hash(password, 12),
    verify: (hash, password) => bcrypt.compare(password, hash),
  };
}


/**
 * Auto-detects the hash format and verifies the password.
 * Argon2 hashes start with '$argon2'. Bcrypt hashes start with '$2a$' or '$2b$'.
 * This enables seamless migration: existing bcrypt users can log in even when
 * the system is configured for argon2.
 *
 * @param {string} storedHash - The hash stored in the database.
 * @param {string} password - The plaintext password to verify.
 * @returns {Promise<boolean>} True if the password matches the hash.
 */
export async function verifyPassword(storedHash, password) {
  // 1. Auto-detect hash format for backward compatibility
  if (storedHash.startsWith("$argon2")) {
    try {
      const argon2 = await import("argon2");
      return argon2.default.verify(storedHash, password);
    } catch {
      throw new Error(
        "[light-auth] Found an argon2 hash but 'argon2' is not installed. Install it with: npm install argon2"
      );
    }
  }

  // 2. Default: bcrypt
  return bcrypt.compare(password, storedHash);
}


/**
 * Hashes a password using the configured algorithm.
 *
 * @param {string} password - The plaintext password to hash.
 * @param {string} algorithm - Hashing algorithm: 'bcrypt' | 'argon2'.
 * @returns {Promise<string>} The hashed password.
 */
export async function hashPassword(password, algorithm = "bcrypt") {
  const engine = await resolveEngine(algorithm);
  return engine.hash(password);
}
