require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
// const { initializeDatabase } = require('./database');
// const { loadSecrets } = require('./secrets');
// const apiRouter = require('./api');

const app = express();
const port = process.env.PORT;

console.log("--- DIAGNOSTIC MODE: Bypassing database and auth. ---");

// Health check endpoint
app.get('/_health', (req, res) => {
    res.status(200).send('OK - DIAGNOSTIC MODE');
});

// Serve a simple index page
app.get('/', (req, res) => {
    res.status(200).send('Diagnostic server is running.');
});


if (!port) {
    console.error('FATAL: PORT environment variable is not defined.');
    process.exit(1);
}

app.listen(port, () => {
    console.log(`Diagnostic server listening on port ${port}`);
});

module.exports = { app, startServer };
