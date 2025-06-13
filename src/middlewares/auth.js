/**
 * Middleware xác thực người dùng
 * Kiểm tra token trong header Authorization
 */
import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ 
      success: false, 
      message: "Không tìm thấy token xác thực" 
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret");
    req.user = decoded; // Gán thông tin user từ token vào request
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Token không hợp lệ"
    });
  }
};

/**
 * Middleware kiểm tra quyền admin
 * Yêu cầu chạy sau authMiddleware
 */
export const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập"
    });
  }

  // Nếu token không chứa role, mặc định là admin (vì login chỉ có admin)
  if (req.user.role && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện hành động này"
    });
  }

  next();
};

/**
 * Middleware kiểm tra quyền user thông thường
 * Có thể sử dụng khi cần phân biệt các quyền khác nhau
 */
export const userMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Bạn chưa đăng nhập"
    });
  }

  // Cho phép cả admin và user thông thường
  if (req.user.role !== "admin" && req.user.role !== "user") {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện hành động này"
    });
  }

  next();
};

/**
 * Middleware kiểm tra xem user có quyền với tài nguyên
 * Sử dụng cho các trường hợp kiểm tra quyền với dữ liệu cụ thể
 * @param {Function} checkFn - Hàm kiểm tra quyền, trả về boolean
 */
export const resourceAccessMiddleware = (checkFn) => {
  return async (req, res, next) => {
    try {
      const hasAccess = await checkFn(req);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Bạn không có quyền truy cập tài nguyên này"
        });
      }

      next();
    } catch (error) {
      console.error("Lỗi kiểm tra quyền truy cập:", error);
      res.status(500).json({
        success: false,
        message: "Đã xảy ra lỗi khi kiểm tra quyền truy cập"
      });
    }
  };
};