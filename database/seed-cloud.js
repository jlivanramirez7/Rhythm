const { Pool } = require('pg');
const Chance = require('chance');

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

const chance = new Chance();

const getDbConfig = () => {
    const dbConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    };

    if (process.env.INSTANCE_UNIX_SOCKET) {
      dbConfig.host = process.env.INSTANCE_UNIX_SOCKET;
    } else {
      dbConfig.host = process.env.DB_HOST;
      dbConfig.port = process.env.DB_PORT;
    }
    return dbConfig;
}

const seed = async () => {
  const pool = new Pool(getDbConfig());
  const client = await pool.connect();
  try {
    console.log('Clearing existing data...');
    await client.query('TRUNCATE TABLE cycle_days, cycles RESTART IDENTITY');

    console.log('Seeding 10 cycles of data...');
    let currentDate = new Date();
    for (let i = 0; i < 10; i++) {
      const cycleLength = chance.integer({ min: 25, max: 35 });
      const peakDay = chance.integer({ min: 12, max: 20 });
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - cycleLength);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() - 1);

      const { rows: [{ id: cycleId }] } = await client.query(
        'INSERT INTO cycles (start_date, end_date) VALUES ($1, $2) RETURNING id',
        [startDate, endDate]
      );

      for (let day = 0; day < cycleLength; day++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + day);

        let hormone_reading;
        if (day < peakDay - 3) {
          hormone_reading = 'Low';
        } else if (day < peakDay) {
          hormone_reading = 'High';
        } else if (day === peakDay) {
          hormone_reading = 'Peak';
        } else if (day < peakDay + 3) {
            hormone_reading = 'High';
        } else {
          hormone_reading = 'Low';
        }

        const intercourse = chance.bool({ likelihood: 30 });

        await client.query(
          'INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES ($1, $2, $3, $4)',
          [cycleId, date, hormone_reading, intercourse]
        );
      }
      currentDate = startDate;
    }
    console.log('Database seeded successfully.');
  } catch (err) {
    console.error('Error seeding database:', err);
    if (process.env.NODE_ENV === 'test') {
        throw err;
    }
  } finally {
    client.release();
    pool.end();
  }
};

if (require.main === module) {
    seed();
}

module.exports = { seed, getDbConfig };
