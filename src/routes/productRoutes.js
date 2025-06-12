import express from 'express';
import { 
  getAllProducts, 
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getLowStockProducts
} from '../controllers/productController.js';  // Sửa từ Controller thành controllers
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

// Routes công khai
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Routes yêu cầu xác thực
router.post('/', authMiddleware, createProduct);
router.put('/:id', authMiddleware, updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);
router.get('/stats/overview', authMiddleware, getProductStats);
router.get('/stats/low-stock', authMiddleware, getLowStockProducts);

export default router;