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
            const users = await db.query(sql('SELECT id, name, email, is_admin, approved FROM users ORDER BY id', isPostgres));
            res.json(users);
        } catch (err) {
            console.error('Error fetching users for admin:', err);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    router.post('/users/approve/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const isPostgres = db.adapter === 'postgres';
            const result = await db.run(sql('UPDATE users SET approved = true WHERE id = ?', isPostgres), [id]);
            if (result.changes === 0) {
                return res.status(404).send('User not found.');
            }
            res.status(200).json({ message: 'User approved.' });
        } catch (err) {
            console.error('Error approving user:', err);
            res.status(500).json({ error: 'Failed to approve user' });
        }
    });

    router.delete('/users/reject/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const isPostgres = db.adapter === 'postgres';
            const result = await db.run(sql('DELETE FROM users WHERE id = ?', isPostgres), [id]);
            if (result.changes === 0) {
                return res.status(404).send('User not found.');
            }
            res.status(204).send();
        } catch (err) {
            console.error('Error rejecting user:', err);
            res.status(500).json({ error: 'Failed to reject user' });
        }
    });

    return router;
};

module.exports = adminApiRouter;
