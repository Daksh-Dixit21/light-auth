import jwt from "jsonwebtoken";

/**
 * Authenticates requests using session or JWT.
 * Attaches `req.user` = { id, role, ...patches } on success.
 * @param {boolean} useSession - If true, use session-based auth; else JWT.
 * @param {string} jwtSecret - Secret for verifying JWT tokens.
 * @returns {import('express').RequestHandler} Express middleware.
 */
export function authenticate(useSession, jwtSecret) {
  return function (req, res, next) {
    try {
      // 1. Session-based authentication
      if (useSession) {
        if (req.session && req.session.user) {
          req.user = req.session.user;
          return next();
        }
        return res.status(401).json({ error: "Unauthorized: No active session." });
      }

      // 2. JWT-based authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Bearer token missing." });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Token not provided." });
      }

      const decoded = jwt.verify(token, jwtSecret);
      if (!decoded || !decoded.id || !decoded.role) {
        return res.status(401).json({ error: "Unauthorized: Token payload incomplete." });
      }

      // 2.1 Attach decoded token to request
      req.user = {
        id: decoded.id,
        role: decoded.role,
        ...decoded // includes patch from onLogin if added
      };

      return next();
    } catch (err) {
      console.error("[authMiddleware] JWT error:", err.message);

      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Unauthorized: Token expired." });
      }

      return res.status(401).json({ error: "Unauthorized: Invalid token." });
    }
  };
}


/**
 * Role-based access control middleware.
 * Only allows requests with a user role in the allowedRoles list.
 * @param {string[]} allowedRoles - List of roles allowed to access route.
 * @returns {import('express').RequestHandler} Express middleware.
 */
export function authorize(allowedRoles = []) {
  return function (req, res, next) {
    // 1. Check for user and role
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: "Forbidden: No role assigned." });
    }

    // 2. Check if user role is allowed
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions." });
    }

    next();
  };
}
