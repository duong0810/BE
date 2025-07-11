import express from "express";
const router = express.Router();

router.post("/zalo-webhook", (req, res) => {
  const event = req.body;

  // Xử lý sự kiện "follow"
  if (event.event_name === "follow") {
    const userId = event.user_id_by_app;
    const followerId = event.follower?.id;
    console.log(`User ${userId} vừa quan tâm OA! Follower ID: ${followerId}`);
    // Bạn có thể thêm xử lý khác ở đây, ví dụ: lưu DB, gửi thông báo, ...
  } else {
    // Xử lý các sự kiện khác (nếu cần)
    console.log("Webhook event:", event);
  }

  // Trả về 200 OK để Zalo biết bạn đã nhận thành công
  res.status(200).send("OK");
});

export default router;