import express from "express";
import { verifyZaloToken } from "../middlewares/zaloAuth.js";
import { getUserProfile, updateUserProfile } from "../controllers/userController.js";

const router = express.Router();

// API cập nhật thông tin tài khoản (user tự cập nhật)
router.put("/me", verifyZaloToken, updateUserProfile);
router.get("/me", verifyZaloToken, getUserProfile); 

export default router;