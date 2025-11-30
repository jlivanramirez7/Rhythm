const express = require('express');
const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';
const moment = require('moment-timezone');
const { sql } = require('./utils');

// DEBUG: Do not remove these logs
const log = (level, message, ...args) => {
    console.log(`[${level.toUpperCase()}] [API] ${message}`, ...args);
};

/**
 * Fetches a single cycle and its associated days from the database.
 * It "fills in" any missing days between the start date and the last reading
 * to ensure a complete, continuous cycle is returned.
 * @param {number} cycleId - The ID of the cycle to fetch.
 * @param {object} db - The database instance.
 * @returns {Promise<object|null>} A promise that resolves with the filled cycle object, or null if not found.
 */
const getFilledCycle = async (cycleId, db) => {
    // DEBUG: Do not remove these logs
    log('debug', `getFilledCycle: Filling cycle for ID: ${cycleId}`);
    const isPostgres = db.adapter === 'postgres';
    const cycleSql = sql(`SELECT * FROM cycles WHERE id = ?`, isPostgres);
    const cycle = await db.get(cycleSql, [cycleId]);

    if (!cycle) {
        log('warn', `getFilledCycle: No cycle found for ID: ${cycleId}`);
        return null;
    }

    const daysSql = sql(`SELECT * FROM cycle_days WHERE cycle_id = ? ORDER BY date`, isPostgres);
    const days = await db.query(daysSql, [cycle.id]);

    // ** THE DEFINITIVE FIX **
    // Explicitly sort days in JS to guarantee order, regardless of DB transaction state.
    days.sort((a, b) => new Date(a.date) - new Date(b.date));

        const daysMap = new Map(days.map(d => {
        const dayDate = moment.utc(d.date).format('YYYY-MM-DD');
        return [dayDate, d];
    }));
    
    const filledDays = [];
    const startDate = moment.utc(cycle.start_date);

    let lastDate = startDate.clone();
    if (days.length > 0) {
        const lastReadingDate = new Date(days[days.length - 1].date);
        if (lastReadingDate > lastDate) {
            lastDate = lastReadingDate;
        }
    }
    
    let currentDate = startDate.clone();
    while (currentDate.isSameOrBefore(lastDate)) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        const existingDay = daysMap.get(dateStr);

        if (existingDay) {
            // DEBUG: Do not remove these logs
            log('debug', `getFilledCycle: Found existing day in map for ${dateStr}. Pushing data:`, existingDay);
            filledDays.push(existingDay);
        } else {
            // DEBUG: Do not remove these logs
            log('debug', `getFilledCycle: No day in map for ${dateStr}. Pushing BLANK placeholder.`);
            filledDays.push({
                cycle_id: cycle.id,
                date: dateStr,
                hormone_reading: null,
                intercourse: 0,
            });
        }
        currentDate.add(1, 'days');
    }

    if (filledDays.length === 0) {
        filledDays.push({
            cycle_id: cycle.id,
            date: new Date(cycle.start_date).toISOString().split('T')[0],
            hormone_reading: null,
            intercourse: 0,
        });
    }

    cycle.days = filledDays;
    return cycle;
};


/**
 * A helper function to handle the logic of inserting or updating a daily reading.
 * This reduces code duplication between the single-day and date-range endpoints.
 * @param {object} db - The database instance.
 * @param {object} data - The reading data, including cycle_id, date, hormone_reading, and intercourse.
 */
