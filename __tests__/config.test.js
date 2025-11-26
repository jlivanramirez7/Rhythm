const { getDbConfig } = require('../database/seed-cloud.js');

describe('Application Configuration', () => {

    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset process.env before each test
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        // Restore original process.env after all tests
        process.env = { ...originalEnv };
    });

    describe('Database Configuration', () => {
        it('should use Unix socket when INSTANCE_UNIX_SOCKET is set', () => {
            process.env.INSTANCE_UNIX_SOCKET = '/cloudsql/project:region:instance';
            const config = getDbConfig();
            expect(config.host).toBe('/cloudsql/project:region:instance');
            expect(config.port).toBeUndefined();
        });

        it('should use host and port when INSTANCE_UNIX_SOCKET is not set', () => {
            process.env.DB_HOST = 'localhost';
            process.env.DB_PORT = '5432';
            const config = getDbConfig();
            expect(config.host).toBe('localhost');
            expect(config.port).toBe('5432');
        });
    });

    describe('Server Port Configuration', () => {
        beforeEach(() => {
            // Clear the require cache for server.js to get a fresh module for each test
            jest.resetModules();
        });

        it('should use the PORT environment variable when available', () => {
            process.env.PORT = '8080';
            const server = require('../src/server.js');
            const port = server.port;
            expect(port).toBe('8080');
        });

        it('should default to port 3000 when the PORT environment variable is not set', () => {
            delete process.env.PORT;
            const server = require('../src/server.js');
            const port = server.port;
            expect(port).toBe(3000);
        });
    });
});
