const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const apiRouter = require('./api');
require('./auth'); // Configure Passport strategies

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Session middleware
app.use(session({
    secret: 'your_secret_key', // Replace with a real secret in a production environment
    resave: false,
    saveUninitialized: true,
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        // Successful authentication, redirect to the app.
        res.redirect('/app');
    }
);

app.get('/logout', (req, res) => {
    req.logout(err => {
        if (err) {
            return next(err);
        }
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

// API routes
app.use('/api', ensureAuthenticated, apiRouter);

// Serve app.html for authenticated users
app.get('/app', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app.html'));
});

// Serve index.html for the root path
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/app');
    } else {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    }
});

// Start server
app.listen(port, () => {
  console.log(`Rhythm app listening at http://localhost:${port}`);
});
