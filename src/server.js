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

let dbError = null;

async function startServer() {
    if (process.env.NODE_ENV === 'production') {
        await loadSecrets();
    }

    const { db, error } = await initializeDatabase();
    dbError = error; // Store the error if it exists

    if (!dbError) {
        require('./auth')(db); // Configure Passport strategies
    }

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
        if (dbError) {
            res.status(500).json({
                status: 'DATABASE_ERROR',
                error: {
                    message: dbError.message,
                    stack: dbError.stack,
                    code: dbError.code,
                }
            });
        } else {
            res.status(200).send('OK');
        }
    });

    // API routes
    if (!dbError) {
        app.use('/api', ensureAuthenticated, apiRouter(db));
    } else {
        // If the DB is down, prevent access to the API
        app.use('/api', (req, res) => {
            res.status(503).send('Service Unavailable: Database connection failed');
        });
    }

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
    startServer();
}

module.exports = { app, startServer };
