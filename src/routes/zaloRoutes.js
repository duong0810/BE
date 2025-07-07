import express from 'express';
import ZaloAPI from '../utils/zaloApi.js';
import { generateZaloToken, verifyZaloToken } from '../middlewares/zaloAuth.js';
import { getPool } from '../config.js';

const router = express.Router();

// Route để xử lý thông tin user từ Mini App
router.post('/auth', async (req, res) => {
  try {
    const { userInfo } = req.body;
    const accessToken = req.headers['zalo-access-token'] || req.headers['access-token'];
    
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        message: 'Thiếu Zalo access token'
      });
    }

    // Verify và lấy thông tin thật từ Zalo API
    let realUserInfo;
    try {
      const userInfoResponse = await axios.get('https://graph.zalo.me/v2.0/me', {
        headers: {
          'access_token': accessToken
        },
        params: {
          fields: 'id,name,picture,birthday,gender'
        }
      });
      
      realUserInfo = userInfoResponse.data;
      
      if (!realUserInfo.id) {
        return res.status(401).json({
          success: false,
          message: 'Access token không hợp lệ'
        });
      }

      // Thử lấy số điện thoại (nếu có quyền)
      try {
        const phoneResponse = await axios.get('https://graph.zalo.me/v2.0/me', {
          headers: {
            'access_token': accessToken
          },
          params: {
            fields: 'phone'
          }
        });
        
        if (phoneResponse.data.phone) {
          realUserInfo.phone = phoneResponse.data.phone;
        }
      } catch (phoneError) {
        console.log('Phone permission not granted:', phoneError.message);
      }
    } catch (error) {
      console.error('Zalo API verification failed:', error);
      return res.status(401).json({
        success: false,
        message: 'Access token không hợp lệ hoặc đã hết hạn'
      });
    }

    // Kiểm tra và tạo/cập nhật user trong database với thông tin thật
    const pool = await getPool();
    
    // Kiểm tra user đã tồn tại chưa
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [realUserInfo.id]
    );

    let userData;
    
    if (existingUser.rows.length === 0) {
      // Tạo user mới với thông tin thật từ Zalo
      const insertResult = await pool.query(
        `INSERT INTO users (zaloid, username, fullname, avatar, phone, birthday, gender, createdat, updatedat) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) 
         RETURNING *`,
        [
          realUserInfo.id,
          realUserInfo.name || `user_${realUserInfo.id}`,
          realUserInfo.name || '',
          realUserInfo.picture?.data?.url || '',
          realUserInfo.phone || null,
          realUserInfo.birthday || null,
          realUserInfo.gender || null
        ]
      );
      userData = insertResult.rows[0];
    } else {
      // Cập nhật thông tin user với data thật từ Zalo
      const updateResult = await pool.query(
        `UPDATE users 
         SET username = $2, fullname = $3, avatar = $4, phone = $5, birthday = $6, gender = $7, updatedat = NOW()
         WHERE zaloid = $1 
         RETURNING *`,
        [
          realUserInfo.id,
          realUserInfo.name || existingUser.rows[0].username,
          realUserInfo.name || existingUser.rows[0].fullname,
          realUserInfo.picture?.data?.url || existingUser.rows[0].avatar,
          realUserInfo.phone || existingUser.rows[0].phone,
          realUserInfo.birthday || existingUser.rows[0].birthday,
          realUserInfo.gender || existingUser.rows[0].gender
        ]
      );
      userData = updateResult.rows[0];
    }

    // Tạo JWT token
    const jwtToken = generateZaloToken({
      id: realUserInfo.id,
      name: realUserInfo.name,
      picture: { data: { url: realUserInfo.picture?.data?.url } },
      phone: realUserInfo.phone,
      birthday: realUserInfo.birthday,
      gender: realUserInfo.gender
    });

    res.json({
      success: true,
      message: 'Đăng nhập thành công với thông tin Zalo thật',
      token: jwtToken,
      user: {
        id: realUserInfo.id,
        name: realUserInfo.name,
        avatar: realUserInfo.picture?.data?.url || '',
        phone: realUserInfo.phone || '',
        birthday: realUserInfo.birthday,
        gender: realUserInfo.gender
      }
    });

  } catch (error) {
    console.error('Zalo auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi xử lý đăng nhập'
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
      [req.user.zaloId, name, phone]
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