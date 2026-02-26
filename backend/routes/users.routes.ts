import { Router } from "express";
import { getMe, getUsers } from "../controller/user.controller";
import { authenticate, requireRole } from "../middlewares/auth";

const router = Router();

router.get("/me", authenticate, getMe);
router.get("/", authenticate, requireRole("ADMIN"), getUsers);

export default router;

