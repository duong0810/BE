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

// --- API CLAIM VOUCHER ---
router.post("/claim", async (req, res) => {
  const { zaloId, voucherId } = req.body;
  console.log("[CLAIM] Nhận được:", { zaloId, voucherId });

  if (!zaloId || !voucherId) {
    console.log("[CLAIM] Thiếu zaloId hoặc voucherId");
    return res.status(400).json({ error: "Thiếu zaloId hoặc voucherId" });
  }
  try {
    const pool = await getPool();
    // Mapping zaloId -> userid
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    console.log("[CLAIM] Kết quả tìm user:", userResult.rows);

    if (userResult.rows.length === 0) {
      console.log("[CLAIM] Không tìm thấy user với zaloId:", zaloId);
      return res.status(404).json({ error: "Không tìm thấy người dùng" });
    }
    const userId = userResult.rows[0].userid;

    // Kiểm tra đã nhận voucher này chưa
    const check = await pool.query(
      "SELECT * FROM uservouchers WHERE userid = $1 AND voucherid = $2",
      [userId, voucherId]
    );
    console.log("[CLAIM] Kết quả kiểm tra uservouchers:", check.rows);

    if (check.rows.length > 0) {
      console.log("[CLAIM] User đã nhận voucher này rồi");
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

    // Lưu voucher cho user (bổ sung isused, assignedat)
    await pool.query(
      "INSERT INTO uservouchers (userid, voucherid, isused, assignedat) VALUES ($1, $2, $3, NOW())",
      [userId, voucherId, false]
    );
    console.log("[CLAIM] Đã lưu voucher cho user:", userId, voucherId);
    res.json({ success: true, message: "Nhận voucher thành công" });
  } catch (err) {
    console.error("[CLAIM] Lỗi:", err);
    res.status(500).json({ error: err.message });
  }
});

// --- API LẤY DANH SÁCH VOUCHER ĐÃ NHẬN ---
router.get("/user", async (req, res) => {
  const { zaloId } = req.query;
  console.log("[GET USER VOUCHERS] Nhận được zaloId:", zaloId);

  if (!zaloId) {
    console.log("[GET USER VOUCHERS] Thiếu zaloId");
    return res.status(400).json({ error: "Thiếu zaloId" });
  }
  try {
    const pool = await getPool();
    // Mapping zaloId -> userid
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    console.log("[GET USER VOUCHERS] Kết quả tìm user:", userResult.rows);

    if (userResult.rows.length === 0) {
      console.log("[GET USER VOUCHERS] Không tìm thấy user với zaloId:", zaloId);
      return res.json([]); // User chưa từng nhận voucher nào
    }
    const userId = userResult.rows[0].userid;
    // Truy vấn voucher đã nhận
    const vouchers = await pool.query(
      `SELECT v.*, uv.isused, uv.assignedat, uv.usedat
       FROM uservouchers uv
       JOIN vouchers v ON uv.voucherid = v.voucherid
       WHERE uv.userid = $1
       ORDER BY uv.assignedat DESC`,
      [userId]
    );
    // Thêm trường collectedAt (timestamp mili giây)
    const result = vouchers.rows.map(v => ({
      ...v,
      collectedAt: v.assignedat ? new Date(v.assignedat).getTime() : null
    }));
    res.json(result);
  } catch (err) {
    console.error("[GET USER VOUCHERS] Lỗi:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/assign", async (req, res) => {
  console.log("===== /assign DEBUG =====");
  console.log("Body nhận được:", req.body);

  const { zaloId, voucherId } = req.body;
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

// ĐẶT CÁC ROUTE ĐỘNG Ở CUỐI FILE
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

export default router;