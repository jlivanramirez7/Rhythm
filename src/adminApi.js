const express = require('express');
const router = express.Router();
const { sql } = require('./utils'); // We will create this utility file next

/**
 * @route GET /api/admin/users
 * @description Fetches all users from the database.
 * @access Private (Admin only)
 */
const adminApiRouter = (db) => {
    router.get('/users', async (req, res) => {
        try {
            const isPostgres = db.adapter === 'postgres';
            const users = await db.query(sql('SELECT id, name, email, is_admin FROM users ORDER BY id', isPostgres));
            res.json(users);
        } catch (err) {
            console.error('Error fetching users for admin:', err);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    return router;
};

module.exports = adminApiRouter;
