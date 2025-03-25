// Simple script to add a test user to the database

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'postgres',
  database: 'youtube_rag',
  password: 'postgres',
  port: 5432,
});

async function checkDbSchema() {
  try {
    // First check what columns actually exist
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    
    console.log('Current users table schema:', result.rows);
    
    // Then try to insert a user with only basic fields
    const insertResult = await pool.query(`
      INSERT INTO users (
        auth0_id, 
        email, 
        name
      ) 
      VALUES (
        'test-auth0-id-2', 
        'test2@example.com', 
        'Test User 2'
      )
      RETURNING id, email, name;
    `);
    
    console.log('User added successfully:', insertResult.rows[0]);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}

checkDbSchema();