const request = require('supertest');
const express = require('express');
const apiRouter = require('../src/api');

// Mock the entire database module
jest.mock('../src/database', () => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(':memory:');

    const initializeDatabase = async () => {
        const run = (sql) => new Promise((resolve, reject) => {
            db.run(sql, err => {
                if (err) return reject(err);
                resolve();
            });
        });

        await run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, google_id TEXT, email TEXT, name TEXT)`);
        await run(`CREATE TABLE IF NOT EXISTS cycles (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, start_date TEXT, end_date TEXT)`);
        await run(`CREATE TABLE IF NOT EXISTS cycle_days (id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_id INTEGER, date TEXT, hormone_reading TEXT, intercourse INTEGER DEFAULT 0, FOREIGN KEY(cycle_id) REFERENCES cycles(id))`);
        
        return {
            query: (sql, params = []) => new Promise((res, rej) => db.all(sql, params, (e, r) => e ? rej(e) : res(r))),
            get: (sql, params = []) => new Promise((res, rej) => db.get(sql, params, (e, r) => e ? rej(e) : res(r))),
            run: (sql, params = []) => new Promise((res, rej) => db.run(sql, params, function(e) { e ? rej(e) : res({ lastID: this.lastID, changes: this.changes }); })),
            isProduction: false,
            _db: db
        };
    };
    return { initializeDatabase };
});

const { initializeDatabase } = require('../src/database');

const mockAuthMiddleware = (req, res, next) => {
    req.isAuthenticated = () => true;
    req.user = { id: 1 }; // Provide a mock user for all tests
    next();
};

describe('Cycles API', () => {
    let app;
    let db;

    beforeAll(async () => {
        // Mock console methods to suppress output during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        db = await initializeDatabase();
        app = express();
        app.use(express.json());
        app.use(mockAuthMiddleware); // Apply mock auth to all routes for simplicity
        app.use('/api', apiRouter(db));
    });

    beforeEach(async () => {
        await db.run(`DELETE FROM cycle_days`);
        await db.run(`DELETE FROM cycles`);
        await db.run(`DELETE FROM users`);
        await db.run(`INSERT INTO users (id, google_id, email, name) VALUES (1, '123', 'test@example.com', 'Test User')`);
    });

    afterAll(done => {
        // Restore console methods
        console.log.mockRestore();
        console.error.mockRestore();

        if (db && db._db) {
            db._db.close(done);
        } else {
            done();
        }
    });

    it('should create a new cycle', async () => {
        const res = await request(app).post('/api/cycles').send({ start_date: '2025-01-01' });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    it('should not create a new cycle without a start date', async () => {
        const res = await request(app).post('/api/cycles').send({});
        expect(res.statusCode).toEqual(400);
    });

    it('should add a reading to the correct cycle', async () => {
        await request(app).post('/api/cycles').send({ start_date: '2025-01-01' });
        const readingRes = await request(app).post('/api/cycles/days').send({ date: '2025-01-02', hormone_reading: 'Low' });
        expect(readingRes.statusCode).toEqual(201);
    });

    it('should delete a cycle and its readings', async () => {
        const cycleRes = await request(app).post('/api/cycles').send({ start_date: '2025-04-01' });
        const cycleId = cycleRes.body.id;
        const deleteRes = await request(app).delete(`/api/cycles/${cycleId}`);
        expect(deleteRes.statusCode).toEqual(200);
        const cyclesRes = await request(app).get('/api/cycles');
        expect(cyclesRes.body.find(c => c.id === cycleId)).toBeUndefined();
    });

    it('should update a day card', async () => {
        await request(app).post('/api/cycles').send({ start_date: '2025-01-01' });
        const readingRes = await request(app).post('/api/cycles/days').send({ date: '2025-01-02', hormone_reading: 'Low' });
        const dayId = readingRes.body.id;
        const updateRes = await request(app).put(`/api/cycles/days/${dayId}`).send({ hormone_reading: 'High' });
        expect(updateRes.statusCode).toEqual(200);
    });

    it('should add readings for a date range', async () => {
        await request(app).post('/api/cycles').send({ start_date: '2025-01-01' });
        const res = await request(app).post('/api/cycles/days/range').send({ start_date: '2025-01-02', end_date: '2025-01-04', hormone_reading: 'High' });
        expect(res.statusCode).toEqual(201);
    });
});
