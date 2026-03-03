import { findUserById, listUsers } from "../repository/user.repository";
import { toSafeUser, type SafeUser } from "../model/user.model";

export const getCurrentUser = async (userId: number): Promise<SafeUser | null> => {
  const user = await findUserById(userId);
  return user ? toSafeUser(user) : null;
};

export const getAllUsers = async (): Promise<SafeUser[]> => {
  const users = await listUsers();
  return users.map(toSafeUser);
};

