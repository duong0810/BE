import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;
dotenv.config();

const config = {
    host: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT) || 5432,
    ssl: {
        rejectUnauthorized: false
    }
};

async function testConnection() {
    const client = new Client(config);
    
    try {
        console.log('🔄 Testing PostgreSQL connection...');
        console.log('Host:', config.host);
        console.log('Database:', config.database);
        console.log('User:', config.user);
        
        await client.connect();
        console.log('✅ Database connected successfully!');
        
        const result = await client.query('SELECT NOW() as current_time');
        console.log('📅 Server time:', result.rows[0].current_time);
        
        await client.end();
        console.log('✅ Connection test completed!');
        
    } catch (error) {
        console.error('❌ Connection test failed:', error.message);
        process.exit(1);
    }
}

testConnection();