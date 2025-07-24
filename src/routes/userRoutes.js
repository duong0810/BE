import express from "express";
import { verifyZaloToken, zaloAuthMiddleware } from "../middlewares/zaloAuth.js";
import { getUserProfile, updateUserProfile, getAllUsers } from "../controllers/userController.js";

const router = express.Router();

router.put("/me", verifyZaloToken, zaloAuthMiddleware, updateUserProfile);
router.get("/me", verifyZaloToken, zaloAuthMiddleware, getUserProfile);

// API lấy danh sách toàn bộ user (chỉ cho admin)
router.get("/", verifyZaloToken, zaloAuthMiddleware, getAllUsers);

export default router;