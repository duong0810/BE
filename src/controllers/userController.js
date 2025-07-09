import { getPool } from "../config.js";

export const updateUserProfile = async (req, res) => {
  try {
    const zaloId = req.user.zaloid;
    const { fullname, gender, birthday, phone, address } = req.body;

    const pool = await getPool();
    const result = await pool.query(
      `UPDATE users
       SET fullname = $1, gender = $2, birthday = $3, phone = $4, address = $5
       WHERE zaloid = $6
       RETURNING *`,
      [fullname, gender, birthday, phone, address, zaloId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};