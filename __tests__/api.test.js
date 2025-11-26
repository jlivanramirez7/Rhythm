const request = require('supertest');
const express = require('express');
const apiRouter = require('../src/api');
const db = require('../src/database');

// Mock authentication middleware
const mockAuthMiddleware = (req, res, next) => {
    req.isAuthenticated = () => true;
    next();
};

const app = express();
app.use(express.json());
app.use('/api', mockAuthMiddleware, apiRouter);


// Mock the database with an in-memory version for testing
jest.mock('../src/database', () => {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(':memory:');
    return db;
});

describe('Rhythm API', () => {
    // Re-create the database schema before each test
    beforeEach((done) => {
        db.serialize(() => {
            db.run(`DROP TABLE IF EXISTS cycle_days`);
            db.run(`DROP TABLE IF EXISTS cycles`);
            db.run(`
                CREATE TABLE cycles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_date TEXT NOT NULL,
                    end_date TEXT
                )
            `);
            db.run(`
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
        db.close(done);
    });

    it('should create a new cycle', async () => {
        const res = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('id');
    });

    it('should add a reading to the correct cycle', async () => {
        // Create a cycle, which also creates a placeholder for Day 1
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        // Add a second reading
        const readingRes = await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        expect(readingRes.statusCode).toEqual(201);

        // Verify there are now two readings in the cycle
        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        
        expect(cycle.days.length).toBe(2);
        // Verify the new reading is present
        const newReading = cycle.days.find(d => d.date === '2025-01-02');
        expect(newReading.hormone_reading).toBe('Low');
    });

    it('should correctly assign a reading to a previous cycle', async () => {
        // Create first cycle
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        // Add a reading to the first cycle
        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-05', hormone_reading: 'High' });

        // Create a second cycle
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-20' });

        // Add a reading that falls within the first cycle's dates
        const readingRes = await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-06', hormone_reading: 'Low' });
        expect(readingRes.statusCode).toEqual(201);

        // Verify the reading was added to the first cycle
        const cyclesRes = await request(app).get('/api/cycles');
        const firstCycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        const secondCycle = cyclesRes.body.find(c => c.start_date === '2025-01-20');

        // The first cycle should now have 3 readings (Day 1 placeholder, plus two added)
        expect(firstCycle.days.length).toBe(3);
        // The second cycle should have 1 reading (the Day 1 placeholder)
        expect(secondCycle.days.length).toBe(1);
    });

    it('should create a placeholder reading for day 1 when a new cycle is created', async () => {
        const res = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-02-01' });
        expect(res.statusCode).toEqual(201);

        const cyclesRes = await request(app).get('/api/cycles');
        const newCycle = cyclesRes.body.find(c => c.start_date === '2025-02-01');

        expect(newCycle.days.length).toBe(1);
        expect(newCycle.days[0].date).toBe('2025-02-01');
        expect(newCycle.days[0].hormone_reading).toBeNull();
    });

    it('should handle date strings without timezone conversion', async () => {
        const startDate = '2025-03-10';
        await request(app)
            .post('/api/cycles')
            .send({ start_date: startDate });
        
        const cyclesRes = await request(app).get('/api/cycles');
        const newCycle = cyclesRes.body.find(c => c.start_date === startDate);
        
        expect(newCycle).toBeDefined();
        expect(newCycle.start_date).toEqual(startDate);
    });

    it('should delete a cycle and its associated readings', async () => {
        // Create a cycle
        const cycleRes = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-04-01' });
        const cycleId = cycleRes.body.id;

        // Add a reading to it
        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-04-02', hormone_reading: 'Peak' });

        // Delete the cycle
        const deleteRes = await request(app).delete(`/api/cycles/${cycleId}`);
        expect(deleteRes.statusCode).toEqual(200);

        // Verify the cycle is gone
        const cyclesRes = await request(app).get('/api/cycles');
        const deletedCycle = cyclesRes.body.find(c => c.id === cycleId);
        expect(deletedCycle).toBeUndefined();
    });

    it('should add readings for a date range', async () => {
        // Create a cycle
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-05-01' });

        // Add readings for a date range
        const rangeRes = await request(app)
            .post('/api/cycles/days/range')
            .send({ start_date: '2025-05-02', end_date: '2025-05-04', hormone_reading: 'High' });
        expect(rangeRes.statusCode).toEqual(200);

        // Verify the readings were added
        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-05-01');

        expect(cycle.days.length).toBe(4); // Day 1 placeholder + 3 from range
        const day2 = cycle.days.find(d => d.date === '2025-05-02');
        const day3 = cycle.days.find(d => d.date === '2025-05-03');
        const day4 = cycle.days.find(d => d.date === '2025-05-04');

        expect(day2.hormone_reading).toBe('High');
        expect(day3.hormone_reading).toBe('High');
        expect(day4.hormone_reading).toBe('High');
    });

    it('should delete a daily reading', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-07-01' });
        
        const readingRes = await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-07-02', hormone_reading: 'Low' });
        const readingId = readingRes.body.id;

        const deleteRes = await request(app).delete(`/api/cycles/days/${readingId}`);
        expect(deleteRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-07-01');
        const deletedReading = cycle.days.find(d => d.id === readingId);
        expect(deletedReading).toBeUndefined();
    });

    it('should clear all data', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-08-01' });

        const deleteRes = await request(app).delete('/api/data');
        expect(deleteRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        expect(cyclesRes.body.length).toBe(0);
    });

    describe('Analytics', () => {
        it('should calculate average cycle length', async () => {
            // Cycle 1: 10 days
            await request(app).post('/api/cycles').send({ start_date: '2025-09-01' });
            await request(app).post('/api/cycles').send({ start_date: '2025-09-11' });

            // Cycle 2: 20 days
            await request(app).post('/api/cycles').send({ start_date: '2025-09-31' });


            const analyticsRes = await request(app).get('/api/analytics');
            expect(analyticsRes.statusCode).toEqual(200);
            expect(analyticsRes.body.averageCycleLength).toBe(15);
        });

        it('should calculate average days to peak', async () => {
            // Cycle 1
            await request(app).post('/api/cycles').send({ start_date: '2025-10-01' });
            await request(app).post('/api/cycles/days').send({ date: '2025-10-05', hormone_reading: 'Peak' });

            // Cycle 2
            await request(app).post('/api/cycles').send({ start_date: '2025-10-15' });
            await request(app).post('/api/cycles/days').send({ date: '2025-10-25', hormone_reading: 'Peak' });


            const analyticsRes = await request(app).get('/api/analytics');
            expect(analyticsRes.statusCode).toEqual(200);
            expect(analyticsRes.body.averageDaysToPeak).toBe(8);
        });
    });
});
