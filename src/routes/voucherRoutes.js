import { getPool } from "../config.js";
import express from "express";
import {
  getAllVouchers,
  createVoucher,
  findVoucher,
  updateVoucher,
  deleteVoucher,
  spinVoucher,
  getWheelConfig
} from "../controllers/voucherController.js";
import { getUserFromZaloId, verifyZaloToken, zaloAuthMiddleware } from "../middlewares/zaloAuth.js";
import multer from "multer";
import { getBannerHeaders, updateBannerHeaders } from "../controllers/voucherController.js";
import { spinWheelWithLimit } from "../controllers/voucherController.js";
import { getUserVouchers } from "../controllers/voucherController.js"; 
import { updateWheelConfig } from "../controllers/voucherController.js";
import { authMiddleware, adminMiddleware } from "../middlewares/auth.js";
import { assignVoucherByPhone } from "../controllers/voucherController.js";// 11/08/2025
import { updateUserVoucherStatus } from "../controllers/voucherController.js"; // 12/08

const upload = multer({ dest: "uploads/" });

const router = express.Router();

router.get("/spin", spinVoucher);

// Route quay vòng với giới hạn
router.post("/spin-wheel-limit", verifyZaloToken, zaloAuthMiddleware, spinWheelWithLimit);

// API lấy danh sách voucher của user (dựa vào token)
router.get("/my-vouchers", verifyZaloToken, zaloAuthMiddleware, getUserVouchers);

// API lấy số lượng ô vòng quay cho FE
router.get("/wheel-config", getWheelConfig);
// API cập nhật số lượng ô vòng quay (chỉ cho admin)
router.put("/wheel-config", authMiddleware, adminMiddleware, updateWheelConfig);

// Route lấy banner headers
router.get("/banner-headers", getBannerHeaders);
router.put("/banner-headers", authMiddleware, updateBannerHeaders);

// Route tạo/sửa voucher: chỉ dùng upload.single("Image") + authMiddleware
router.post("/", upload.single("Image"), authMiddleware, createVoucher);
router.put("/:id", upload.single("Image"), authMiddleware, updateVoucher);

