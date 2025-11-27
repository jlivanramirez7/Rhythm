const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

const createTables = async () => {
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
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS cycles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_date TEXT NOT NULL,
                    end_date TEXT
                )`, (err) => {
                    if (err) return reject(err);
                });

                db.run(`CREATE TABLE IF NOT EXISTS cycle_days (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cycle_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                    intercourse INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (cycle_id) REFERENCES cycles (id)
                )`, (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    }
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
        console.log('Connecting to PostgreSQL...');
    } else {
        const dbPath = path.resolve(__dirname, '../database/rhythm.db');
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Connected to the SQLite database.');
        });
    }
    await createTables();
    console.log('Database initialized and tables verified.');
    return db;
};

module.exports = { init };
