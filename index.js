const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const path = require('path');
const { pool } = require('./db');
const { setupAuth } = require('./auth');
const apiRoutes = require('./routes/api');

const app = express();
app.use(express.json());

// ── Session middleware (stored in PostgreSQL) ─────────────
const sessionMiddleware = session({
  store: new PgSession({ pool, tableName: 'sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'apex-dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,      // set true when behind HTTPS in production
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
  }
});

// ── Derive app URL from environment ───────────────────────
if (!process.env.APP_URL) {
  const domain = process.env.REPLIT_DEV_DOMAIN || `localhost:5000`;
  process.env.APP_URL = `https://${domain}`;
}

// ── Auth (Google OAuth + guards) ─────────────────────────
setupAuth(app, sessionMiddleware);

// ── API routes ────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── Static files (served after auth guard) ────────────────
app.use(express.static(path.join(__dirname), {
  index: false   // don't auto-serve index.html — let auth guard handle /
}));

// ── Serve the main app (requires auth) ───────────────────
app.get('/', (req, res) => {
  if (!req.user) return res.sendFile(path.join(__dirname, 'login.html'));
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Login page (public) ───────────────────────────────────
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// ── AI proxy (requires auth) ──────────────────────────────
app.post('/chat', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: req.body.system,
        messages: req.body.messages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(5000, '0.0.0.0', () => console.log('Apex running on port 5000'));
