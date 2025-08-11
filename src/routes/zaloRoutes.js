import express from 'express';
import axios from 'axios';
import ZaloAPI from '../utils/zaloApi.js';
import { generateZaloToken, verifyZaloToken, zaloAuthMiddleware } from '../middlewares/zaloAuth.js';
import { getPool } from '../config.js';

const router = express.Router();

// ✅ THÊM FUNCTION FORMAT PHONE NUMBER
const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove any existing formatting
  const cleanPhone = phone.replace(/[^\d]/g, '');
  
  // Check if it's Vietnamese number
  if (cleanPhone.startsWith('84') && cleanPhone.length >= 10) {
    // Format: 84372284930 → +84 372284930
    const countryCode = cleanPhone.substring(0, 2); // 84
    const mainNumber = cleanPhone.substring(2);      // 372284930
    return `+${countryCode} ${mainNumber}`;
  }
  
  // If it starts with 0, convert to +84 format
  if (cleanPhone.startsWith('0') && cleanPhone.length >= 10) {
    // Format: 0372284930 → +84 372284930
    const mainNumber = cleanPhone.substring(1);      // 372284930
    return `+84 ${mainNumber}`;
  }
  
  // Default: just add + if it's all numbers
  if (cleanPhone.length >= 10) {
    return `+${cleanPhone}`;
  }
  
  // Return original if can't format
  return phone;
};

// Route để xử lý đăng nhập từ Zalo Mini App
router.post('/auth', async (req, res) => {
  try {
    const { userInfo, accessToken, phoneNumber } = req.body;

    console.log('Received auth request:', { userInfo, accessToken, phoneNumber });

    const actualUserInfo = userInfo?.userInfo || userInfo;

    if (!actualUserInfo || !actualUserInfo.id) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin user không hợp lệ'
      });
    }

    console.log('Using userInfo:', actualUserInfo);
    console.log('Received phone number:', phoneNumber);

    // ✅ FORMAT PHONE NUMBER
    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log('Formatted phone:', formattedPhone);

    const pool = await getPool();
    
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [actualUserInfo.id]
    );

    let userData;
    
    if (existingUser.rows.length === 0) {
      // Tạo user mới
      const insertResult = await pool.query(
        `INSERT INTO users (zaloid, username, fullname, email, phone, avatar, role, status, createdat, updatedat) 
         VALUES ($1, $2, $3, $4, $5, $6, 'user', 'active', NOW(), NOW()) 
         RETURNING *`,
        [
          actualUserInfo.id,
          actualUserInfo.name || `zalo_user_${actualUserInfo.id}`,
          actualUserInfo.name || '',
          actualUserInfo.email || null,
          formattedPhone, // ← DÙNG FORMATTED PHONE
          actualUserInfo.avatar || ''
        ]
      );
      userData = insertResult.rows[0];
      console.log('Created new user with formatted phone:', userData.userid, formattedPhone);
    } else {
      // Cập nhật thông tin user
      const updateResult = await pool.query(
        `UPDATE users 
         SET fullname = $2, phone = COALESCE($3, phone), avatar = $4, updatedat = NOW()
         WHERE zaloid = $1 
         RETURNING *`,
        [
          actualUserInfo.id,
          actualUserInfo.name || existingUser.rows[0].fullname,
          formattedPhone || existingUser.rows[0].phone, // ← DÙNG FORMATTED PHONE
          actualUserInfo.avatar || existingUser.rows[0].avatar
        ]
      );
      userData = updateResult.rows[0];
      console.log('Updated user with formatted phone:', userData.userid, formattedPhone);
    }

    // Tạo JWT token
    const jwtToken = generateZaloToken(userData);

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token: jwtToken,
      user: {
        id: userData.userid,
        zaloid: userData.zaloid,
        username: userData.username,
        fullname: userData.fullname,
        phone: userData.phone, 
        avatar: userData.avatar,
        role: userData.role,
        status: userData.status
      }
    });

  } catch (error) {
    console.error('Zalo auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xử lý đăng nhập',
      error: error.message
    });
  }
});

// Route để lấy thông tin user hiện tại
router.get('/me', verifyZaloToken, zaloAuthMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Route để cập nhật thông tin user
router.put('/update', verifyZaloToken, zaloAuthMiddleware, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const pool = await getPool();
    
    // ✅ FORMAT PHONE KHI UPDATE
    const formattedPhone = formatPhoneNumber(phone);
    
    const updateResult = await pool.query(
      `UPDATE users 
       SET fullname = $2, phone = $3, updatedat = NOW()
       WHERE zaloid = $1 
       RETURNING *`,
      [req.user.zaloid, name, formattedPhone] // ← DÙNG FORMATTED PHONE
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại'
      });
    }

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật thông tin'
    });
  }
});

export default router;