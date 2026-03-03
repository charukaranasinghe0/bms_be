import { randomUUID } from "crypto";
import { hashPassword, comparePassword } from "../utils/hash";
import { signAccessToken, signRefreshToken, type JwtUserPayload, verifyRefreshToken } from "../utils/jwt";
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  findUserByEmailOrUsername,
  findUserById,
} from "../repository/user.repository";
import { createRefreshToken, findRefreshTokenById, revokeRefreshToken } from "../repository/refreshToken.repository";
import { findRoleById, findRoleByName } from "../repository/role.repository";
import { toSafeUser, type SafeUser, type UserWithRole, type EmploymentType, type UserStatus } from "../model/user.model";

interface RegisterInput {
  email: string;
  password: string;
  username: string;
  fullName: string;
  contactNumber?: string;
  employmentType?: EmploymentType;
  roleId?: number;
}

interface LoginInput {
  emailOrUsername: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: SafeUser;
  tokens: AuthTokens;
}

const buildPayload = (user: UserWithRole): JwtUserPayload => ({
  userId: user.userId,
  role: user.role?.roleName ?? "USER",
  roleId: user.roleId,
});

const ensureActiveUser = (status: UserStatus): void => {
  if (status !== "ACTIVE") {
    const err = new Error("User is not active");
    (err as any).statusCode = 403;
    throw err;
  }
};

const issueTokensForUser = async (user: UserWithRole): Promise<AuthTokens> => {
  const jti = randomUUID();
  const accessToken = signAccessToken(buildPayload(user));
  const refreshToken = signRefreshToken(user.userId, jti);

  const passwordHash = await hashPassword(refreshToken);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await createRefreshToken({
    id: jti,
    userId: user.userId,
    tokenHash: passwordHash,
    expiresAt,
  });

  return { accessToken, refreshToken };
};

export const registerUser = async (input: RegisterInput): Promise<AuthResult> => {
  const existingByEmail = await findUserByEmail(input.email);
  if (existingByEmail) {
    throw new Error("Email is already in use");
  }

  const existingByUsername = await findUserByUsername(input.username);
  if (existingByUsername) {
    throw new Error("Username is already in use");
  }

  const passwordHash = await hashPassword(input.password);

  let roleId = input.roleId ?? null;
  if (!roleId) {
    const userRole = await findRoleByName("USER");
    if (!userRole) {
      throw new Error('Default role "USER" not found. Please seed roles.');
    }
    roleId = userRole.roleId;
  } else {
    const role = await findRoleById(roleId);
    if (!role) {
      throw new Error("Provided role does not exist");
    }
  }

  const user = await createUser({
    username: input.username,
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    contactNumber: input.contactNumber,
    roleId: roleId!,
    employmentType: input.employmentType ?? "FULL_TIME",
    status: "ACTIVE",
  });

  ensureActiveUser(user.status);

  const tokens = await issueTokensForUser(user);

  return {
    user: toSafeUser(user),
    tokens,
  };
};

export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const user = await findUserByEmailOrUsername(input.emailOrUsername);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  ensureActiveUser(user.status);

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid credentials");
  }

  const tokens = await issueTokensForUser(user);

  return {
    user: toSafeUser(user),
    tokens,
  };
};

export const rotateRefreshToken = async (token: string): Promise<AuthTokens> => {
  const payload = verifyRefreshToken(token);

  const record = await findRefreshTokenById(payload.jti);
  if (!record || record.revoked) {
    throw new Error("Refresh token is no longer valid");
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new Error("Refresh token has expired");
  }

  const matches = await comparePassword(token, record.tokenHash);
  if (!matches) {
    throw new Error("Refresh token mismatch");
  }

  await revokeRefreshToken(record.id);

  const user = await findUserById(record.userId);
  if (!user) {
    throw new Error("User not found");
  }

  ensureActiveUser(user.status);

  return issueTokensForUser(user);
};


