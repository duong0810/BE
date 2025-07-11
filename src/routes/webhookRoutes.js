import express from "express";
const router = express.Router();

router.post("/zalo-webhook", (req, res) => {
  // Xử lý dữ liệu sự kiện từ Zalo gửi về
  console.log("Webhook event:", req.body);

  // Trả về 200 OK để Zalo biết bạn đã nhận thành công
  res.status(200).send("OK");
});

export default router;