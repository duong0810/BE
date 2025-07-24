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
    const authHeader = req.headers.authorization;
    console.log('[verifyZaloToken] Authorization header:', authHeader);
    const token = authHeader?.split(' ')[1];

    if (!token) {
      console.warn('[verifyZaloToken] Không có token');
      return res.status(401).json({
        success: false,
        message: 'Token không được cung cấp'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('[verifyZaloToken] Lỗi verify token (jwt.verify):', err);
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ (verify fail)'
      });
    }
    console.log('[verifyZaloToken] Token decoded:', decoded);
    if (!decoded || !decoded.zaloid) {
      console.error('[verifyZaloToken] Token decode ra nhưng không có zaloid:', decoded);
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error('[verifyZaloToken] Lỗi ngoài:', error);
    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ (outer catch)'
    });
  }
};

/**
 * Middleware xác thực Zalo access token
 */
export const zaloAuthMiddleware = async (req, res, next) => {
  // Ưu tiên lấy zaloid từ JWT token (req.user), nếu không có thì lấy từ body
  console.log('[zaloAuthMiddleware] req.user:', req.user);
  console.log('[zaloAuthMiddleware] req.body.userInfo:', req.body?.userInfo);
  let zaloid = null;
  if (req.user && req.user.zaloid) {
    zaloid = req.user.zaloid;
  } else if (req.body.userInfo && req.body.userInfo.id) {
    zaloid = req.body.userInfo.id;
  }

  console.log('[zaloAuthMiddleware][DEBUG] zaloid from token/body:', zaloid, zaloid ? zaloid.length : 'undefined');
  console.log('[zaloAuthMiddleware][DEBUG] typeof zaloid:', typeof zaloid);
  if (!zaloid) {
    console.warn('[zaloAuthMiddleware] Thiếu zaloid, trả lỗi 401');
    if (req.user) {
      console.warn('[zaloAuthMiddleware] req.user hiện tại:', req.user);
    }
    return res.status(401).json({
      success: false,
      message: "Thiếu thông tin user từ Zalo Mini App"
    });
  }

  try {
    // Lấy thông tin user từ database
    const pool = await getPool();
    const userResult = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [zaloid]
    );
    console.log('[zaloAuthMiddleware][DEBUG] Kết quả truy vấn user:', userResult.rows);
    if (userResult.rows.length > 0) {
      const dbZaloid = userResult.rows[0].zaloid;
      console.log('[zaloAuthMiddleware][DEBUG] zaloid from DB:', dbZaloid, dbZaloid ? dbZaloid.length : 'undefined');
      console.log('[zaloAuthMiddleware][DEBUG] So sánh:', zaloid === dbZaloid ? 'MATCH' : 'NOT MATCH');
    }

    if (userResult.rows.length === 0) {
      console.warn('[zaloAuthMiddleware] Không tìm thấy user trong DB với zaloid:', zaloid);
      return res.status(404).json({
        success: false,
        message: "User chưa đăng ký trong hệ thống"
      });
    }

    // Gán thông tin user vào request
    req.user = {
      zaloid: zaloid,
      name: userResult.rows[0].fullname,
      userId: userResult.rows[0].userid,
      userInfo: userResult.rows[0]
    };

    next();
  } catch (error) {
    console.error('[zaloAuthMiddleware] Lỗi khi xác thực user từ Zalo Mini App:', error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server khi xác thực user từ Zalo Mini App"
    });
  }
}

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