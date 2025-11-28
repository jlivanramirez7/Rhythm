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
    if (req.isAuthenticated() || process.env.NODE_ENV !== 'production') {
        return next();
    }
    res.redirect('/');
};

async function main() {
    const secrets = await loadSecrets();
    
    // Pass secrets to the database initialization
    const db = await initializeDatabase(secrets);
    
    require('./auth')(db, secrets);

    // Mock authentication for local development
    if (process.env.NODE_ENV !== 'production') {
        app.use((req, res, next) => {
            req.user = { id: 1, name: 'Test User', email: 'test@example.com' }; // Mock user
            next();
        });
    }

    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../public'), { index: false }));
    app.use(session({
        secret: secrets.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    }));
    app.use(passport.initialize());
    app.use(passport.session());

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

    app.get('/_health', (req, res) => res.status(200).send('OK'));
    
    // Middleware to prevent caching of API responses
    app.use('/api', (req, res, next) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        next();
    });

    app.use('/api', ensureAuthenticated, apiRouter(db));

    app.get('/app', ensureAuthenticated, (req, res) => {
        res.sendFile(path.join(__dirname, '../public/app.html'));
    });
    app.get('/', (req, res) => {
        if (req.isAuthenticated() || process.env.NODE_ENV !== 'production') {
            res.redirect('/app');
        } else {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        }
    });

    if (!port) {
        console.error('FATAL: PORT environment variable is not defined.');
        process.exit(1);
    }
    app.listen(port, () => {
        console.log(`Rhythm app listening on port ${port}`);
    });
}

if (process.env.NODE_ENV !== 'test') {
    main().catch(err => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });
}

module.exports = { app, main };
