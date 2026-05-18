import express from "express";
import crypto from "crypto";
import { callHook } from "../utils/hookUtils.js";
import { hashPassword } from "../utils/hashUtils.js";

/**
 * Sets up generic OAuth2 routes for configured providers.
 * Works with any standard OAuth2 provider (Google, GitHub, etc.)
 *
 * Flow:
 *   1. GET  /auth/oauth/:provider         -> Redirects to provider's consent screen
 *   2. GET  /auth/oauth/:provider/callback -> Exchanges code for token, fetches profile, logs in / registers
 *
 * @param {import('express').Application} app - Express app instance.
 * @param {Object} UserModel - Mongoose User model.
 * @param {Object} config - Full auth config.
 */
export function setupOAuthRoutes(app, UserModel, config) {
  const router = express.Router();
  const providers = config.oauth?.providers || {};
  const base = config.route || "/auth";

  // Iterate over each configured provider
  for (const [name, provider] of Object.entries(providers)) {
    // Validate required provider fields
    if (!provider.clientId || !provider.clientSecret || !provider.authorizationUrl || !provider.tokenUrl || !provider.userInfoUrl || !provider.callbackUrl) {
      console.warn(`[light-auth] WARNING: OAuth provider "${name}" is missing required fields. Skipping.`);
      continue;
    }

    // 1. Redirect to provider's authorization URL
    router.get(`/oauth/${name}`, (req, res) => {
      // Generate CSRF state token
      const state = crypto.randomBytes(16).toString("hex");

      // Store state in session or as a cookie for verification
      if (req.session) {
        req.session._oauthState = state;
      } else {
        res.cookie("_oauth_state", state, {
          httpOnly: true,
          sameSite: "lax",
          maxAge: 5 * 60 * 1000, // 5 min
        });
      }

      const params = new URLSearchParams({
        client_id: provider.clientId,
        redirect_uri: provider.callbackUrl,
        response_type: "code",
        scope: provider.scope || "openid email profile",
        state,
      });

      return res.redirect(`${provider.authorizationUrl}?${params.toString()}`);
    });

    // 2. Handle callback from provider
    router.get(`/oauth/${name}/callback`, async (req, res) => {
      try {
        const { code, state } = req.query;

        if (!code || typeof code !== "string") {
          return res.status(400).json({ error: "Authorization code missing." });
        }

        // 2.1 Verify CSRF state
        const cookies = req.cookies || parseCookieHeader(req.headers.cookie);
        const storedState = req.session?._oauthState || cookies._oauth_state;
        if (!storedState || storedState !== state) {
          return res.status(403).json({ error: "OAuth state mismatch. Possible CSRF attack." });
        }

        // Clean up state
        if (req.session?._oauthState) delete req.session._oauthState;
        if (cookies._oauth_state) res.clearCookie("_oauth_state");

        // 2.2 Exchange code for access token
        const tokenResponse = await fetch(provider.tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
          },
          body: new URLSearchParams({
            client_id: provider.clientId,
            client_secret: provider.clientSecret,
            code,
            redirect_uri: provider.callbackUrl,
            grant_type: "authorization_code",
          }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
          console.error(`[light-auth] OAuth token exchange failed for ${name}:`, tokenData);
          return res.status(401).json({ error: "Failed to obtain access token from provider." });
        }

        // 2.3 Fetch user profile from provider
        const profileResponse = await fetch(provider.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/json",
          },
        });

        const profile = await profileResponse.json();

        // 2.4 Extract email using provider's mapping or default
        const mapProfile = provider.mapProfile || defaultProfileMapper;
        const { email, displayName } = mapProfile(profile);

        if (!email) {
          return res.status(400).json({ error: "Could not retrieve email from OAuth provider." });
        }

        // 2.5 Find or create user
        let user = await UserModel.findOne({ email });
        const isNewUser = !user;

        if (!user) {
          // Create user with a random secure password (they authenticate via OAuth)
          const randomPassword = crypto.randomBytes(32).toString("hex");
          const algorithm = config.hashing?.algorithm || "bcrypt";
          const hashedPassword = await hashPassword(randomPassword, algorithm);

          user = await UserModel.create({
            email,
            password: hashedPassword,
            role: "user",
            name: displayName || undefined,
            verified: true, // OAuth emails are pre-verified by the provider
          });

          await callHook(config.hooks?.onRegister, user);
        }

        // 2.6 Call onLogin hook
        const userPayload = { _id: user._id, email: user.email, role: user.role };
        const extendedPayload = typeof config.hooks?.onLogin === "function"
          ? await config.hooks.onLogin(user)
          : null;

        if (extendedPayload && typeof extendedPayload === "object") {
          Object.assign(userPayload, extendedPayload);
        }

        // 2.7 Issue JWT or create session
        if (config.useSession && req.session) {
          req.session.user = userPayload;
        }

        // 2.8 Call custom onOAuthSuccess callback or redirect
        if (typeof provider.onSuccess === "function") {
          return provider.onSuccess(req, res, {
            user: userPayload,
            isNewUser,
            profile,
            accessToken: tokenData.access_token,
          });
        }

        // Default: redirect to successRedirect or return JSON
        if (provider.successRedirect) {
          return res.redirect(provider.successRedirect);
        }

        return res.json({
          message: `OAuth login via ${name} successful.`,
          user: userPayload,
          isNewUser,
        });
      } catch (err) {
        console.error(`[light-auth] OAuth callback error for ${name}:`, err);
        await callHook(config.hooks?.onError, {
          type: "oauth",
          error: err,
          req,
        });

        if (provider.failureRedirect) {
          return res.redirect(provider.failureRedirect);
        }

        return res.status(500).json({ error: "OAuth authentication failed." });
      }
    });
  }

  // Mount OAuth router
  app.use(base, router);
}


/**
 * Default profile mapper for standard OpenID Connect providers.
 * @param {Object} profile - Raw profile object from the provider.
 * @returns {{ email: string, displayName: string, avatarUrl: string }}
 */
function defaultProfileMapper(profile) {
  return {
    email: profile.email || profile.mail || null,
    displayName: profile.name || profile.displayName || profile.login || null,
    avatarUrl: profile.picture || profile.avatar_url || null,
  };
}

function parseCookieHeader(header) {
  if (!header || typeof header !== "string") return {};

  return header.split(";").reduce((cookies, part) => {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) return cookies;

    const value = rawValue.join("=");
    try {
      cookies[rawKey] = decodeURIComponent(value);
    } catch {
      cookies[rawKey] = value;
    }
    return cookies;
  }, {});
}
