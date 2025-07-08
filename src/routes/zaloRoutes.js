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

    // Handle nested userInfo structure from Frontend
    const actualUserInfo = userInfo?.userInfo || userInfo;

    if (!actualUserInfo || !actualUserInfo.id) {
      return res.status(400).json({
        success: false,
        message: 'Thông tin user không hợp lệ'
      });
    }

    console.log('Using userInfo:', actualUserInfo);

    // Xử lý phone token nếu có (từ Mini App)
    let phoneNumber = null;
    if (phoneToken && accessToken) {
      try {
        console.log('Attempting to decode phone token:', phoneToken.substring(0, 20) + '...');
        
        // ✅ METHOD 1: Sử dụng API endpoint đúng theo Zalo docs
        try {
          const phoneResponse = await axios.get(
            `https://graph.zalo.me/v2.0/me/info?access_token=${accessToken}&code=${phoneToken}&fields=name,picture`
          );
          
          console.log('Method 1 (correct API) response:', phoneResponse.data);
          
          if (phoneResponse.data.error === 0 && phoneResponse.data.data && phoneResponse.data.data.number) {
            phoneNumber = phoneResponse.data.data.number;
            console.log('✅ Successfully decoded phone number:', phoneNumber);
          } else {
            console.log('❌ Method 1 - Cannot decode phone number:', phoneResponse.data);
            throw new Error('Method 1 failed');
          }
        } catch (method1Error) {
          console.log('Method 1 failed:', method1Error.response?.data || method1Error.message);
          
          // ✅ METHOD 2: Thử với alternative endpoint
          try {
            const phoneResponse = await axios.get(
              `https://openapi.zalo.me/v2.0/me/info?access_token=${accessToken}&code=${phoneToken}&fields=name,picture`
            );
            
            console.log('Method 2 (alternative API) response:', phoneResponse.data);
            
            if (phoneResponse.data.error === 0 && phoneResponse.data.data && phoneResponse.data.data.number) {
              phoneNumber = phoneResponse.data.data.number;
              console.log('✅ Method 2 - Successfully decoded phone number:', phoneNumber);
            } else {
              console.log('❌ Method 2 - Cannot decode phone number:', phoneResponse.data);
              throw new Error('Method 2 failed');
            }
          } catch (method2Error) {
            console.log('Method 2 failed:', method2Error.response?.data || method2Error.message);
            
            // ✅ METHOD 3: Thử với app secret
            try {
              const phoneResponse = await axios.get(
                `https://graph.zalo.me/v2.0/me/info?access_token=${accessToken}&code=${phoneToken}&secret_key=${process.env.ZALO_APP_SECRET}&fields=name,picture`
              );
              
              console.log('Method 3 (with secret) response:', phoneResponse.data);
              
              if (phoneResponse.data.error === 0 && phoneResponse.data.data && phoneResponse.data.data.number) {
                phoneNumber = phoneResponse.data.data.number;
                console.log('✅ Method 3 - Successfully decoded phone number:', phoneNumber);
              } else {
                console.log('❌ Method 3 - Cannot decode phone number:', phoneResponse.data);
                throw new Error('Method 3 failed');
              }
            } catch (method3Error) {
              console.log('Method 3 failed:', method3Error.response?.data || method3Error.message);
              
              // ✅ METHOD 4: Fallback - thử với old endpoint (backup)
              try {
                const phoneResponse = await axios.post('https://graph.zalo.me/v2.0/me/phone', {
                  phone_token: phoneToken
                }, {
                  headers: {
                    'access_token': accessToken
                  }
                });
                
                console.log('Method 4 (fallback) response:', phoneResponse.data);
                
                // Extract phone number từ response
                phoneNumber = phoneResponse.data?.data?.number || 
                              phoneResponse.data?.number || 
                              phoneResponse.data?.phone_number;
                              
                if (phoneNumber) {
                  console.log('✅ Method 4 - Successfully decoded phone number:', phoneNumber);
                } else {
                  throw new Error('Method 4 - No phone number in response');
                }
              } catch (method4Error) {
                console.log('Method 4 failed:', method4Error.response?.data || method4Error.message);
                throw new Error('All phone decode methods failed');
              }
            }
          }
        }
        
      } catch (phoneError) {
        console.error('Cannot decode phone token:', {
          error: phoneError.message,
          tokenLength: phoneToken?.length,
          accessTokenLength: accessToken?.length,
          appSecret: process.env.ZALO_APP_SECRET ? 'exists' : 'missing'
        });
        
        // Không throw error, tiếp tục mà không có phone
        console.log('Continuing login without phone number...');
      }
    } else {
      console.log('Missing phoneToken or accessToken, skipping phone decode');
    }

    // Kiểm tra và tạo/cập nhật user trong database
    const pool = await getPool();
    
    // Kiểm tra user đã tồn tại chưa
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
          phoneNumber,
          actualUserInfo.avatar || ''
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
          actualUserInfo.id,
          actualUserInfo.name || existingUser.rows[0].fullname,
          phoneNumber || existingUser.rows[0].phone,
          actualUserInfo.avatar || existingUser.rows[0].avatar
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