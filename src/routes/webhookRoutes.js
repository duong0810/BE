import express from "express";
import { getPool } from "../config.js";

const router = express.Router();

router.post("/zalo-webhook", async (req, res) => {
  console.log("Webhook body:", req.body);
  const event = req.body;

  const pool = await getPool();

  if (event.event_name === "follow") {
    const userId = event.user_id_by_app;
    // Cập nhật trạng thái Quan tâm OA
    await pool.query(
      'UPDATE users SET "isFollowOA" = true WHERE zaloid = $1',
      [userId]
    );
    console.log(`User ${userId} vừa quan tâm OA!`);
  } else if (event.event_name === "unfollow") {
    const userId = event.user_id_by_app;
    await pool.query(
      'UPDATE users SET "isFollowOA" = false WHERE zaloid = $1',
      [userId]
    );
    console.log(`User ${userId} vừa bỏ Quan tâm OA!`);
  } else {
    console.log("Webhook event:", event);
  }

  res.status(200).send("OK");
});

export default router;