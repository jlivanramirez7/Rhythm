const { Pool } = require('pg');
require('dotenv').config();

const mockPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

beforeAll(async () => {
    await mockPool.query(`
        CREATE TABLE IF NOT EXISTS cycles (
            id SERIAL PRIMARY KEY,
            start_date DATE NOT NULL,
            end_date DATE
        );
    `);
    await mockPool.query(`
        CREATE TABLE IF NOT EXISTS cycle_days (
            id SERIAL PRIMARY KEY,
            cycle_id INTEGER NOT NULL,
            date DATE NOT NULL,
            hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
            intercourse BOOLEAN NOT NULL DEFAULT false,
            FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
        );
    `);
});

beforeEach(async () => {
    await mockPool.query('TRUNCATE TABLE cycle_days, cycles RESTART IDENTITY CASCADE');
});

afterAll(async () => {
    await mockPool.end();
});

// We can also mock the db module to use this pool
jest.mock('../src/db', () => {
    const isProduction = true; // Force production mode for these tests
    const query = (sql, params = []) => mockPool.query(sql, params).then(res => res.rows);
    const get = (sql, params = []) => mockPool.query(sql, params).then(res => res.rows[0]);
    const run = (sql, params = []) => mockPool.query(sql, params).then(res => ({ lastID: res.rows[0] ? res.rows[0].id : undefined, changes: res.rowCount }));
    const serialize = (fn) => fn();
    return { query, get, run, serialize, isProduction };
});