// Route lấy voucher theo category
router.get("/category/:category", async (req, res) => {
  const { category } = req.params;
  try {
    const pool = await getPool();
    const result = await pool.query(
      'SELECT * FROM Vouchers WHERE Category = $1',
      [category]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- API LẤY VOUCHER THEO CATEGORY VỚI SỐ LƯỢNG ĐÃ THU THẬP CỦA USER ---
router.get("/category/:category/user/:zaloId", async (req, res) => {
  const { category, zaloId } = req.params;
  console.log("[GET VOUCHERS WITH USER COUNT] Category:", category, "ZaloId:", zaloId);

  try {
    const pool = await getPool();
    
    // Lấy userid từ zaloId
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    
    if (userResult.rows.length === 0) {
      // Nếu user không tồn tại, trả về voucher với quantity = 0
      const vouchersResult = await pool.query(
        `SELECT v.*, 0 as user_collected_count 
         FROM vouchers v 
         WHERE v.category = $1`,
        [category]
      );
      return res.json(vouchersResult.rows);
    }
    
    const userId = userResult.rows[0].userid;
    
    // Query lấy voucher kèm số lượng đã thu thập của user
    const result = await pool.query(
      `SELECT 
        v.*,
        COALESCE(COUNT(uv.uservoucherid), 0) as user_collected_count
       FROM vouchers v
       LEFT JOIN uservouchers uv ON v.voucherid = uv.voucherid AND uv.userid = $1
       WHERE v.category = $2
       GROUP BY v.voucherid, v.code, v.description, v.discount, v.type, v.quantity, v.minorder, v.maxdiscount, v.expirydate, v.isactive, v.category, v.probability, v.image, v.createdat, v.updatedat
       ORDER BY v.createdat DESC`,
      [userId, category]
    );
    
    console.log("[GET VOUCHERS WITH USER COUNT] Result:", result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error("[GET VOUCHERS WITH USER COUNT] Lỗi:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- API LẤY TẤT CẢ VOUCHER VỚI SỐ LƯỢNG ĐÃ THU THẬP CỦA USER ---
router.get("/with-user-count", async (req, res) => {
  const { zaloId } = req.query;
  console.log("[GET ALL VOUCHERS WITH USER COUNT] ZaloId:", zaloId);

  try {
    const pool = await getPool();
    
    if (!zaloId) {
      // Nếu không có zaloId, trả về voucher bình thường
      const result = await pool.query('SELECT * FROM vouchers ORDER BY createdat DESC');
      const vouchersWithCount = result.rows.map(v => ({
        ...v,
        user_collected_count: 0
      }));
      return res.json(vouchersWithCount);
    }
    
    // Lấy userid từ zaloId
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    
    if (userResult.rows.length === 0) {
      // Nếu user không tồn tại, trả về voucher với quantity = 0
      const vouchersResult = await pool.query('SELECT * FROM vouchers ORDER BY createdat DESC');
      const vouchersWithCount = vouchersResult.rows.map(v => ({
        ...v,
        user_collected_count: 0
      }));
      return res.json(vouchersWithCount);
    }
    
    const userId = userResult.rows[0].userid;
    
    // Query lấy tất cả voucher kèm số lượng đã thu thập của user
    const result = await pool.query(
      `SELECT 
        v.*,
        COALESCE(COUNT(uv.uservoucherid), 0) as user_collected_count
       FROM vouchers v
       LEFT JOIN uservouchers uv ON v.voucherid = uv.voucherid AND uv.userid = $1
       GROUP BY v.voucherid, v.code, v.description, v.discount, v.type, v.quantity, v.minorder, v.maxdiscount, v.expirydate, v.isactive, v.category, v.probability, v.image, v.createdat, v.updatedat
       ORDER BY v.createdat DESC`,
      [userId]
    );
    
    console.log("[GET ALL VOUCHERS WITH USER COUNT] Result count:", result.rows.length);
    res.json(result.rows);
  } catch (err) {
    console.error("[GET ALL VOUCHERS WITH USER COUNT] Lỗi:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- API CLAIM VOUCHER ---
router.post("/claim", verifyZaloToken, zaloAuthMiddleware, async (req, res) => {
  try {
    // ✅ LẤY ZALOID TỪ JWT TOKEN (đã verify trong middleware)
    const zaloId = req.user.zaloid; // từ verifyZaloToken middleware
    const { voucherId } = req.body;
    
    console.log('[CLAIM] ZaloId từ token:', zaloId);
    console.log('[CLAIM] VoucherId:', voucherId);
    
    if (!voucherId) {
      console.log('[CLAIM] Thiếu voucherId');
      return res.status(400).json({ 
        success: false,
        error: "Thiếu voucherId" 
      });
    }

    const pool = await getPool();
    
    // 1. Lấy userid từ zaloId
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    console.log('[CLAIM] Kết quả tìm user:', userResult.rows.length);

    if (userResult.rows.length === 0) {
      console.log('[CLAIM] Không tìm thấy user với zaloId:', zaloId);
      return res.status(404).json({ 
        success: false,
        error: "Không tìm thấy người dùng" 
      });
    }
    
    const userId = userResult.rows[0].userid;
    console.log('[CLAIM] User found:', userId);

    // 2. Kiểm tra đã nhận voucher này chưa
    const check = await pool.query(
      "SELECT * FROM uservouchers WHERE userid = $1 AND voucherid = $2",
      [userId, voucherId]
    );
    console.log('[CLAIM] Kết quả kiểm tra uservouchers:', check.rows.length);

    if (check.rows.length > 0) {
      console.log('[CLAIM] User đã nhận voucher này rồi');
      return res.status(409).json({ 
        success: false,
        error: "Bạn đã nhận voucher này rồi" 
      });
    }

    // 3. Kiểm tra voucher tồn tại và số lượng
    const voucherResult = await pool.query(
      "SELECT * FROM vouchers WHERE voucherid = $1",
      [voucherId]
    );
    
    if (voucherResult.rows.length === 0) {
      console.log('[CLAIM] Voucher không tồn tại:', voucherId);
      return res.status(404).json({ 
        success: false,
        error: "Voucher không tồn tại" 
      });
    }

    const voucher = voucherResult.rows[0];
    console.log('[CLAIM] Voucher found:', voucher.code, 'Quantity:', voucher.quantity);

    if (voucher.quantity <= 0) {
      console.log('[CLAIM] Voucher đã hết lượt');
      return res.status(409).json({ 
        success: false,
        error: "Voucher đã hết lượt!" 
      });
    }

    // 4. Kiểm tra voucher còn hiệu lực không
    const now = new Date();
    if (new Date(voucher.expirydate) < now) {
      console.log('[CLAIM] Voucher đã hết hạn');
      return res.status(400).json({
        success: false,
        error: 'Voucher đã hết hạn'
      });
    }

    // 5. Trừ số lượng voucher
    await pool.query(
      "UPDATE vouchers SET quantity = quantity - 1 WHERE voucherid = $1 AND quantity > 0",
      [voucherId]
    );

    // 6. Lưu voucher cho user
    const claimResult = await pool.query(
      "INSERT INTO uservouchers (userid, voucherid, isused, assignedat) VALUES ($1, $2, $3, NOW()) RETURNING *",
      [userId, voucherId, false]
    );
    
    console.log('[CLAIM] Đã lưu voucher cho user:', userId, voucherId);
    
    res.json({ 
      success: true, 
      message: "Nhận voucher thành công!",
      data: {
        userVoucher: claimResult.rows[0],
        voucher: voucher
      }
    });
    
  } catch (err) {
    console.error('[CLAIM] Lỗi:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});

router.post("/assign", verifyZaloToken, zaloAuthMiddleware, async (req, res) => {
  console.log("===== /assign DEBUG =====");
  console.log("Body nhận được:", req.body);

  const zaloId = req.user.zaloid; // Lấy từ token
  const { voucherId } = req.body;
  if (!zaloId || !voucherId) {
    console.log("Thiếu zaloId hoặc voucherId");
    return res.status(400).json({ error: "Thiếu zaloId hoặc voucherId" });
  }
  try {
    const pool = await getPool();
    // Lấy userid từ zaloid
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    console.log("userResult:", userResult.rows);
    if (userResult.rows.length === 0) {
      console.log("Không tìm thấy user với zaloId:", zaloId);
      return res.status(404).json({ error: "Không tìm thấy user" });
    }
    const userId = userResult.rows[0].userid;
    // Kiểm tra đã nhận voucher này chưa
    const check = await pool.query(
      "SELECT * FROM uservouchers WHERE userid = $1 AND voucherid = $2",
      [userId, voucherId]
    );
    console.log("Check uservouchers:", check.rows);
    if (check.rows.length > 0) {
      console.log("User đã nhận voucher này rồi");
      return res.status(409).json({ error: "Bạn đã nhận voucher này rồi" });
    }

    // Kiểm tra số lượng voucher còn không
    const voucherResult = await pool.query(
      "SELECT quantity FROM vouchers WHERE voucherid = $1",
      [voucherId]
    );
    if (voucherResult.rows.length === 0 || voucherResult.rows[0].quantity <= 0) {
      return res.status(409).json({ error: "Voucher đã hết lượt!" });
    }

    // Trừ số lượng voucher
    await pool.query(
      "UPDATE vouchers SET quantity = quantity - 1 WHERE voucherid = $1 AND quantity > 0",
      [voucherId]
    );

    // Lưu voucher cho user
    await pool.query(
      "INSERT INTO uservouchers (userid, voucherid, isused, assignedat) VALUES ($1, $2, $3, NOW())",
      [userId, voucherId, false]
    );
    console.log("Đã lưu voucher cho user:", userId, voucherId);
    res.json({ success: true, message: "Đã lưu voucher cho user" });
  } catch (err) {
    console.error("Lỗi khi assign voucher:", err);
    res.status(500).json({ error: err.message });
  }
});

// Thống kê chi tiết voucher đã thu thập theo từng user (admin)
// Thống kê chi tiết voucher đã thu thập theo từng user (admin)
router.get("/stats/collected-detail", authMiddleware, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.query(`
      SELECT 
        u.userid, 
        u.zaloid, 
        u.username, 
        u.fullname, 
        uv.uservoucherid,
        uv.voucherid,
        v.code,
        v.description,
        v.category,
        v.expirydate,
        v.discount,         -- Thêm dòng này
        v.quantity,         -- Thêm dòng này
        uv.isused,
        uv.assignedat,
        uv.usedat
      FROM users u
      LEFT JOIN uservouchers uv ON u.userid = uv.userid
      LEFT JOIN vouchers v ON uv.voucherid = v.voucherid
      ORDER BY u.userid, uv.assignedat DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API kiểm tra trạng thái user và số lượng voucher đã thu thập
router.get("/user-stats/:zaloId", async (req, res) => {
  const { zaloId } = req.params;
  
  try {
    const pool = await getPool();
    
    // Lấy thông tin user
    const userResult = await pool.query(
      "SELECT * FROM users WHERE zaloid = $1",
      [zaloId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User không tồn tại" });
    }
    
    const user = userResult.rows[0];
    const userId = user.userid;
    
    // Đếm tổng số voucher đã thu thập
    const totalVouchersResult = await pool.query(
      "SELECT COUNT(*) as total_collected FROM uservouchers WHERE userid = $1",
      [userId]
    );
    
    // Đếm voucher theo category
    const vouchersByCategoryResult = await pool.query(
      `SELECT v.category, COUNT(*) as count 
       FROM uservouchers uv 
       JOIN vouchers v ON uv.voucherid = v.voucherid 
       WHERE uv.userid = $1 
       GROUP BY v.category`,
      [userId]
    );
    
    // Đếm voucher đã sử dụng
    const usedVouchersResult = await pool.query(
      "SELECT COUNT(*) as used_count FROM uservouchers WHERE userid = $1 AND isused = true",
      [userId]
    );
    
    res.json({
      success: true,
      user: {
        userId: user.userid,
        zaloId: user.zaloid,
        username: user.username,
        fullname: user.fullname,
        avatar: user.avatar,
        phone: user.phone,
        status: user.status
      },
      stats: {
        totalCollected: parseInt(totalVouchersResult.rows[0].total_collected),
        usedVouchers: parseInt(usedVouchersResult.rows[0].used_count),
        vouchersByCategory: vouchersByCategoryResult.rows
      }
    });
    
  } catch (err) {
    console.error("Lỗi khi lấy thống kê user:", err);
    res.status(500).json({ error: err.message });
  }
});

// routes gán voucher vào sdt (/:id) 11/08/2025
router.post("/assign-by-phone", authMiddleware, adminMiddleware, assignVoucherByPhone);

// routes cập nhật trạng thái sử dụng voucher
router.put("/uservoucher/update-status", authMiddleware, updateUserVoucherStatus);

// ĐẶT CÁC ROUTE ĐỘNG Ở CUỐI FILE
router.get("/", getAllVouchers);
router.get("/:id", findVoucher);
router.delete("/:id", authMiddleware, deleteVoucher);

export default router;