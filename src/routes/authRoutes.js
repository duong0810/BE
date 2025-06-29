import express from "express";
import jwt from "jsonwebtoken";
import { getPool } from "../config.js";
const router = express.Router();

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
  username === process.env.ADMIN_USERNAME &&
  password === process.env.ADMIN_PASSWORD
) {
  // Tạo token JWT có thêm trường role
  const token = jwt.sign(
    { username, role: "admin" }, // Thêm role: "admin"
    process.env.JWT_SECRET || "your_jwt_secret",
    { expiresIn: "1d" }
  );
  return res.json({ success: true, token });
}
  return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
});

// Đăng ký user bằng Zalo
router.post("/register", async (req, res) => {
  const { zaloId, username, phone, fullName, avatar } = req.body;
  if (!zaloId || !username || !phone) {
    return res.status(400).json({ error: "Thiếu thông tin đăng ký" });
  }
  try {
    const pool = await getPool();
    // Kiểm tra đã tồn tại user chưa
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    if (userResult.rows.length > 0) {
      return res.json({ success: true, message: "Đã đăng ký" });
    }
    // Tạo mới user
    await pool.query(
      "INSERT INTO users (zaloid, username, phone, fullname, avatar, status) VALUES ($1, $2, $3, $4, $5, $6)",
      [zaloId, username, phone, fullName || username, avatar, "active"]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/update", async (req, res) => {
  const { zaloId, username, gender, birthday, city, district, ward, address } = req.body;
  if (!zaloId) {
    return res.status(400).json({ error: "Thiếu zaloId" });
  }
  try {
    const pool = await getPool();
    await pool.query(
      `UPDATE users SET 
        username = $1, 
        gender = $2, 
        birthday = $3, 
        city = $4, 
        district = $5, 
        ward = $6, 
        address = $7,
        updatedat = NOW()
      WHERE zaloid = $8`,
      [username, gender, birthday, city, district, ward, address, zaloId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;