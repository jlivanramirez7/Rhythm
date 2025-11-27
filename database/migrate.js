const { Pool } = require('pg');
const { getDbConfig } = require('./seed-cloud.js');

const createTables = async () => {
    const pool = new Pool(getDbConfig());
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS cycles (
                id SERIAL PRIMARY KEY,
                start_date DATE NOT NULL,
                end_date DATE
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS cycle_days (
                id SERIAL PRIMARY KEY,
                cycle_id INTEGER NOT NULL,
                date DATE NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse BOOLEAN NOT NULL DEFAULT false,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
            );
        `);
        console.log('Tables created or already exist.');
    } catch (err) {
        console.error('Error creating tables:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
};

if (require.main === module) {
    createTables();
}
