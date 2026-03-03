export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN" | "TEMP" | "OTHER";

export type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export interface RoleModel {
  roleId: number;
  roleName: string;
  description: string | null;
}

export interface UserModel {
  userId: number;
  roleId: number;
  username: string;
  passwordHash: string;
  fullName: string;
  contactNumber: string | null;
  email: string;
  employmentType: EmploymentType;
  status: UserStatus;
  createdAt: Date;
}

export interface UserWithRole extends UserModel {
  role?: RoleModel | null;
}

export type SafeUser = Omit<UserModel, "passwordHash"> & {
  roleName?: string | null;
};

export interface RefreshTokenModel {
  id: string;
  userId: number;
  tokenHash: string;
  revoked: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export const toSafeUser = (user: UserWithRole): SafeUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...rest } = user;

  return {
    ...rest,
    roleName: user.role?.roleName ?? null,
  };
};

