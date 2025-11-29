const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

/**
 * Configures Passport.js for Google OAuth 2.0 authentication.
 * @param {object} db - The database instance.
 * @param {object} secrets - An object containing application secrets.
 */
module.exports = (db, secrets) => {
    const authorizedUsers = secrets.AUTHORIZED_USERS ? secrets.AUTHORIZED_USERS.split(',') : [];

    /**
     * Finds a user by their Google ID or creates a new one if they don't exist.
     * @param {string} googleId - The user's Google profile ID.
     * @param {string} email - The user's email address.
     * @param {string} name - The user's display name.
     * @returns {Promise<object>} The user object from the database.
     */
    const findOrCreateUser = async ({ googleId, email, name }) => {
        const isPostgres = db.adapter === 'postgres';
        const selectSql = `SELECT * FROM users WHERE google_id = ${isPostgres ? '$1' : '?'}`;
        let user = await db.get(selectSql, [googleId]);

        if (!user) {
            const insertSql = `INSERT INTO users (google_id, email, name) VALUES (${isPostgres ? '$1, $2, $3' : '?, ?, ?'}) ${isPostgres ? 'RETURNING id' : ''}`;
            const result = await db.run(insertSql, [googleId, email, name]);
            const newUserId = isPostgres ? result.id : result.lastID;
            user = await db.get(selectSql, [newUserId]);
        }
        return user;
    };

    passport.use(new GoogleStrategy({
        clientID: secrets.GOOGLE_CLIENT_ID,
        clientSecret: secrets.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.NODE_ENV === 'production' ? 'https://rhythm-632601707892.us-central1.run.app/auth/google/callback' : '/auth/google/callback',
        proxy: true
    },
  async (accessToken, refreshToken, profile, cb) => {
    if (authorizedUsers.length > 0 && !authorizedUsers.includes(profile.emails[0].value)) {
      return cb(null, false, { message: 'Unauthorized User' });
    }

    try {
        const user = await findOrCreateUser({
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName
        });
        return cb(null, user);
    } catch (err) {
        return cb(err);
    }
    }
    ));

    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const isPostgres = db.adapter === 'postgres';
            const sql = `SELECT * FROM users WHERE id = ${isPostgres ? '$1' : '?'}`;
            const user = await db.get(sql, [id]);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
};
