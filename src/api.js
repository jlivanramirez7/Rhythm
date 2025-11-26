const express = require('express');
const router = express.Router();
const db = require('./database');

// Create a new cycle
router.post('/cycles', (req, res) => {
    const { start_date } = req.body;
    if (!start_date) {
        return res.status(400).send('start_date is required');
    }

    // Find the most recent unfinished cycle
    const findPreviousCycleSql = `SELECT id FROM cycles WHERE end_date IS NULL ORDER BY start_date DESC LIMIT 1`;
    db.get(findPreviousCycleSql, [], (err, previousCycle) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // The date from the input is already in 'YYYY-MM-DD' format. No conversion needed.
        const formattedStartDate = start_date;

        const insertNewCycle = () => {
            const insertCycleSql = `INSERT INTO cycles (start_date) VALUES (?)`;
            db.run(insertCycleSql, [formattedStartDate], function(err) {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                const newCycleId = this.lastID;
                // Also insert a null reading for Day 1 to ensure it's editable
                const insertDay1Sql = `INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, NULL, 0)`;
                db.run(insertDay1Sql, [newCycleId, formattedStartDate], function(err) {
                    if (err) {
                        // If this fails, the cycle is still created, but log it.
                        console.error("Error creating placeholder for Day 1:", err.message);
                    }
                    res.status(201).json({ id: newCycleId, start_date: formattedStartDate });
                });
            });
        };

        if (previousCycle) {
            const previousCycleEndDate = new Date(formattedStartDate);
            previousCycleEndDate.setDate(previousCycleEndDate.getDate() - 1);
            const formattedPreviousCycleEndDate = previousCycleEndDate.toISOString().split('T')[0];
            console.log(`Ending previous cycle ${previousCycle.id} with end_date: ${formattedPreviousCycleEndDate}`);

            const updatePreviousCycleSql = `UPDATE cycles SET end_date = ? WHERE id = ?`;
            db.run(updatePreviousCycleSql, [formattedPreviousCycleEndDate, previousCycle.id], function(err) {
                if (err) {
                    console.error("Error ending previous cycle:", err.message);
                }
                insertNewCycle(); // Call insert after updating previous cycle
            });
        } else {
            insertNewCycle(); // No previous cycle to end, just insert new one
        }
    });
});

