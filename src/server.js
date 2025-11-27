require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const { loadSecrets } = require('./secrets');
const apiRouter = require('./api');
const db = require('./database');

const app = express();
const port = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
    loadSecrets();
}
require('./auth'); // Configure Passport strategies

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(session({
    secret: 'your_secret_key',
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

// Middleware to protect routes
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
};

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

// Start server
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Rhythm app listening on port ${port}`);
    });
}

module.exports = { app };
