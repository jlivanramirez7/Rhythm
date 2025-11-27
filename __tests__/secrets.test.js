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
    it('should return an object with loaded secrets', async () => {
        // Since loadSecrets returns the secrets, we capture the return value
        const secrets = await loadSecrets();

        // Assert that the returned object has the correct properties
        expect(secrets.DB_USER).toBe('mock_db_user');
        expect(secrets.DB_PASSWORD).toBe('mock_db_password');
        expect(secrets.GOOGLE_CLIENT_ID).toBe('mock_google_client_id');
        expect(secrets.GOOGLE_CLIENT_SECRET).toBe('mock_google_client_secret');
        expect(secrets.AUTHORIZED_USERS).toBe('mock_user@example.com');
        expect(secrets.SESSION_SECRET).toBe('mock_session_secret');
    });
});
