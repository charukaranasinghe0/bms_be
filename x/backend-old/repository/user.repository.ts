import { prisma } from "../db/prisma";
import type { EmploymentType, UserStatus, UserWithRole } from "../model/user.model";

export const findUserByEmail = async (email: string): Promise<UserWithRole | null> => {
  return prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });
};

export const findUserByUsername = async (username: string): Promise<UserWithRole | null> => {
  return prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });
};

export const findUserByEmailOrUsername = async (
  emailOrUsername: string,
): Promise<UserWithRole | null> => {
  return prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
    },
    include: { role: true },
  });
};

export const findUserById = async (userId: number): Promise<UserWithRole | null> => {
  return prisma.user.findUnique({
    where: { userId },
    include: { role: true },
  });
};

interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  contactNumber?: string | null;
  roleId: number;
  employmentType?: EmploymentType;
  status?: UserStatus;
}

export const createUser = async (data: CreateUserInput): Promise<UserWithRole> => {
  const {
    username,
    email,
    passwordHash,
    fullName,
    contactNumber,
    roleId,
    employmentType = "FULL_TIME",
    status = "ACTIVE",
  } = data;

  return prisma.user.create({
    data: {
      username,
      email,
      passwordHash,
      fullName,
      contactNumber,
      roleId,
      employmentType,
      status,
    },
    include: { role: true },
  });
};

export const listUsers = async (): Promise<UserWithRole[]> => {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { role: true },
  });
};

