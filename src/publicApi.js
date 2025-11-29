const express = require('express');
const router = express.Router();
const { sql } = require('./utils');

const publicApiRouter = (db) => {
    router.post('/register', async (req, res) => {
        const { name, email } = req.body;
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required.' });
        }

        try {
            const isPostgres = db.adapter === 'postgres';
            const existingUser = await db.get(sql('SELECT id FROM users WHERE email = ?', isPostgres), [email]);

            if (existingUser) {
                return res.status(400).json({ error: 'A user with this email already exists.' });
            }

            const placeholderGoogleId = `pending-${Date.now()}`;
            await db.run(
                sql('INSERT INTO users (name, email, google_id, approved) VALUES (?, ?, ?, ?)', isPostgres),
                [name, email, placeholderGoogleId, false]
            );

            res.status(201).json({ message: 'Registration successful. Please wait for admin approval.' });
        } catch (err) {
            console.error('Error during registration:', err);
            res.status(500).json({ error: 'An unexpected error occurred.' });
        }
    });

    return router;
};

module.exports = publicApiRouter;
