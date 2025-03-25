// Script to directly insert a test user into the database

const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'postgres',
  database: 'youtube_rag',
  password: 'postgres',
  port: 5432,
});

async function insertTestUser() {
  try {
    // Insert a test user using the existing schema (without role, last_login, etc.)
    const insertResult = await pool.query(`
      INSERT INTO users (
        auth0_id,
        email,
        name,
        created_at,
        updated_at
      )
      VALUES (
        'auth0|test123', 
        'test@example.com',
        'Test User',
        NOW(),
        NOW()
      )
      RETURNING id, auth0_id, email, name;
    `);
    
    console.log('User inserted successfully:', insertResult.rows[0]);
    
    // Verify users table contents
    const selectResult = await pool.query('SELECT * FROM users');
    console.log('All users in database:', selectResult.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    pool.end();
  }
}

insertTestUser();