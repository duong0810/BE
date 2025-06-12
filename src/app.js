
import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from 'cookie-parser';
import { connectDB } from "./config.js";
import voucherRoutes from "./routes/voucherRoutes.js";
import healthRoutes from "./routes/healthRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
// import authRoutes from "./routes/authRoutes.js";
import productRoutes from './routes/productRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;


const app = express();

app.use(cors());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// Đặt express.json và express.urlencoded lên TRƯỚC các route
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

// Sau đó mới khai báo các route
app.use("/api/vouchers", voucherRoutes);
app.use("/health", healthRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/products", productRoutes);
app.use("/api/uploads", uploadRoutes);

// // API auth
// app.use("/api/auth", authRoutes);

// Phục vụ tệp tĩnh từ thư mục public (chỉ cho trang login)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Route cho admin login (chỉ trả về HTML login, không điều hướng dashboard)
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'AdminLogin.html'));
});

// Route mặc định trả về thông tin API
app.get('/api', (req, res) => {
  res.json({
    message: 'MiniApp Zalo API đang hoạt động',
    endpoints: [
      '/api/vouchers',
      '/api/products',
      '/api/uploads'
    ]
  });
});

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Không tìm thấy API đã yêu cầu'
  });
});

// Xử lý lỗi global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || 'Đã xảy ra lỗi server'
  });
});

// Kết nối database trước khi start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();