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

describe('Rhythm API', () => {
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

    it('should create a new cycle', async () => {
        const res = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    it('should add a reading to the correct cycle', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        const readingRes = await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        expect(readingRes.statusCode).toEqual(201);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        
        expect(cycle.days.length).toBe(2);
        const newReading = cycle.days.find(d => d.date === '2025-01-02');
        expect(newReading.hormone_reading).toBe('Low');
    });

    it('should delete a cycle and its associated readings', async () => {
        const cycleRes = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-04-01' });
        const cycleId = cycleRes.body.id;

        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-04-02', hormone_reading: 'Peak' });

        const deleteRes = await request(app).delete(`/api/cycles/${cycleId}`);
        expect(deleteRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const deletedCycle = cyclesRes.body.find(c => c.id === cycleId);
        expect(deletedCycle).toBeUndefined();
    });

    it('should update a day card with a new reading', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        const readingRes = await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        
        const dayId = readingRes.body.id;

        const updateRes = await request(app)
            .put(`/api/cycles/days/${dayId}`)
            .send({ hormone_reading: 'High' });

        expect(updateRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        const updatedReading = cycle.days.find(d => d.id === dayId);
        expect(updatedReading.hormone_reading).toBe('High');
    });

    it('should add multiple readings to the same cycle', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        
        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-03', hormone_reading: 'High' });

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        
        expect(cycle.days.length).toBe(3);
    });
});
