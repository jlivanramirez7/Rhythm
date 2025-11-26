const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database.');
});

const createTables = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cycles (
        id SERIAL PRIMARY KEY,
        start_date DATE NOT NULL,
        end_date DATE
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS cycle_days (
        id SERIAL PRIMARY KEY,
        cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        hormone_reading VARCHAR(10) CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
        intercourse BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    console.log('Tables created successfully.');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    client.release();
  }
};

createTables();

module.exports = {
  query: (text, params) => pool.query(text, params),
};
