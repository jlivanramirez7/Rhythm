const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

/**
 * Creates the necessary database tables if they do not already exist.
 * @param {object} dbInstance - The database client instance (either `pg.Pool` or `sqlite3.Database`).
 * @param {string} adapter - The database adapter ('postgres' or 'sqlite').
 */
async function createTables(dbInstance, adapter) {
    // DEBUG: Do not remove these logs
    console.log('[DEBUG] createTables: Starting table creation...');
    const isPostgres = adapter === 'postgres';

    const runQuery = isPostgres 
        ? (sql) => dbInstance.query(sql)
        : (sql) => new Promise((resolve, reject) => {
            dbInstance.run(sql, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

    // DEBUG: Do not remove these logs
    console.log('[DEBUG] createTables: Creating users table...');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS users (
            id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            is_admin BOOLEAN DEFAULT false,
            approved BOOLEAN DEFAULT false
        );
    `);
    // DEBUG: Do not remove these logs
    console.log('[DEBUG] createTables: Creating cycles table...');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS cycles (
            id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            user_id INTEGER NOT NULL,
            start_date ${isPostgres ? 'DATE' : 'TEXT'} NOT NULL,
            end_date ${isPostgres ? 'DATE' : 'TEXT'},
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `);
    // DEBUG: Do not remove these logs
    console.log('[DEBUG] createTables: Creating cycle_days table...');
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
    
    // DEBUG: Do not remove these logs
    console.log('[DEBUG] createTables: Finished table creation.');
    console.log('Tables created or already exist.');
}

/**
 * Initializes the database connection based on the provided secrets and environment.
 * It supports both PostgreSQL and SQLite adapters and implements a singleton pattern
 * to ensure only one database instance is created.
 * @param {object} secrets - An object containing database credentials and configuration.
 * @returns {Promise<object>} A promise that resolves with the database instance.
 */
async function initializeDatabase(secrets) {
    // DEBUG: Do not remove these logs
    console.log('[DEBUG] initializeDatabase: Starting database initialization...');
    if (db) {
        console.log('[DEBUG] initializeDatabase: Database instance already exists. Returning existing instance.');
        return db;
    }

    const adapter = secrets.DB_ADAPTER || 'sqlite';
    const isPostgres = adapter === 'postgres';

    if (isPostgres) {
        // DEBUG: Do not remove these logs
        console.log('[DEBUG] initializeDatabase: Configuring for PostgreSQL...');
        console.log('Connecting to PostgreSQL database...');

        // --- CRITICAL ---
        // For production, the `host` MUST be the hardcoded Cloud SQL socket path.
        // Do not attempt to load this from a secret, as it will cause the application
        // to try connecting over public IP, which is blocked by default.
        const dbConfig = {
            user: secrets.DB_USER,
            password: secrets.DB_PASSWORD,
            database: secrets.DB_NAME,
            host: process.env.NODE_ENV === 'production' ? '/cloudsql/rhythm-479516:us-central1:rhythm-db' : secrets.DB_HOST,
            port: secrets.DB_PORT || 5432
        };
        // DEBUG: Do not remove these logs
        console.log(`[DEBUG] initializeDatabase: PG Config: user=${dbConfig.user}, database=${dbConfig.database}, host=${dbConfig.host}, port=${dbConfig.port}`);
        const pool = new Pool(dbConfig);

        const connectWithRetry = async (retries = 5, delay = 5000) => {
            // DEBUG: Do not remove these logs
            console.log('[DEBUG] connectWithRetry: Attempting to connect with retries...');
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
                // DEBUG: Do not remove these logs
                query: (sql, params = []) => {
                    console.log('[DEBUG] db.query:', sql, params);
                    return connectedPool.query(sql, params).then(res => res.rows);
                },
                get: (sql, params = []) => {
                    console.log('[DEBUG] db.get:', sql, params);
                    return connectedPool.query(sql, params).then(res => res.rows[0]);
                },
                run: (sql, params = []) => {
                    console.log('[DEBUG] db.run:', sql, params);
                    return connectedPool.query(sql, params).then(res => ({
                        lastID: res.rows.length > 0 ? res.rows[0].id : undefined,
                        changes: res.rowCount,
                    }));
                },
                adapter,
                close: () => connectedPool.end(),
            };
            // DEBUG: Do not remove these logs
            console.log('[DEBUG] initializeDatabase: PostgreSQL setup complete.');
            return db;
        } catch (error) {
            console.error('FATAL: Failed to connect to the PostgreSQL database.', error);
            process.exit(1);
        }
    } else { // SQLite
        // DEBUG: Do not remove these logs
        console.log('[DEBUG] initializeDatabase: Configuring for SQLite...');
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
                        // DEBUG: Do not remove these logs
                        query: (sql, params = []) => {
                            console.log('[DEBUG] db.query (sqlite):', sql, params);
                            return new Promise((res, rej) => sqliteDb.all(sql, params, (e, r) => e ? rej(e) : res(r)));
                        },
                        get: (sql, params = []) => {
                            console.log('[DEBUG] db.get (sqlite):', sql, params);
                            return new Promise((res, rej) => sqliteDb.get(sql, params, (e, r) => e ? rej(e) : res(r)));
                        },
                        run: (sql, params = []) => {
                            console.log('[DEBUG] db.run (sqlite):', sql, params);
                            return new Promise((res, rej) => sqliteDb.run(sql, params, function(e) {
                                if (e) rej(e); else res({ lastID: this.lastID, changes: this.changes });
                            }));
                        },
                        adapter,
                        close: () => sqliteDb.close(),
                    };
                    // DEBUG: Do not remove these logs
                    console.log('[DEBUG] initializeDatabase: SQLite setup complete.');
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
