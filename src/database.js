const { Pool } = require('pg');
const sqlite3 = require('sqlite3');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');

let db;

/**
 * Creates the necessary database tables if they do not already exist.
 * @param {object} dbInstance - The database client instance (either `pg.Pool` or `sqlite3.Database`).
 * @param {string} adapter - The database adapter ('postgres', 'sqlite', or 'gcs-sqlite').
 */
async function createTables(dbInstance, adapter) {
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

    console.log('[DEBUG] createTables: Creating users table...');
    await runQuery(`
        CREATE TABLE IF NOT EXISTS users (
            id ${isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT'},
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT
        );
    `);

    // --- Idempotent Migration ---
    const columns = isPostgres 
        ? await dbInstance.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'")
            .then(res => res.rows.map(r => r.column_name))
        : await new Promise((resolve, reject) => {
            dbInstance.all("PRAGMA table_info(users)", (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => r.name));
            });
        });

    if (!columns.includes('is_admin')) {
        console.log('[INFO] Migrating database: Adding is_admin column to users table.');
        await runQuery('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false');
    }
    if (!columns.includes('approved')) {
        console.log('[INFO] Migrating database: Adding approved column to users table.');
        await runQuery('ALTER TABLE users ADD COLUMN approved BOOLEAN DEFAULT false');
    }
    if (!columns.includes('partner_id')) {
        console.log('[INFO] Migrating database: Adding partner_id column to users table.');
        await runQuery('ALTER TABLE users ADD COLUMN partner_id INTEGER REFERENCES users(id)');
    }
    if (!columns.includes('show_instructions')) {
        console.log('[INFO] Migrating database: Adding show_instructions column to users table.');
        await runQuery('ALTER TABLE users ADD COLUMN show_instructions BOOLEAN DEFAULT true');
    }
    if (!columns.includes('last_login')) {
        console.log('[INFO] Migrating database: Adding last_login column to users table.');
        await runQuery('ALTER TABLE users ADD COLUMN last_login TEXT');
    }
    if (!columns.includes('default_view_user_id')) {
        console.log('[INFO] Migrating database: Adding default_view_user_id column to users table.');
        await runQuery('ALTER TABLE users ADD COLUMN default_view_user_id INTEGER REFERENCES users(id)');
    }

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

    if (isPostgres) {
        console.log('[DEBUG] createTables: Creating sessions table for connect-pg-simple...');
        await runQuery(`
            CREATE TABLE IF NOT EXISTS "sessions" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            )
            WITH (OIDS=FALSE);
        `);
        const constraintExists = await dbInstance.query(
            "SELECT 1 FROM pg_constraint WHERE conname = 'sessions_pkey'"
        ).then(res => res.rowCount > 0);

        if (!constraintExists) {
            await runQuery('ALTER TABLE "sessions" ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;');
        }
    } else {
        console.log('[DEBUG] createTables: Creating sessions table for connect-sqlite3...');
        await runQuery(`
            CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                expired TEXT NOT NULL,
                sess TEXT NOT NULL
            );
        `);
    }
    
    console.log('[DEBUG] createTables: Finished table creation.');
}

/**
 * Initializes the database connection based on secrets and environment.
 * Supports PostgreSQL, local SQLite, and GCS-backed SQLite with optimistic concurrency control.
 * @param {object} secrets - Database credentials and configuration.
 * @returns {Promise<object>} Database instance wrapper.
 */
