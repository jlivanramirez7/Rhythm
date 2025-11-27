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
});
