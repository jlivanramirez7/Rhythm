const express = require('express');
const router = express.Router();
const db = require('./db');
const isProduction = process.env.NODE_ENV === 'production';

// Helper to adjust SQL queries for different databases
const sql = (query) => {
    if (isProduction) {
        // Use $1, $2, etc. for PostgreSQL
        return query.replace(/\?/g, (match, index) => `$${index / 2 + 1}`);
    }
    // Use ? for SQLite
    return query;
};

// Create a new cycle
router.post('/cycles', async (req, res) => {
    const { start_date } = req.body;
    if (!start_date) {
        return res.status(400).send('start_date is required');
    }

    try {
        const findPreviousCycleSql = sql(`SELECT id FROM cycles WHERE end_date IS NULL ORDER BY start_date DESC LIMIT 1`);
        const previousCycle = await db.get(findPreviousCycleSql);

        const formattedStartDate = start_date;

        const insertNewCycle = async () => {
            const insertCycleSql = sql(`INSERT INTO cycles (start_date) VALUES (?) RETURNING id`);
            const result = await db.run(insertCycleSql, [formattedStartDate]);
            const newCycleId = isProduction ? result.lastID : result.lastID;
            
            const insertDay1Sql = sql(`INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, NULL, 0)`);
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
        console.error(err.message);
        res.status(500).json({ error: 'Failed to create a new cycle' });
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
        console.error(err.message);
        res.status(500).json({ error: 'Failed to process daily reading' });
    }
});

// Get all cycles with their days
router.get('/cycles', async (req, res) => {
    try {
        const cyclesSql = sql(`SELECT * FROM cycles ORDER BY start_date DESC`);
        const cycles = await db.query(cyclesSql);

        for (const cycle of cycles) {
            const daysSql = sql(`SELECT * FROM cycle_days WHERE cycle_id = ? ORDER BY date`);
            cycle.days = await db.query(daysSql, [cycle.id]);
        }
        
        res.json(cycles);
    } catch (err) {
        console.error('GET /api/cycles: Database error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get analytics
router.get('/analytics', async (req, res) => {
    try {
        const analytics = {};
        
        let cycleLengthSql;
        if(isProduction) {
            cycleLengthSql = `SELECT (end_date - start_date + 1) as length FROM cycles WHERE end_date IS NOT NULL`;
        } else {
            cycleLengthSql = `SELECT CAST(julianday(end_date) - julianday(start_date) + 1 AS INTEGER) as length FROM cycles WHERE end_date IS NOT NULL`;
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
        console.error('Analytics error:', err.message);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});


// Delete a cycle and all its readings
router.delete('/cycles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.run(sql(`DELETE FROM cycle_days WHERE cycle_id = ?`), [id]);
        const result = await db.run(sql(`DELETE FROM cycles WHERE id = ?`), [id]);
        
        if (result.changes === 0) {
            return res.status(404).send('Cycle not found.');
        }
        res.status(200).send('Cycle deleted successfully.');
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to delete cycle' });
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
        const updateSql = sql(`UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`);
        const result = await db.run(updateSql, values);
        
        if (result.changes === 0) {
            return res.status(404).send('Reading not found.');
        }
        res.status(200).json({ id, message: 'Reading updated.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to update reading' });
    }
});

module.exports = router;
