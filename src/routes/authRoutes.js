import express from "express";
import jwt from "jsonwebtoken";
import { getPool } from "../config.js";
import axios from "axios";

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

// Đăng ký/đăng nhập user bằng Zalo (tự động lấy thông tin từ Zalo)
router.post("/zalo-login", async (req, res) => {
  const { accessToken, code } = req.body;
  
  if (!accessToken) {
    return res.status(400).json({ error: "Thiếu access token" });
  }
  
  try {
    // Lấy thông tin user từ Zalo API
    const userInfoResponse = await axios.get('https://graph.zalo.me/v2.0/me', {
      headers: {
        'access_token': accessToken
      },
      params: {
        fields: 'id,name,picture'
      }
    });
    
    const zaloUserInfo = userInfoResponse.data;
    
    if (!zaloUserInfo.id) {
      return res.status(400).json({ error: "Không thể lấy thông tin từ Zalo" });
    }
    
    const pool = await getPool();
    const zaloId = zaloUserInfo.id;
    
    // Kiểm tra user đã tồn tại chưa
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [zaloId]
    );
    
    if (existingUser.rows.length > 0) {
      // User đã tồn tại, cập nhật thông tin nếu cần
      const user = existingUser.rows[0];
      await pool.query(
        `UPDATE users SET 
          username = $1, 
          fullname = $2, 
          avatar = $3,
          updatedat = NOW()
         WHERE zaloid = $4`,
        [
          zaloUserInfo.name, 
          zaloUserInfo.name, 
          zaloUserInfo.picture?.data?.url || null,
          zaloId
        ]
      );
      
      return res.json({ 
        success: true, 
        message: "Đăng nhập thành công",
        user: {
          userId: user.userid,
          zaloId: zaloId,
          username: zaloUserInfo.name,
          fullname: zaloUserInfo.name,
          avatar: zaloUserInfo.picture?.data?.url || user.avatar
        }
      });
    } else {
      // Tạo user mới
      const insertResult = await pool.query(
        `INSERT INTO users (zaloid, username, fullname, avatar, status, createdat) 
         VALUES ($1, $2, $3, $4, $5, NOW()) 
         RETURNING userid`,
        [
          zaloId,
          zaloUserInfo.name,
          zaloUserInfo.name,
          zaloUserInfo.picture?.data?.url || null,
          "active"
        ]
      );
      
      const newUserId = insertResult.rows[0].userid;
      
      return res.json({ 
        success: true, 
        message: "Đăng ký thành công",
        user: {
          userId: newUserId,
          zaloId: zaloId,
          username: zaloUserInfo.name,
          fullname: zaloUserInfo.name,
          avatar: zaloUserInfo.picture?.data?.url || null
        }
      });
    }
    
  } catch (error) {
    console.error("Lỗi khi xử lý đăng nhập Zalo:", error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: "Access token không hợp lệ hoặc đã hết hạn" });
    }
    
    return res.status(500).json({ error: "Lỗi server khi xử lý đăng nhập" });
  }
});

// Lấy thông tin user hiện tại
router.get("/me", async (req, res) => {
  const { zaloId } = req.query;
  
  if (!zaloId) {
    return res.status(400).json({ error: "Thiếu zaloId" });
  }
  
  try {
    const pool = await getPool();
    const userResult = await pool.query(
      "SELECT userid, zaloid, username, fullname, phone, avatar, gender, birthday, city, district, ward, address, status FROM users WHERE zaloid = $1",
      [zaloId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy user" });
    }
    
    res.json({ 
      success: true, 
      user: userResult.rows[0] 
    });
  } catch (err) {
    console.error("Lỗi khi lấy thông tin user:", err);
    res.status(500).json({ error: err.message });
  }
});

// Đăng ký user bằng Zalo (legacy - dành cho test)
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