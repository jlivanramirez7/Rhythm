const request = require('supertest');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');

// Mock ensureAuthenticated exactly as it appears in server.js
const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'User not authenticated' });
};

describe('Routing logic loop test', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
        app.use(passport.initialize());
        app.use(passport.session());

        // We only mock the root and /app endpoints exactly as in server.js

        // Mock auth states based on special headers for testing
        app.use((req, res, next) => {
            req.isAuthenticated = () => req.headers['x-auth'] === 'true';
            next();
        });

        app.get('/', (req, res) => {
            if (req.isAuthenticated()) {
                res.redirect('/app');
            } else {
                res.send('INDEX');
            }
        });

        app.get('/app', ensureAuthenticated, (req, res) => {
            res.send('APP');
        });

        app.get('/api/me', ensureAuthenticated, (req, res) => {
            res.json({ id: 1 });
        });
    });

    test('Unauthenticated user root goes to index', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
        expect(res.text).toBe('INDEX');
    });

    test('Authenticated user root redirects to /app', async () => {
        const res = await request(app)
            .get('/')
            .set('x-auth', 'true');
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/app');
    });

    test('Unauthenticated user /app receives 401 JSON instead of redirecting (potential bug)', async () => {
        const res = await request(app).get('/app');
        expect(res.statusCode).toBe(401);
    });

    test('Authenticated /api/me receives 200', async () => {
        const res = await request(app)
            .get('/api/me')
            .set('x-auth', 'true');
        expect(res.statusCode).toBe(200);
    });
});
