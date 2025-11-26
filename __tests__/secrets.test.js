const { loadSecrets } = require('../src/secrets');

// Mock the Google Cloud Secret Manager client
jest.mock('@google-cloud/secret-manager', () => ({
    SecretManagerServiceClient: jest.fn(() => ({
        accessSecretVersion: jest.fn((request) => {
            const secretName = request.name.split('/')[3];
            const mockSecrets = {
                DB_PASSWORD: 'mock_db_password',
                GOOGLE_CLIENT_ID: 'mock_google_client_id',
                GOOGLE_CLIENT_SECRET: 'mock_google_client_secret',
                AUTHORIZED_USERS: 'mock_user@example.com',
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
    // Store original process.env values
    const originalEnv = { ...process.env };

    afterEach(() => {
        // Restore original process.env after each test
        process.env = { ...originalEnv };
    });

    it('should load secrets into process.env', async () => {
        await loadSecrets();

        expect(process.env.DB_PASSWORD).toBe('mock_db_password');
        expect(process.env.GOOGLE_CLIENT_ID).toBe('mock_google_client_id');
        expect(process.env.GOOGLE_CLIENT_SECRET).toBe('mock_google_client_secret');
        expect(process.env.AUTHORIZED_USERS).toBe('mock_user@example.com');
    });
});
