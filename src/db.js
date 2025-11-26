const db = require('./database');
const isProduction = process.env.NODE_ENV === 'production';

// A simple query function that returns a promise
const query = async (sql, params = []) => {
    if (isProduction) {
        const { rows } = await db.query(sql, params);
        return rows;
    } else {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

const get = async (sql, params = []) => {
    if (isProduction) {
        const { rows } = await db.query(sql, params);
        return rows[0];
    } else {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }
};

const run = async (sql, params = []) => {
    if (isProduction) {
        // For pg, we will use RETURNING id for inserts.
        // The result will be in the `rows` property.
        // For updates/deletes, `rowCount` gives the number of changes.
        const { rows, rowCount } = await db.query(sql, params);
        // This is a bit of a hack to mimic sqlite's `this` object.
        return { lastID: rows[0] ? rows[0].id : undefined, changes: rowCount };
    } else {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }
};

const serialize = (fn) => {
    if (!isProduction) {
        db.serialize(fn);
    } else {
        // pg pool handles serialization
        fn();
    }
};

module.exports = { query, get, run, serialize };
