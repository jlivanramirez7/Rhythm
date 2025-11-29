/**
 * A helper function to adapt SQL queries for different database dialects.
 * It replaces '?' placeholders with '$1', '$2', etc. for PostgreSQL and
 * adds a 'RETURNING id' clause for INSERT statements.
 * @param {string} query - The SQL query to adapt.
 * @param {boolean} isPostgres - True if the target database is PostgreSQL.
 * @returns {string} The adapted SQL query.
 */
const sql = (query, isPostgres) => {
    let finalQuery = query;
    if (isPostgres) {
        let positional = 0;
        finalQuery = finalQuery.replace(/\?/g, () => `$${++positional}`);
    }
    if (isPostgres && finalQuery.toUpperCase().startsWith('INSERT')) {
        finalQuery += ' RETURNING id';
    }
    return finalQuery;
};

module.exports = { sql };
