import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Lấy đường dẫn thư mục hiện tại
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình lưu trữ cho multer
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads/products');
    
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});

// Bộ lọc file
const fileFilter = (req, file, cb) => {
  // Chỉ chấp nhận các loại file hình ảnh
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Giới hạn 5MB
  }
});

// Route upload hình ảnh sản phẩm
router.post('/product-image', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Không có file nào được tải lên'
      });
    }
    
    // Trả về đường dẫn đến file
    const filePath = `/uploads/products/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Tải lên hình ảnh thành công',
      data: { imageUrl: filePath }
    });
  } catch (error) {
    console.error('Lỗi khi tải lên hình ảnh:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tải lên hình ảnh'
    });
  }
});

export default router;