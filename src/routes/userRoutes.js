import express from "express";
import { verifyZaloToken } from "../middlewares/zaloAuth.js";
import { getUserProfile, updateUserProfile } from "../controllers/userController.js";

const router = express.Router();

// API cập nhật thông tin tài khoản (user tự cập nhật)
router.put("/me", verifyZaloToken, updateUserProfile);
router.get("/me", verifyZaloToken, getUserProfile); 

// API lấy danh sách toàn bộ user (chỉ cho admin)
router.get("/", authMiddleware, adminMiddleware, getAllUsers);

export default router;