 const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

async function accessSecretVersion(name) {
    const [version] = await client.accessSecretVersion({
        name: `projects/rhythm-479516/secrets/${name}/versions/latest`,
    });
    return version.payload.data.toString('utf8');
}

async function loadSecrets() {
    console.log('Loading secrets from Google Cloud Secret Manager...');
    try {
        const [dbUser, dbPassword, googleClientId, googleClientSecret, authorizedUsers, sessionSecret] = await Promise.all([
            accessSecretVersion('DB_USER'),
            accessSecretVersion('DB_PASSWORD'),
            accessSecretVersion('GOOGLE_CLIENT_ID'),
            accessSecretVersion('GOOGLE_CLIENT_SECRET'),
            accessSecretVersion('AUTHORIZED_USERS'),
            accessSecretVersion('SESSION_SECRET')
        ]);
        
        console.log('Secrets loaded successfully.');
        return {
            DB_USER: dbUser,
            DB_PASSWORD: dbPassword,
            GOOGLE_CLIENT_ID: googleClientId,
            GOOGLE_CLIENT_SECRET: googleClientSecret,
            AUTHORIZED_USERS: authorizedUsers,
            SESSION_SECRET: sessionSecret
        };
    } catch (error) {
        console.error('Failed to load secrets:', error);
        process.exit(1);
    }
}

module.exports = { loadSecrets };
