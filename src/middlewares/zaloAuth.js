import axios from "axios";
import jwt from 'jsonwebtoken';
import { getPool } from "../config.js";

/**
 * Tạo JWT token từ thông tin user Zalo
 */
export const generateZaloToken = (userData) => {
  return jwt.sign(
    {
      userId: userData.userid,
      zaloid: userData.zaloid,
      username: userData.username,
      fullname: userData.fullname,
      role: userData.role,
      phone: userData.phone,
      avatar: userData.avatar
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

/**
 * Verify JWT token
 */
export const verifyZaloToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token không được cung cấp'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ'
    });
  }
};

/**
 * Middleware xác thực Zalo access token
 */
export const zaloAuthMiddleware = async (req, res, next) => {
  const accessToken = req.headers['zalo-access-token'] || req.headers['access-token'];
  console.log('Access token FE:', accessToken);
  if (!accessToken) {
    return res.status(401).json({ 
      success: false, 
      message: "Thiếu Zalo access token" 
    });
  }

  try {
    // Verify token với Zalo API
    const userInfoResponse = await axios.get('https://graph.zalo.me/v2.0/me', {
      headers: {
        'access_token': accessToken
      },
      params: {
        fields: 'id,name'
      }
    });
    
    const zaloUserInfo = userInfoResponse.data;
    
    if (!zaloUserInfo.id) {
      return res.status(401).json({
        success: false,
        message: "Access token không hợp lệ"
      });
    }
    
    // Lấy thông tin user từ database
    const pool = await getPool();
    const userResult = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [zaloUserInfo.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User chưa đăng ký trong hệ thống"
      });
    }
    
    // Gán thông tin user vào request
    req.zaloUser = {
      zaloId: zaloUserInfo.id,
      name: zaloUserInfo.name,
      userId: userResult.rows[0].userid,
      userInfo: userResult.rows[0]
    };
    
    next();
  } catch (error) {
    console.error("Lỗi xác thực Zalo token:", error);
    
    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: "Access token không hợp lệ hoặc đã hết hạn"
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xác thực"
    });
  }
};

/**
 * Middleware lấy thông tin user từ zaloId (không bắt buộc xác thực)
 */
export const getUserFromZaloId = async (req, res, next) => {
  const zaloId = req.body.zaloId || req.query.zaloId;
  
  if (!zaloId) {
    return next(); // Tiếp tục nếu không có zaloId
  }
  
  try {
    const pool = await getPool();
    const userResult = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [zaloId]
    );
    
    if (userResult.rows.length > 0) {
      req.currentUser = {
        zaloId: zaloId,
        userId: userResult.rows[0].userid,
        userInfo: userResult.rows[0]
      };
    }
    
    next();
  } catch (error) {
    console.error("Lỗi khi lấy thông tin user:", error);
    next(); // Tiếp tục ngay cả khi có lỗi
  }
};