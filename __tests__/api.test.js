const request = require('supertest');
const express = require('express');
const apiRouter = require('../src/api');
const { initializeDatabase } = require('../src/database');

let app;
let db;

describe('Cycles API', () => {
    beforeAll(async () => {
        process.env.NODE_ENV = 'test';
        const secrets = {
            DB_ADAPTER: 'sqlite',
            DB_NAME: ':memory:',
        };
        db = await initializeDatabase(secrets);
        
        app = express();
        app.use(express.json());
        app.use((req, res, next) => {
            req.user = { id: 1 };
            next();
        });
        app.use('/api', apiRouter(db));
    });

    afterAll(async () => {
        if (db && typeof db.close === 'function') {
            await db.close();
        }
    });

    beforeEach(async () => {
        await db.run(`DROP TABLE IF EXISTS cycle_days`);
        await db.run(`DROP TABLE IF EXISTS cycles`);
        await db.run(`DROP TABLE IF EXISTS users`);
        
        await db.run(`
            CREATE TABLE users (
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
        expect(readingRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        
        expect(cycle.days.length).toBe(5); // 5 default days inserted on cycle creation
        const newReading = cycle.days.find(d => d.date === '2025-01-02');
        expect(newReading.hormone_reading).toBe('Low');
    });

    it('should delete a cycle', async () => {
        const cycleRes = await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        const cycleId = cycleRes.body.id;

        const deleteRes = await request(app).delete(`/api/cycles/${cycleId}`);
        expect(deleteRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        expect(cyclesRes.body.length).toBe(0);
    });

    it('should add readings for a date range', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        const readingRes = await request(app)
            .post('/api/cycles/days/range')
            .send({ 
                start_date: '2025-01-02', 
                end_date: '2025-01-04', 
                hormone_reading: 'High' 
            });
        expect(readingRes.statusCode).toEqual(201);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        
        expect(cycle.days.length).toBe(5);
        const day2 = cycle.days.find(d => d.date === '2025-01-02');
        const day3 = cycle.days.find(d => d.date === '2025-01-03');
        const day4 = cycle.days.find(d => d.date === '2025-01-04');
        
        expect(day2.hormone_reading).toBe('High');
        expect(day3.hormone_reading).toBe('High');
        expect(day4.hormone_reading).toBe('High');
    });

    it('should update a reading', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        
        const initialCyclesRes = await request(app).get('/api/cycles');
        const initialCycle = initialCyclesRes.body.find(c => c.start_date === '2025-01-01');
        const readingId = initialCycle.days.find(d => d.date === '2025-01-02').id;

        const updateRes = await request(app)
            .put(`/api/cycles/days/${readingId}`)
            .send({ hormone_reading: 'Peak' });
        expect(updateRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        const updatedReading = cycle.days.find(d => d.id === readingId);
        expect(updatedReading.hormone_reading).toBe('Peak');
    });

    it('should delete a reading', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        
        const initialCyclesRes = await request(app).get('/api/cycles');
        const initialCycle = initialCyclesRes.body.find(c => c.start_date === '2025-01-01');
        const readingId = initialCycle.days.find(d => d.date === '2025-01-02').id;

        const deleteRes = await request(app).delete(`/api/cycles/days/${readingId}`);
        expect(deleteRes.statusCode).toEqual(204);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        const deletedReading = cycle.days.find(d => d.id === readingId);
        expect(deletedReading).toBeUndefined();
    });

    it('should return analytics', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });
        await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-14', hormone_reading: 'Peak' });
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-29' });

        const res = await request(app).get('/api/analytics');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('averageCycleLength', 28);
        expect(res.body).toHaveProperty('averageDaysToPeak', 14);
    });

    it('should clear all data', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        const deleteRes = await request(app).delete('/api/data');
        expect(deleteRes.statusCode).toEqual(204);

        const cyclesRes = await request(app).get('/api/cycles');
        expect(cyclesRes.body.length).toBe(0);
    });

    it('should add a reading with the correct date', async () => {
        await request(app)
            .post('/api/cycles')
            .send({ start_date: '2025-01-01' });

        const readingRes = await request(app)
            .post('/api/cycles/days')
            .send({ date: '2025-01-02', hormone_reading: 'Low' });
        expect(readingRes.statusCode).toEqual(200);

        const cyclesRes = await request(app).get('/api/cycles');
        const cycle = cyclesRes.body.find(c => c.start_date === '2025-01-01');
        
        const newReading = cycle.days.find(d => d.date === '2025-01-02');
        expect(newReading).toBeDefined();
    });

    it('should get and save per-phase notification preferences and subscribe device', async () => {
        await db.run(`DELETE FROM notification_preferences`);
        await db.run(`DELETE FROM push_subscriptions`);

        // 1. Default preferences should have all phase & libido toggles enabled
        const initialRes = await request(app).get('/api/notifications/preferences');
        expect(initialRes.statusCode).toEqual(200);
        expect(initialRes.body.preferences).toMatchObject({
            notify_menstrual: true,
            notify_follicular: true,
            notify_ovulatory: true,
            notify_peak: true,
            notify_luteal: true,
            notify_libido: true,
            subscriptionsCount: 0
        });

        // 2. Toggle off menstrual and follicular, keep ovulatory/peak/libido on, and save
        const saveRes = await request(app)
            .put('/api/notifications/preferences')
            .send({
                notify_menstrual: false,
                notify_follicular: false,
                notify_ovulatory: true,
                notify_peak: true,
                notify_luteal: false,
                notify_libido: true
            });
        expect(saveRes.statusCode).toEqual(200);
        expect(saveRes.body.preferences).toMatchObject({
            notify_menstrual: false,
            notify_follicular: false,
            notify_ovulatory: true,
            notify_peak: true,
            notify_luteal: false,
            notify_libido: true
        });

        // 3. Subscribe a device push endpoint
        const subRes = await request(app)
            .post('/api/notifications/subscribe')
            .send({
                subscription: {
                    endpoint: 'https://push.example.com/sub-1',
                    keys: { p256dh: 'test-p256dh', auth: 'test-auth' }
                }
            });
        expect(subRes.statusCode).toEqual(201);
        expect(subRes.body.preferences.subscriptionsCount).toBe(1);

        // 4. Unsubscribe
        const unsubRes = await request(app)
            .post('/api/notifications/unsubscribe')
            .send({ endpoint: 'https://push.example.com/sub-1' });
        expect(unsubRes.statusCode).toEqual(200);
        expect(unsubRes.body.preferences.subscriptionsCount).toBe(0);
    });

    it('should detect phase transitions and 3-day Highest Libido window accurately without daily duplicate alerts', () => {
        const { determineCurrentCyclePhase, determineLibidoWindow } = require('../src/notifications');

        const cycle = {
            id: 42,
            start_date: '2026-10-01',
            end_date: null,
            days: [
                { date: '2026-10-01', hormone_reading: 'Low' },
                { date: '2026-10-02', hormone_reading: 'Low' },
                { date: '2026-10-03', hormone_reading: 'Low' },
                { date: '2026-10-04', hormone_reading: 'Low' },
                { date: '2026-10-05', hormone_reading: 'Low' }
            ]
        };

        // Day 3 -> Menstrual phase, not in libido window
        const day3Phase = determineCurrentCyclePhase([cycle], '2026-10-03');
        expect(day3Phase.phaseKey).toBe('menstrual');
        expect(day3Phase.stateToken).toBe('42:menstrual');
        expect(determineLibidoWindow([cycle], '2026-10-03').isInLibidoWindow).toBe(false);

        // Day 4 -> Still Menstrual (same stateToken = no duplicate daily notification)
        const day4Phase = determineCurrentCyclePhase([cycle], '2026-10-04');
        expect(day4Phase.stateToken).toBe('42:menstrual');

        // Day 6 -> Enters Follicular phase
        const day6Phase = determineCurrentCyclePhase([cycle], '2026-10-06');
        expect(day6Phase.phaseKey).toBe('follicular');
        expect(day6Phase.stateToken).toBe('42:follicular');

        // Log High on Day 10 -> Enters Ovulatory phase
        cycle.days.push({ date: '2026-10-10', hormone_reading: 'High' });
        const day10Phase = determineCurrentCyclePhase([cycle], '2026-10-10');
        expect(day10Phase.phaseKey).toBe('ovulatory');
        expect(day10Phase.stateToken).toBe('42:ovulatory');

        // Day 12 (Peak-2 for default 14d peak) -> Enters Highest Libido Window
        const day12Libido = determineLibidoWindow([cycle], '2026-10-12');
        expect(day12Libido.isInLibidoWindow).toBe(true);
        expect(day12Libido.stateToken).toBe('42:libido');

        // Log Peak on Day 13 & Day 14 -> Enters Peak phase
        cycle.days.push({ date: '2026-10-13', hormone_reading: 'Peak' });
        cycle.days.push({ date: '2026-10-14', hormone_reading: 'Peak' });
        const day13Phase = determineCurrentCyclePhase([cycle], '2026-10-13');
        expect(day13Phase.phaseKey).toBe('peak');
        expect(day13Phase.stateToken).toBe('42:peak');

        // Wait day 2 (2026-10-16, within Peak+3) -> Remains in Peak/PPHLL countdown (does not bounce back to ovulatory)
        const day16Phase = determineCurrentCyclePhase([cycle], '2026-10-16');
        expect(day16Phase.phaseKey).toBe('peak');

        // 4th day after last Peak (2026-10-18 > 2026-10-17 fertileEnd) -> Enters Luteal phase
        const day18Phase = determineCurrentCyclePhase([cycle], '2026-10-18');
        expect(day18Phase.phaseKey).toBe('luteal');
        expect(day18Phase.stateToken).toBe('42:luteal');
        expect(determineLibidoWindow([cycle], '2026-10-18').isInLibidoWindow).toBe(false);
    });
});
