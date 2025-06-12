import { getPool } from '../config.js';

// Lấy tất cả sản phẩm với phân trang và tìm kiếm
export const getAllProducts = async (page = 1, limit = 10, search = '') => {
  try {
    const pool = await getPool();
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT 
        ProductID, ProductName, Description, Price, Stock, ImageUrl, IsActive, Category,
        TO_CHAR(CreatedAt, 'YYYY-MM-DD HH24:MI:SS') as CreatedAt, 
        TO_CHAR(UpdatedAt, 'YYYY-MM-DD HH24:MI:SS') as UpdatedAt
      FROM Products
      WHERE IsActive = true
    `;
    const params = [];
    
    if (search) {
      query += ` AND (ProductID ILIKE $${params.length + 1} OR ProductName ILIKE $${params.length + 2})`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY CreatedAt DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);

    // Đếm tổng số bản ghi
    let countQuery = `SELECT COUNT(*) as total FROM Products WHERE IsActive = true`;
    const countParams = [];
    
    if (search) {
      countQuery += ` AND ProductName ILIKE $1`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    return {
      products: result.rows,
      total: parseInt(countResult.rows[0].total)
    };
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sản phẩm:', error);
    throw error;
  }
};

// Lấy chi tiết sản phẩm theo ID
export const getProductById = async (productId) => {
  try {
    const pool = await getPool();
    const query = `
      SELECT 
        ProductID, ProductName, Description, Price, Stock, ImageUrl, IsActive, Category,
        TO_CHAR(CreatedAt, 'YYYY-MM-DD HH24:MI:SS') as CreatedAt, 
        TO_CHAR(UpdatedAt, 'YYYY-MM-DD HH24:MI:SS') as UpdatedAt
      FROM Products
      WHERE ProductID = $1
    `;
    
    const result = await pool.query(query, [productId]);
    return result.rows[0];
  } catch (error) {
    console.error(`Lỗi khi lấy chi tiết sản phẩm:`, error);
    throw error;
  }
};

// Tạo sản phẩm mới
export const createProduct = async (product) => {
  try {
    const pool = await getPool();
    await pool.query(`
      INSERT INTO Products (ProductID, ProductName, Description, Price, Stock, ImageUrl, IsActive, Category)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      product.productId,
      product.productName,
      product.description,
      product.price,
      product.stock,
      product.imageUrl,
      product.isActive,
      product.category
    ]);
    return true;
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  }
};

// Cập nhật sản phẩm
export const updateProduct = async (productId, productData) => {
  try {
    const pool = await getPool();
    let updateFields = [];
    const params = [productId];
    let paramIndex = 2;

    if (productData.productName !== undefined) {
      updateFields.push(`ProductName = $${paramIndex}`);
      params.push(productData.productName);
      paramIndex++;
    }
    if (productData.description !== undefined) {
      updateFields.push(`Description = $${paramIndex}`);
      params.push(productData.description);
      paramIndex++;
    }
    if (productData.price !== undefined) {
      updateFields.push(`Price = $${paramIndex}`);
      params.push(productData.price);
      paramIndex++;
    }
    if (productData.stock !== undefined) {
      updateFields.push(`Stock = $${paramIndex}`);
      params.push(productData.stock);
      paramIndex++;
    }
    if (productData.imageUrl !== undefined) {
      updateFields.push(`ImageUrl = $${paramIndex}`);
      params.push(productData.imageUrl);
      paramIndex++;
    }
    if (productData.isActive !== undefined) {
      updateFields.push(`IsActive = $${paramIndex}`);
      params.push(productData.isActive);
      paramIndex++;
    }
    if (productData.category !== undefined) {
      updateFields.push(`Category = $${paramIndex}`);
      params.push(productData.category);
      paramIndex++;
    }

    updateFields.push('UpdatedAt = NOW()');

    if (updateFields.length === 1) {
      return false; // Không có trường nào được cập nhật
    }

    const query = `
      UPDATE Products
      SET ${updateFields.join(', ')}
      WHERE ProductID = $1
    `;

    const result = await pool.query(query, params);
    return result.rowCount > 0;
  } catch (error) {
    console.error(`Lỗi khi cập nhật sản phẩm:`, error);
    throw error;
  }
};