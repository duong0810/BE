import express from 'express';
import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../cloudinary.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Cấu hình lưu trữ Cloudinary cho multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'miniappzalo/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit' }]
  },
});

// Bộ lọc file
const fileFilter = (req, file, cb) => {
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

// Route upload hình ảnh sản phẩm lên Cloudinary
router.post(
  '/product-image',
  authMiddleware,
  upload.single('image'),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Không có file nào được tải lên'
        });
      }

      // Đường dẫn ảnh public trên Cloudinary
      const imageUrl = req.file.path;

      res.json({
        success: true,
        message: 'Tải lên hình ảnh thành công',
        data: { imageUrl }
      });
    } catch (error) {
      console.error('Lỗi khi tải lên hình ảnh:', error);
      res.status(500).json({
        success: false,
        message: 'Đã xảy ra lỗi khi tải lên hình ảnh',
        error: error.message,
      });
    }
  }
);

export default router;