import { prisma } from "../db/prisma";
import type { RefreshTokenModel } from "../model/user.model";

interface CreateRefreshTokenInput {
  id: string;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}

export const createRefreshToken = async (input: CreateRefreshTokenInput): Promise<RefreshTokenModel> => {
  const { id, userId, tokenHash, expiresAt } = input;

  return prisma.refreshToken.create({
    data: {
      id,
      userId,
      tokenHash,
      expiresAt,
    },
  });
};

export const findRefreshTokenById = async (id: string): Promise<RefreshTokenModel | null> => {
  return prisma.refreshToken.findUnique({
    where: { id },
  });
};

export const revokeRefreshToken = async (id: string): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { id, revoked: false },
    data: { revoked: true },
  });
};

