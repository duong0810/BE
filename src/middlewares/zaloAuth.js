/**
 * Middleware xác thực Zalo access token
 */
import axios from "axios";
import { getPool } from "../config.js";

export const zaloAuthMiddleware = async (req, res, next) => {
  const accessToken = req.headers['zalo-access-token'] || req.headers['access-token'];
  
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
