import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth";
import { getAllUsers, getCurrentUser } from "../service/user.service";

export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const user = await getCurrentUser(req.user.userId);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.status(200).json({ user });
};

export const getUsers = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const users = await getAllUsers();
  res.status(200).json({ users });
};

