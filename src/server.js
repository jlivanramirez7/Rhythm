const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const apiRouter = require('./api');
require('./auth');
require('dotenv').config();

const app = express();
const port = 3000;

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
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect to app.
    res.redirect('/app');
  });

app.get('/logout', function(req, res, next){
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// API routes
app.use('/api', ensureAuthenticated, apiRouter);
console.log('API routes mounted at /api');

// Serve welcome.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/welcome.html'));
});

app.get('/app', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app.html'));
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/');
}

// Start server
app.listen(port, () => {
  console.log(`Rhythm app listening at http://localhost:${port}`);
});
