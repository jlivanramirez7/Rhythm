const request = require('supertest');
const express = require('express');
const apiRouter = require('../src/api');
const db = require('../src/db');

// Mock authentication middleware
const mockAuthMiddleware = (req, res, next) => {
    req.isAuthenticated = () => true;
    next();
};

const app = express();
app.use(express.json());
app.use('/api', mockAuthMiddleware, apiRouter);

// Mock the database with an in-memory version for testing
jest.mock('../src/db', () => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(':memory:');
    
    const query = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    };

    const get = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    };

    const run = (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    };

    const serialize = (fn) => db.serialize(fn);

    return { query, get, run, serialize, _db: db };
});

describe('Intercourse API', () => {
    // Re-create the database schema before each test
    beforeEach((done) => {
        db.serialize(() => {
            db._db.run(`DROP TABLE IF EXISTS cycle_days`);
            db._db.run(`DROP TABLE IF EXISTS cycles`);
            db._db.run(`
                CREATE TABLE cycles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_date TEXT NOT NULL,
                    end_date TEXT
                )
            `);
            db._db.run(`
                CREATE TABLE cycle_days (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    cycle_id INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                    intercourse INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY (cycle_id) REFERENCES cycles (id)
                )
            `, () => done());
        });
    });

    afterAll((done) => {
        db._db.close(done);
    });

    it('should log intercourse without a hormone reading', async () => {
        await request(app).post('/api/cycles').send({ start_date: '2025-01-01' });

        const readingRes = await request(app).post('/api/cycles/days').send({
            date: '2025-01-01',
            intercourse: true
        });
        expect(readingRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const day = cyclesRes.body[0].days.find(d => d.date === '2025-01-01');
        expect(day.intercourse).toBe(1);
        expect(day.hormone_reading).toBeNull();
    });

    it('should update intercourse status without affecting hormone reading', async () => {
        await request(app).post('/api/cycles').send({ start_date: '2025-01-01' });

        await request(app).post('/api/cycles/days').send({
            date: '2025-01-02',
            hormone_reading: 'Low',
            intercourse: false
        });

        const cyclesRes1 = await request(app).get('/api/cycles');
        const day1 = cyclesRes1.body[0].days.find(d => d.date === '2025-01-02');

        await request(app).post('/api/cycles/days').send({
            date: '2025-01-02',
            intercourse: true
        });

        const cyclesRes2 = await request(app).get('/api/cycles');
        const day2 = cyclesRes2.body[0].days.find(d => d.date === '2025-01-02');
        expect(day2.intercourse).toBe(1);
        expect(day2.hormone_reading).toBe('Low');
    });

    it('should add intercourse to an existing reading', async () => {
        await request(app).post('/api/cycles').send({ start_date: '2025-02-01' });
        await request(app).post('/api/cycles/days').send({ date: '2025-02-02', hormone_reading: 'High' });

        const cyclesRes1 = await request(app).get('/api/cycles');
        const day1 = cyclesRes1.body[0].days.find(d => d.date === '2025-02-02');
        expect(day1.intercourse).toBe(0);

        await request(app).post('/api/cycles/days').send({ date: '2025-02-02', intercourse: true });

        const cyclesRes2 = await request(app).get('/api/cycles');
        const day2 = cyclesRes2.body[0].days.find(d => d.date === '2025-02-02');
        expect(day2.intercourse).toBe(1);
        expect(day2.hormone_reading).toBe('High');
    });
});
