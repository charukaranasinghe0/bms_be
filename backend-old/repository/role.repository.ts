import { prisma } from "../db/prisma";
import type { RoleModel } from "../model/user.model";

export const findRoleById = async (roleId: number): Promise<RoleModel | null> => {
  return prisma.role.findUnique({ where: { roleId } });
};

export const findRoleByName = async (roleName: string): Promise<RoleModel | null> => {
  return prisma.role.findUnique({ where: { roleName } });
};

