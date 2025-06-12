import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
dotenv.config();

// Kiểm tra biến môi trường cho PostgreSQL
const requiredEnvVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Cấu hình kết nối PostgreSQL
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: {
    rejectUnauthorized: false
  },
  max: 10, // pool size
  min: 0,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Biến global để lưu trạng thái kết nối
let poolConnection = null;

// Hàm kết nối đến DB và trả về pool
export const connectDB = async () => {
  try {
    if (!poolConnection) {
      console.log("Creating new PostgreSQL connection pool...");
      poolConnection = new Pool(config);
      console.log("PostgreSQL connected successfully");
      
      // Test connection
      const client = await poolConnection.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log("✅ Database connection verified");
    }
    return poolConnection;
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    throw error;
  }
};

// Hàm getPool để tương thích với mã đã có
export const getPool = async () => {
  return await connectDB();
};

// Hàm thực thi truy vấn PostgreSQL
export async function executeQuery(query, params = []) {
  try {
    const pool = await connectDB();
    const result = await pool.query(query, params);
    return result;
  } catch (error) {
    console.error("Query execution failed:", error);
    throw error;
  }
}

export default config;