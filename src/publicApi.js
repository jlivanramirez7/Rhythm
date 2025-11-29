const express = require('express');
const router = express.Router();
const { sql } = require('./utils');

const publicApiRouter = (db) => {
    router.post('/register', async (req, res) => {
        console.log('[INFO] /api/register - Request received with body:', req.body);
        const { name, email } = req.body;
        if (!name || !email) {
            console.log('[WARN] /api/register - Bad request: name or email missing.');
            return res.status(400).json({ error: 'Name and email are required.' });
        }

        try {
            const isPostgres = db.adapter === 'postgres';
            console.log('[INFO] /api/register - Checking for existing user with email:', email);
            const existingUser = await db.get(sql('SELECT id FROM users WHERE email = ?', isPostgres), [email]);

            if (existingUser) {
                console.log('[WARN] /api/register - User already exists:', email);
                return res.status(400).json({ error: 'A user with this email already exists.' });
            }

            const placeholderGoogleId = `pending-${Date.now()}`;
            console.log('[INFO] /api/register - Creating new user with placeholder Google ID:', placeholderGoogleId);
            await db.run(
                sql('INSERT INTO users (name, email, google_id, approved) VALUES (?, ?, ?, ?)', isPostgres),
                [name, email, placeholderGoogleId, false]
            );

            res.status(201).json({ message: 'Registration successful. Please wait for admin approval.' });
        } catch (err) {
            console.error('[ERROR] /api/register - Error during registration:', err);
            res.status(500).json({ error: 'An unexpected error occurred.' });
        }
    });

    return router;
};

module.exports = publicApiRouter;
