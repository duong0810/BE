import { getPool } from './src/config.js';

async function testDB() {
  try {
    console.log('🔍 Testing database connection...');
    const pool = await getPool();
    
    console.log('✅ Pool created successfully');
    
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Query executed:', result.rows[0]);
    
    const productsResult = await pool.query('SELECT COUNT(*) FROM Products');
    console.log('✅ Products count:', productsResult.rows[0]);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('❌ Full error:', error);
  }
}

testDB();