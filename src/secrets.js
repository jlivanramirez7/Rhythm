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
        process.env.DB_USER = await accessSecretVersion('DB_USER');
        process.env.DB_PASSWORD = await accessSecretVersion('DB_PASSWORD');
        process.env.GOOGLE_CLIENT_ID = await accessSecretVersion('GOOGLE_CLIENT_ID');
        process.env.GOOGLE_CLIENT_SECRET = await accessSecretVersion('GOOGLE_CLIENT_SECRET');
        process.env.AUTHORIZED_USERS = await accessSecretVersion('AUTHORIZED_USERS');
        process.env.SESSION_SECRET = await accessSecretVersion('SESSION_SECRET');
        console.log('Secrets loaded successfully.');
    } catch (error) {
        console.error('Failed to load secrets:', error);
        process.exit(1);
    }
}

module.exports = { loadSecrets };
