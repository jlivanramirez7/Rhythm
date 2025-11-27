const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

module.exports = (db, secrets) => {
    const authorizedUsers = secrets.AUTHORIZED_USERS ? secrets.AUTHORIZED_USERS.split(',') : [];

    passport.use(new GoogleStrategy({
        clientID: secrets.GOOGLE_CLIENT_ID,
        clientSecret: secrets.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    proxy: true
  },
  async (accessToken, refreshToken, profile, cb) => {
    if (authorizedUsers.length > 0 && !authorizedUsers.includes(profile.emails[0].value)) {
      return cb(null, false, { message: 'Unauthorized User' });
    }

    try {
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;

        const user = await db.get('SELECT * FROM users WHERE google_id = ?', [googleId]);

        if (user) {
            return cb(null, user);
        } else {
            const result = await db.run(
                'INSERT INTO users (google_id, email, name) VALUES (?, ?, ?)',
                [googleId, email, name]
            );
            const newUser = await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
            return cb(null, newUser);
        }
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
            const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
};
