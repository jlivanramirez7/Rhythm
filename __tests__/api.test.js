const request = require('supertest');
const express = require('express');
const apiRouter = require('../src/api');
const { initializeDatabase } = require('../src/database');

let app;
let db;

describe('Cycles API', () => {
    beforeAll(async () => {
        // Set up an in-memory database for testing
        process.env.NODE_ENV = 'test';
        db = await initializeDatabase();
        
        app = express();
        app.use(express.json());
        // Mock user for all API requests
        app.use((req, res, next) => {
            req.user = { id: 1 };
            next();
        });
        app.use('/api', apiRouter(db));
    });

    beforeEach(async () => {
        // Clear and seed the database before each test
        await db.run(`DROP TABLE IF EXISTS cycle_days`);
        await db.run(`DROP TABLE IF EXISTS cycles`);
        await db.run(`DROP TABLE IF EXISTS users`);
        
        await db.run(`
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                google_id TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                name TEXT
            );
        `);
        await db.run(`
            CREATE TABLE cycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            );
        `);
        await db.run(`
            CREATE TABLE cycle_days (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cycle_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                hormone_reading TEXT CHECK(hormone_reading IN ('Low', 'High', 'Peak')),
                intercourse INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
            );
        `);
        await db.run(`INSERT INTO users (id, google_id, email, name) VALUES (1, 'testuser', 'test@example.com', 'Test User')`);
    });

    it('should create a new cycle', async () => {
        const res = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    it('should not create a new cycle without a start date', async () => {
        const res = await request(app)
            .post('/api/cycles')
            .send({});
        expect(res.statusCode).toEqual(400);
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
});