const upsertReading = async (db, data) => {
    const { cycle_id, date, hormone_reading, intercourse, userId } = data;
    const isPostgres = db.adapter === 'postgres';

    const findExistingSql = sql(`
        SELECT cd.id FROM cycle_days cd
        JOIN cycles c ON cd.cycle_id = c.id
        WHERE cd.cycle_id = ? AND cd.date = ? AND c.user_id = ?
    `, isPostgres);
    const existingReading = await db.get(findExistingSql, [cycle_id, date, userId]);

    if (existingReading) {
        const fieldsToUpdate = [];
        const values = [];
        if (hormone_reading !== undefined) {
            fieldsToUpdate.push('hormone_reading = ?');
            values.push(hormone_reading);
        }
        if (intercourse !== undefined) {
            fieldsToUpdate.push('intercourse = ?');
            values.push(intercourse ? 1 : 0);
        }

        if (fieldsToUpdate.length > 0) {
            values.push(existingReading.id);
            const updateSql = sql(`UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, isPostgres);
            const result = await db.run(updateSql, values);
            log('debug', `upsertReading - UPDATE result. Rows affected: ${result.changes}`);
        }
    } else {
        const intercourseValue = intercourse ? 1 : 0;
        const insertSql = sql(`INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, ?, ?)`, isPostgres);
        await db.run(insertSql, [cycle_id, date, hormone_reading, intercourseValue]);
    }
};

const apiRouter = (db) => {
    const isPostgres = db.adapter === 'postgres';

    /**
     * @route GET /api/me
     * @description Fetches the currently logged-in user's profile.
     */
    router.get('/me', (req, res) => {
        res.json(req.user);
    });

    router.get('/shared-users', async (req, res) => {
        const userId = req.user.id;
        try {
            const isPostgres = db.adapter === 'postgres';
            const users = await db.query(sql('SELECT id, name, email FROM users WHERE partner_id = ? OR id = ?', isPostgres), [userId, userId]);
            res.json(users);
        } catch (err) {
            console.error('Error fetching shared users:', err);
            res.status(500).json({ error: 'Failed to fetch shared users' });
        }
    });

    router.post('/partner', async (req, res) => {
        const { email } = req.body;
        const userId = req.user.id;
        try {
            const isPostgres = db.adapter === 'postgres';
            const partner = await db.get(sql('SELECT id FROM users WHERE email = ?', isPostgres), [email]);

            if (!partner) {
                return res.status(404).json({ error: 'Partner not found. Please ensure they have registered.' });
            }

            await db.run(sql('UPDATE users SET partner_id = ? WHERE id = ?', isPostgres), [partner.id, userId]);
            res.status(200).json({ message: 'Partner linked successfully.' });
        } catch (err) {
            console.error('Error linking partner:', err);
            res.status(500).json({ error: 'Failed to link partner' });
        }
    });

    /**
     * @route POST /api/cycles
     * @description Creates a new cycle for the logged-in user. If an open-ended
     * cycle exists, its end_date is set to the day before the new cycle's start_date.
     * @param {object} req.body - { start_date: string }
     */
    router.post('/cycles', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', 'POST /api/cycles - Request received.');
        log('debug', 'Request body:', req.body);

        const { start_date } = req.body;
        const userId = req.user.id;

        if (!start_date) {
            log('warn', 'POST /api/cycles - Bad request: start_date is missing.');
            return res.status(400).json({ error: 'start_date is required' });
        }

        try {
            log('debug', `POST /api/cycles - Finding previous cycle for user ${userId}.`);
            const findPreviousCycleSql = sql(`SELECT id FROM cycles WHERE user_id = ? AND end_date IS NULL ORDER BY start_date DESC LIMIT 1`, isPostgres);
            const previousCycle = await db.get(findPreviousCycleSql, [userId]);

            const formattedStartDate = start_date;

            const insertNewCycle = async () => {
                const insertCycleSql = sql(`INSERT INTO cycles (user_id, start_date) VALUES (?, ?)`, isPostgres);
                const result = await db.run(insertCycleSql, [userId, formattedStartDate]);
                const newCycleId = result.lastID;

                const insertDay1Sql = sql(`INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, NULL, false)`, isPostgres);
                await db.run(insertDay1Sql, [newCycleId, formattedStartDate]);

                res.status(201).json({ id: newCycleId, start_date: formattedStartDate });
            };

            if (previousCycle) {
                log('debug', `POST /api/cycles - Previous cycle found (ID: ${previousCycle.id}). Updating its end_date.`);
                const previousCycleEndDate = new Date(formattedStartDate);
                previousCycleEndDate.setDate(previousCycleEndDate.getDate() - 1);
                const formattedPreviousCycleEndDate = previousCycleEndDate.toISOString().split('T')[0];

                const updatePreviousCycleSql = sql(`UPDATE cycles SET end_date = ? WHERE id = ?`, isPostgres);
                await db.run(updatePreviousCycleSql, [formattedPreviousCycleEndDate, previousCycle.id]);
                await insertNewCycle();
            } else {
                log('debug', 'POST /api/cycles - No previous cycle found. Creating first cycle.');
                await insertNewCycle();
            }
        } catch (err) {
            log('error', 'Error in POST /api/cycles:', err);
            res.status(500).json({ error: 'Failed to create a new cycle', details: err.message });
        }
    });

    /**
     * @route POST /api/cycles/days/range
     * @description Adds or updates hormone readings for a continuous range of dates.
     * @param {object} req.body - { start_date: string, end_date: string, hormone_reading: string, intercourse: boolean }
     */
    router.post('/cycles/days/range', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', 'POST /api/cycles/days/range - Request received.');
        log('debug', 'Request body:', req.body);
        const { start_date, end_date, hormone_reading, intercourse } = req.body;

        if (!start_date || !end_date) {
            log('warn', 'POST /api/cycles/days/range - Bad request: start_date or end_date missing.');
            return res.status(400).send('start_date and end_date are required');
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        if (startDate > endDate) {
            log('warn', 'POST /api/cycles/days/range - Bad request: start_date is after end_date.');
            return res.status(400).send('start_date cannot be after end_date');
        }

        try {
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const date = d.toISOString().split('T')[0];
                // DEBUG: Do not remove these logs
                log('debug', `POST /api/cycles/days/range - Processing date: ${date}`);
                const findCycleSql = sql(`
                    SELECT id FROM cycles 
                    WHERE ? >= start_date AND (end_date IS NULL OR ? <= end_date)
                    ORDER BY start_date DESC 
                    LIMIT 1
                `, isPostgres);
                const cycle = await db.get(findCycleSql, [date, date]);

                if (cycle) {
                    await upsertReading(db, {
                        cycle_id: cycle.id,
                        date,
                        hormone_reading,
                        intercourse,
                        userId: req.user.id
                    });
                }
            }
            res.status(201).json({ message: 'Readings for the date range logged successfully!' });
        } catch (err) {
            log('error', 'Error in POST /api/cycles/days/range:', err);
            res.status(500).json({ error: 'Failed to process date range readings', details: err.message });
        }
    });

    /**
     * @route POST /api/cycles/days
     * @description Adds or updates a single day's hormone reading.
     * @param {object} req.body - { date: string, hormone_reading: string, intercourse: boolean }
     */
    router.post('/cycles/days', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', 'POST /api/cycles/days - Request received.');
        log('debug', 'Request body:', req.body);
        let { date, hormone_reading, intercourse } = req.body;

        if (hormone_reading === '') {
            hormone_reading = null;
        }

        if (!date || (hormone_reading === undefined && intercourse === undefined)) {
            log('warn', 'POST /api/cycles/days - Bad request: missing required fields.');
            return res.status(400).send('date and either hormone_reading or intercourse are required');
        }

        date = moment.utc(date).format('YYYY-MM-DD');

        try {
            const findCycleSql = sql(`
                SELECT id FROM cycles 
                WHERE user_id = ? AND ? >= start_date AND (end_date IS NULL OR ? <= end_date)
                ORDER BY start_date DESC 
                LIMIT 1
            `, isPostgres);
            const cycle = await db.get(findCycleSql, [req.user.id, date, date]);

            if (!cycle) {
                return res.status(404).send('No cycle found for the selected date.');
            }

            await upsertReading(db, {
                cycle_id: cycle.id,
                date,
                hormone_reading,
                intercourse,
                userId: req.user.id
            });
            
            res.status(200).json({ success: true });
        } catch (err) {
            log('error', 'Error in POST /api/cycles/days:', err);
            res.status(500).json({ error: 'Failed to process daily reading', details: err.message });
        }
    });

    // Get all cycles with their days
    router.get('/cycles', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', `GET /api/cycles - Request received for user ${req.user.id}.`);
        const targetUserId = req.query.user_id || req.user.id;

        // Security check: ensure the logged-in user is allowed to view the target user's data
        const sharedUsers = await db.query(sql('SELECT id FROM users WHERE partner_id = ? OR id = ?', isPostgres), [req.user.id, req.user.id]);
        const allowedIds = sharedUsers.map(u => u.id);

        if (!allowedIds.includes(parseInt(targetUserId, 10))) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            const cyclesSql = sql(`SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date DESC`, isPostgres);
            const cycles = await db.query(cyclesSql, [targetUserId]);

            const filledCycles = [];
            for (const cycle of cycles) {
                const filledCycle = await getFilledCycle(cycle.id, db);
                if(filledCycle) {
                    filledCycles.push(filledCycle);
                }
            }
    
            res.json(filledCycles);
        } catch (err) {
            log('error', 'Error in GET /api/cycles:', err);
            res.status(500).json({ error: 'Failed to fetch cycles', details: err.message });
        }
    });

    // Get analytics
    router.get('/analytics', async (req, res) => {
        const targetUserId = req.query.user_id || req.user.id;
        log('info', `GET /api/analytics - Request received for user ${targetUserId}.`);

        // Security check: ensure the logged-in user is allowed to view the target user's data
        const sharedUsers = await db.query(sql('SELECT id FROM users WHERE partner_id = ? OR id = ?', isPostgres), [req.user.id, req.user.id]);
        const allowedIds = sharedUsers.map(u => u.id);

        if (!allowedIds.includes(parseInt(targetUserId, 10))) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        try {
            const analytics = {};
            
            const cycleLengthSql = sql(`
                SELECT 
                    ${isPostgres ? '(end_date - start_date + 1)' : 'CAST(julianday(end_date) - julianday(start_date) + 1 AS INTEGER)'} as length 
                FROM cycles 
                WHERE user_id = ? AND end_date IS NOT NULL
            `, isPostgres);

            const cycleLengths = await db.query(cycleLengthSql, [targetUserId]);

            if (cycleLengths.length > 0) {
                const totalDays = cycleLengths.reduce((acc, row) => acc + row.length, 0);
                analytics.averageCycleLength = Math.round(totalDays / cycleLengths.length);
            } else {
                analytics.averageCycleLength = 0;
            }

            const peakDaySql = sql(`
                SELECT c.start_date, MIN(cd.date) as peak_date
                FROM cycles c
                JOIN cycle_days cd ON c.id = cd.cycle_id
                WHERE c.user_id = ? AND cd.hormone_reading = 'Peak'
                GROUP BY c.id, c.start_date
                HAVING MIN(cd.date) IS NOT NULL
            `, isPostgres);

            const peakRows = await db.query(peakDaySql, [targetUserId]);

            if (peakRows.length > 0) {
                const daysToPeak = peakRows.map(row => {
                    const start = new Date(row.start_date);
                    const peak = new Date(row.peak_date);
                    return (peak - start) / (1000 * 60 * 60 * 24) + 1;
                });
                const totalDaysToPeak = daysToPeak.reduce((acc, days) => acc + days, 0);
                analytics.averageDaysToPeak = Math.round(totalDaysToPeak / peakRows.length);
            } else {
                analytics.averageDaysToPeak = 0;
            }

            res.json(analytics);
        } catch (err) {
            log('error', 'Error in GET /api/analytics:', err);
            res.status(500).json({ error: 'Failed to fetch analytics', details: err.message });
        }
    });

    // Delete a cycle and all its readings
    router.delete('/cycles/:id', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', `DELETE /api/cycles/${req.params.id} - Request received.`);
        const { id } = req.params;
        const userId = req.user.id;
        try {
            await db.run(sql(`DELETE FROM cycle_days WHERE cycle_id = ?`, isPostgres), [id]);
            const result = await db.run(sql(`DELETE FROM cycles WHERE id = ? AND user_id = ?`, isPostgres), [id, userId]);
            
            res.status(200).send('Cycle deleted successfully.');
        } catch (err) {
            log('error', `Error in DELETE /api/cycles/${id}:`, err);
            res.status(500).json({ error: 'Failed to delete cycle', details: err.message });
        }
    });

    // Update a specific day's reading
    router.put('/cycles/days/:id', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', `PUT /api/cycles/days/${req.params.id} - Request received.`);
        log('debug', 'Request body:', req.body);
        const { id } = req.params;
        const { hormone_reading, intercourse } = req.body;

        const fieldsToUpdate = [];
        const values = [];

        if (hormone_reading !== undefined) {
            fieldsToUpdate.push('hormone_reading = ?');
            values.push(hormone_reading);
        }
        if (intercourse !== undefined) {
            fieldsToUpdate.push('intercourse = ?');
            values.push(intercourse ? 1 : 0);
        }

        if (fieldsToUpdate.length === 0) {
            return res.status(400).send('No updateable fields provided.');
        }

        values.push(id); // Add the ID for the WHERE clause

        try {
            const updateSql = sql(`UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`, isPostgres);
            const result = await db.run(updateSql, values);
            
            if (result.changes === 0) {
                return res.status(404).send('Reading not found.');
            }
            res.status(200).json({ id, message: 'Reading updated.' });
        } catch (err) {
            log('error', `Error in PUT /api/cycles/days/${id}:`, err);
            res.status(500).json({ error: 'Failed to update reading', details: err.message });
        }
    });

    // Delete a specific day's reading
    router.delete('/cycles/days/:id', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', `DELETE /api/cycles/days/${req.params.id} - Request received.`);
        const { id } = req.params;
        try {
            const result = await db.run(sql(`DELETE FROM cycle_days WHERE id = ?`, isPostgres), [id]);
            if (result.changes === 0) {
                return res.status(404).send('Reading not found.');
            }
            res.status(204).send();
        } catch (err) {
            log('error', `Error in DELETE /api/cycles/days/${id}:`, err);
            res.status(500).json({ error: 'Failed to delete reading', details: err.message });
        }
    });

    // Clear all data for the user
    router.delete('/data', async (req, res) => {
        // DEBUG: Do not remove these logs
        log('info', `DELETE /api/data - Request received for user ${req.user.id}.`);
        const userId = req.user.id;
        try {
            const cycles = await db.query(sql(`SELECT id FROM cycles WHERE user_id = ?`, isPostgres), [userId]);
            const cycleIds = cycles.map(c => c.id);
            if (cycleIds.length > 0) {
                const placeholders = cycleIds.map(() => '?').join(',');
                await db.run(sql(`DELETE FROM cycle_days WHERE cycle_id IN (${placeholders})`, isPostgres), cycleIds);
                await db.run(sql(`DELETE FROM cycles WHERE user_id = ?`, isPostgres), [userId]);
            }
            res.status(204).send();
        } catch (err) {
            log('error', 'Error in DELETE /api/data:', err);
            res.status(500).json({ error: 'Failed to clear data', details: err.message });
        }
    });

    return router;
}

module.exports = apiRouter;
