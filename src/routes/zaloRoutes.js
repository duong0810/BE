import express from 'express';
import axios from 'axios';
import ZaloAPI from '../utils/zaloApi.js';
import { generateZaloToken, verifyZaloToken } from '../middlewares/zaloAuth.js';
import { getPool } from '../config.js';

const router = express.Router();

// Route để xử lý đăng nhập từ Zalo Mini App
router.post('/auth', async (req, res) => {
  try {
    const { userInfo, accessToken, phoneToken } = req.body;
    
    console.log('Received auth request:', { userInfo, accessToken, phoneToken });
    
    if (!userInfo || !userInfo.id) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin user không hợp lệ'
      });
    }

    // Xử lý phone token nếu có (từ Mini App)
    let phoneNumber = null;
    if (phoneToken) {
      try {
        // Gọi Zalo API để decode phone token
        const phoneResponse = await axios.post('https://graph.zalo.me/v2.0/me/phone', {
          phone_token: phoneToken
        }, {
          headers: {
            'access_token': process.env.ZALO_APP_SECRET // hoặc app access token
          }
        });
        
        phoneNumber = phoneResponse.data.number;
        console.log('Phone number from token:', phoneNumber);
      } catch (phoneError) {
        console.log('Cannot decode phone token:', phoneError.message);
        // Không throw error, vì user có thể chưa cấp quyền phone
      }
    }

    // Kiểm tra và tạo/cập nhật user trong database
    const pool = await getPool();
    
    // Kiểm tra user đã tồn tại chưa
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [userInfo.id]
    );

    let userData;
    
    if (existingUser.rows.length === 0) {
      // Tạo user mới
      const insertResult = await pool.query(
        `INSERT INTO users (zaloid, username, fullname, email, phone, avatar, role, status, createdat, updatedat) 
         VALUES ($1, $2, $3, $4, $5, $6, 'user', 'active', NOW(), NOW()) 
         RETURNING *`,
        [
          userInfo.id,
          userInfo.name || `zalo_user_${userInfo.id}`,
          userInfo.name || '',
          null, // email
          phoneNumber, // phone từ token
          userInfo.avatar || ''
        ]
      );
      userData = insertResult.rows[0];
      console.log('Created new user:', userData.userid);
    } else {
      // Cập nhật thông tin user
      const updateResult = await pool.query(
        `UPDATE users 
         SET fullname = $2, phone = COALESCE($3, phone), avatar = $4, updatedat = NOW()
         WHERE zaloid = $1 
         RETURNING *`,
        [
          userInfo.id,
          userInfo.name || existingUser.rows[0].fullname,
          phoneNumber || existingUser.rows[0].phone, // Giữ phone cũ nếu không có mới
          userInfo.avatar || existingUser.rows[0].avatar
        ]
      );
      userData = updateResult.rows[0];
      console.log('Updated user:', userData.userid);
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
        role: userData.role
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
router.get('/me', verifyZaloToken, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Route để cập nhật thông tin user
router.put('/update', verifyZaloToken, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const pool = await getPool();
    
    const updateResult = await pool.query(
      `UPDATE users 
       SET fullname = $2, phone = $3, updatedat = NOW()
       WHERE zaloid = $1 
       RETURNING *`,
      [req.user.zaloid, name, phone]
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