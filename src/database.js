const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

let db;
const isProduction = process.env.NODE_ENV === 'production';

const createTables = (dbInstance) => {
    if (isProduction) {
        dbInstance.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        dbInstance.query(`
            CREATE TABLE IF NOT EXISTS cycle_days (
                id SERIAL PRIMARY KEY,
                cycle_id INTEGER NOT NULL,
                date DATE NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse BOOLEAN NOT NULL DEFAULT false,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
            );
        `);
        dbInstance.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                google_id TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                name TEXT
            );
        `);
    } else {
        dbInstance.serialize(() => {
            dbInstance.run(`CREATE TABLE IF NOT EXISTS cycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error("Error creating cycles table:", err.message);
            });

            dbInstance.run(`CREATE TABLE IF NOT EXISTS cycle_days (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id)
            )`, (err) => {
                if (err) console.error("Error creating cycle_days table:", err.message);
            });

            dbInstance.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                name TEXT
            )`, (err) => {
                if (err) console.error("Error creating users table:", err.message);
            });
        });
    }
    console.log('Tables created or already exist.');
};

if (isProduction) {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });
    createTables(pool);
    db = {
        query: async (sql, params = []) => {
            const result = await pool.query(sql, params);
            return result.rows;
        },
        get: async (sql, params = []) => {
            const result = await pool.query(sql, params);
            return result.rows[0];
        },
        run: async (sql, params = []) => {
            const result = await pool.query(sql, params);
            return {
                lastID: result.rows.length > 0 ? result.rows[0].id : undefined,
                changes: result.rowCount
            };
        }
    };
    console.log('Connected to the PostgreSQL database.');
} else {
    const dbPath = path.resolve(__dirname, '../database/rhythm.db');
    const sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error(err.message);
        else console.log('Connected to the SQLite database.');
    });
    createTables(sqliteDb);
    db = {
        query: (sql, params = []) => new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        }),
        get: (sql, params = []) => new Promise((resolve, reject) => {
            sqliteDb.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        }),
        run: (sql, params = []) => new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        }),
    };
}

module.exports = db;
