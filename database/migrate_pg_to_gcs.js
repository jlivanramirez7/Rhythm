const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const { Storage } = require('@google-cloud/storage');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Helper to fetch secrets using gcloud CLI to bypass ADC/GCE metadata scope issues locally
function getSecret(name) {
    console.log(`Fetching secret ${name} via gcloud CLI...`);
    try {
        return execSync(`gcloud secrets versions access latest --secret=${name} --project=rhythm-479516`, { encoding: 'utf8' }).trim();
    } catch (err) {
        console.error(`FATAL: Failed to fetch secret ${name}. Ensure gcloud is logged in and you have Secret Manager access.`);
        process.exit(1);
    }
}

async function migrate() {
    console.log('=== Starting Rhythm Data Migration: Cloud SQL PostgreSQL -> GCS SQLite ===');

    // 1. Fetch production secrets
    const dbUser = getSecret('DB_USER');
    const dbPassword = getSecret('DB_PASSWORD');
    const dbName = getSecret('DB_NAME');
    const gcsBucketName = 'rhythm-479516-db-bucket';

    console.log('\n[1/5] Connecting to Cloud SQL PostgreSQL via local proxy on 127.0.0.1:5432...');
    const pgPool = new Pool({
        user: dbUser,
        password: dbPassword,
        database: dbName,
        host: '127.0.0.1',
        port: 5432
    });

    let pgClient;
    try {
        pgClient = await pgPool.connect();
        console.log('Successfully connected to Cloud SQL PostgreSQL.');
    } catch (err) {
        console.error('\nFATAL: Could not connect to PostgreSQL on 127.0.0.1:5432.', err.message);
        console.error('ACTION REQUIRED: Please ensure you are running the Cloud SQL Proxy in a separate terminal tab:');
        console.error('  ./cloud-sql-proxy rhythm-479516:us-central1:rhythm-db\n');
        process.exit(1);
    }

    // 2. Export data from PostgreSQL
    console.log('\n[2/5] Exporting production tables from PostgreSQL...');
    const users = (await pgClient.query('SELECT * FROM users ORDER BY id ASC')).rows;
    const cycles = (await pgClient.query('SELECT * FROM cycles ORDER BY id ASC')).rows;
    const cycleDays = (await pgClient.query('SELECT * FROM cycle_days ORDER BY id ASC')).rows;
    const sessions = (await pgClient.query('SELECT * FROM sessions')).rows;

    console.log(`Exported: ${users.length} users, ${cycles.length} cycles, ${cycleDays.length} cycle_days, ${sessions.length} sessions.`);
    pgClient.release();
    await pgPool.end();

    // 3. Initialize local SQLite database
    const sqlitePath = path.resolve(__dirname, 'rhythm.db');
    if (fs.existsSync(sqlitePath)) {
        console.log(`Removing existing local SQLite file at ${sqlitePath}...`);
        fs.unlinkSync(sqlitePath);
    }

    console.log('\n[3/5] Initializing SQLite database and creating schema...');
    const sqliteDb = new sqlite3.Database(sqlitePath);

    const runSqlite = (sql, params = []) => new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });

    await new Promise((resolve, reject) => sqliteDb.serialize(() => resolve()));

    // Create Tables
    await runSqlite(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            google_id TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            is_admin BOOLEAN DEFAULT false,
            approved BOOLEAN DEFAULT false,
            partner_id INTEGER REFERENCES users(id),
            show_instructions BOOLEAN DEFAULT true,
            last_login TEXT,
            default_view_user_id INTEGER REFERENCES users(id)
        );
    `);

    await runSqlite(`
        CREATE TABLE IF NOT EXISTS cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        );
    `);

    await runSqlite(`
        CREATE TABLE IF NOT EXISTS cycle_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cycle_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
            intercourse INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
        );
    `);

    await runSqlite(`
        CREATE TABLE IF NOT EXISTS sessions (
            sid TEXT PRIMARY KEY,
            expired TEXT NOT NULL,
            sess TEXT NOT NULL
        );
    `);

    // 4. Seed SQLite database
    console.log('\n[4/5] Seeding exported data into SQLite...');

    for (const u of users) {
        await runSqlite(`INSERT INTO users (id, google_id, email, name, is_admin, approved, partner_id, show_instructions, last_login, default_view_user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            u.id, u.google_id, u.email, u.name, u.is_admin ? 1 : 0, u.approved ? 1 : 0, u.partner_id, u.show_instructions ? 1 : 0, u.last_login, u.default_view_user_id
        ]);
    }

    for (const c of cycles) {
        const startDate = typeof c.start_date === 'string' ? c.start_date.split('T')[0] : c.start_date.toISOString().split('T')[0];
        const endDate = c.end_date ? (typeof c.end_date === 'string' ? c.end_date.split('T')[0] : c.end_date.toISOString().split('T')[0]) : null;
        await runSqlite(`INSERT INTO cycles (id, user_id, start_date, end_date) VALUES (?, ?, ?, ?)`, [
            c.id, c.user_id, startDate, endDate
        ]);
    }

    for (const cd of cycleDays) {
        const dateStr = typeof cd.date === 'string' ? cd.date.split('T')[0] : cd.date.toISOString().split('T')[0];
        await runSqlite(`INSERT INTO cycle_days (id, cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, ?, ?, ?)`, [
            cd.id, cd.cycle_id, dateStr, cd.hormone_reading, cd.intercourse ? 1 : 0
        ]);
    }

    for (const s of sessions) {
        // connect-sqlite3 expects expired as ISO string and sess as JSON string
        const expiredStr = new Date(s.expire).toISOString();
        const sessStr = typeof s.sess === 'string' ? s.sess : JSON.stringify(s.sess);
        await runSqlite(`INSERT INTO sessions (sid, expired, sess) VALUES (?, ?, ?)`, [
            s.sid, expiredStr, sessStr
        ]);
    }

    await new Promise((resolve, reject) => sqliteDb.close((err) => err ? reject(err) : resolve()));
    console.log('SQLite seeding complete and database connection closed.');

    // 5. Upload to GCS
    console.log(`\n[5/5] Uploading rhythm.db to GCS bucket gs://${gcsBucketName}...`);
    const storage = new Storage();
    const bucket = storage.bucket(gcsBucketName);
    
    try {
        await bucket.upload(sqlitePath, {
            destination: 'rhythm.db',
            metadata: {
                cacheControl: 'no-cache, no-store, must-revalidate',
            },
        });
        console.log(`\n=== SUCCESS: rhythm.db uploaded successfully to gs://${gcsBucketName}/rhythm.db ===\n`);
    } catch (err) {
        console.error(`\nFATAL: Failed to upload rhythm.db to GCS bucket ${gcsBucketName}.`, err.message);
        console.error('ACTION REQUIRED: Ensure your GCS bucket exists and you have Storage Object Admin permissions.\n');
        process.exit(1);
    }
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
