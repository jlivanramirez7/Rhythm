const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

async function createTables(dbInstance, adapter) {
    const isPostgres = adapter === 'postgres';

    const runQuery = isPostgres 
        ? (sql) => dbInstance.query(sql)
        : (sql) => new Promise((resolve, reject) => {
            dbInstance.run(sql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

    await runQuery(`
        CREATE TABLE IF NOT EXISTS users (
            id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT
        );
    `);
    await runQuery(`
        CREATE TABLE IF NOT EXISTS cycles (
            id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER NOT NULL,
            start_date ${isPostgres ? 'DATE' : 'TEXT'} NOT NULL,
            end_date ${isPostgres ? 'DATE' : 'TEXT'},
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `);
    await runQuery(`
        CREATE TABLE IF NOT EXISTS cycle_days (
            id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            cycle_id INTEGER NOT NULL,
            date ${isPostgres ? 'DATE' : 'TEXT'} NOT NULL,
            hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
            intercourse ${isPostgres ? 'BOOLEAN' : 'INTEGER'} NOT NULL DEFAULT ${isPostgres ? 'false' : '0'},
            FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
        );
    `);
    
    console.log('Tables created or already exist.');
}

async function initializeDatabase(secrets) {
    if (db) return db;

    const adapter = secrets.DB_ADAPTER || 'sqlite';
    const isPostgres = adapter === 'postgres';

    if (isPostgres) {
        console.log('Connecting to PostgreSQL database...');
        const dbConfig = {
            user: secrets.DB_USER,
            password: secrets.DB_PASSWORD,
            database: secrets.DB_NAME,
            // When running in production on Cloud Run, we connect to the Cloud SQL instance via a Unix socket.
            host: process.env.NODE_ENV === 'production' ? '/cloudsql/rhythm-479516:us-central1:rhythm-db' : secrets.DB_HOST,
            port: secrets.DB_PORT || 5432
        };
        const pool = new Pool(dbConfig);

        const connectWithRetry = async (retries = 5, delay = 5000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`Database connection attempt ${i + 1}...`);
                    const client = await pool.connect();
                    console.log('Successfully connected to the PostgreSQL database.');
                    client.release();
                    return pool;
                } catch (err) {
                    console.error(`Connection attempt ${i + 1} failed with error:`, err);
                    if (i === retries - 1) throw err;
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        };
        
        try {
            const connectedPool = await connectWithRetry();
            await createTables(connectedPool, adapter);

            db = {
                query: (sql, params = []) => connectedPool.query(sql, params).then(res => res.rows),
                get: (sql, params = []) => connectedPool.query(sql, params).then(res => res.rows[0]),
                run: (sql, params = []) => connectedPool.query(sql, params).then(res => ({
                    lastID: res.rows.length > 0 ? res.rows[0].id : undefined,
                    changes: res.rowCount,
                })),
                adapter,
            };
            return db;
        } catch (error) {
            console.error('FATAL: Failed to connect to the PostgreSQL database.', error);
            process.exit(1);
        }
    } else { // SQLite
        console.log('Connecting to SQLite database...');
        const dbPath = path.resolve(__dirname, '..', secrets.DB_NAME);
        return new Promise((resolve, reject) => {
            const sqliteDb = new sqlite3.Database(dbPath, async (err) => {
                if (err) {
                    console.error('FATAL: Could not connect to SQLite database.', err);
                    return reject(err);
                }
                console.log('Successfully connected to the SQLite database.');

                try {
                    await createTables(sqliteDb, adapter);
                    db = {
                        query: (sql, params = []) => new Promise((res, rej) => sqliteDb.all(sql, params, (e, r) => e ? rej(e) : res(r))),
                        get: (sql, params = []) => new Promise((res, rej) => sqliteDb.get(sql, params, (e, r) => e ? rej(e) : res(r))),
                        run: (sql, params = []) => new Promise((res, rej) => sqliteDb.run(sql, params, function(e) {
                            if (e) rej(e); else res({ lastID: this.lastID, changes: this.changes });
                        })),
                        adapter,
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
