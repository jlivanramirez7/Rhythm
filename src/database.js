const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

let db;

const createTables = async (db) => {
    if (process.env.NODE_ENV === 'production') {
        await db.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id SERIAL PRIMARY KEY,
                start_date DATE NOT NULL,
                end_date DATE
            );
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS cycle_days (
                id SERIAL PRIMARY KEY,
                cycle_id INTEGER NOT NULL,
                date DATE NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse BOOLEAN NOT NULL DEFAULT false,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
            );
        `);
    } else {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS cycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_date TEXT NOT NULL,
                end_date TEXT
            )`, (err) => {
                if (err) {
                    console.error("Error creating cycles table:", err.message);
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS cycle_days (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id)
            )`, (err) => {
                if (err) {
                    console.error("Error creating cycle_days table:", err.message);
                }
            });
        });
    }
    console.log('Tables created or already exist.');
};

const init = async () => {
    if (process.env.NODE_ENV === 'production') {
        db = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_DATABASE,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT,
        });
        await createTables(db);
        console.log('Connected to the PostgreSQL database.');
    } else {
        const dbPath = path.resolve(__dirname, '../database/rhythm.db');
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Connected to the SQLite database.');
        });
        await createTables(db);
    }
    return db;
}

module.exports = { init };
