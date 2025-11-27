jest.mock('../src/auth', () => jest.fn());

const { startServer } = require('../src/server');
const { initializeDatabase } = require('../src/database');

describe('Server Startup', () => {
    let originalEnv;
    let mockDb;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation(() => {});
        originalEnv = { ...process.env };

        // Initialize a mock database for the tests
        mockDb = await initializeDatabase();
    });

    afterEach(() => {
        // Restore original console.error and process.exit
        console.error.mockRestore();
        process.exit.mockRestore();
        // Restore original environment variables
        process.env = originalEnv;
    });

    it('should not throw an error when PORT is defined', async () => {
        process.env.PORT = '3000';
        process.env.NODE_ENV = 'test';

        await startServer(mockDb);

        expect(process.exit).not.toHaveBeenCalled();
    });
});
