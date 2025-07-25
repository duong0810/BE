import express from "express";
import { verifyZaloToken, zaloAuthMiddleware } from "../middlewares/zaloAuth.js";
import { getUserProfile, updateUserProfile, getAllUsers } from "../controllers/userController.js";
import { deleteUser, adminUpdateUser } from "../controllers/userController.js";
import { authMiddleware, adminMiddleware } from "../middlewares/auth.js";
const router = express.Router();

router.put("/me", verifyZaloToken, zaloAuthMiddleware, updateUserProfile);
router.get("/me", verifyZaloToken, zaloAuthMiddleware, getUserProfile);

// API lấy danh sách toàn bộ user (chỉ cho admin)
router.get("/", verifyZaloToken, zaloAuthMiddleware, getAllUsers);


// Xoá user (chỉ admin)
router.delete("/:id", authMiddleware, adminMiddleware, deleteUser);

// Sửa thông tin user (chỉ admin)
router.put("/:id", authMiddleware, adminMiddleware, adminUpdateUser);
export default router;