const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const INSTANCE_CONNECTION_NAME = 'secret-bloom-474313-m8:us-central1:rhythm-db';

let db;

async function createTables(dbInstance) {
    if (isProduction) {
        await dbInstance.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                google_id TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                name TEXT
            );
        `);
        await dbInstance.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        await dbInstance.query(`
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
        const run = (sql) => new Promise((resolve, reject) => {
            dbInstance.run(sql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        await run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                name TEXT
            );
        `);
        await run(`
            CREATE TABLE IF NOT EXISTS cycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        await run(`
            CREATE TABLE IF NOT EXISTS cycle_days (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
            );
        `);
    }
    console.log('Tables created or already exist.');
}

async function initializeDatabase() {
    if (db) return db;

    if (isProduction) {
        console.log('Connecting to Cloud SQL for PostgreSQL...');
        const pool = new Pool({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            host: `/cloudsql/${INSTANCE_CONNECTION_NAME}`,
        });

        try {
            const client = await pool.connect();
            console.log('Successfully connected to the PostgreSQL database.');
            client.release();
            await createTables(pool);

            db = {
                query: (sql, params = []) => pool.query(sql, params).then(res => res.rows),
                get: (sql, params = []) => pool.query(sql, params).then(res => res.rows[0]),
                run: (sql, params = []) => pool.query(sql, params).then(res => ({
                    lastID: res.rows.length > 0 ? res.rows[0].id : undefined,
                    changes: res.rowCount,
                })),
                isProduction,
            };
            return db;
        } catch (error) {
            console.error('FATAL: Failed to connect to the PostgreSQL database.', error);
            process.exit(1);
        }
    } else {
        console.log('Connecting to SQLite database...');
        const dbPath = path.resolve(__dirname, '../database/rhythm.db');
        return new Promise((resolve, reject) => {
            const sqliteDb = new sqlite3.Database(dbPath, async (err) => {
                if (err) {
                    console.error('FATAL: Could not connect to SQLite database.', err);
                    return reject(err);
                }
                console.log('Successfully connected to the SQLite database.');

                try {
                    await createTables(sqliteDb);
                    db = {
                        query: (sql, params = []) => new Promise((res, rej) => sqliteDb.all(sql, params, (e, r) => e ? rej(e) : res(r))),
                        get: (sql, params = []) => new Promise((res, rej) => sqliteDb.get(sql, params, (e, r) => e ? rej(e) : res(r))),
                        run: (sql, params = []) => new Promise((res, rej) => sqliteDb.run(sql, params, function(e) {
                            if (e) rej(e); else res({ lastID: this.lastID, changes: this.changes });
                        })),
                        isProduction,
                    };
                    resolve(db);
                } catch (tableError) {
                    console.error('FATAL: Error creating SQLite tables.', tableError);
                    reject(tableError);
                }
            });
        }).catch(err => {
            console.error(err);
            process.exit(1);
        });
    }
}

module.exports = { initializeDatabase };
