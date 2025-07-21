import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Loads or generates a Mongoose User model for the app.
 * If not present, generates a default User.js model file (dev only).
 * @param {Object} config - Auth config object (may contain custom User model).
 * @param {string[]} roles - List of allowed user roles.
 * @param {Object} db - Mongoose connection (with .models).
 * @returns {Promise<any>} The User model.
 */
export async function createUserModel(config, roles, db) {
  // 1. Use custom User model if provided
  if (config.User) return config.User;
  // 2. Use already-registered model if present
  if (db.models.User) return db.model("User");

  // 3. Determine User.js path
  const userModelPath = path.join(process.cwd(), "models/User.js");

  // 4. Generate default User.js if missing (dev only)
  if (!fs.existsSync(userModelPath)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[setupAuth] ❌ User.js model not found in production.");
    }

    fs.mkdirSync(path.dirname(userModelPath), { recursive: true });

    const template = `import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ${JSON.stringify(roles)}, default: 'user' },
  name: String,
  emailOtp: String,
  emailOtpExpires: Date,
  resetOtp: String,
  resetOtpExpires: Date,
  verified: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', userSchema);
`;

    fs.writeFileSync(userModelPath, template);
    console.log(`[setupAuth] ✅ Default User.js model generated at: ${userModelPath}`);
  }

  // 5. Import and return User model
  const userModule = await import(pathToFileURL(userModelPath).href);
  return userModule.default;
}
