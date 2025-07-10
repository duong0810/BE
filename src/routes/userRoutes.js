import express from "express";
import { authMiddleware, adminMiddleware } from "../middlewares/auth.js";
import { getUserProfile, updateUserProfile, getAllUsers } from "../controllers/userController.js";

const router = express.Router();

router.put("/me", verifyZaloToken, updateUserProfile);
router.get("/me", verifyZaloToken, getUserProfile);

// API lấy danh sách toàn bộ user (chỉ cho admin)
router.get("/", authMiddleware, adminMiddleware, getAllUsers);

export default router;