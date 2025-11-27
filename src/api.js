const express = require('express');
const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

// Helper to adjust SQL queries for different databases
const sql = (query) => {
    if (isProduction) {
        // Use $1, $2, etc. for PostgreSQL
        let i = 0;
        return query.replace(/\?/g, () => `$${++i}`);
    }
    // Use ? for SQLite
    return query;
};

const apiRouter = (db) => {
    // Create a new cycle
    router.post('/cycles', async (req, res) => {
        const { start_date } = req.body;
        const userId = req.user.id;

        if (!start_date) {
            return res.status(400).json({ error: 'start_date is required' });
        }

        try {
            const findPreviousCycleSql = sql(`SELECT id FROM cycles WHERE user_id = ? AND end_date IS NULL ORDER BY start_date DESC LIMIT 1`);
            const previousCycle = await db.get(findPreviousCycleSql, [userId]);

            const formattedStartDate = start_date;

            const insertNewCycle = async () => {
                const insertCycleSql = sql(`INSERT INTO cycles (user_id, start_date) VALUES (?, ?) RETURNING id`);
                const result = await db.run(insertCycleSql, [userId, formattedStartDate]);
                const newCycleId = result.lastID;

                const insertDay1Sql = sql(`INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, NULL, false)`);
                await db.run(insertDay1Sql, [newCycleId, formattedStartDate]);

                res.status(201).json({ id: newCycleId, start_date: formattedStartDate });
            };

            if (previousCycle) {
                const previousCycleEndDate = new Date(formattedStartDate);
                previousCycleEndDate.setDate(previousCycleEndDate.getDate() - 1);
                const formattedPreviousCycleEndDate = previousCycleEndDate.toISOString().split('T')[0];

                const updatePreviousCycleSql = sql(`UPDATE cycles SET end_date = ? WHERE id = ?`);
                await db.run(updatePreviousCycleSql, [formattedPreviousCycleEndDate, previousCycle.id]);
                await insertNewCycle();
            } else {
                await insertNewCycle();
            }
        } catch (err) {
            console.error('Error in POST /api/cycles:', err);
            res.status(500).json({ error: 'Failed to create a new cycle', details: err.message });
        }
    });

    // Add or update a daily reading for a range of dates
    router.post('/cycles/days/range', async (req, res) => {
        const { start_date, end_date, hormone_reading, intercourse } = req.body;

        if (!start_date || !end_date) {
            return res.status(400).send('start_date and end_date are required');
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        try {
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const date = d.toISOString().split('T')[0];
                const findCycleSql = sql(`
                    SELECT id FROM cycles 
                    WHERE ? >= start_date AND (end_date IS NULL OR ? <= end_date)
                    ORDER BY start_date DESC 
                    LIMIT 1
                `);
                const cycle = await db.get(findCycleSql, [date, date]);

                if (cycle) {
                    const cycle_id = cycle.id;
                    const findExistingSql = sql(`SELECT id FROM cycle_days WHERE cycle_id = ? AND date = ?`);
                    const existingReading = await db.get(findExistingSql, [cycle_id, date]);

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
                            const updateSql = sql(`UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`);
                            await db.run(updateSql, values);
                        }
                    } else {
                        const intercourseValue = intercourse ? 1 : 0;
                        const insertSql = sql(`INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, ?, ?) RETURNING id`);
                        await db.run(insertSql, [cycle_id, date, hormone_reading, intercourseValue]);
                    }
                }
            }
            res.status(201).json({ message: 'Readings for the date range logged successfully!' });
        } catch (err) {
            console.error('Error in POST /api/cycles/days/range:', err);
            res.status(500).json({ error: 'Failed to process date range readings', details: err.message });
        }
    });

    // Add or update a daily reading
    router.post('/cycles/days', async (req, res) => {
        let { date, hormone_reading, intercourse } = req.body;

        if (hormone_reading === '') {
            hormone_reading = null;
        }

        if (!date || (hormone_reading === undefined && intercourse === undefined)) {
            return res.status(400).send('date and either hormone_reading or intercourse are required');
        }

        date = new Date(date).toISOString().split('T')[0];

        try {
            const findCycleSql = sql(`
                SELECT id FROM cycles 
                WHERE ? >= start_date AND (end_date IS NULL OR ? <= end_date)
                ORDER BY start_date DESC 
                LIMIT 1
            `);
            const cycle = await db.get(findCycleSql, [date, date]);

            if (!cycle) {
                return res.status(404).send('No cycle found for the selected date.');
            }

            const cycle_id = cycle.id;
            const findExistingSql = sql(`SELECT id FROM cycle_days WHERE cycle_id = ? AND date = ?`);
            const existingReading = await db.get(findExistingSql, [cycle_id, date]);

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
                    const updateSql = sql(`UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`);
                    await db.run(updateSql, values);
                    res.status(200).json({ id: existingReading.id, message: 'Reading updated.' });
                } else {
                    res.status(200).json({ id: existingReading.id, message: 'No changes provided.' });
                }
            } else {
                const intercourseValue = intercourse ? 1 : 0;
                const insertSql = sql(`INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, ?, ?) RETURNING id`);
                const result = await db.run(insertSql, [cycle_id, date, hormone_reading, intercourseValue]);
                res.status(201).json({ id: result.lastID, message: 'Reading created.' });
            }
        } catch (err) {
            console.error('Error in POST /api/cycles/days:', err);
            res.status(500).json({ error: 'Failed to process daily reading', details: err.message });
        }
    });

    // Get all cycles with their days
    router.get('/cycles', async (req, res) => {
        const userId = req.user.id;
        try {
            const cyclesSql = sql(`SELECT * FROM cycles WHERE user_id = ? ORDER BY start_date DESC`);
            const cycles = await db.query(cyclesSql, [userId]);

            for (const cycle of cycles) {
                const daysSql = sql(`SELECT * FROM cycle_days WHERE cycle_id = ? ORDER BY date`);
                const days = await db.query(daysSql, [cycle.id]);
                
                const filledDays = [];
                const lastDate = days.length > 0
                    ? new Date(Math.max(...days.map(d => new Date(d.date))))
                    : new Date(cycle.start_date);

                const startDate = new Date(cycle.start_date);
                let currentDate = new Date(startDate);
                
                while (currentDate <= lastDate) {
                    const dateStr = currentDate.toISOString().split('T')[0];
                    const existingDay = days.find(d => d.date === dateStr);
                    if (existingDay) {
                        filledDays.push(existingDay);
                    } else {
                        filledDays.push({
                            cycle_id: cycle.id,
                            date: dateStr,
                            hormone_reading: null,
                            intercourse: 0,
                        });
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                // If there are no readings, ensure at least the start day is shown.
                if (filledDays.length === 0) {
                    filledDays.push({
                        cycle_id: cycle.id,
                        date: cycle.start_date,
                        hormone_reading: null,
                        intercourse: 0,
                    });
                }
                cycle.days = filledDays;
            }
    
            res.json(cycles);
        } catch (err) {
            console.error('Error in GET /api/cycles:', err);
            res.status(500).json({ error: 'Failed to fetch cycles', details: err.message });
        }
    });

    // Get analytics
    router.get('/analytics', async (req, res) => {
        try {
            const analytics = {};
            
            let cycleLengthSql;
            if(isProduction) {
                cycleLengthSql = `SELECT (end_date - start_date + 1) as length FROM cycles WHERE user_id = ${req.user.id} AND end_date IS NOT NULL`;
            } else {
                cycleLengthSql = `SELECT CAST(julianday(end_date) - julianday(start_date) + 1 AS INTEGER) as length FROM cycles WHERE user_id = ${req.user.id} AND end_date IS NOT NULL`;
            }

            const cycleLengths = await db.query(cycleLengthSql);

            if (cycleLengths.length > 0) {
                const totalDays = cycleLengths.reduce((acc, row) => acc + row.length, 0);
                analytics.averageCycleLength = Math.round(totalDays / cycleLengths.length);
            } else {
                analytics.averageCycleLength = 0;
            }

            let peakDaySql;
            if (isProduction) {
                peakDaySql = `
                    SELECT c.start_date, MIN(cd.date) as peak_date
                    FROM cycles c
                    JOIN cycle_days cd ON c.id = cd.cycle_id
                    WHERE cd.hormone_reading = 'Peak'
                    GROUP BY c.id, c.start_date
                    HAVING MIN(cd.date) IS NOT NULL
                `;
            } else {
                peakDaySql = `
                    SELECT c.start_date, MIN(cd.date) as peak_date
                    FROM cycles c
                    JOIN cycle_days cd ON c.id = cd.cycle_id
                    WHERE cd.hormone_reading = 'Peak'
                    GROUP BY c.id
                    HAVING peak_date IS NOT NULL
                `;
            }

            const peakRows = await db.query(peakDaySql);

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
            console.error('Error in GET /api/analytics:', err);
            res.status(500).json({ error: 'Failed to fetch analytics', details: err.message });
        }
    });

    // Delete a cycle and all its readings
    router.delete('/cycles/:id', async (req, res) => {
        const { id } = req.params;
        const userId = req.user.id;
        try {
            await db.run(sql(`DELETE FROM cycle_days WHERE cycle_id = ?`), [id]);
            const result = await db.run(sql(`DELETE FROM cycles WHERE id = ? AND user_id = ?`), [id, userId]);
            
            res.status(200).send('Cycle deleted successfully.');
        } catch (err) {
            console.error('Error in DELETE /api/cycles/:id:', err);
            res.status(500).json({ error: 'Failed to delete cycle', details: err.message });
        }
    });

    // Update a specific day's reading
    router.put('/cycles/days/:id', async (req, res) => {
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
            const updateSql = sql(`UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ? RETURNING id`);
            const result = await db.run(updateSql, values);
            
            if (result.changes === 0) {
                return res.status(404).send('Reading not found.');
            }
            res.status(200).json({ id, message: 'Reading updated.' });
        } catch (err) {
            console.error('Error in PUT /api/cycles/days/:id:', err);
            res.status(500).json({ error: 'Failed to update reading', details: err.message });
        }
    });

    return router;
}

module.exports = apiRouter;
