const { loadSecrets } = require('../src/secrets');

// Mock the Google Cloud Secret Manager client
jest.mock('@google-cloud/secret-manager', () => ({
    SecretManagerServiceClient: jest.fn(() => ({
        accessSecretVersion: jest.fn((request) => {
            const secretName = request.name.split('/')[3];
            const mockSecrets = {
                DB_USER: 'mock_db_user',
                DB_PASSWORD: 'mock_db_password',
                GOOGLE_CLIENT_ID: 'mock_google_client_id',
                GOOGLE_CLIENT_SECRET: 'mock_google_client_secret',
                AUTHORIZED_USERS: 'mock_user@example.com',
                SESSION_SECRET: 'mock_session_secret'
            };
            return Promise.resolve([{
                payload: {
                    data: Buffer.from(mockSecrets[secretName] || ''),
                },
            }]);
        }),
    })),
}));

describe('Secret Manager', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules(); // Most important - it clears the cache
        process.env = { ...OLD_ENV }; // Make a copy
    });

    afterAll(() => {
        process.env = OLD_ENV; // Restore old environment
    });

    it('should return an object with loaded secrets in production', async () => {
        process.env.NODE_ENV = 'production';
        const { loadSecrets } = require('../src/secrets');
        const secrets = await loadSecrets();

        expect(secrets.DB_USER).toBe('mock_db_user');
        expect(secrets.DB_PASSWORD).toBe('mock_db_password');
        expect(secrets.GOOGLE_CLIENT_ID).toBe('mock_google_client_id');
        expect(secrets.GOOGLE_CLIENT_SECRET).toBe('mock_google_client_secret');
        expect(secrets.AUTHORIZED_USERS).toBe('mock_user@example.com');
        expect(secrets.SESSION_SECRET).toBe('mock_session_secret');
    });

    it('should load secrets from environment variables in development', async () => {
        process.env.NODE_ENV = 'development';
        process.env.DB_USER = 'dev_db_user';
        process.env.DB_PASSWORD = 'dev_db_password';
        process.env.GOOGLE_CLIENT_ID = 'dev_google_client_id';
        process.env.GOOGLE_CLIENT_SECRET = 'dev_google_client_secret';
        process.env.AUTHORIZED_USERS = 'dev_user@example.com';
        process.env.SESSION_SECRET = 'dev_session_secret';

        const { loadSecrets } = require('../src/secrets');
        const secrets = await loadSecrets();

        expect(secrets.DB_USER).toBe('dev_db_user');
        expect(secrets.DB_PASSWORD).toBe('dev_db_password');
        expect(secrets.GOOGLE_CLIENT_ID).toBe('dev_google_client_id');
        expect(secrets.GOOGLE_CLIENT_SECRET).toBe('dev_google_client_secret');
        expect(secrets.AUTHORIZED_USERS).toBe('dev_user@example.com');
        expect(secrets.SESSION_SECRET).toBe('dev_session_secret');
    });
});
