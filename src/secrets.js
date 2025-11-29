const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

/**
 * Accesses the latest version of a secret from Google Cloud Secret Manager.
 * @param {string} name - The name of the secret to access.
 * @returns {Promise<string>} A promise that resolves with the secret value.
 */
async function accessSecretVersion(name) {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: `projects/rhythm-479516/secrets/${name}/versions/latest`,
    });
    return version.payload.data.toString('utf8');
}

/**
 * Loads application secrets either from local .env file or from Google Cloud Secret Manager
 * based on the NODE_ENV environment variable.
 * @returns {Promise<object>} A promise that resolves with an object containing the application secrets.
 */
async function loadSecrets() {
    if (process.env.NODE_ENV !== 'production') {
        console.log('Loading secrets from .env file for local development...');
        return {
            DB_ADAPTER: process.env.DB_ADAPTER,
            DB_NAME: process.env.DB_NAME,
            DB_USER: process.env.DB_USER,
            DB_PASSWORD: process.env.DB_PASSWORD,
            DB_HOST: process.env.DB_HOST,
            DB_PORT: process.env.DB_PORT,
            GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
            AUTHORIZED_USERS: process.env.AUTHORIZED_USERS,
            SESSION_SECRET: process.env.SESSION_SECRET
        };
    }

    console.log('Loading secrets from Google Cloud Secret Manager...');
    try {
        const secretNames = [
            'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST',
            'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
            'AUTHORIZED_USERS', 'SESSION_SECRET', 'INSTANCE_CONNECTION_NAME'
        ];

        const secretPromises = secretNames.map(name => accessSecretVersion(name));
        const secretValues = await Promise.all(secretPromises);

        const secrets = secretNames.reduce((acc, name, index) => {
            acc[name] = secretValues[index];
            return acc;
        }, {});
        
        secrets.DB_ADAPTER = 'postgres';
        console.log('Secrets loaded successfully.');
        return secrets;
    } catch (error) {
        console.error('Failed to load secrets:', error);
        process.exit(1);
    }
}

module.exports = { loadSecrets };
