import session from "express-session";

/**
 * Initializes session middleware on the Express app.
 * @param {import('express').Application} app - Express app instance.
 * @param {string} secret - Secret used to sign the session ID cookie.
 * @param {object} sessionConfig - Session options.
 * @param {boolean} sessionConfig.resave - Forces session to be saved back to the store.
 * @param {boolean} sessionConfig.saveUninitialized - Forces uninitialized sessions to be saved.
 * @param {object} sessionConfig.cookie - Cookie options.
 * @param {object} [sessionConfig.store] - Optional session store instance.
 * @returns {void}
 */
export function setupSession(app, secret, sessionConfig = {}) {
  // 1. Validate secret
  if (!secret || typeof secret !== "string" || secret.length < 16) {
    throw new Error("[setupSession] Session secret must be a strong string of at least 16 characters.");
  }

  // 2. Validate sessionConfig booleans
  if (typeof sessionConfig.resave !== "boolean" || typeof sessionConfig.saveUninitialized !== "boolean") {
    throw new Error("[setupSession] sessionConfig must include 'resave' and 'saveUninitialized' booleans.");
  }

  // 3. Determine environment
  const isProd = process.env.NODE_ENV === "production";

  // 4. Build final config
  const finalConfig = {
    secret,
    resave: sessionConfig.resave,
    saveUninitialized: sessionConfig.saveUninitialized,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      ...sessionConfig.cookie,
      secure: isProd && sessionConfig.cookie?.secure !== false, // Only set secure in production unless explicitly disabled
    },
    store: sessionConfig.store || null, // Use custom store if provided
  };

  // 5. Register session middleware
  app.use(session(finalConfig));
}
