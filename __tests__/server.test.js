const { app } = require('../src/server.js');
const request = require('supertest');

describe('Server', () => {
    it('should respond to the health check', async () => {
        const response = await request(app).get('/_health');
        expect(response.statusCode).toBe(200);
    });
});
