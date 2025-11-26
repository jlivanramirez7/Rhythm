const express = require('express');
const router = express.Router();
const db = require('./database');

// Create a new cycle
router.post('/cycles', async (req, res) => {
    const { start_date } = req.body;
    if (!start_date) {
        return res.status(400).send('start_date is required');
    }

    try {
        // Find the most recent unfinished cycle
        const findPreviousCycleSql = `SELECT id FROM cycles WHERE end_date IS NULL ORDER BY start_date DESC LIMIT 1`;
        const { rows: [previousCycle] } = await db.query(findPreviousCycleSql);

        const insertNewCycle = async () => {
            const insertCycleSql = `INSERT INTO cycles (start_date) VALUES ($1) RETURNING id`;
            const { rows: [{ id: newCycleId }] } = await db.query(insertCycleSql, [start_date]);

            // Also insert a null reading for Day 1 to ensure it's editable
            const insertDay1Sql = `INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES ($1, $2, NULL, FALSE)`;
            await db.query(insertDay1Sql, [newCycleId, start_date]);

            res.status(201).json({ id: newCycleId, start_date });
        };

        if (previousCycle) {
            const previousCycleEndDate = new Date(start_date);
            previousCycleEndDate.setDate(previousCycleEndDate.getDate() - 1);
            const formattedPreviousCycleEndDate = previousCycleEndDate.toISOString().split('T')[0];

            const updatePreviousCycleSql = `UPDATE cycles SET end_date = $1 WHERE id = $2`;
            await db.query(updatePreviousCycleSql, [formattedPreviousCycleEndDate, previousCycle.id]);
        }

        await insertNewCycle();
    } catch (err) {
        console.error("Error creating new cycle:", err);
        res.status(500).json({ error: err.message });
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
        // Find the cycle that the reading's date falls into.
        const findCycleSql = `
            SELECT id FROM cycles 
            WHERE $1 >= start_date AND (end_date IS NULL OR $1 <= end_date)
            ORDER BY start_date DESC 
            LIMIT 1
        `;
        const { rows: [cycle] } = await db.query(findCycleSql, [date]);

        if (!cycle) {
            return res.status(404).send('No cycle found for the selected date.');
        }

        const cycle_id = cycle.id;
        // Upsert logic
        const upsertSql = `
            INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (cycle_id, date) DO UPDATE SET
                hormone_reading = EXCLUDED.hormone_reading,
                intercourse = EXCLUDED.intercourse
            RETURNING id;
        `;
        const intercourseValue = intercourse ? true : false;
        const { rows: [{ id }] } = await db.query(upsertSql, [cycle_id, date, hormone_reading, intercourseValue]);
        res.status(201).json({ id, message: 'Reading created or updated.' });
    } catch (err) {
        console.error('Error adding or updating daily reading:', err);
        res.status(500).json({ error: err.message });
    }
});

