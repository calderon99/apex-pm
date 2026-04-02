const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('./db');

function setupAuth(app, sessionMiddleware) {
  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Google OAuth (only if credentials are configured) ────
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled');
  } else {
  passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.APP_URL + '/auth/google/callback',
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email from Google'));

      const existing = await query(
        'SELECT * FROM users WHERE provider = $1 AND provider_id = $2',
        ['google', profile.id]
      );

      if (existing.rows.length > 0) {
        // Update name/avatar in case they changed
        const updated = await query(
          `UPDATE users SET name=$1, avatar_url=$2, updated_at=NOW()
           WHERE id=$3 RETURNING *`,
          [profile.displayName, profile.photos?.[0]?.value, existing.rows[0].id]
        );
        return done(null, updated.rows[0]);
      }

      // Create new user
      const created = await query(
        `INSERT INTO users (email, name, avatar_url, provider, provider_id)
         VALUES ($1, $2, $3, 'google', $4)
         ON CONFLICT (email) DO UPDATE
           SET provider='google', provider_id=$4, name=$2, avatar_url=$3, updated_at=NOW()
         RETURNING *`,
        [email, profile.displayName, profile.photos?.[0]?.value, profile.id]
      );

      // Auto-create a default portfolio for new users
      const user = created.rows[0];
      const portfolioCheck = await query(
        'SELECT id FROM portfolios WHERE owner_id = $1 LIMIT 1',
        [user.id]
      );
      if (portfolioCheck.rows.length === 0) {
        const portfolio = await query(
          `INSERT INTO portfolios (owner_id, name, description)
           VALUES ($1, $2, $3) RETURNING id`,
          [user.id, `${profile.displayName.split(' ')[0]}'s Portfolio`, 'My project portfolio']
        );
        // Also create membership record
        await query(
          `INSERT INTO memberships (user_id, resource_type, resource_id, role)
           VALUES ($1, 'portfolio', $2, 'owner')`,
          [user.id, portfolio.rows[0].id]
        );
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));
  } // end Google OAuth conditional

  // ── Session serialization ─────────────────────────────────
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || false);
    } catch (err) {
      done(err);
    }
  });

  // ── Auth routes ───────────────────────────────────────────
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login?error=1' }),
    (req, res) => res.redirect('/')
  );

  app.get('/auth/logout', (req, res) => {
    req.logout(() => res.redirect('/login'));
  });

  // ── Auth guard middleware ─────────────────────────────────
  app.use((req, res, next) => {
    const open = ['/login', '/auth/', '/api/'];
    if (open.some(p => req.path.startsWith(p))) return next();
    if (req.user) return next();
    if (req.path === '/') return res.sendFile(__dirname + '/login.html');
    res.redirect('/login');
  });
}

module.exports = { setupAuth };
