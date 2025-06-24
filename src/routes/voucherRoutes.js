import { getPool } from "../config.js";
import express from "express";
import {
  getAllVouchers,
  createVoucher,
  findVoucher,
  updateVoucher,
  deleteVoucher,
  spinVoucher
} from "../controllers/voucherController.js";
import { authMiddleware } from "../middlewares/auth.js";
import multer from "multer";
import { getBannerHeaders, updateBannerHeaders } from "../controllers/voucherController.js";

const upload = multer({ dest: "uploads/" });

const router = express.Router();

router.get("/spin", spinVoucher);

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

// Route thu thập voucher (giảm số lượng, lưu log)
router.post("/collect", async (req, res) => {
  const { voucherId, userId } = req.body;
  if (!voucherId || !userId) {
    return res.status(400).json({
      error: "Thiếu tham số bắt buộc: voucherId và userId là bắt buộc"
    });
  }
  try {
    const pool = await getPool();
    // PostgreSQL stored procedure call
    const result = await pool.query(
      'SELECT sp_AssignVoucherToUser($1, $2) as result',
      [parseInt(userId, 10), voucherId]
    );

    const assignResult = result.rows[0].result;
    if (assignResult === 1) {
      res.json({ success: true });
    } else if (assignResult === -1) {
      res.status(400).json({ error: "Voucher không tồn tại" });
    } else if (assignResult === -2) {
      res.status(400).json({ error: "Voucher đã hết số lượng" });
    } else if (assignResult === -3) {
      res.status(400).json({ error: "Voucher đã hết hạn" });
    } else if (assignResult === -4) {
      res.status(400).json({ error: "Bạn đã sở hữu voucher này" });
    } else {
      res.status(500).json({ error: "Lỗi không xác định" });
    }
  } catch (err) {
    console.error("Lỗi SQL trong route /collect:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/", getAllVouchers);
router.get("/:id", findVoucher);
router.delete("/:id", authMiddleware, deleteVoucher);

// Route đăng nhập admin
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return res.json({ success: true, token: "admin-token" });
  }
  return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });
});

// Route nhận voucher cho user Zalo (không cần đăng ký)
router.post("/claim", async (req, res) => {
  const { voucherId, zaloId } = req.body;
  if (!voucherId || !zaloId) {
    return res.status(400).json({ error: "Thiếu voucherId hoặc zaloId" });
  }
  try {
    const pool = await getPool();
    // Tìm hoặc tạo user theo zaloId
    let userResult = await pool.query(
  'SELECT userid FROM users WHERE zaloid = $1',
  [zaloId]
);

  let userId;
  if (userResult.rows.length === 0) {
    // Tạo mới user nếu chưa có
    const insertUser = await pool.query(
      'INSERT INTO users (zaloid, username, status) VALUES ($1, $2, $3) RETURNING userid',
      [zaloId, `zalo_${zaloId}`, 'active']
    );
    userId = insertUser.rows[0].userid;
  } else {
    userId = userResult.rows[0].userid;
  }
  // Kiểm tra đã nhận voucher này chưa
  const check = await pool.query(
    'SELECT * FROM uservouchers WHERE userid = $1 AND voucherid = $2',
    [userId, voucherId]
  );
  if (check.rows.length > 0) {
    return res.status(409).json({ error: "Bạn đã nhận voucher này rồi" });
  }
  // Gán voucher cho user
  await pool.query(
    'INSERT INTO uservouchers (userid, voucherid) VALUES ($1, $2)',
    [userId, voucherId]
  );
  res.json({ success: true, message: "Nhận voucher thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route lấy danh sách voucher của user Zalo
router.get("/user/:zaloId", async (req, res) => {
  const { zaloId } = req.params;
  if (!zaloId) {
    return res.status(400).json({ error: "Thiếu zaloId" });
  }
  try {
    const pool = await getPool();
    // Lấy userid theo zaloid
    const userResult = await pool.query(
      'SELECT userid FROM users WHERE zaloid = $1',
      [zaloId]
    );
    if (userResult.rows.length === 0) {
      return res.json([]); // User chưa từng nhận voucher nào
    }
    const userId = userResult.rows[0].userid;
    console.log("userId:", userId); // Thêm dòng này
    // Lấy danh sách voucher đã nhận
    const vouchers = await pool.query(
      `SELECT v.*, uv.isused, uv.assignedat, uv.usedat
      FROM uservouchers uv
      JOIN vouchers v ON uv.voucherid = v.voucherid
      WHERE uv.userid = $1
      ORDER BY uv.assignedat DESC`,
      [userId]
    );
    console.log("vouchers:", vouchers.rows);
    res.json(vouchers.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/assign", async (req, res) => {
  const { zaloId, voucherId } = req.body;
  if (!zaloId || !voucherId) {
    return res.status(400).json({ error: "Thiếu zaloId hoặc voucherId" });
  }
  try {
    const pool = await getPool();
    // Lấy userid từ zaloid
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy user" });
    }
    const userId = userResult.rows[0].userid;
    // Kiểm tra đã nhận voucher này chưa
    const check = await pool.query(
      "SELECT * FROM uservouchers WHERE userid = $1 AND voucherid = $2",
      [userId, voucherId]
    );
    if (check.rows.length > 0) {
      return res.status(409).json({ error: "Bạn đã nhận voucher này rồi" });
    }
    // Lưu voucher cho user
    await pool.query(
      "INSERT INTO uservouchers (userid, voucherid) VALUES ($1, $2)",
      [userId, voucherId]
    );
    res.json({ success: true, message: "Đã lưu voucher cho user" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;