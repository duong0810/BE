import express from "express";
import { authMiddleware, adminMiddleware } from "../middlewares/auth.js";
import { verifyZaloToken, zaloAuthMiddleware } from "../middlewares/zaloAuth.js";
import { getUserProfile, updateUserProfile, getAllUsers } from "../controllers/userController.js";

const router = express.Router();

router.put("/me", zaloAuthMiddleware, updateUserProfile);
router.get("/me", zaloAuthMiddleware, getUserProfile);

// API lấy danh sách toàn bộ user (chỉ cho admin)
router.get("/", authMiddleware, adminMiddleware, getAllUsers);

export default router;