import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

/**
 * Loads or generates a Mongoose User model for the app.
 * STRICT MODE: Requires config.User to be a Model or 'default'.
 * @param {Object} config - Auth config object.
 * @param {string[]} roles - List of allowed user roles.
 * @param {Object} db - Mongoose connection (with .models).
 * @returns {Promise<any>} The User model.
 */
export async function createUserModel(config, roles, db) {
  // 1. Case: Custom User model provided
  if (config.User && typeof config.User !== "string") {
    return config.User;
  }

  // 2. Case: "default" - Auto-generate or load file-based model
  if (config.User === "default") {
    // 2.1 Use already-registered model if present (fast path for re-runs)
    if (db.models.User) return db.model("User");

    const userModelPath = path.join(process.cwd(), "models/User.js");

    // 2.2 Generate default User.js if missing
    if (!fs.existsSync(userModelPath)) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("[light-auth] ❌ User model not found. In production, 'models/User.js' must exist when using 'default'.");
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
      console.log(`[light-auth] ✅ Created default User model at: ${userModelPath}`);
    } else {
      console.log(`[light-auth] ℹ️ Using existing User model at: ${userModelPath}`);
    }

    // 2.3 Import and return User model
    const userModule = await import(pathToFileURL(userModelPath).href);
    return userModule.default;
  }

  // 3. Case: Missing/Invalid config -> ERROR
  throw new Error(
    "[light-auth] ❌ No User model provided. You must either:\n" +
    "  1. Pass a Mongoose model instance to 'User' in config.\n" +
    "  2. Set 'User' to 'default' to auto-generate/load a model at 'models/User.js'."
  );
}
