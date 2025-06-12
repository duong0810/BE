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

export default router;