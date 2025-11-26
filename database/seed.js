const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Chance = require('chance');

const chance = new Chance();
const dbPath = path.resolve(__dirname, 'rhythm.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the rhythm database.');
});

const seedData = () => {
    db.serialize(() => {
        db.run(`DELETE FROM cycle_days`);
        db.run(`DELETE FROM cycles`);

        let currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 365); // Start a year ago
        const totalCycles = 10;
        let cyclesCompleted = 0;

        const allDone = () => {
            cyclesCompleted++;
            if (cyclesCompleted === totalCycles) {
                db.close((err) => {
                    if (err) {
                        console.error('Error closing db:', err.message);
                    }
                    console.log('Closed the database connection.');
                });
            }
        };

        for (let i = 0; i < totalCycles; i++) {
            const cycleLength = chance.integer({ min: 28, max: 32 });
            const peakDay = chance.integer({ min: 11, max: 14 }); // Start pattern on day 12, 13, 14, or 15
            const startDate = new Date(currentDate);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + cycleLength - 1);
            const startDateString = startDate.toISOString().split('T')[0];
            const endDateString = endDate.toISOString().split('T')[0];

            db.run(`INSERT INTO cycles (start_date, end_date) VALUES (?, ?)`, [startDateString, endDateString], function(err) {
                if (err) {
                    console.error('Error inserting cycle:', err.message);
                    return;
                }
                const cycleId = this.lastID;
                let daysInserted = 0;

                for (let day = 0; day < cycleLength; day++) {
                    const readingDate = new Date(startDate);
                    readingDate.setDate(startDate.getDate() + day);
                    const readingDateString = readingDate.toISOString().split('T')[0];
                    let hormoneReading = 'Low';

                    if (day >= peakDay && day < peakDay + 5) {
                        const pattern = ['Peak', 'Peak', 'High', 'Low', 'Low'];
                        hormoneReading = pattern[day - peakDay];
                    }

                    db.run(`INSERT INTO cycle_days (cycle_id, date, hormone_reading) VALUES (?, ?, ?)`, [cycleId, readingDateString, hormoneReading], (err) => {
                        if (err) {
                            console.error('Error inserting day:', err.message);
                        }
                        daysInserted++;
                        if (daysInserted === cycleLength) {
                            allDone();
                        }
                    });
                }
            });

            currentDate.setDate(currentDate.getDate() + cycleLength);
        }
    });
};

seedData();
