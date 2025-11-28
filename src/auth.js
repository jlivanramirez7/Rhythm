const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

module.exports = (db, secrets) => {
    const authorizedUsers = secrets.AUTHORIZED_USERS ? secrets.AUTHORIZED_USERS.split(',') : [];

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
        const email = profile.emails[0].value;
        const googleId = profile.id;
        const name = profile.displayName;

        if (db.adapter === 'postgres') {
            let user = await db.get('SELECT * FROM users WHERE google_id = $1', [googleId]);

            if (user) {
                return cb(null, user);
            } else {
                const result = await db.run(
                    'INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING id',
                    [googleId, email, name]
                );
                user = await db.get('SELECT * FROM users WHERE id = $1', [result.lastID]);
                return cb(null, user);
            }
        } else {
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
            let user;
            if (db.adapter === 'postgres') {
                user = await db.get('SELECT * FROM users WHERE id = $1', [id]);
            } else {
                user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
            }
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
};
