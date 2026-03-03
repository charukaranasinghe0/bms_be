import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../config/env";
import { registerUser, loginUser, rotateRefreshToken } from "../service/auth.service";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { verifyRefreshToken } from "../utils/jwt";
import { revokeRefreshToken } from "../repository/refreshToken.repository";

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(6),
  fullName: z.string().min(1),
  contactNumber: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN", "TEMP", "OTHER"]).optional(),
  roleId: z.number().int().positive().optional(),
});

const loginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(6),
});

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(env.REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await registerUser(parsed.data);

    setRefreshCookie(res, result.tokens.refreshToken);

    res.status(201).json({
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (err: any) {
    const status = err?.statusCode ?? 400;
    res.status(status).json({ message: err?.message ?? "Registration failed" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten() });
    return;
  }

  try {
    const result = await loginUser(parsed.data);

    setRefreshCookie(res, result.tokens.refreshToken);

    res.status(200).json({
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (err: any) {
    const status = err?.statusCode ?? 401;
    res.status(status).json({ message: err?.message ?? "Login failed" });
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[env.REFRESH_COOKIE_NAME];

  if (!token) {
    res.status(401).json({ message: "Refresh token missing" });
    return;
  }

  try {
    const tokens = await rotateRefreshToken(token);

    setRefreshCookie(res, tokens.refreshToken);

    res.status(200).json({
      accessToken: tokens.accessToken,
    });
  } catch (err: any) {
    const status = err?.statusCode ?? 401;
    res.status(status).json({ message: err?.message ?? "Refresh failed" });
  }
};

export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const token = req.cookies?.[env.REFRESH_COOKIE_NAME];

  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await revokeRefreshToken(payload.jti);
    } catch {
      // ignore errors on logout
    }
  }

  res.clearCookie(env.REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.status(204).send();
};

