import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../utils/auth";

// Extend Express Request interface to hold authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// Middleware to verify if user is logged in
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Access token missing or malformed." });
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res
      .status(401)
      .json({
        error: "Session expired or invalid token. Please log in again.",
      });
  }

  req.user = decoded;
  next();
}

// Middleware to enforce specific roles (e.g. PLATFORM_ADMIN or HOUSEHOLD_ADMIN)
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "You do not have permission to perform this action." });
    }

    next();
  };
}
