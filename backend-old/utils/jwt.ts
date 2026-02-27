import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";

export type UserRole = "USER" | "ADMIN" | "MANAGER" | "STAFF" | "OTHER" | string;

export interface JwtUserPayload {
  userId: number;
  role: UserRole;
  roleId: number;
}

export interface RefreshTokenPayload {
  sub: number;
  jti: string;
  iat?: number;
  exp?: number;
}

const accessExpiresIn: SignOptions["expiresIn"] = `${env.ACCESS_TOKEN_TTL_DAYS}d`;
const refreshExpiresIn: SignOptions["expiresIn"] = `${env.REFRESH_TOKEN_TTL_DAYS}d`;

export const signAccessToken = (payload: JwtUserPayload): string => {
  const secret: Secret = env.JWT_ACCESS_SECRET;
  const options: SignOptions = { expiresIn: accessExpiresIn };
  return jwt.sign(payload, secret, options);
};

export const signRefreshToken = (userId: number, jti: string): string => {
  const secret: Secret = env.JWT_REFRESH_SECRET;
  const options: SignOptions = { expiresIn: refreshExpiresIn };
  const payload: { sub: number; jti: string } = { sub: userId, jti };
  return jwt.sign(payload, secret, options);
};

export const verifyAccessToken = (token: string): JwtUserPayload => {
  const secret: Secret = env.JWT_ACCESS_SECRET;
  return jwt.verify(token, secret) as JwtUserPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret: Secret = env.JWT_REFRESH_SECRET;
  const decoded = jwt.verify(token, secret) as JwtPayload & { jti?: string };

  if (typeof decoded.sub !== "string" && typeof decoded.sub !== "number") {
    throw new Error("Invalid refresh token subject");
  }
  if (!decoded.jti) {
    throw new Error("Invalid refresh token id");
  }

  return {
    sub: typeof decoded.sub === "string" ? Number(decoded.sub) : decoded.sub,
    jti: decoded.jti,
    iat: decoded.iat,
    exp: decoded.exp,
  };
};

