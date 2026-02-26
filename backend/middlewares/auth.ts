import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtUserPayload, type UserRole } from "../utils/jwt";

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = authHeader.substring("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    (req as AuthenticatedRequest).user = payload;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export const requireRole = (role: UserRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (role === "ADMIN" && user.role !== "ADMIN") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    next();
  };
};

