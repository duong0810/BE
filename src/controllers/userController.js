import { getPool } from "../config.js";

function parseBirthday(birthday) {
  // Nếu là dd/mm/yyyy thì chuyển sang yyyy-mm-dd
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(birthday)) {
    const [day, month, year] = birthday.split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return birthday; // Nếu đã là yyyy-mm-dd thì giữ nguyên
}

function toDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const updateUserProfile = async (req, res) => {
  try {
    const zaloId = req.user.zaloid;
    const { fullname, gender, birthday, phone, address } = req.body;
    const birthdayISO = birthday ? parseBirthday(birthday) : null;

    const pool = await getPool();
    const result = await pool.query(
      `UPDATE users
       SET fullname = $1, gender = $2, birthday = $3, phone = $4, address = $5
       WHERE zaloid = $6
       RETURNING *`,
      [fullname, gender, birthdayISO, phone, address, zaloId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Format lại ngày sinh
    const user = result.rows[0];
    user.birthday = toDDMMYYYY(user.birthday);

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const zaloId = req.user.zaloid;
    const pool = await getPool();
    const result = await pool.query(
      `SELECT * FROM users WHERE zaloid = $1`,
      [zaloId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = result.rows[0];
    user.birthday = toDDMMYYYY(user.birthday);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// gọi thong tin tất cả user bên DA
export const getAllUsers = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.query("SELECT * FROM users ORDER BY userid DESC");
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    // Xoá các voucher của user trước (nếu có)
    await pool.query("DELETE FROM uservouchers WHERE userid = $1", [id]);
    // Xoá user
    const result = await pool.query("DELETE FROM users WHERE userid = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }
    res.json({ success: true, message: "Xoá user thành công" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const adminUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, fullname, phone, email, role, gender, birthday, address } = req.body;
    const birthdayISO = birthday ? parseBirthday(birthday) : null;
    const pool = await getPool();
    const result = await pool.query(
      `UPDATE users SET 
        username = $2,
        fullname = $3,
        phone = $4,
        email = $5,
        role = $6,
        gender = $7,
        birthday = $8,
        address = $9,
        updatedat = NOW()
      WHERE userid = $1 RETURNING *`,
      [id, username, fullname, phone, email, role, gender, birthdayISO, address]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User không tồn tại" });
    }
    const user = result.rows[0];
    user.birthday = toDDMMYYYY(user.birthday);
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};