// Add or update daily readings for a date range
router.post('/cycles/days/range', async (req, res) => {
    const { start_date, end_date, hormone_reading } = req.body;
    if (!start_date || !end_date || !hormone_reading) {
        return res.status(400).send('start_date, end_date, and hormone_reading are required');
    }

    try {
        const dates = [];
        let currentDate = new Date(start_date);
        const lastDate = new Date(end_date);

        while (currentDate <= lastDate) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (dates.length === 0) {
            return res.status(200).send('No dates in the provided range.');
        }

        for (const date of dates) {
            const findCycleSql = `
                SELECT id FROM cycles 
                WHERE $1 >= start_date AND (end_date IS NULL OR $1 <= end_date)
                ORDER BY start_date DESC 
                LIMIT 1
            `;
            const { rows: [cycle] } = await db.query(findCycleSql, [date]);

            if (cycle) {
                const cycle_id = cycle.id;
                const upsertSql = `
                    INSERT INTO cycle_days (cycle_id, date, hormone_reading)
                    VALUES ($1, $2, $3)
                    ON CONFLICT (cycle_id, date) DO UPDATE SET
                        hormone_reading = EXCLUDED.hormone_reading;
                `;
                await db.query(upsertSql, [cycle_id, date, hormone_reading]);
            }
        }
        res.status(200).send('Readings for the date range logged successfully.');
    } catch (err) {
        console.error('Error logging date range readings:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get all cycles with their days, sorted by start_date DESC for newest first
router.get('/cycles', async (req, res) => {
    try {
        const sql = `
            SELECT c.id, c.start_date, c.end_date,
                   (SELECT json_agg(
                               json_build_object('id', cd.id, 'date', cd.date, 'hormone_reading', cd.hormone_reading, 'intercourse', cd.intercourse)
                           )
                    FROM cycle_days cd
                    WHERE cd.cycle_id = c.id
                   ) as days
            FROM cycles c
            ORDER BY c.start_date DESC
        `;
        const { rows } = await db.query(sql);
        const cycles = rows.map(row => ({
            ...row,
            days: row.days || []
        }));
        res.json(cycles);
    } catch (err) {
        console.error('GET /api/cycles: Database error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get analytics
router.get('/analytics', async (req, res) => {
    try {
        const analytics = {};
        const cycleLengthSql = `SELECT AVG(end_date - start_date + 1) as average_cycle_length FROM cycles WHERE end_date IS NOT NULL`;
        const { rows: [cycleLength] } = await db.query(cycleLengthSql);
        analytics.averageCycleLength = cycleLength.average_cycle_length ? Math.round(cycleLength.average_cycle_length) : 0;

        const peakDaySql = `
            WITH peak_days AS (
                SELECT c.id, c.start_date, MIN(cd.date) as peak_date
                FROM cycles c
                JOIN cycle_days cd ON c.id = cd.cycle_id
                WHERE cd.hormone_reading = 'Peak'
                GROUP BY c.id, c.start_date
            )
            SELECT AVG(peak_date - start_date + 1) as average_days_to_peak
            FROM peak_days;
        `;
        const { rows: [peakDay] } = await db.query(peakDaySql);
        analytics.averageDaysToPeak = peakDay.average_days_to_peak ? Math.round(peakDay.average_days_to_peak) : 0;

        res.json(analytics);
    } catch (err) {
        console.error('Error getting analytics:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a cycle and all its readings
router.delete('/cycles/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deleteSql = `DELETE FROM cycles WHERE id = $1`;
        const { rowCount } = await db.query(deleteSql, [id]);
        if (rowCount === 0) {
            return res.status(404).send('Cycle not found.');
        }
        res.status(200).send('Cycle deleted successfully.');
    } catch (err) {
        console.error('Error deleting cycle:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete a daily reading
router.delete('/cycles/days/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const deleteSql = `DELETE FROM cycle_days WHERE id = $1`;
        const { rowCount } = await db.query(deleteSql, [id]);
        if (rowCount === 0) {
            return res.status(404).send('Daily reading not found.');
        }
        res.status(200).send('Daily reading deleted successfully.');
    } catch (err) {
        console.error('Error deleting daily reading:', err);
        res.status(500).json({ error: err.message });
    }
});

// Update a daily reading
router.put('/cycles/days/:id', async (req, res) => {
    const { id } = req.params;
    const { date, hormone_reading, intercourse } = req.body;

    if (!date && hormone_reading === undefined && intercourse === undefined) {
        return res.status(400).send('At least one field to update is required');
    }

    try {
        const findSql = `SELECT * FROM cycle_days WHERE id = $1`;
        const { rows: [reading] } = await db.query(findSql, [id]);

        if (!reading) {
            return res.status(404).send('Daily reading not found.');
        }

        const newDate = date || reading.date;
        const newHormoneReading = hormone_reading !== undefined ? hormone_reading : reading.hormone_reading;
        const newIntercourse = intercourse !== undefined ? intercourse : reading.intercourse;

        const updateSql = `UPDATE cycle_days SET date = $1, hormone_reading = $2, intercourse = $3 WHERE id = $4`;
        const { rowCount } = await db.query(updateSql, [newDate, newHormoneReading, newIntercourse, id]);

        if (rowCount === 0) {
            return res.status(404).send('Daily reading not found or no changes made.');
        }
        res.status(200).send('Daily reading updated successfully.');
    } catch (err) {
        console.error('Error updating daily reading:', err);
        res.status(500).json({ error: err.message });
    }
});

// Clear all data
router.delete('/data', async (req, res) => {
    try {
        await db.query(`TRUNCATE TABLE cycle_days, cycles RESTART IDENTITY`);
        res.status(200).send('All data cleared successfully.');
    } catch (err) {
        console.error("Error clearing data:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
