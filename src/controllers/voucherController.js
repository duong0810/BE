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

    // Kiểm tra tổng xác suất nếu là voucher vòng quay
    if (Category === 'wheel' && Probability) {
      const result = await pool.query(
        "SELECT SUM(Probability) AS total FROM Vouchers WHERE Category = 'wheel' AND IsActive = true"
      );
      const currentTotal = Number(result.rows[0].total) || 0;
      if (currentTotal + Number(Probability) > 100) {
        return res.status(400).json({ error: "Tổng xác suất các voucher vòng quay vượt quá 100%" });
      }
    }

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

    // Kiểm tra tổng xác suất nếu là voucher vòng quay
    if (newCategory === 'wheel' && newProbability) {
      // Trừ xác suất cũ, cộng xác suất mới
      const result = await pool.query(
        "SELECT SUM(Probability) AS total FROM Vouchers WHERE Category = 'wheel' AND IsActive = true AND VoucherID != $1",
        [id]
      );
      const currentTotal = Number(result.rows[0].total) || 0;
      if (currentTotal + Number(newProbability) > 100) {
        return res.status(400).json({ error: "Tổng xác suất các voucher vòng quay vượt quá 100%" });
      }
    }

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

// Hàm quay random voucher theo xác suất (chuẩn hóa tổng xác suất = 100)
export const spinVoucher = async (req, res) => {
  try {   
    const pool = await getPool();
    const result = await pool.query(`
      SELECT * FROM Vouchers 
      WHERE IsActive = true AND Probability IS NOT NULL AND Probability > 0 AND Category = 'wheel'
      ORDER BY CreatedAt ASC
    `);
    const vouchers = result.rows;

    if (vouchers.length === 0) {
      return res.status(404).json({ message: "No voucher available" });
    }

    // Tính tổng xác suất gốc
    const totalProb = vouchers.reduce((sum, v) => sum + Number(v.probability), 0);
    if (totalProb === 0) {
      return res.status(404).json({ message: "No voucher available" });
    }

    // Chuẩn hóa xác suất về tổng 100
    const normalizedVouchers = vouchers.map(v => ({
      ...v,
      normalizedProbability: Number(v.probability) * 100 / totalProb
    }));

    // Tạo ranges
    const ranges = [];
    let accumulator = 0;
    normalizedVouchers.forEach(voucher => {
      const prob = voucher.normalizedProbability;
      ranges.push({
        voucher: voucher,
        start: accumulator,
        end: accumulator + prob,
        probability: prob
      });
      accumulator += prob;
    });

    // Random value từ 0 đến 100
    const randomValue = Math.random() * 100;

    // Tìm winner
    const winner = ranges.find(range => 
      randomValue >= range.start && randomValue < range.end
    );

    if (winner) {
      return res.json({ voucher: winner.voucher, randomValue });
    }

    res.json({ voucher: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Hàm lấy danh sách voucher loại "wheel" từ database
async function getWheelVouchersFromDB() {
  const pool = await getPool();
  const result = await pool.query(`
    SELECT * FROM Vouchers 
    WHERE IsActive = true AND Probability IS NOT NULL AND Probability > 0 AND Category = 'wheel'
    ORDER BY CreatedAt ASC
  `);
  return result.rows;
}

export const confirmSpinVoucher = async (req, res) => {
  try {
    const { randomValue } = req.body;
    const vouchers = await getWheelVouchersFromDB();

    const totalProb = vouchers.reduce((sum, v) => sum + Number(v.probability), 0);
    if (totalProb === 0) {
      return res.status(404).json({ message: "No voucher available" });
    }

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
    console.log("Received randomValue:", randomValue);
    console.log("Ranges:", ranges);
    // Tìm lại winner dựa trên randomValue
    const winner = ranges.find(range => 
      randomValue >= range.start && randomValue < range.end
    );

    if (winner) {
      return res.json({ voucher: winner.voucher, randomValue: randomValue });
    }

    res.json({ voucher: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// API quay vòng quay giới hạn 2 lần mỗi user (dùng bảng UserVouchers)
export const spinWheelWithLimit = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(400).json({ error: "Thiếu userId" });

    const pool = await getPool();

    // Đếm số lượt quay "wheel" đã dùng
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM uservouchers uv
       JOIN vouchers v ON uv.voucherid = v.voucherid
       WHERE uv.userid = $1 AND v.category = 'wheel'`,
      [userId]
    );
    const spinCount = parseInt(countResult.rows[0].count, 10);

    if (spinCount >= 2) {
      return res.status(409).json({ error: "Bạn đã hết lượt quay!" });
    }

    // Random voucher loại "wheel" theo xác suất
    const voucherResult = await pool.query(`
      SELECT * FROM vouchers 
      WHERE isactive = true AND probability IS NOT NULL AND probability > 0 AND category = 'wheel'
      ORDER BY RANDOM()
    `);
    const vouchers = voucherResult.rows;
    if (vouchers.length === 0) {
      return res.status(404).json({ error: "No voucher available" });
    }
    const totalProb = vouchers.reduce((sum, v) => sum + Number(v.probability), 0);
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
    const randomValue = Math.random() * totalProb;
    const winner = ranges.find(range =>
      randomValue >= range.start && randomValue < range.end
    );
    if (!winner) {
      return res.status(500).json({ error: "Không tìm được voucher phù hợp" });
    }

    // Lưu lượt quay vào uservouchers
    await pool.query(
      `INSERT INTO uservouchers (userid, voucherid) VALUES ($1, $2)`,
      [userId, winner.voucher.voucherid]
    );

    return res.json({ voucher: winner.voucher });
  } catch (err) {
    console.error("Error in spinWheelWithLimit:", err);
    res.status(500).json({ error: err.message });
  }
};

export const getUserVouchers = async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!userId) return res.json([]);
    const pool = await getPool();
    const vouchers = await pool.query(
      `SELECT v.*, uv.assignedat AS "collectedAt", uv.isused, uv.quantity
      FROM uservouchers uv
      JOIN vouchers v ON uv.voucherid = v.voucherid
      WHERE uv.userid = $1
      ORDER BY uv.assignedat DESC`,
      [userId]
    );
    // Lấy lịch sử sử dụng cho từng voucher
    const voucherRows = vouchers.rows;
    for (let voucher of voucherRows) {
      const usageResult = await pool.query(
        `SELECT usedat FROM uservoucher_usages WHERE uservoucherid = $1 ORDER BY usedat ASC`,
        [voucher.uservoucherid]
      );
      voucher.usedAtList = usageResult.rows.map(u => u.usedat);
}
    res.json({ data: vouchers.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// API cập nhật số lượng ô vòng quay (chỉ cho admin)
export const updateWheelConfig = async (req, res) => {
  const { num_segments } = req.body;
  if (!num_segments || isNaN(num_segments) || num_segments < 2) {
    return res.status(400).json({ success: false, message: "Số ô không hợp lệ" });
  }
  try {
    const pool = await getPool();
    // Nếu đã có cấu hình thì update, chưa có thì insert
    const check = await pool.query("SELECT * FROM wheel_config LIMIT 1");
    if (check.rows.length > 0) {
      await pool.query(
        "UPDATE wheel_config SET num_segments = $1, updated_at = NOW() WHERE id = $2",
        [num_segments, check.rows[0].id]
      );
    } else {
      await pool.query(
        "INSERT INTO wheel_config (num_segments) VALUES ($1)",
        [num_segments]
      );
    }
    res.json({ success: true, num_segments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// API lấy cấu hình số lượng ô vòng quay
export const getWheelConfig = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.query("SELECT num_segments FROM wheel_config LIMIT 1");
    const num_segments = result.rows.length > 0 ? result.rows[0].num_segments : 8; // mặc định 8 ô
    res.json({ success: true, num_segments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Hàm chuẩn hóa số điện thoại về dạng +84xxxxxxxxx
function formatPhoneNumber(phone) {
  let p = phone.replace(/[^\d+]/g, ''); // Giữ dấu +
  if (p.startsWith('0')) p = '+84' + p.slice(1);
  else if (p.startsWith('+84')) p = '+84' + p.slice(3);
  else if (!p.startsWith('+84')) p = '+84' + p;
  return p.replace(/\s+/g, ''); // Xóa mọi dấu cách
}

// gán voucher vào 1 sdt bất kỳ - 11/08/2025 //
export const assignVoucherByPhone = async (req, res) => {
  try {
    const { phone, voucherId, quantity = 1, namecustomer } = req.body;
    const pool = await getPool();
    const cleanPhone = formatPhoneNumber(phone);

    // Tìm user
    let userResult = await pool.query(
      "SELECT * FROM users WHERE phone = $1 OR username = $1",
      [cleanPhone]
    );

    let userId;
    if (userResult.rows.length === 0) {
      // Tạo mới user với tên khách hàng
      const newUser = await pool.query(
        "INSERT INTO users (phone, username, createdat, namecustomer) VALUES ($1, $2, NOW(), $3) RETURNING userid",
        [cleanPhone, cleanPhone, namecustomer]
      );
      userId = newUser.rows[0].userid;
    } else {
      userId = userResult.rows[0].userid;
      // Cập nhật tên khách hàng nếu cần
      await pool.query(
        "UPDATE users SET namecustomer = $1 WHERE userid = $2",
        [namecustomer, userId]
      );
    }

    // Kiểm tra đã gán voucher này cho user chưa
    const check = await pool.query(
      "SELECT * FROM uservouchers WHERE userid = $1 AND voucherid = $2",
      [userId, voucherId]
    );
    if (check.rows.length > 0) {
      // Nếu đã có, cộng quantity và cập nhật tên khách hàng
      await pool.query(
        "UPDATE uservouchers SET quantity = quantity + $1, namecustomer = $2 WHERE userid = $3 AND voucherid = $4",
        [quantity, namecustomer, userId, voucherId]
      );
    } else {
      // Nếu chưa có, tạo mới với quantity và tên khách hàng
      await pool.query(
        "INSERT INTO uservouchers (userid, voucherid, isused, assignedat, quantity, namecustomer) VALUES ($1, $2, $3, NOW(), $4, $5)",
        [userId, voucherId, false, quantity, namecustomer]
      );
    }

    // Trừ số lượng voucher tổng của hệ thống
    await pool.query(
      "UPDATE vouchers SET quantity = quantity - $1 WHERE voucherid = $2 AND quantity >= $1",
      [quantity, voucherId]
    );

    res.json({ success: true, message: "Gán voucher thành công!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Cập nhật trạng thái voucher của user
export const updateUserVoucherStatus = async (req, res) => {
  const { uservoucherid, isused } = req.body;
  if (!uservoucherid || typeof isused !== "boolean") {
    return res.status(400).json({ success: false, message: "Thiếu uservoucherid hoặc isused" });
  }
  try {
    const pool = await getPool();
    // Lấy quantity hiện tại
    const check = await pool.query(
      `SELECT quantity FROM uservouchers WHERE uservoucherid = $1`,
      [uservoucherid]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Không tìm thấy uservoucher" });
    }
    let quantity = check.rows[0].quantity;

    if (isused) {
  if (quantity > 0) {
    quantity -= 1;
    await pool.query(
      `UPDATE uservouchers SET quantity = $1, isused = $2, usedat = (CASE WHEN $2 THEN NOW() ELSE NULL END) WHERE uservoucherid = $3`,
      [quantity, quantity === 0, uservoucherid]
    );
    // Thêm lịch sử sử dụng
    await pool.query(
      `INSERT INTO uservoucher_usages (uservoucherid, usedat) VALUES ($1, NOW())`,
      [uservoucherid]
    );
  } else {
    return res.status(400).json({ success: false, message: "Voucher đã dùng hết!" });
  }

    } else {
      // Nếu bỏ check đã dùng, có thể cộng lại số lượng nếu muốn
      await pool.query(
        `UPDATE uservouchers SET isused = false, usedat = NULL WHERE uservoucherid = $1`,
        [uservoucherid]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
