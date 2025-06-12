import * as productModel from '../Model/Product.js';

// Lấy tất cả sản phẩm
export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const { products, total } = await productModel.getAllProducts(page, limit, search);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy danh sách sản phẩm'
    });
  }
};

// Lấy chi tiết sản phẩm theo ID (ProductID là chuỗi)
export const getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'ID sản phẩm không hợp lệ'
      });
    }
    const product = await productModel.getProductById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error(`Lỗi khi lấy chi tiết sản phẩm:`, error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy chi tiết sản phẩm'
    });
  }
};

// Tạo sản phẩm mới (ProductID là chuỗi, FE phải gửi lên)
export const createProduct = async (req, res) => {
  console.log('req.body:', req.body);
  try {
    const { productId, productName, description, price, stock, imageUrl, isActive, category } = req.body;
    // Kiểm tra dữ liệu đầu vào
    if (!productId || !productName) {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm và tên sản phẩm là bắt buộc'
      });
    }
    if (price === undefined || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      return res.status(400).json({
        success: false,
        message: 'Giá sản phẩm không hợp lệ'
      });
    }
    const productData = {
      productId,
      productName,
      description,
      price: parseFloat(price),
      stock: stock !== undefined ? parseInt(stock) : 0,
      imageUrl,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      category
    };
    const created = await productModel.createProduct(productData);
    res.status(201).json({
      success: true,
      message: 'Tạo sản phẩm thành công',
      data: { productId }
    });
  } catch (error) {
    // Xử lý lỗi trùng khóa chính (mã sản phẩm đã tồn tại)
    if (
      error.originalError &&
      error.originalError.info &&
      error.originalError.info.number === 2627
    ) {
      return res.status(400).json({
        success: false,
        message: 'Mã sản phẩm đã tồn tại'
      });
    }
    console.error('Lỗi khi tạo sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tạo sản phẩm'
    });
  }
};

// Cập nhật sản phẩm
export const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'ID sản phẩm không hợp lệ'
      });
    }
    // Kiểm tra sản phẩm tồn tại
    const existingProduct = await productModel.getProductById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    const { productName, description, price, stock, imageUrl, isActive, category } = req.body;
    // Xử lý dữ liệu cập nhật
    const updateData = {};
    if (category !== undefined) updateData.category = category;
    if (productName !== undefined) updateData.productName = productName;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) {
      if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá sản phẩm không hợp lệ'
        });
      }
      updateData.price = parseFloat(price);
    }
    if (stock !== undefined) {
      if (isNaN(parseInt(stock)) || parseInt(stock) < 0) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng sản phẩm không hợp lệ'
        });
      }
      updateData.stock = parseInt(stock);
    }
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    // Kiểm tra nếu không có dữ liệu để cập nhật
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không có dữ liệu nào được cập nhật'
      });
    }
    const success = await productModel.updateProduct(productId, updateData);
    if (success) {
      res.json({
        success: true,
        message: 'Cập nhật sản phẩm thành công'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Cập nhật sản phẩm thất bại'
      });
    }
  } catch (error) {
    console.error(`Lỗi khi cập nhật sản phẩm:`, error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi cập nhật sản phẩm'
    });
  }
};

// Xóa sản phẩm (xóa mềm)
export const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: 'ID sản phẩm không hợp lệ'
      });
    }
    // Kiểm tra sản phẩm tồn tại
    const existingProduct = await productModel.getProductById(productId);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm'
      });
    }
    const success = await productModel.deleteProduct(productId);
    if (success) {
      res.json({
        success: true,
        message: 'Xóa sản phẩm thành công'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Xóa sản phẩm thất bại'
      });
    }
  } catch (error) {
    console.error(`Lỗi khi xóa sản phẩm:`, error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xóa sản phẩm'
    });
  }
};

// Lấy thống kê sản phẩm
export const getProductStats = async (req, res) => {
  try {
    const stats = await productModel.getProductStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Lỗi khi lấy thống kê sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy thống kê sản phẩm'
    });
  }
};

// Lấy danh sách sản phẩm sắp hết hàng
export const getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const products = await productModel.getLowStockProducts(threshold);
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Lỗi khi lấy sản phẩm sắp hết hàng:', error);
    res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi lấy sản phẩm sắp hết hàng'
    });
  }
};