async function initializeDatabase(secrets) {
    console.log('[DEBUG] initializeDatabase: Starting database initialization...');
    if (db) {
        console.log('[DEBUG] initializeDatabase: Database instance already exists. Returning existing instance.');
        return db;
    }

    const adapter = secrets.DB_ADAPTER || 'sqlite';
    const isPostgres = adapter === 'postgres';
    const isGcsSqlite = adapter === 'gcs-sqlite' || (process.env.NODE_ENV === 'production' && adapter !== 'postgres');

    if (isPostgres) {
        console.log('[DEBUG] initializeDatabase: Configuring for PostgreSQL...');
        const dbConfig = {
            user: secrets.DB_USER,
            password: secrets.DB_PASSWORD,
            database: secrets.DB_NAME,
            host: process.env.NODE_ENV === 'production' ? '/cloudsql/rhythm-479516:us-central1:rhythm-db' : secrets.DB_HOST,
            port: secrets.DB_PORT || 5432
        };
        console.log(`[DEBUG] initializeDatabase: PG Config: user=${dbConfig.user}, database=${dbConfig.database}, host=${dbConfig.host}`);
        const pool = new Pool(dbConfig);

        const connectWithRetry = async (retries = 5, delay = 5000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    console.log(`Database connection attempt ${i + 1}...`);
                    const client = await pool.connect();
                    console.log('Successfully connected to PostgreSQL.');
                    client.release();
                    return pool;
                } catch (err) {
                    console.error(`Connection attempt ${i + 1} failed:`, err);
                    if (i === retries - 1) throw err;
                    await new Promise(res => setTimeout(res, delay));
                }
            }
        };
        
        try {
            const connectedPool = await connectWithRetry();
            await createTables(connectedPool, adapter);

            db = {
                pool: connectedPool,
                query: (sql, params = []) => connectedPool.query(sql, params).then(res => res.rows),
                get: (sql, params = []) => connectedPool.query(sql, params).then(res => res.rows[0]),
                run: (sql, params = []) => connectedPool.query(sql, params).then(res => ({
                    lastID: res.rows.length > 0 ? res.rows[0].id : undefined,
                    changes: res.rowCount,
                })),
                adapter,
                close: () => connectedPool.end(),
            };
            return db;
        } catch (error) {
            console.error('FATAL: Failed to connect to PostgreSQL.', error);
            process.exit(1);
        }
    } else if (isGcsSqlite) {
        console.log('[DEBUG] initializeDatabase: Configuring for GCS-Backed SQLite...');
        const bucketName = secrets.GCS_BUCKET_NAME || 'rhythm-479516-db-bucket';
        const remoteFileName = 'rhythm.db';
        const localDbPath = '/tmp/rhythm.db';
        
        const storage = new Storage();
        const bucket = storage.bucket(bucketName);
        const file = bucket.file(remoteFileName);

        let currentGeneration;
        let sqliteDb;

        // Helper to download DB from GCS
        const downloadDb = async () => {
            console.log(`[GCS-SQLITE] Downloading ${remoteFileName} from gs://${bucketName}...`);
            try {
                const [metadata] = await file.getMetadata();
                currentGeneration = metadata.generation;
                await file.download({ destination: localDbPath });
                console.log(`[GCS-SQLITE] Download complete. Current generation: ${currentGeneration}`);
                
                if (sqliteDb) {
                    await new Promise(res => sqliteDb.close(() => res()));
                }
                sqliteDb = new sqlite3.Database(localDbPath);
            } catch (err) {
                console.error(`[GCS-SQLITE] FATAL: Failed to download database from GCS.`, err);
                throw err;
            }
        };

        // Helper to check if local DB is stale before reads
        const ensureFreshness = async () => {
            try {
                const [metadata] = await file.getMetadata();
                if (metadata.generation !== currentGeneration) {
                    console.log(`[GCS-SQLITE] Stale DB detected (local: ${currentGeneration}, remote: ${metadata.generation}). Refreshing...`);
                    await downloadDb();
                }
            } catch (err) {
                console.error('[GCS-SQLITE] Error checking metadata freshness:', err);
            }
        };

        // Initial download
        await downloadDb();
        await createTables(sqliteDb, adapter);

        db = {
            query: async (sql, params = []) => {
                console.log('[DEBUG] db.query (gcs-sqlite):', sql, params);
                await ensureFreshness();
                return new Promise((res, rej) => sqliteDb.all(sql, params, (e, r) => e ? rej(e) : res(r)));
            },
            get: async (sql, params = []) => {
                console.log('[DEBUG] db.get (gcs-sqlite):', sql, params);
                await ensureFreshness();
                return new Promise((res, rej) => sqliteDb.get(sql, params, (e, r) => e ? rej(e) : res(r)));
            },
            run: async (sql, params = []) => {
                console.log('[DEBUG] db.run (gcs-sqlite):', sql, params);
                
                const executeWriteWithRetry = async (attempt = 1) => {
                    await ensureFreshness();
                    
                    // 1. Execute local write
                    const result = await new Promise((res, rej) => sqliteDb.run(sql, params, function(e) {
                        if (e) rej(e); else res({ lastID: this.lastID, changes: this.changes });
                    }));

                    // 2. Attempt GCS upload with ifGenerationMatch precondition
                    console.log(`[GCS-SQLITE] Uploading modified DB to GCS (attempt ${attempt}, matching generation ${currentGeneration})...`);
                    try {
                        const [uploadResponse] = await bucket.upload(localDbPath, {
                            destination: remoteFileName,
                            preconditionOpts: { ifGenerationMatch: currentGeneration },
                            metadata: { cacheControl: 'no-cache, no-store, must-revalidate' }
                        });
                        currentGeneration = uploadResponse.metadata.generation;
                        console.log(`[GCS-SQLITE] Upload successful. New generation: ${currentGeneration}`);
                        return result;
                    } catch (uploadErr) {
                        if (uploadErr.code === 412 || uploadErr.message.includes('Precondition Failed')) {
                            console.warn(`[GCS-SQLITE] Write collision detected (HTTP 412) on attempt ${attempt}. Retrying optimism...`);
                            if (attempt >= 5) {
                                throw new Error('Database write collision retry limit exceeded (5 attempts). Please try again.');
                            }
                            // Wait a short random jitter before retrying
                            await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
                            return await executeWriteWithRetry(attempt + 1);
                        }
                        throw uploadErr;
                    }
                };

                return await executeWriteWithRetry();
            },
            adapter: 'gcs-sqlite',
            close: () => new Promise(res => sqliteDb.close(() => res())),
        };
        console.log('[DEBUG] initializeDatabase: GCS-Backed SQLite setup complete.');
        return db;

    } else { // Local SQLite
        console.log('[DEBUG] initializeDatabase: Configuring for local SQLite...');
        const dbPath = secrets.DB_NAME === ':memory:' ? ':memory:' : path.resolve(__dirname, '..', secrets.DB_NAME);
        return new Promise((resolve, reject) => {
            const sqliteDb = new sqlite3.Database(dbPath, async (err) => {
                if (err) return reject(err);
                console.log('Successfully connected to local SQLite database.');
                try {
                    await createTables(sqliteDb, adapter);
                    db = {
                        query: (sql, params = []) => new Promise((res, rej) => sqliteDb.all(sql, params, (e, r) => e ? rej(e) : res(r))),
                        get: (sql, params = []) => new Promise((res, rej) => sqliteDb.get(sql, params, (e, r) => e ? rej(e) : res(r))),
                        run: (sql, params = []) => new Promise((res, rej) => sqliteDb.run(sql, params, function(e) {
                            if (e) rej(e); else res({ lastID: this.lastID, changes: this.changes });
                        })),
                        adapter: 'sqlite',
                        close: () => sqliteDb.close(),
                    };
                    resolve(db);
                } catch (tableError) {
                    reject(tableError);
                }
            });
        });
    }
}

module.exports = { initializeDatabase };
