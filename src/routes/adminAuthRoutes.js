import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Đặt biến môi trường thật mạnh khi deploy

// Route đăng nhập admin
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    // Tạo JWT token
    const token = jwt.sign(
      { username, role: "admin" },
      JWT_SECRET,
      { expiresIn: "2h" }
    );
    return res.json({ success: true, token });
  }
  return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
});

export default router;