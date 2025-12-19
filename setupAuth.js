import express from "express";
import helmet from "helmet";
import { setupSession } from "./modules/auth/session.js";
import { createUserModel } from "./modules/utils/userModel.js";
import { validatePassword } from "./modules/utils/validators.js";
import { callHook } from "./modules/utils/hookUtils.js";
import {
  registerRoute,
  loginRoute,
  logoutRoute
} from "./modules/routes/authRoutes.js";
import {
  authenticate,
  authorize
} from "./modules/middleware/authMiddleware.js";
import { setupEmailRoutes } from "./modules/email/routes/emailRoutes.js";
import { defaultSendMail } from "./modules/email/services/emailService.js";


/**
 * Sets up authentication, session, and email verification routes for the app.
 * Deep-merges config, validates requirements, and wires up all middleware.
 * @param {import('express').Application} app - Express app instance.
 * @param {Object} config - Auth configuration object.
 * @returns {Promise<{auth: {authenticate: Function, authorize: Function}, models: {User: any}}>} Auth middleware and models.
 */
export async function setupAuth(app, config) {
  // 1. Define default config
  const defaults = {
    route: "/auth",
    useSession: false,
    roles: ["user"],
    passwordPolicy: { minLength: 8 },
    rateLimiting: {
      login: {
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: "Too many login attempts.",
        store: null
      },
      register: {
        windowMs: 60 * 60 * 1000,
        max: 5,
        message: "Too many registration attempts.",
        store: null
      }
    },
    sessionConfig: {
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, sameSite: "lax" },
      store: null
    },
    jwtConfig: { expiresIn: "1h" },
    User: null,
    emailVerification: null,
    forgotPassword: null,
    hooks: {}
  };

  // 2. Deep-merge user config with defaults
  const merged = {
    ...defaults,
    ...config,
    passwordPolicy: {
      ...defaults.passwordPolicy,
      ...(config.passwordPolicy || {})
    },
    rateLimiting: {
      login: {
        ...defaults.rateLimiting.login,
        ...(config.rateLimiting?.login || {})
      },
      register: {
        ...defaults.rateLimiting.register,
        ...(config.rateLimiting?.register || {})
      }
    },
    sessionConfig: {
      ...defaults.sessionConfig,
      ...(config.sessionConfig || {}),
      cookie: {
        ...defaults.sessionConfig.cookie,
        ...(config.sessionConfig?.cookie || {})
      }
    },
    jwtConfig: {
      ...defaults.jwtConfig,
      ...(config.jwtConfig || {})
    },
    hooks: {
      ...defaults.hooks,
      ...(config.hooks || {})
    }
  };

  // 3. Destructure merged config
  const {
    db,
    route,
    jwtSecret,
    useSession,
    roles,
    passwordPolicy,
    rateLimiting,
    sessionConfig,
    jwtConfig,
    emailVerification,
    forgotPassword
  } = merged;

  // 3.1 Startup Banner & Feature Logging
  console.log("\n==================================================");
  console.log("🚀 Initializing Light-Auth...");
  console.log("==================================================");
  console.log(`✅ Auth Mode:     ${useSession ? "Session-based" : "JWT-based"}`);
  console.log(`✅ Base Route:    ${route}`);
  console.log(`✅ Roles:         ${roles.join(", ")}`);
  if (emailVerification?.enabled) console.log(`✅ Email Verify:  Enabled`);
  if (forgotPassword?.enabled) console.log(`✅ Forgot Pass:   Enabled`);
  console.log("==================================================\n");

  // 4. Validate critical requirements
  if (!jwtSecret || typeof jwtSecret !== "string" || jwtSecret.length < 16) {
    const error = new Error("[setupAuth] ❌ jwtSecret is required and must be a strong, non-default string (min 16 chars).");
    await callHook(merged.hooks?.onError, { type: "setup", error });
    throw error;
  }

  if (!db || !db.model) {
    const error = new Error("[setupAuth] ❌ Mongoose DB connection required.");
    await callHook(merged.hooks?.onError, { type: "setup", error });
    throw error;
  }

  // 5. Create User model if not provided
  const UserModel = merged.User || (await createUserModel(merged, roles, db));

  // 6. Register security middleware
  app.use(helmet());

  // 7. Only initialize session middleware once per app
  if (useSession && !app._sessionInitialized) {
    setupSession(app, jwtSecret, sessionConfig);
    app._sessionInitialized = true;
  }

  // 8. Create router and register core auth routes
  const router = express.Router();
  router.use(express.json());

  // 8.1 Register route: user registration
  registerRoute(
    router,
    UserModel,
    roles,
    validatePassword(passwordPolicy),
    rateLimiting.register,
    merged
  );

  // 8.2 Register route: user login
  const requireEmailVerified = !!(
    emailVerification && emailVerification.requiredToLogin
  );
  loginRoute(
    router,
    UserModel,
    jwtSecret,
    jwtConfig,
    useSession,
    rateLimiting.login,
    requireEmailVerified,
    merged
  );

  // 8.3 Register route: user logout
  logoutRoute(router, useSession, merged);

  // 9. Mount router on app
  app.use(route, router);

  // 10. Email verification + forgot password support
  const emailFeaturesEnabled =
    emailVerification?.enabled || forgotPassword?.enabled;

  if (emailFeaturesEnabled) {
    const isProd = process.env.NODE_ENV === "production";
    const allowMock = process.env.ALLOW_MOCK_EMAILS === "true";

    // 10.1 Provide default sendMail if not set
    if (emailVerification?.enabled && !emailVerification.sendMail) {
      if (isProd && !allowMock) {
        const error = new Error(
          "[setupAuth] Email verification is enabled but no sendMail function provided. Use a real mailer or set ALLOW_MOCK_EMAILS=true."
        );
        await callHook(merged.hooks?.onError, { type: "setup", error });
        throw error;
      }
      merged.emailVerification.sendMail = defaultSendMail;
    }

    if (forgotPassword?.enabled && !forgotPassword.sendMail) {
      if (isProd && !allowMock) {
        const error = new Error(
          "[setupAuth] Forgot password is enabled but no sendMail function provided. Use a real mailer or set ALLOW_MOCK_EMAILS=true."
        );
        await callHook(merged.hooks?.onError, { type: "setup", error });
        throw error;
      }
      merged.forgotPassword.sendMail = defaultSendMail;
    }

    // 10.2 Register email routes
    setupEmailRoutes(app, UserModel, merged);
  }

  // 11. Export auth middleware + models
  return {
    auth: {
      authenticate: authenticate(useSession, jwtSecret),
      authorize
    },
    models: {
      User: UserModel
    }
  };
}
