import express from "express";
import { getPool } from "../config.js";

const router = express.Router();

// Lấy tất cả settings
router.get("/", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.query('SELECT * FROM Settings');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy setting theo key
router.get("/:key", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.query('SELECT * FROM Settings WHERE Key = $1', [req.params.key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Setting not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;