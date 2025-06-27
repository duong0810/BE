import { getPool } from "../config.js";

// Lấy tất cả voucher (có thể lọc theo category nếu truyền query)
export const getAllVouchers = async (req, res) => {
  try {
    const pool = await getPool();
    const { category } = req.query;
    
    let query = 'SELECT * FROM Vouchers';
    let values = [];
    
    if (category) {
      query += ' WHERE LOWER(TRIM(Category)) = LOWER($1)';
      values = [category];
    }
    
    const result = await pool.query(query, values);
    return res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    return res.status(500).json({
      success: false,
      message: "Đã xảy ra lỗi khi lấy danh sách voucher"
    });
  }
};

// Tìm kiếm voucher theo code hoặc id
export const findVoucher = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const result = await pool.query(
      "SELECT * FROM Vouchers WHERE VoucherID = $1 OR Code = $1",
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Voucher not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Tạo voucher mới
export const createVoucher = async (req, res) => {
  console.log(req.body);
  try {
    const {
      VoucherID,
      Description,
      Discount,
      ExpiryDate,
      IsActive,
      Category,
      Quantity,
      Probability
    } = req.body;
    
    const Code = generateVoucherCode(7);
    const Image = req.file ? `/uploads/${req.file.filename}` : req.body.Image || null;

    const pool = await getPool();
    await pool.query(`
      INSERT INTO Vouchers (VoucherID, Code, Description, Discount, Type, Quantity, MinOrder, MaxDiscount, ExpiryDate, IsActive, Category, Probability, Image)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
      VoucherID,
      Code,
      Description || null,
      Discount || 0,
      null, // Type
      Quantity || 1,
      null, // MinOrder
      null, // MaxDiscount
      ExpiryDate || null,
      IsActive || 1,
      Category || null,
      Probability || null,
      Image || null
    ]);

    res.status(201).json({ message: "Voucher created successfully", Code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Sửa voucher
export const updateVoucher = async (req, res) => {
  const { id } = req.params;
  const {
    Description,
    Discount,
    ExpiryDate,
    IsActive,
    Category,
    Quantity,
    Probability,
    Image
  } = req.body || {};

  try {
    const pool = await getPool();
    
    // Lấy voucher hiện tại
    const oldVoucherResult = await pool.query(
      "SELECT * FROM Vouchers WHERE VoucherID = $1 OR Code = $1",
      [id]
    );
    const oldVoucher = oldVoucherResult.rows[0];

    if (!oldVoucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    // Xử lý dữ liệu mới
    const newDescription = (Description !== undefined && Description !== "" && Description !== null)
      ? Description : oldVoucher.description;
    const newExpiryDate = (ExpiryDate !== undefined && ExpiryDate !== "" && ExpiryDate !== null)
      ? ExpiryDate : oldVoucher.expirydate;
    const newProbability = (Probability !== undefined && Probability !== "" && Probability !== null)
      ? Probability : oldVoucher.probability;
    const newImage = req.file
      ? `/uploads/${req.file.filename}`
      : (Image !== undefined && Image !== "" && Image !== null)
        ? Image : oldVoucher.image;
    const newCategory = (Category !== undefined && Category !== "" && Category !== null)
      ? Category : oldVoucher.category;

    const result = await pool.query(`
      UPDATE Vouchers
      SET Description = $1, Discount = $2, Type = $3, Quantity = $4, MinOrder = $5,
          MaxDiscount = $6, ExpiryDate = $7, IsActive = $8, Category = $9, 
          Probability = $10, Image = $11, UpdatedAt = NOW()
      WHERE VoucherID = $12 OR Code = $12
    `, [
      newDescription,
      Discount || oldVoucher.discount,
      null,
      Quantity || oldVoucher.quantity,
      null,
      null,
      newExpiryDate,
      IsActive !== undefined ? IsActive : oldVoucher.isactive,
      newCategory,
      newProbability,
      newImage,
      id
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Voucher not found" });
    }
    res.json({ message: "Voucher updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Xoá voucher
export const deleteVoucher = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    
    // Xóa các bản ghi liên quan trong UserVouchers trước
    await pool.query("DELETE FROM UserVouchers WHERE VoucherID = $1", [id]);
    
    // Sau đó xóa voucher
    await pool.query("DELETE FROM Vouchers WHERE VoucherID = $1", [id]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Hàm sinh mã code 7 ký tự
function generateVoucherCode(length = 7) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Hàm quay random voucher theo xác suất
export const spinVoucher = async (req, res) => {
  try {
    const pool = await getPool();
    // Lấy zaloId từ query hoặc body
    const zaloId = req.query.zaloId || req.body.zaloId;
    if (!zaloId) {
      return res.status(400).json({ error: "Thiếu zaloId" });
    }

    // Lấy userid từ zaloId
    const userResult = await pool.query(
      "SELECT userid FROM users WHERE zaloid = $1",
      [zaloId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy user" });
    }
    const userId = userResult.rows[0].userid;

    // Đếm số lượt quay đã dùng (chỉ tính voucher category = 'wheel')
    const spinCountResult = await pool.query(
      `SELECT COUNT(*) FROM uservouchers uv
       JOIN vouchers v ON uv.voucherid = v.voucherid
       WHERE uv.userid = $1 AND v.category = 'wheel'`,
      [userId]
    );
    const spinCount = parseInt(spinCountResult.rows[0].count, 10);

    if (spinCount >= 2) {
      return res.status(403).json({ error: "Bạn đã hết lượt quay!" });
    }

    // Lấy danh sách voucher quay (category = 'wheel', còn quantity)
    const result = await pool.query(`
      SELECT * FROM Vouchers 
      WHERE IsActive = true AND Probability IS NOT NULL AND Probability > 0 AND Category = 'wheel' AND Quantity > 0
      ORDER BY RANDOM()
    `);
    const vouchers = result.rows;

    if (vouchers.length === 0) {
      return res.status(404).json({ message: "No voucher available" });
    }

    // Tính tổng xác suất
    const totalProb = vouchers.reduce((sum, v) => sum + Number(v.probability), 0);
    if (totalProb === 0) {
      return res.status(404).json({ message: "No voucher available" });
    }

    // Tạo ranges xác suất
    const ranges = [];
    let accumulator = 0;
    vouchers.forEach(voucher => {
      const prob = Number(voucher.probability);
      ranges.push({
        voucher: voucher,
        start: accumulator,
        end: accumulator + prob,
        probability: prob
      });
      accumulator += prob;
    });

    // Random value
    const randomValue = Math.random() * totalProb;
    const winner = ranges.find(range => 
      randomValue >= range.start && randomValue < range.end
    );

    if (!winner) {
      return res.status(500).json({ error: "Không tìm được voucher trúng!" });
    }

    // Trừ số lượng voucher
    await pool.query(
      "UPDATE vouchers SET quantity = quantity - 1 WHERE voucherid = $1 AND quantity > 0",
      [winner.voucher.voucherid]
    );

    // Lưu voucher cho user
    await pool.query(
      "INSERT INTO uservouchers (userid, voucherid, isused, assignedat) VALUES ($1, $2, $3, NOW())",
      [userId, winner.voucher.voucherid, false]
    );

    res.json({ success: true, voucher: winner.voucher });
  } catch (err) {
    console.error("Error in spin:", err);
    res.status(500).json({ error: err.message });
  }
};

// Lấy các dòng chữ banner
export const getBannerHeaders = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.query(
      "SELECT key, value FROM Settings WHERE key IN ('header1', 'header2', 'header3')"
    );
    
    const headers = {};
    result.rows.forEach(row => {
      headers[row.key] = row.value;
    });
    
    res.json({ 
      success: true, 
      data: {
        header1: headers.header1 || '',
        header2: headers.header2 || '',
        header3: headers.header3 || ''
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Cập nhật các dòng chữ banner
export const updateBannerHeaders = async (req, res) => {
  const { header1, header2, header3 } = req.body;
  
  try {
    const pool = await getPool();
    
    // Function helper để upsert
    const upsertHeader = async (key, value) => {
      if (value !== undefined) {
        await pool.query(`
          INSERT INTO Settings (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = $2
        `, [key, value]);
      }
    };
    
    // Cập nhật từng header
    await upsertHeader('header1', header1);
    await upsertHeader('header2', header2);
    await upsertHeader('header3', header3);
    
    res.json({ 
      success: true, 
      message: "Banner headers updated successfully"
    });
  } catch (err) {
    console.error("❌ Error updating banner headers:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
};