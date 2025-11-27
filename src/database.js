const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const INSTANCE_CONNECTION_NAME = `rhythm-479516:us-central1:rhythm-db`;

let db;

async function createTables(dbInstance) {
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT
        );
    `;
    const createCyclesTable = `
        CREATE TABLE IF NOT EXISTS cycles (
            id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
            user_id INTEGER NOT NULL,
            start_date ${isProduction ? 'DATE' : 'TEXT'} NOT NULL,
            end_date ${isProduction ? 'DATE' : 'TEXT'},
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `;
    const createCycleDaysTable = `
        CREATE TABLE IF NOT EXISTS cycle_days (
            id ${isProduction ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isProduction ? '' : 'AUTOINCREMENT'},
            cycle_id INTEGER NOT NULL,
            date ${isProduction ? 'DATE' : 'TEXT'} NOT NULL,
            hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
            intercourse ${isProduction ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isProduction ? 'false' : '0'},
            FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
        );
    `;

    if (isProduction) {
        await dbInstance.query(createUsersTable);
        await dbInstance.query(createCyclesTable);
        await dbInstance.query(createCycleDaysTable);
    } else {
        const run = (sql) => new Promise((resolve, reject) => {
            dbInstance.run(sql, (err) => err ? reject(err) : resolve());
        });
        await run(createUsersTable);
        await run(createCyclesTable);
        await run(createCycleDaysTable);
    }
    console.log('Tables created or already exist.');
}

async function initializeDatabase(secrets) {
    if (db) return db;

    if (isProduction) {
        const pool = new Pool({
            user: secrets.DB_USER,
            password: secrets.DB_PASSWORD,
            database: secrets.DB_NAME,
            host: `/cloudsql/${INSTANCE_CONNECTION_NAME}`,
        });

        const connectWithRetry = async (retries = 5, delay = 5000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`Database connection attempt ${i + 1}...`);
                    const client = await pool.connect();
                    console.log('Successfully connected to the PostgreSQL database.');
                    client.release();
                    return pool;
                } catch (err) {
                    console.error(`Connection attempt ${i + 1} failed:`, err.message);
                    if (i === retries - 1) throw err;
                    console.log(`Retrying in ${delay / 1000}s...`);
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        };
        
        try {
            const connectedPool = await connectWithRetry();
            await createTables(connectedPool);
            db = {
                query: (sql, params = []) => connectedPool.query(sql, params).then(res => res.rows),
                get: (sql, params = []) => connectedPool.query(sql, params).then(res => res.rows[0]),
                run: (sql, params = []) => connectedPool.query(sql, params).then(res => ({ lastID: res.rows[0]?.id, changes: res.rowCount })),
            };
            return db;
        } catch (error) {
            console.error('FATAL: Failed to connect to the PostgreSQL database after multiple retries.', error);
            process.exit(1);
        }
    } else {
        // Local/testing SQLite database
        const dbPath = path.resolve(__dirname, '../database/rhythm.db');
        return new Promise((resolve, reject) => {
            const sqliteDb = new sqlite3.Database(dbPath, async (err) => {
                if (err) {
                    console.error('FATAL: Could not connect to SQLite database.', err);
                    return reject(err);
                }
                console.log('Successfully connected to the SQLite database.');
                await createTables(sqliteDb);
                db = {
                    query: (sql, params = []) => new Promise((res, rej) => sqliteDb.all(sql, params, (e, r) => e ? rej(e) : res(r))),
                    get: (sql, params = []) => new Promise((res, rej) => sqliteDb.get(sql, params, (e, r) => e ? rej(e) : res(r))),
                    run: (sql, params = []) => new Promise((res, rej) => sqliteDb.run(sql, params, function(e) { e ? rej(e) : res({ lastID: this.lastID, changes: this.changes }); })),
                };
                resolve(db);
            });
        });
    }
}

module.exports = { initializeDatabase };
