const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

async function accessSecretVersion(name) {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: `projects/rhythm-479516/secrets/${name}/versions/latest`,
    });
    return version.payload.data.toString('utf8');
}

async function loadSecrets() {
    // For local development, load from .env file
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

    // For production, load from Google Cloud Secret Manager
    console.log('Loading secrets from Google Cloud Secret Manager...');
    try {
        const [dbUser, dbPassword, dbName, dbHost, googleClientId, googleClientSecret, authorizedUsers, sessionSecret] = await Promise.all([
            accessSecretVersion('DB_USER'),
            accessSecretVersion('DB_PASSWORD'),
            accessSecretVersion('DB_NAME'),
            accessSecretVersion('DB_HOST'),
            accessSecretVersion('GOOGLE_CLIENT_ID'),
            accessSecretVersion('GOOGLE_CLIENT_SECRET'),
            accessSecretVersion('AUTHORIZED_USERS'),
            accessSecretVersion('SESSION_SECRET')
        ]);
        
        console.log('Secrets loaded successfully.');
        return {
            DB_USER: dbUser,
            DB_PASSWORD: dbPassword,
            DB_NAME: dbName,
            DB_HOST: dbHost,
            GOOGLE_CLIENT_ID: googleClientId,
            GOOGLE_CLIENT_SECRET: googleClientSecret,
            AUTHORIZED_USERS: authorizedUsers,
            SESSION_SECRET: sessionSecret,
            DB_ADAPTER: 'postgres' // Assume postgres in production
        };
    } catch (error) {
        console.error('Failed to load secrets:', error);
        process.exit(1);
    }
}

module.exports = { loadSecrets };