// Add or update a daily reading
router.post('/cycles/days', (req, res) => {
    let { date, hormone_reading, intercourse } = req.body;

    if (hormone_reading === '') {
        hormone_reading = null;
    }

    if (!date || (hormone_reading === undefined && intercourse === undefined)) {
        return res.status(400).send('date and either hormone_reading or intercourse are required');
    }

    date = new Date(date).toISOString().split('T')[0];

    // Find the cycle that the reading's date falls into.
    const findCycleSql = `
        SELECT id FROM cycles 
        WHERE ? >= start_date AND (end_date IS NULL OR ? <= end_date)
        ORDER BY start_date DESC 
        LIMIT 1
    `;
    db.get(findCycleSql, [date, date], (err, cycle) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!cycle) {
            return res.status(404).send('No cycle found for the selected date.');
        }

        const cycle_id = cycle.id;
        // Upsert logic: Update if a reading for this date in this cycle exists, otherwise insert.
        const findExistingSql = `SELECT id FROM cycle_days WHERE cycle_id = ? AND date = ?`;
        db.get(findExistingSql, [cycle_id, date], (err, existingReading) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

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
                    const updateSql = `UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
                    db.run(updateSql, values, function(err) {
                        if (err) { return res.status(500).json({ error: err.message }); }
                        res.status(200).json({ id: existingReading.id, message: 'Reading updated.' });
                    });
                } else {
                    res.status(200).json({ id: existingReading.id, message: 'No changes provided.' });
                }
            } else {
                const intercourseValue = intercourse ? 1 : 0;
                const insertSql = `INSERT INTO cycle_days (cycle_id, date, hormone_reading, intercourse) VALUES (?, ?, ?, ?)`;
                db.run(insertSql, [cycle_id, date, hormone_reading, intercourseValue], function(err) {
                    if (err) { return res.status(500).json({ error: err.message }); }
                    res.status(201).json({ id: this.lastID, message: 'Reading created.' });
                });
            }
        });
    });
});

// Add or update daily readings for a date range
router.post('/cycles/days/range', (req, res) => {
    const { start_date, end_date, hormone_reading } = req.body;
    if (!start_date || !end_date || !hormone_reading) {
        return res.status(400).send('start_date, end_date, and hormone_reading are required');
    }

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

    db.serialize(() => {
        const processDate = (index) => {
            if (index >= dates.length) {
                return res.status(200).send('Readings for the date range logged successfully.');
            }

            const date = dates[index];
            const findCycleSql = `
                SELECT id FROM cycles 
                WHERE ? >= start_date AND (end_date IS NULL OR ? <= end_date)
                ORDER BY start_date DESC 
                LIMIT 1
            `;

            db.get(findCycleSql, [date, date], (err, cycle) => {
                if (err) {
                    console.error(`Error finding cycle for date ${date}:`, err.message);
                    return processDate(index + 1); // Continue to next date
                }
                if (!cycle) {
                    console.log(`No cycle found for date ${date}. Skipping.`);
                    return processDate(index + 1); // Continue to next date
                }

                const cycle_id = cycle.id;
                const findExistingSql = `SELECT id FROM cycle_days WHERE cycle_id = ? AND date = ?`;
                db.get(findExistingSql, [cycle_id, date], (err, existingReading) => {
                    if (err) {
                        console.error(`Error finding existing reading for date ${date}:`, err.message);
                        return processDate(index + 1); // Continue to next date
                    }

                    if (existingReading) {
                        const updateSql = `UPDATE cycle_days SET hormone_reading = ? WHERE id = ?`;
                        db.run(updateSql, [hormone_reading, existingReading.id], function(err) {
                            if (err) {
                                console.error(`Error updating reading for date ${date}:`, err.message);
                            }
                            processDate(index + 1);
                        });
                    } else {
                        const insertSql = `INSERT INTO cycle_days (cycle_id, date, hormone_reading) VALUES (?, ?, ?)`;
                        db.run(insertSql, [cycle_id, date, hormone_reading], function(err) {
                            if (err) {
                                console.error(`Error inserting reading for date ${date}:`, err.message);
                            }
                            processDate(index + 1);
                        });
                    }
                });
            });
        };

        processDate(0);
    });
});

// Get all cycles with their days, sorted by start_date DESC for newest first
router.get('/cycles', (req, res) => {
    console.log('GET /api/cycles: Request received');
    const sql = `
        SELECT c.id, c.start_date, c.end_date,
               (SELECT json_group_array(
                           json_object('id', cd.id, 'date', cd.date, 'hormone_reading', cd.hormone_reading, 'intercourse', cd.intercourse)
                       )
                FROM cycle_days cd
                WHERE cd.cycle_id = c.id
                ORDER BY cd.date) as days
        FROM cycles c
        ORDER BY c.start_date DESC
    `;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('GET /api/cycles: Database error:', err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`GET /api/cycles: Found ${rows.length} cycles`);
        const cycles = rows.map(row => ({
            ...row,
            days: row.days ? JSON.parse(row.days) : []
        }));
        res.json(cycles);
    });
});

// Get analytics
router.get('/analytics', (req, res) => {
    const analytics = {};
    const cycleLengthSql = `SELECT CAST(julianday(end_date) - julianday(start_date) + 1 AS INTEGER) as length FROM cycles WHERE end_date IS NOT NULL`;

    db.all(cycleLengthSql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (rows.length > 0) {
            const totalDays = rows.reduce((acc, row) => acc + row.length, 0);
            analytics.averageCycleLength = Math.round(totalDays / rows.length);
        } else {
            analytics.averageCycleLength = 0;
        }

        const peakDaySql = `
            SELECT c.start_date, MIN(cd.date) as peak_date
            FROM cycles c
            JOIN cycle_days cd ON c.id = cd.cycle_id
            WHERE cd.hormone_reading = 'Peak'
            GROUP BY c.id
            HAVING peak_date IS NOT NULL
        `;

        db.all(peakDaySql, [], (err, peakRows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

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
        });
    });
});

// Delete a cycle and all its readings
router.delete('/cycles/:id', (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        // First, delete all readings associated with this cycle
        db.run(`DELETE FROM cycle_days WHERE cycle_id = ?`, id, function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
        });

        // Then, delete the cycle itself
        db.run(`DELETE FROM cycles WHERE id = ?`, id, function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).send('Cycle not found.');
            }
            res.status(200).send('Cycle deleted successfully.');
        });
    });
});

// Delete a daily reading
router.delete('/cycles/days/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM cycle_days WHERE id = ?`, id, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).send('Daily reading not found.');
        }
        res.status(200).send('Daily reading deleted successfully.');
    });
});

// Update a daily reading
router.put('/cycles/days/:id', (req, res) => {
    const { id } = req.params;
    const { date, hormone_reading, intercourse } = req.body;

    if (!date && hormone_reading === undefined && intercourse === undefined) {
        return res.status(400).send('At least one field to update is required');
    }

    const fieldsToUpdate = [];
    const values = [];

    if (date) {
        fieldsToUpdate.push('date = ?');
        values.push(date);
    }
    if (hormone_reading !== undefined) {
        fieldsToUpdate.push('hormone_reading = ?');
        values.push(hormone_reading === '' ? null : hormone_reading);
    }
    if (intercourse !== undefined) {
        fieldsToUpdate.push('intercourse = ?');
        values.push(intercourse ? 1 : 0);
    }

    if (fieldsToUpdate.length > 0) {
        values.push(id);
        const updateSql = `UPDATE cycle_days SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        db.run(updateSql, values, function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (this.changes === 0) {
                return res.status(404).send('Daily reading not found or no changes made.');
            }
            res.status(200).send('Daily reading updated successfully.');
        });
    } else {
        res.status(400).send('No valid fields to update were provided.');
    }
});

// Clear all data
router.delete('/data', (req, res) => {
    db.serialize(() => {
        db.run(`DELETE FROM cycle_days`, (err) => {
            if (err) {
                console.error("Error deleting cycle_days data:", err.message);
                return res.status(500).json({ error: err.message });
            }
        });
        db.run(`DELETE FROM cycles`, (err) => {
            if (err) {
                console.error("Error deleting cycles data:", err.message);
                return res.status(500).json({ error: err.message });
            }
            res.status(200).send('All data cleared successfully.');
        });
    });
});

module.exports = router;
