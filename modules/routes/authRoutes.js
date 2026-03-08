import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { validateEmail } from "../utils/validators.js";
import { callHook } from "../utils/hookUtils.js";

export function registerRoute(router, UserModel, roles, validatePassword, rateLimitOptions, config = {}) {
  const limiter = rateLimit({
    ...rateLimitOptions,
    store: rateLimitOptions.store || null,
  });

  router.post("/register", limiter, async (req, res) => {
    try {
      if (!req.body) {
        return res.status(400).json({ error: "Missing request body." });
      }

      const {
        email,
        password,
        role = "user",
        // Protected fields that shouldn't be set via register
        _verified,
        _emailOtp,
        _emailOtpExpires,
        _resetOtp,
        _resetOtpExpires,
        ...extra
      } = req.body;

      if (!email || !validateEmail(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      if (!roles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Allowed: ${roles.join(", ")}` });
      }

      const exists = await UserModel.findOne({ email });
      if (exists) return res.status(409).json({ error: "User already exists." });

      const hashed = await bcrypt.hash(password, 12);
      const user = await UserModel.create({
        ...extra,
        email,
        password: hashed,
        role
      });

      await callHook(config.hooks?.onRegister, user);

      res.status(201).json({
        user: { _id: user._id, email: user.email, role: user.role },
        message: "Registration successful."
      });
    } catch (err) {
      console.error("[REGISTER ERROR]", err);
      await callHook(config.hooks?.onError, {
        type: "register",
        error: err,
        req
      });
      res.status(500).json({ error: "Registration failed." });
    }
  });
}

export function loginRoute(router, UserModel, jwtSecret, jwtConfig, useSession, rateLimitOptions, requireVerified = false, config = {}) {
  const limiter = rateLimit({
    ...rateLimitOptions,
    store: rateLimitOptions.store || null,
  });

  router.post("/login", limiter, async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required." });
      }

      const user = await UserModel.findOne({ email }).select("+password");
      if (!user) return res.status(401).json({ error: "Invalid credentials." });

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) return res.status(401).json({ error: "Invalid credentials." });

      if (requireVerified && !user.verified) {
        return res.status(403).json({ error: "Email not verified. Please verify before logging in." });
      }

      const userPayload = { _id: user._id, email: user.email, role: user.role };

      const extendedPayload = typeof config.hooks?.onLogin === "function"
        ? await config.hooks.onLogin(user)
        : null;

      if (extendedPayload && typeof extendedPayload === "object") {
        Object.assign(userPayload, extendedPayload);
      }

      if (useSession) {
        req.session.user = userPayload;
        return res.json({ user: userPayload, message: "Logged in via session." });
      } else {
        const token = jwt.sign({ id: user._id, role: user.role }, jwtSecret, { expiresIn: jwtConfig.expiresIn });
        return res.json({ token, user: userPayload, message: "Logged in via JWT." });
      }
    } catch (err) {
      console.error("[LOGIN ERROR]", err);
      await callHook(config.hooks?.onError, {
        type: "login",
        error: err,
        req
      });
      res.status(500).json({ error: "Login failed." });
    }
  });
}

export function logoutRoute(router, useSession, config = {}) {
  router.post("/logout", async (req, res) => {
    // 1. Capture user from session OR from req.user (attached by authenticate middleware)
    const user = useSession ? req.session?.user : (req.user || null);

    if (useSession) {
      if (!req.session) {
        return res.status(400).json({ error: "No active session found." });
      }

      req.session.destroy(async (err) => {
        if (err) {
          console.error("[LOGOUT ERROR]", err);
          await callHook(config.hooks?.onError, {
            type: "logout",
            error: err,
            req
          });
          return res.status(500).json({ error: "Failed to log out." });
        }

        await callHook(config.hooks?.onLogout, user);
        return res.json({ message: "Logged out successfully.", user: null });
      });
    } else {
      // For JWT, we just call the hook and return success
      await callHook(config.hooks?.onLogout, user);
      return res.json({ message: "Logged out successfully (Client should clear JWT manually).", user: null });
    }
  });
}
