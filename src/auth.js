const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { sql } = require('./utils');

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
     * @param {boolean} approved - The approval status to set for a new user.
     * @returns {Promise<object>} The user object from the database.
     */
    const findOrCreateUser = async ({ googleId, email, name, approved = false }) => {
        const isPostgres = db.adapter === 'postgres';
        const selectSql = `SELECT * FROM users WHERE google_id = ${isPostgres ? '$1' : '?'}`;
        let user = await db.get(selectSql, [googleId]);

        if (!user) {
            const insertSql = `INSERT INTO users (google_id, email, name, approved) VALUES (${isPostgres ? '$1, $2, $3, $4' : '?, ?, ?, ?'}) ${isPostgres ? 'RETURNING id' : ''}`;
            const result = await db.run(insertSql, [googleId, email, name, approved]);
            const newUserId = isPostgres ? (result.rows && result.rows[0] ? result.rows[0].id : result.lastID) : result.lastID;
            
            const selectNewUserSql = `SELECT * FROM users WHERE id = ${isPostgres ? '$1' : '?'}`;
            user = await db.get(selectNewUserSql, [newUserId]);
        }
        return user;
    };

    passport.use(new GoogleStrategy({
        clientID: secrets.GOOGLE_CLIENT_ID,
        clientSecret: secrets.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.NODE_ENV === 'production' ? 'https://rhythm-632601707892.us-central1.run.app/auth/google/callback' : '/auth/google/callback',
        proxy: true,
        passReqToCallback: true
    },
  async (req, accessToken, refreshToken, profile, cb) => {
    try {
        const isPostgres = db.adapter === 'postgres';
        const email = profile.emails[0].value;
        const googleId = profile.id;

        // Find user by email first
        const userByEmail = await db.get(sql('SELECT * FROM users WHERE email = ?', isPostgres), [email]);

        if (userByEmail) {
            // Ensure existing admins and approved users can always log in
            if (userByEmail.is_admin || userByEmail.approved) {
                // If this is the first Google login for a manually added user, update their google_id
                if (userByEmail.google_id.startsWith('pending-')) {
                    await db.run(sql('UPDATE users SET google_id = ? WHERE id = ?', isPostgres), [googleId, userByEmail.id]);
                    const updatedUser = await db.get(sql('SELECT * FROM users WHERE id = ?', isPostgres), [userByEmail.id]);
                    return cb(null, updatedUser);
                }
                return cb(null, userByEmail);
            }

            // If user is approved and this is their first Google login, update their google_id
            if (userByEmail.google_id.startsWith('pending-')) {
                await db.run(sql('UPDATE users SET google_id = ? WHERE id = ?', isPostgres), [googleId, userByEmail.id]);
                const updatedUser = await db.get(sql('SELECT * FROM users WHERE id = ?', isPostgres), [userByEmail.id]);
                return cb(null, updatedUser);
            }

            // If google_id already matches, this is a normal login
            if (userByEmail.google_id === googleId) {
                return cb(null, userByEmail);
            }
        }

        // If no user is found by email, deny access. Registration must happen first.
        return cb(null, false, { message: 'User not registered.' });

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
