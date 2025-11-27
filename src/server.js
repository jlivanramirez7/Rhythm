console.log("--- NodeJS process started ---");
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const { initializeDatabase } = require('./database');
const { loadSecrets } = require('./secrets');
const apiRouter = require('./api');

const app = express();
const port = process.env.PORT;

// Middleware to protect routes
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
};

async function startServer(db) {
    if (process.env.NODE_ENV === 'production') {
        await loadSecrets();
    }

    require('./auth')(db); // Configure Passport strategies

    // Middleware
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../public')));
    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    }));
    app.use(passport.initialize());
    app.use(passport.session());

    // Auth routes
    app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
    app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
        res.redirect('/app');
    });
    app.get('/logout', (req, res, next) => {
        req.logout((err) => {
            if (err) { return next(err); }
            res.redirect('/');
        });
    });

    // Health check endpoint
    app.get('/_health', (req, res) => {
        res.status(200).send('OK');
    });

    // API routes
    app.use('/api', ensureAuthenticated, apiRouter(db));

    // Serve app
    app.get('/app', ensureAuthenticated, (req, res) => {
        res.sendFile(path.join(__dirname, '../public/app.html'));
    });

    // Serve index
    app.get('/', (req, res) => {
        if (req.isAuthenticated()) {
            res.redirect('/app');
        } else {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        }
    });

    if (require.main === module) {
        if (!port) {
            console.error('FATAL: PORT environment variable is not defined.');
            process.exit(1);
        }
        app.listen(port, () => {
            console.log(`Rhythm app listening on port ${port}`);
        });
    }
}

// Start the server only if this file is run directly (not when imported as a module in tests)
if (process.env.NODE_ENV !== 'test') {
    (async () => {
        try {
            const db = await initializeDatabase();
            await startServer(db);
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    })();
}

module.exports = { app, startServer };
